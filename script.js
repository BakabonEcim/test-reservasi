// ==================== KONFIGURASI FIREBASE ====================
const firebaseConfig = {
    apiKey: "AIzaSyAqb4sr3rDjuERBh2iyS6nrMbnBKZ1Pgfs",
    authDomain: "reservasi-cc592.firebaseapp.com",
    projectId: "reservasi-cc592",
    storageBucket: "reservasi-cc592.firebasestorage.app",
    messagingSenderId: "464707598627",
    appId: "1:464707598627:web:3a31787cc49ed70abc3496"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// ==================== GLOBAL VARIABLES ====================
let currentPage = 'dashboard';
let tables = [];
let reservations = [];
let selectedDate = new Date().toISOString().split('T')[0];

// ==================== UTILITY FUNCTIONS ====================
function showNotification(message, isError = false) {
    const notif = document.getElementById('notification');
    notif.textContent = message;
    notif.style.background = isError ? '#f44336' : '#4CAF50';
    notif.classList.remove('hidden');
    setTimeout(() => notif.classList.add('hidden'), 3000);
}

function formatRupiah(angka) {
    if (!angka) return 'Rp 0';
    return 'Rp ' + angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseRupiah(str) {
    if (!str) return 0;
    return parseInt(str.replace(/[^0-9]/g, '')) || 0;
}

function capitalizeWords(str) {
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

function formatDate(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d)) return dateString;
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn('Gagal menyimpan ke localStorage', e);
    }
}

function loadFromLocalStorage(key) {
    try {
        return JSON.parse(localStorage.getItem(key)) || null;
    } catch (e) {
        return null;
    }
}

// ==================== FIREBASE OPERATIONS ====================
async function loadTablesFromFirebase() {
    try {
        const snapshot = await db.collection('tables').get();
        tables = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        tables.sort((a, b) => a.nomorMeja.localeCompare(b.nomorMeja, undefined, { numeric: true }));
        saveToLocalStorage('tables', tables);
    } catch (error) {
        console.error('Gagal memuat meja dari Firebase, gunakan localStorage', error);
        tables = loadFromLocalStorage('tables') || [];
    }
    return tables;
}

async function saveTableToFirebase(tableData) {
    try {
        if (tableData.id) {
            await db.collection('tables').doc(tableData.id).set(tableData);
        } else {
            const docRef = await db.collection('tables').add(tableData);
            tableData.id = docRef.id;
        }
        await loadTablesFromFirebase();
        showNotification('Meja berhasil disimpan');
    } catch (error) {
        showNotification('Gagal simpan meja, simpan ke localStorage', true);
        let localTables = loadFromLocalStorage('tables') || [];
        if (tableData.id) {
            const index = localTables.findIndex(t => t.id === tableData.id);
            if (index >= 0) localTables[index] = tableData;
            else localTables.push(tableData);
        } else {
            tableData.id = 'local_' + Date.now();
            localTables.push(tableData);
        }
        saveToLocalStorage('tables', localTables);
        tables = localTables;
    }
}

async function deleteTableFromFirebase(tableId) {
    try {
        await db.collection('tables').doc(tableId).delete();
        await loadTablesFromFirebase();
        showNotification('Meja dihapus');
    } catch (error) {
        showNotification('Gagal hapus meja, hapus dari localStorage', true);
        let localTables = loadFromLocalStorage('tables') || [];
        localTables = localTables.filter(t => t.id !== tableId);
        saveToLocalStorage('tables', localTables);
        tables = localTables;
    }
}

// Reservasi
async function loadReservationsByDate(date) {
    try {
        const snapshot = await db.collection('reservations')
            .where('tanggal', '==', date)
            .get();
        reservations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        calculateUrutanDP();
        saveToLocalStorage(`reservations_${date}`, reservations);
    } catch (error) {
        console.error('Gagal memuat reservasi, gunakan localStorage', error);
        reservations = loadFromLocalStorage(`reservations_${date}`) || [];
    }
    return reservations;
}

async function saveReservation(resData) {
    try {
        resData.statusKelengkapan = getStatusKelengkapan(resData);
        
        if (resData.dpCheck && resData.dpNominal > 0) {
            if (!resData.dpTimestamp) {
                resData.dpTimestamp = firebase.firestore.FieldValue.serverTimestamp();
            }
        } else {
            resData.dpCheck = false;
            resData.dpNominal = 0;
            resData.dpJenis = '';
            resData.dpTimestamp = null;
        }

        if (resData.id) {
            await db.collection('reservations').doc(resData.id).set(resData, { merge: true });
        } else {
            resData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db.collection('reservations').add(resData);
            resData.id = docRef.id;
        }
        await loadReservationsByDate(resData.tanggal);
        showNotification('Reservasi berhasil disimpan');
        return true;
    } catch (error) {
        showNotification('Gagal simpan reservasi, simpan ke localStorage', true);
        resData.id = resData.id || 'local_' + Date.now();
        let localRes = loadFromLocalStorage(`reservations_${resData.tanggal}`) || [];
        const index = localRes.findIndex(r => r.id === resData.id);
        if (index >= 0) localRes[index] = resData;
        else localRes.push(resData);
        saveToLocalStorage(`reservations_${resData.tanggal}`, localRes);
        reservations = localRes;
        calculateUrutanDP();
        return false;
    }
}

async function deleteReservation(resId, tanggal) {
    try {
        await db.collection('reservations').doc(resId).delete();
        await loadReservationsByDate(tanggal);
        showNotification('Reservasi dihapus');
        return true;
    } catch (error) {
        showNotification('Gagal hapus reservasi, hapus dari localStorage', true);
        let localRes = loadFromLocalStorage(`reservations_${tanggal}`) || [];
        localRes = localRes.filter(r => r.id !== resId);
        saveToLocalStorage(`reservations_${tanggal}`, localRes);
        reservations = localRes;
        calculateUrutanDP();
        return false;
    }
}

function calculateUrutanDP() {
    const withDP = reservations
        .filter(r => r.dpCheck && r.dpNominal > 0 && r.dpTimestamp)
        .sort((a, b) => {
            const timeA = a.dpTimestamp ? (a.dpTimestamp.seconds || new Date(a.dpTimestamp).getTime() / 1000) : 0;
            const timeB = b.dpTimestamp ? (b.dpTimestamp.seconds || new Date(b.dpTimestamp).getTime() / 1000) : 0;
            return timeA - timeB;
        });
    
    withDP.forEach((r, index) => {
        r.urutanDP = index + 1;
    });
    
    reservations.forEach(r => {
        if (!r.dpCheck || r.dpNominal <= 0 || !r.dpTimestamp) {
            delete r.urutanDP;
        }
    });
}

function getStatusKelengkapan(r) {
    const hasMeja = r.nomorMeja && r.nomorMeja.length > 0;
    const hasDP = r.dpCheck && r.dpNominal > 0;
    if (hasMeja && hasDP) return 'Lengkap';
    if (!hasMeja && hasDP) return 'Belum ada Meja';
    if (hasMeja && !hasDP) return 'Belum ada DP';
    return 'Belum ada Meja & DP';
}

function showReservationDetailModal(r) {
    let dpInfo = 'Tidak ada';
    let dpActions = '';
    if (r.dpCheck && r.dpNominal > 0 && r.dpTimestamp) {
        let dpDate = '';
        if (r.dpTimestamp.seconds) {
            dpDate = formatDate(new Date(r.dpTimestamp.seconds * 1000));
        } else if (r.dpTimestamp instanceof Date) {
            dpDate = formatDate(r.dpTimestamp);
        } else if (typeof r.dpTimestamp === 'string') {
            dpDate = formatDate(r.dpTimestamp);
        }
        const jenis = r.dpJenis === 'transfer' ? 'TF' : 'Cash';
        dpInfo = `${formatRupiah(r.dpNominal)} (${jenis} pada ${dpDate})`;
        dpActions = `<button class="btn btn-sm btn-warning" id="hapusDPBtn" data-id="${r.id}">Hapus DP</button>`;
    }
    
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <h3>Detail Reservasi</h3>
        <p><strong>Nama:</strong> ${r.nama}</p>
        <p><strong>Jumlah Tamu:</strong> ${r.jumlahTamu}</p>
        <p><strong>No HP:</strong> ${r.noHp}</p>
        <p><strong>Area:</strong> ${r.areaPreferensi === 'non' ? 'Non Smoking' : 'Smoking'}</p>
        <p><strong>Meja:</strong> ${r.nomorMeja ? r.nomorMeja.join(', ') : '-'}</p>
        <p><strong>Order:</strong> ${r.sudahOrder ? 'Ya' : 'Tidak'}</p>
        <p><strong>DP:</strong> ${dpInfo}</p>
        ${r.urutanDP ? `<p><strong>Urutan DP:</strong> ${r.urutanDP}</p>` : ''}
        <p><strong>Catatan:</strong> ${r.catatan || '-'}</p>
        <div class="flex" style="justify-content: space-between; margin-top: 15px;">
            <div>
                <button class="btn btn-primary" onclick="editReservasi('${r.id}')">Edit</button>
                <button class="btn btn-danger" onclick="hapusReservasi('${r.id}')">Hapus</button>
            </div>
            ${dpActions}
        </div>
    `;
    modal.classList.remove('hidden');
    
    const hapusDPBtn = document.getElementById('hapusDPBtn');
    if (hapusDPBtn) {
        hapusDPBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('Hapus data DP? Urutan DP akan dihapus dan bisa diisi ulang dengan urutan baru.')) {
                r.dpCheck = false;
                r.dpNominal = 0;
                r.dpJenis = '';
                r.dpTimestamp = null;
                delete r.urutanDP;
                await saveReservation(r);
                modal.classList.add('hidden');
                if (currentPage === 'list-reservasi') {
                    renderPage('list-reservasi');
                } else if (currentPage === 'cek-meja') {
                    renderPage('cek-meja');
                }
            }
        });
    }
}

// ==================== RENDER PAGE (ASYNC) ====================
async function renderPage(page) {
    currentPage = page;
    document.querySelectorAll('.page').forEach(el => el.remove());
    
    const content = document.getElementById('content');
    let html = '';
    
    if (page === 'dashboard') {
        html = await renderDashboard();
    } else if (page === 'reservasi-baru') {
        html = renderReservasiBaru();
    } else if (page === 'list-reservasi') {
        html = renderListReservasi();
    } else if (page === 'cek-meja') {
        html = renderCekMeja();
    } else if (page === 'atur-meja') {
        html = renderAturMeja();
    }
    
    content.innerHTML = html;
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
    });
    
    if (page === 'dashboard') {
        // sudah di-render
    } else if (page === 'reservasi-baru') {
        initReservasiBaru();
    } else if (page === 'list-reservasi') {
        initListReservasi();
    } else if (page === 'cek-meja') {
        initCekMeja();
    } else if (page === 'atur-meja') {
        initAturMeja();
    }
}

// Dashboard
async function renderDashboard() {
    const today = new Date().toISOString().split('T')[0];
    await loadReservationsByDate(today);
    const todayRes = reservations;
    const totalMeja = tables.length;
    
    const mejaTerpakai = new Set();
    todayRes.forEach(r => {
        if (r.nomorMeja) r.nomorMeja.forEach(m => mejaTerpakai.add(m));
    });
    const mejaKosong = totalMeja - mejaTerpakai.size;
    
    const belumDP = todayRes.filter(r => r.nomorMeja && r.nomorMeja.length > 0 && (!r.dpCheck || r.dpNominal <= 0)).length;
    const tanpaMeja = todayRes.filter(r => !r.nomorMeja || r.nomorMeja.length === 0).length;
    const reservasiHariIni = todayRes.length;
    
    return `
        <div class="page">
            <h2>Dashboard</h2>
            <div class="stats-container">
                <div class="stat-box">
                    <div class="stat-value">${reservasiHariIni}</div>
                    <div class="stat-label">Reservasi hari ini</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${mejaKosong}</div>
                    <div class="stat-label">Meja kosong</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${belumDP}</div>
                    <div class="stat-label">Reservasi belum DP</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${tanpaMeja}</div>
                    <div class="stat-label">Reservasi tanpa meja</div>
                </div>
            </div>
        </div>
    `;
}

// Reservasi Baru
function renderReservasiBaru() {
    const today = new Date().toISOString().split('T')[0];
    return `
        <div class="page">
            <h2>Buat Reservasi Baru</h2>
            <form id="form-reservasi">
                <div class="form-group">
                    <label>Tanggal Reservasi</label>
                    <input type="date" id="tanggal" min="${today}" value="${selectedDate}" required>
                </div>
                <div class="form-group">
                    <label>Nama Tamu</label>
                    <input type="text" id="nama" required placeholder="Nama lengkap">
                </div>
                <div class="form-group">
                    <label>Jumlah Tamu</label>
                    <input type="number" id="jumlahTamu" required min="1">
                </div>
                <div class="form-group">
                    <label>Nomor HP</label>
                    <input type="tel" id="noHp" required>
                </div>
                <div class="form-group">
                    <label>Preferensi Area</label>
                    <select id="area">
                        <option value="non">Non Smoking</option>
                        <option value="smoking">Smoking</option>
                    </select>
                </div>
                <div class="form-group checkbox">
                    <input type="checkbox" id="sudahMejaCheck">
                    <label>Sudah Ada Nomor Meja?</label>
                </div>
                <div id="mejaSelection" class="hidden">
                    <p>Pilih Meja (bisa lebih dari satu): <span id="selectedMejaDisplay" style="font-weight:bold; color:#4CAF50;"></span></p>
                    <div id="gridMeja" class="meja-grid"></div>
                </div>
                <div class="form-group checkbox">
                    <input type="checkbox" id="sudahOrderCheck">
                    <label>Sudah Ada Orderan?</label>
                </div>
                <div class="form-group checkbox">
                    <input type="checkbox" id="dpCheck">
                    <label>Ada Pembayaran DP?</label>
                </div>
                <div id="dpFields" class="hidden">
                    <div class="form-group">
                        <label>Jenis DP</label>
                        <select id="dpJenis">
                            <option value="transfer">Transfer</option>
                            <option value="cash">Cash</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Nominal DP (Rp)</label>
                        <input type="text" id="dpNominal" placeholder="contoh: 10000">
                    </div>
                </div>
                <div class="form-group">
                    <label>Catatan</label>
                    <textarea id="catatan" rows="2"></textarea>
                </div>
                <div class="flex">
                    <button type="submit" class="btn btn-primary">Simpan Reservasi</button>
                    <button type="button" class="btn btn-warning" id="batalReservasi">Batal</button>
                </div>
            </form>
        </div>
    `;
}

async function initReservasiBaru() {
    const mejaCheck = document.getElementById('sudahMejaCheck');
    const mejaDiv = document.getElementById('mejaSelection');
    const dpCheck = document.getElementById('dpCheck');
    const dpFields = document.getElementById('dpFields');
    const dpNominalInput = document.getElementById('dpNominal');
    const gridMeja = document.getElementById('gridMeja');
    const selectedMejaDisplay = document.getElementById('selectedMejaDisplay');
    const namaInput = document.getElementById('nama');
    const tanggalInput = document.getElementById('tanggal');
    const today = new Date().toISOString().split('T')[0];
    
    namaInput.addEventListener('blur', () => {
        namaInput.value = capitalizeWords(namaInput.value);
    });
    
    if (tables.length === 0) await loadTablesFromFirebase();
    
    mejaCheck.addEventListener('change', () => {
        if (mejaCheck.checked) {
            mejaDiv.classList.remove('hidden');
            renderMejaGrid();
        } else {
            mejaDiv.classList.add('hidden');
            selectedMejaDisplay.textContent = '';
        }
    });
    
    dpCheck.addEventListener('change', () => {
        dpFields.classList.toggle('hidden', !dpCheck.checked);
    });
    
    dpNominalInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/[^0-9]/g, '');
        if (val) {
            e.target.value = new Intl.NumberFormat('id-ID').format(val);
        } else {
            e.target.value = '';
        }
    });
    
    async function renderMejaGrid() {
        const tanggal = tanggalInput.value;
        await loadReservationsByDate(tanggal);
        const mejaTerpakai = new Set();
        reservations.forEach(r => {
            if (r.nomorMeja) r.nomorMeja.forEach(m => mejaTerpakai.add(m));
        });
        
        let html = '';
        tables.forEach(meja => {
            const disabled = mejaTerpakai.has(meja.nomorMeja) ? 'disabled' : '';
            const areaClass = `area-${meja.area.replace(' ', '-')}`;
            html += `<div class="meja-item ${disabled} ${areaClass}" data-meja="${meja.nomorMeja}">${meja.nomorMeja}</div>`;
        });
        gridMeja.innerHTML = html;
        
        document.querySelectorAll('#gridMeja .meja-item:not(.disabled)').forEach(item => {
            item.addEventListener('click', () => {
                item.classList.toggle('selected');
                updateSelectedMejaDisplay();
            });
        });
    }
    
    function updateSelectedMejaDisplay() {
        const selected = [];
        document.querySelectorAll('#gridMeja .meja-item.selected').forEach(el => {
            selected.push(el.dataset.meja);
        });
        selectedMejaDisplay.textContent = selected.length ? 'Meja ' + selected.join(', ') : '';
    }
    
    tanggalInput.addEventListener('change', () => {
        if (tanggalInput.value < today) {
            alert('Tanggal reservasi tidak boleh sebelum hari ini.');
            tanggalInput.value = today;
        }
        if (mejaCheck.checked) renderMejaGrid();
    });
    
    document.getElementById('form-reservasi').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const tanggal = tanggalInput.value;
        if (tanggal < today) {
            alert('Tanggal reservasi tidak boleh sebelum hari ini.');
            tanggalInput.value = today;
            return;
        }
        
        const nama = capitalizeWords(document.getElementById('nama').value);
        const jumlahTamu = parseInt(document.getElementById('jumlahTamu').value);
        const noHp = document.getElementById('noHp').value;
        const area = document.getElementById('area').value;
        const sudahMeja = mejaCheck.checked;
        let nomorMeja = [];
        if (sudahMeja) {
            document.querySelectorAll('#gridMeja .meja-item.selected').forEach(el => {
                nomorMeja.push(el.dataset.meja);
            });
        }
        const sudahOrder = document.getElementById('sudahOrderCheck').checked;
        const dpCheckVal = dpCheck.checked;
        let dpJenis = '';
        let dpNominal = 0;
        if (dpCheckVal) {
            dpJenis = document.getElementById('dpJenis').value;
            dpNominal = parseRupiah(document.getElementById('dpNominal').value);
            if (dpNominal <= 0) {
                alert('Nominal DP harus diisi jika centang DP');
                return;
            }
        }
        const catatan = document.getElementById('catatan').value;
        
        if (!tanggal || !nama || !jumlahTamu || !noHp) {
            alert('Harap isi semua field wajib');
            return;
        }
        
        const idInput = document.getElementById('reservasiId');
        const id = idInput ? idInput.value : null;
        
        const reservasi = {
            id: id,
            tanggal,
            nama,
            jumlahTamu,
            noHp,
            areaPreferensi: area,
            nomorMeja,
            sudahOrder,
            dpCheck: dpCheckVal,
            dpJenis,
            dpNominal,
            catatan
        };
        
        await saveReservation(reservasi);
        renderPage('dashboard');
    });
    
    document.getElementById('batalReservasi').addEventListener('click', () => {
        renderPage('dashboard');
    });
}

// List Reservasi (dengan event listener langsung)
function renderListReservasi() {
    return `
        <div class="page">
            <h2>Daftar Reservasi</h2>
            <div class="flex flex-wrap justify-between">
                <div class="flex">
                    <input type="date" id="filterTanggal" value="${selectedDate}">
                    <button class="btn btn-primary" id="muatReservasi">Muat</button>
                </div>
                <div class="flex">
                    <select id="sortBy">
                        <option value="urutanDP">Urutan DP</option>
                        <option value="nomorMeja">Nomor Meja</option>
                        <option value="statusKelengkapan">Status</option>
                    </select>
                </div>
            </div>
            <div id="listContainer" class="mt-20"></div>
        </div>
    `;
}

async function initListReservasi() {
    const tanggalInput = document.getElementById('filterTanggal');
    const muatBtn = document.getElementById('muatReservasi');
    const sortBySelect = document.getElementById('sortBy');
    
    async function loadAndDisplay() {
        selectedDate = tanggalInput.value;
        await loadReservationsByDate(selectedDate);
        sortReservations();
        displayTable();
    }
    
    function sortReservations() {
        const sortField = sortBySelect.value;
        if (sortField === 'urutanDP') {
            reservations.sort((a, b) => {
                const aUrut = a.urutanDP || 9999;
                const bUrut = b.urutanDP || 9999;
                return aUrut - bUrut;
            });
        } else if (sortField === 'nomorMeja') {
            reservations.sort((a, b) => {
                const aMeja = a.nomorMeja && a.nomorMeja.length ? a.nomorMeja[0] : '';
                const bMeja = b.nomorMeja && b.nomorMeja.length ? b.nomorMeja[0] : '';
                return aMeja.localeCompare(bMeja, undefined, { numeric: true });
            });
        } else if (sortField === 'statusKelengkapan') {
            const order = { 'Lengkap': 0, 'Belum ada DP': 1, 'Belum ada Meja': 2, 'Belum ada Meja & DP': 3 };
            reservations.sort((a, b) => order[a.statusKelengkapan] - order[b.statusKelengkapan]);
        }
    }
    
    function displayTable() {
        const container = document.getElementById('listContainer');
        container.innerHTML = renderTable();
        
        // Pasang event listener untuk setiap tombol dan baris
        attachTableEvents();
    }
    
    function attachTableEvents() {
        // Pasang event untuk setiap baris
        document.querySelectorAll('#listContainer tbody tr').forEach(row => {
            row.addEventListener('click', function(e) {
                // Jangan trigger jika klik di tombol
                if (e.target.tagName === 'BUTTON') return;
                
                const id = this.dataset.id;
                const r = reservations.find(r => r.id === id);
                if (r) showReservationDetailModal(r);
            });
        });
        
        // Pasang event untuk tombol edit
        document.querySelectorAll('.edit-reservasi').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const id = this.dataset.id;
                editReservasi(id);
            });
        });
        
        // Pasang event untuk tombol hapus
        document.querySelectorAll('.hapus-reservasi').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const id = this.dataset.id;
                if (confirm('Hapus reservasi ini?')) {
                    await deleteReservation(id, selectedDate);
                    // Refresh tampilan
                    await loadReservationsByDate(selectedDate);
                    sortReservations();
                    displayTable();
                }
            });
        });
    }
    
    function renderTable() {
        let html = '<div class="table-container"><table><thead><tr>';
        html += '<th>Meja</th><th>Nama</th><th>Tamu</th><th>Urutan DP</th><th>Status</th><th>Aksi</th>';
        html += '</tr></thead><tbody>';
        
        reservations.forEach(r => {
            const mejaStr = r.nomorMeja && r.nomorMeja.length ? r.nomorMeja.join(', ') : '-';
            const statusClass = {
                'Lengkap': 'badge-lengkap',
                'Belum ada Meja': 'badge-belum-meja',
                'Belum ada DP': 'badge-belum-dp',
                'Belum ada Meja & DP': 'badge-belum-meja-dp'
            }[r.statusKelengkapan] || '';
            const statusBadge = `<span class="badge ${statusClass}">${r.statusKelengkapan}</span>`;
            const urutanDP = r.urutanDP ? r.urutanDP : '-';
            
            html += `<tr data-id="${r.id}">`;
            html += `<td>${mejaStr}</td>`;
            html += `<td>${r.nama}</td>`;
            html += `<td>${r.jumlahTamu}</td>`;
            html += `<td>${urutanDP}</td>`;
            html += `<td>${statusBadge}</td>`;
            html += `<td>
                <button class="btn btn-sm btn-primary edit-reservasi" data-id="${r.id}">Edit</button>
                <button class="btn btn-sm btn-danger hapus-reservasi" data-id="${r.id}">Hapus</button>
            </td></tr>`;
        });
        html += '</tbody></table></div>';
        return html;
    }
    
    muatBtn.addEventListener('click', loadAndDisplay);
    sortBySelect.addEventListener('change', () => {
        sortReservations();
        displayTable();
    });
    
    loadAndDisplay();
}

// Cek Meja Kosong
function renderCekMeja() {
    return `
        <div class="page">
            <h2>Cek Meja Kosong</h2>
            <div class="flex">
                <input type="date" id="cekTanggal" value="${selectedDate}">
                <button class="btn btn-primary" id="tampilkanMeja">Tampilkan</button>
            </div>
            <div id="gridMejaCek" class="meja-grid mt-20"></div>
        </div>
    `;
}

async function initCekMeja() {
    const tanggalInput = document.getElementById('cekTanggal');
    const tampilBtn = document.getElementById('tampilkanMeja');
    const grid = document.getElementById('gridMejaCek');
    
    async function tampilkan() {
        const tanggal = tanggalInput.value;
        await loadReservationsByDate(tanggal);
        const mejaTerpakai = new Set();
        reservations.forEach(r => {
            if (r.nomorMeja) r.nomorMeja.forEach(m => mejaTerpakai.add(m));
        });
        
        let html = '';
        tables.forEach(meja => {
            const terisi = mejaTerpakai.has(meja.nomorMeja);
            const warna = terisi ? 'background: #666; color: white;' : 'background: #4CAF50; color: white;';
            const areaClass = `area-${meja.area.replace(' ', '-')}`;
            html += `<div class="meja-item ${areaClass}" style="${warna}" data-meja="${meja.nomorMeja}" data-terisi="${terisi}">${meja.nomorMeja}</div>`;
        });
        grid.innerHTML = html;
        
        document.querySelectorAll('#gridMejaCek .meja-item').forEach(item => {
            item.addEventListener('click', () => {
                const meja = item.dataset.meja;
                const terisi = item.dataset.terisi === 'true';
                if (terisi) {
                    const reservasiMeja = reservations.filter(r => r.nomorMeja && r.nomorMeja.includes(meja));
                    if (reservasiMeja.length > 0) {
                        showReservationDetailModal(reservasiMeja[0]);
                    }
                } else {
                    if (confirm(`Buat reservasi baru dengan meja ${meja}?`)) {
                        selectedDate = tanggal;
                        renderPage('reservasi-baru');
                        setTimeout(() => {
                            document.getElementById('sudahMejaCheck').checked = true;
                            document.getElementById('mejaSelection').classList.remove('hidden');
                            const mejaItems = document.querySelectorAll('#gridMeja .meja-item');
                            mejaItems.forEach(m => {
                                if (m.dataset.meja === meja) {
                                    m.classList.add('selected');
                                }
                            });
                            const display = document.getElementById('selectedMejaDisplay');
                            if (display) display.textContent = 'Meja ' + meja;
                        }, 100);
                    }
                }
            });
        });
    }
    
    tampilBtn.addEventListener('click', tampilkan);
    tampilkan();
}

// Atur Meja
function renderAturMeja() {
    return `
        <div class="page">
            <h2>Atur Meja</h2>
            <div class="flex">
                <button class="btn btn-primary" id="tambahMeja">Tambah Meja Baru</button>
                <button class="btn btn-warning" id="importMeja">Import dari CSV</button>
            </div>
            <div id="daftarMeja" class="mt-20"></div>
        </div>
    `;
}

async function initAturMeja() {
    const daftarDiv = document.getElementById('daftarMeja');
    
    async function renderDaftarMeja() {
        await loadTablesFromFirebase();
        let html = '<div class="table-container"><table><thead><tr><th>Nomor Meja</th><th>Area</th><th>Aksi</th></tr></thead><tbody>';
        tables.forEach(meja => {
            html += `<tr>
                <td>${meja.nomorMeja}</td>
                <td>
                    <select class="area-select" data-id="${meja.id}">
                        <option value="non" ${meja.area === 'non' ? 'selected' : ''}>Non Smoking</option>
                        <option value="smoking" ${meja.area === 'smoking' ? 'selected' : ''}>Smoking</option>
                        <option value="tambahan" ${meja.area === 'tambahan' ? 'selected' : ''}>Tambahan</option>
                    </select>
                </td>
                <td>
                    <button class="btn btn-sm btn-danger hapus-meja" data-id="${meja.id}">Hapus</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table></div>';
        daftarDiv.innerHTML = html;
        
        document.querySelectorAll('.area-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const id = e.target.dataset.id;
                const area = e.target.value;
                const meja = tables.find(t => t.id === id);
                if (meja) {
                    meja.area = area;
                    await saveTableToFirebase(meja);
                    renderDaftarMeja();
                }
            });
        });
        
        document.querySelectorAll('.hapus-meja').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Hapus meja ini?')) {
                    const id = e.target.dataset.id;
                    await deleteTableFromFirebase(id);
                    renderDaftarMeja();
                }
            });
        });
    }
    
    document.getElementById('tambahMeja').addEventListener('click', () => {
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = `
            <h3>Tambah Meja Baru</h3>
            <div class="form-group">
                <label>Nomor Meja</label>
                <input type="text" id="nomorMejaBaru" placeholder="contoh: 12A">
            </div>
            <div class="form-group">
                <label>Area</label>
                <select id="areaBaru">
                    <option value="non">Non Smoking</option>
                    <option value="smoking">Smoking</option>
                    <option value="tambahan">Tambahan</option>
                </select>
            </div>
            <button class="btn btn-primary" id="simpanMejaBaru">Simpan</button>
        `;
        modal.classList.remove('hidden');
        
        document.getElementById('simpanMejaBaru').addEventListener('click', async () => {
            const nomor = document.getElementById('nomorMejaBaru').value.trim();
            const area = document.getElementById('areaBaru').value;
            if (!nomor) {
                alert('Nomor meja harus diisi');
                return;
            }
            if (tables.some(t => t.nomorMeja === nomor)) {
                alert('Nomor meja sudah ada');
                return;
            }
            await saveTableToFirebase({ nomorMeja: nomor, area });
            modal.classList.add('hidden');
            renderDaftarMeja();
        });
    });
    
    document.getElementById('importMeja').addEventListener('click', () => {
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = `
            <h3>Import Meja dari CSV</h3>
            <p>Format: nomorMeja,area (area: non, smoking, tambahan)</p>
            <p>Contoh:<br>1,non<br>2A,smoking<br>3,tambahan</p>
            <textarea id="csvInput" rows="10" style="width:100%;"></textarea>
            <button class="btn btn-primary" id="prosesImport">Proses</button>
        `;
        modal.classList.remove('hidden');
        
        document.getElementById('prosesImport').addEventListener('click', async () => {
            const csv = document.getElementById('csvInput').value.trim();
            if (!csv) {
                alert('Masukkan data CSV');
                return;
            }
            const lines = csv.split('\n');
            const newTables = [];
            const errors = [];
            for (let line of lines) {
                line = line.trim();
                if (!line) continue;
                const parts = line.split(',');
                if (parts.length < 2) {
                    errors.push(`Baris tidak valid: ${line}`);
                    continue;
                }
                const nomorMeja = parts[0].trim();
                const area = parts[1].trim();
                if (!nomorMeja || !['non', 'smoking', 'tambahan'].includes(area)) {
                    errors.push(`Area harus non/smoking/tambahan: ${line}`);
                    continue;
                }
                if (tables.some(t => t.nomorMeja === nomorMeja) || newTables.some(t => t.nomorMeja === nomorMeja)) {
                    errors.push(`Nomor meja duplikat: ${nomorMeja}`);
                    continue;
                }
                newTables.push({ nomorMeja, area });
            }
            
            if (errors.length > 0) {
                alert('Error:\n' + errors.join('\n'));
                return;
            }
            
            for (let table of newTables) {
                await saveTableToFirebase(table);
            }
            modal.classList.add('hidden');
            renderDaftarMeja();
            showNotification(`${newTables.length} meja berhasil diimport`);
        });
    });
    
    renderDaftarMeja();
}

// Fungsi global untuk edit dan hapus
window.editReservasi = function(id) {
    const reservasi = reservations.find(r => r.id === id);
    if (!reservasi) return;
    
    renderPage('reservasi-baru');
    setTimeout(() => {
        document.getElementById('tanggal').value = reservasi.tanggal;
        document.getElementById('nama').value = reservasi.nama;
        document.getElementById('jumlahTamu').value = reservasi.jumlahTamu;
        document.getElementById('noHp').value = reservasi.noHp;
        document.getElementById('area').value = reservasi.areaPreferensi || 'non';
        if (reservasi.nomorMeja && reservasi.nomorMeja.length) {
            document.getElementById('sudahMejaCheck').checked = true;
            document.getElementById('mejaSelection').classList.remove('hidden');
            setTimeout(() => {
                document.querySelectorAll('#gridMeja .meja-item').forEach(item => {
                    if (reservasi.nomorMeja.includes(item.dataset.meja)) {
                        item.classList.add('selected');
                    }
                });
                const selectedMejaDisplay = document.getElementById('selectedMejaDisplay');
                if (selectedMejaDisplay) {
                    selectedMejaDisplay.textContent = 'Meja ' + reservasi.nomorMeja.join(', ');
                }
            }, 200);
        }
        document.getElementById('sudahOrderCheck').checked = reservasi.sudahOrder || false;
        if (reservasi.dpCheck) {
            document.getElementById('dpCheck').checked = true;
            document.getElementById('dpFields').classList.remove('hidden');
            document.getElementById('dpJenis').value = reservasi.dpJenis || 'transfer';
            document.getElementById('dpNominal').value = formatRupiah(reservasi.dpNominal);
        }
        document.getElementById('catatan').value = reservasi.catatan || '';
        
        const form = document.getElementById('form-reservasi');
        let idInput = document.getElementById('reservasiId');
        if (!idInput) {
            idInput = document.createElement('input');
            idInput.type = 'hidden';
            idInput.id = 'reservasiId';
            form.appendChild(idInput);
        }
        idInput.value = reservasi.id;
    }, 100);
};

// ==================== LOGIN & AUTENTIKASI ====================
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            console.log('Login sukses');
        })
        .catch(error => {
            document.getElementById('login-error').textContent = error.message;
        });
});

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    auth.signOut().then(() => {
        document.getElementById('login-page').style.display = 'block';
        document.getElementById('app-content').style.display = 'none';
    });
});

// Pantau status autentikasi
auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        
        // Pasang event listener untuk tombol navigasi
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                await renderPage(this.dataset.page);
            });
        });

        startApp();
    } else {
        document.getElementById('login-page').style.display = 'block';
        document.getElementById('app-content').style.display = 'none';
    }
});

// ==================== INISIALISASI APLIKASI ====================
function startApp() {
    loadTablesFromFirebase().then(() => {
        renderPage('dashboard');
    });
                }
