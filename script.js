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

// ==================== GLOBAL VARIABLES ====================
let currentPage = 'dashboard';
let tables = []; // data meja dari Firestore
let reservations = []; // data reservasi untuk tanggal tertentu
let selectedDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
let columnSettings = {
    visible: ['nama', 'jumlahTamu', 'noHp', 'area', 'nomorMeja', 'statusOrder', 'statusDP', 'nominalDP', 'urutanDP', 'statusKelengkapan'],
    order: ['nama', 'jumlahTamu', 'noHp', 'area', 'nomorMeja', 'statusOrder', 'statusDP', 'nominalDP', 'urutanDP', 'statusKelengkapan']
};
let viewMode = 'table'; // 'table' atau 'card'
let sortBy = 'urutanDP'; // default

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

// Simpan ke localStorage
function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn('Gagal menyimpan ke localStorage', e);
    }
}

// Muat dari localStorage
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
        // Urutkan berdasarkan nomor meja (asumsi string)
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
        await loadTablesFromFirebase(); // refresh
        showNotification('Meja berhasil disimpan');
    } catch (error) {
        showNotification('Gagal simpan meja, simpan ke localStorage', true);
        // Simpan ke localStorage sebagai cadangan
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
        // Hitung urutan DP berdasarkan createdAt
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
        // Hitung status kelengkapan
        resData.statusKelengkapan = getStatusKelengkapan(resData);
        
        if (resData.id) {
            await db.collection('reservations').doc(resData.id).set(resData);
        } else {
            // Tambah createdAt untuk urutan DP
            resData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db.collection('reservations').add(resData);
            resData.id = docRef.id;
        }
        // Hitung ulang urutan DP untuk tanggal tersebut
        await loadReservationsByDate(resData.tanggal);
        showNotification('Reservasi berhasil disimpan');
        return true;
    } catch (error) {
        showNotification('Gagal simpan reservasi, simpan ke localStorage', true);
        // Simpan ke localStorage
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
    } catch (error) {
        showNotification('Gagal hapus reservasi, hapus dari localStorage', true);
        let localRes = loadFromLocalStorage(`reservations_${tanggal}`) || [];
        localRes = localRes.filter(r => r.id !== resId);
        saveToLocalStorage(`reservations_${tanggal}`, localRes);
        reservations = localRes;
        calculateUrutanDP();
    }
}

// Hitung urutan DP berdasarkan createdAt (client-side)
function calculateUrutanDP() {
    // Filter reservasi yang memiliki DP (dpCheck true dan dpNominal > 0)
    const withDP = reservations
        .filter(r => r.dpCheck && r.dpNominal > 0)
        .sort((a, b) => {
            // Jika ada createdAt, bandingkan; jika tidak, pakai waktu lokal
            const timeA = a.createdAt ? (a.createdAt.seconds || a.createdAt) : 0;
            const timeB = b.createdAt ? (b.createdAt.seconds || b.createdAt) : 0;
            return timeA - timeB;
        });
    
    // Beri nomor urut
    withDP.forEach((r, index) => {
        r.urutanDP = index + 1;
    });
    
    // Yang tanpa DP tetap 0
    reservations.forEach(r => {
        if (!r.dpCheck || r.dpNominal <= 0) r.urutanDP = 0;
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

// ==================== RENDER PAGE ====================
function renderPage(page) {
    currentPage = page;
    // Sembunyikan semua page, tampilkan yang dipilih
    document.querySelectorAll('.page').forEach(el => el.remove());
    
    const content = document.getElementById('content');
    let html = '';
    
    if (page === 'dashboard') {
        html = renderDashboard();
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
    
    // Update active nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
    });
    
    // Inisialisasi event listeners spesifik halaman
    if (page === 'dashboard') initDashboard();
    else if (page === 'reservasi-baru') initReservasiBaru();
    else if (page === 'list-reservasi') initListReservasi();
    else if (page === 'cek-meja') initCekMeja();
    else if (page === 'atur-meja') initAturMeja();
}

// Dashboard
function renderDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const todayRes = reservations.filter(r => r.tanggal === today);
    const totalMeja = tables.length;
    const mejaTerpakai = new Set();
    todayRes.forEach(r => {
        if (r.nomorMeja) r.nomorMeja.forEach(m => mejaTerpakai.add(m));
    });
    const mejaTersedia = totalMeja - mejaTerpakai.size;
    const belumLengkap = todayRes.filter(r => r.statusKelengkapan !== 'Lengkap').length;
    
    return `
        <div class="page">
            <h2>Dashboard</h2>
            <div class="stats">
                <p><strong>Reservasi hari ini:</strong> ${todayRes.length}</p>
                <p><strong>Meja tersedia:</strong> ${mejaTersedia} dari ${totalMeja}</p>
                <p><strong>Reservasi belum lengkap:</strong> ${belumLengkap}</p>
            </div>
        </div>
    `;
}

function initDashboard() {
    // Tidak ada aksi khusus
}

// Reservasi Baru
function renderReservasiBaru() {
    return `
        <div class="page">
            <h2>Buat Reservasi Baru</h2>
            <form id="form-reservasi">
                <div class="form-group">
                    <label>Tanggal Reservasi</label>
                    <input type="date" id="tanggal" value="${selectedDate}" required>
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
                    <p>Pilih Meja (bisa lebih dari satu):</p>
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
    
    // Load meja jika belum
    if (tables.length === 0) await loadTablesFromFirebase();
    
    // Event listener checkbox meja
    mejaCheck.addEventListener('change', () => {
        if (mejaCheck.checked) {
            mejaDiv.classList.remove('hidden');
            renderMejaGrid();
        } else {
            mejaDiv.classList.add('hidden');
        }
    });
    
    // Event listener DP
    dpCheck.addEventListener('change', () => {
        dpFields.classList.toggle('hidden', !dpCheck.checked);
    });
    
    // Format Rupiah saat input DP
    dpNominalInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/[^0-9]/g, '');
        if (val) {
            e.target.value = new Intl.NumberFormat('id-ID').format(val);
        } else {
            e.target.value = '';
        }
    });
    
    // Render grid meja berdasarkan tanggal yang dipilih dan reservasi yang ada
    async function renderMejaGrid() {
        const tanggal = document.getElementById('tanggal').value;
        // Muat reservasi untuk tanggal tersebut untuk mengetahui meja terpakai
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
        
        // Tambahkan event listener untuk seleksi (multiple)
        document.querySelectorAll('#gridMeja .meja-item:not(.disabled)').forEach(item => {
            item.addEventListener('click', () => {
                item.classList.toggle('selected');
            });
        });
    }
    
    document.getElementById('tanggal').addEventListener('change', () => {
        if (mejaCheck.checked) renderMejaGrid();
    });
    
    // Handle submit
    document.getElementById('form-reservasi').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Ambil data
        const tanggal = document.getElementById('tanggal').value;
        const nama = capitalizeWords(document.getElementById('nama').value);
        const jumlahTamu = parseInt(document.getElementById('jumlahTamu').value);
        const noHp = document.getElementById('noHp').value;
        const area = document.getElementById('area').value; // 'non' atau 'smoking'
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
        
        // Validasi
        if (!tanggal || !nama || !jumlahTamu || !noHp) {
            alert('Harap isi semua field wajib');
            return;
        }
        
        const reservasi = {
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
            catatan,
            createdAt: new Date().toISOString() // fallback
        };
        
        await saveReservation(reservasi);
        // Kembali ke dashboard
        renderPage('dashboard');
    });
    
    document.getElementById('batalReservasi').addEventListener('click', () => {
        renderPage('dashboard');
    });
}

// List Reservasi
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
                    <select id="viewMode">
                        <option value="table" ${viewMode==='table'?'selected':''}>Tabel</option>
                        <option value="card" ${viewMode==='card'?'selected':''}>Card</option>
                    </select>
                    <select id="sortBy">
                        <option value="urutanDP" ${sortBy==='urutanDP'?'selected':''}>Urutan DP</option>
                        <option value="nomorMeja" ${sortBy==='nomorMeja'?'selected':''}>Nomor Meja</option>
                        <option value="statusKelengkapan" ${sortBy==='statusKelengkapan'?'selected':''}>Status Kelengkapan</option>
                    </select>
                    <button class="btn btn-warning" id="aturKolom">Atur Kolom</button>
                </div>
            </div>
            <div id="listContainer" class="mt-20"></div>
        </div>
    `;
}

async function initListReservasi() {
    const tanggalInput = document.getElementById('filterTanggal');
    const muatBtn = document.getElementById('muatReservasi');
    const viewModeSelect = document.getElementById('viewMode');
    const sortBySelect = document.getElementById('sortBy');
    const aturKolomBtn = document.getElementById('aturKolom');
    
    async function loadAndDisplay() {
        selectedDate = tanggalInput.value;
        await loadReservationsByDate(selectedDate);
        sortReservations();
        displayList();
    }
    
    function sortReservations() {
        const sortField = sortBySelect.value;
        if (sortField === 'urutanDP') {
            reservations.sort((a, b) => (a.urutanDP || 999) - (b.urutanDP || 999));
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
    
    function displayList() {
        const container = document.getElementById('listContainer');
        const mode = viewModeSelect.value;
        viewMode = mode;
        
        if (mode === 'table') {
            container.innerHTML = renderTable();
        } else {
            container.innerHTML = renderCards();
        }
        
        // Tambah event listener untuk tombol edit/hapus
        document.querySelectorAll('.edit-reservasi').forEach(btn => {
            btn.addEventListener('click', () => editReservasi(btn.dataset.id));
        });
        document.querySelectorAll('.hapus-reservasi').forEach(btn => {
            btn.addEventListener('click', () => hapusReservasi(btn.dataset.id));
        });
    }
    
    function renderTable() {
        const cols = columnSettings.visible;
        let html = '<div class="table-container"><table><thead><tr>';
        cols.forEach(col => {
            html += `<th>${getColumnName(col)}</th>`;
        });
        html += '<th>Aksi</th></tr></thead><tbody>';
        
        reservations.forEach(r => {
            html += '<tr>';
            cols.forEach(col => {
                html += `<td>${getColumnValue(r, col)}</td>`;
            });
            html += `<td>
                <button class="btn btn-sm btn-primary edit-reservasi" data-id="${r.id}">Edit</button>
                <button class="btn btn-sm btn-danger hapus-reservasi" data-id="${r.id}">Hapus</button>
            </td></tr>`;
        });
        html += '</tbody></table></div>';
        return html;
    }
    
    function renderCards() {
        let html = '<div class="card-view">';
        reservations.forEach(r => {
            const statusClass = {
                'Lengkap': 'badge-lengkap',
                'Belum ada Meja': 'badge-belum-meja',
                'Belum ada DP': 'badge-belum-dp',
                'Belum ada Meja & DP': 'badge-belum-meja-dp'
            }[r.statusKelengkapan] || '';
            
            html += `<div class="card">
                <div class="card-header">
                    <strong>${r.nama}</strong>
                    <span class="badge ${statusClass}">${r.statusKelengkapan}</span>
                </div>
                <div class="card-body">
                    <p>Jumlah Tamu: ${r.jumlahTamu}</p>
                    <p>No HP: ${r.noHp}</p>
                    <p>Area: ${r.areaPreferensi}</p>
                    <p>Meja: ${r.nomorMeja ? r.nomorMeja.join(', ') : '-'}</p>
                    <p>Order: ${r.sudahOrder ? 'Ya' : 'Tidak'}</p>
                    <p>DP: ${r.dpCheck ? formatRupiah(r.dpNominal) + ' (' + r.dpJenis + ')' : 'Tidak'}</p>
                    <p>Urutan DP: ${r.urutanDP || 0}</p>
                </div>
                <div class="card-footer">
                    <button class="btn btn-sm btn-primary edit-reservasi" data-id="${r.id}">Edit</button>
                    <button class="btn btn-sm btn-danger hapus-reservasi" data-id="${r.id}">Hapus</button>
                </div>
            </div>`;
        });
        html += '</div>';
        return html;
    }
    
    function getColumnName(col) {
        const names = {
            nama: 'Nama',
            jumlahTamu: 'Jumlah',
            noHp: 'No HP',
            area: 'Area',
            nomorMeja: 'Meja',
            statusOrder: 'Order',
            statusDP: 'Status DP',
            nominalDP: 'Nominal DP',
            urutanDP: 'Urutan DP',
            statusKelengkapan: 'Kelengkapan'
        };
        return names[col] || col;
    }
    
    function getColumnValue(r, col) {
        switch (col) {
            case 'nama': return r.nama;
            case 'jumlahTamu': return r.jumlahTamu;
            case 'noHp': return r.noHp;
            case 'area': return r.areaPreferensi;
            case 'nomorMeja': return r.nomorMeja ? r.nomorMeja.join(', ') : '-';
            case 'statusOrder': return r.sudahOrder ? 'Ya' : 'Tidak';
            case 'statusDP': return r.dpCheck ? (r.dpJenis === 'transfer' ? 'Transfer' : 'Cash') : 'Tidak';
            case 'nominalDP': return r.dpCheck ? formatRupiah(r.dpNominal) : '-';
            case 'urutanDP': return r.urutanDP || 0;
            case 'statusKelengkapan': {
                const statusClass = {
                    'Lengkap': 'badge-lengkap',
                    'Belum ada Meja': 'badge-belum-meja',
                    'Belum ada DP': 'badge-belum-dp',
                    'Belum ada Meja & DP': 'badge-belum-meja-dp'
                }[r.statusKelengkapan] || '';
                return `<span class="badge ${statusClass}">${r.statusKelengkapan}</span>`;
            }
            default: return '';
        }
    }
    
    muatBtn.addEventListener('click', loadAndDisplay);
    viewModeSelect.addEventListener('change', displayList);
    sortBySelect.addEventListener('change', () => {
        sortReservations();
        displayList();
    });
    
    aturKolomBtn.addEventListener('click', () => {
        // Buka modal atur kolom
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = renderAturKolomModal();
        modal.classList.remove('hidden');
        
        // Inisialisasi drag & drop sederhana (opsional)
        // Di sini kita hanya beri checkbox untuk visibilitas
        document.getElementById('simpanKolom').addEventListener('click', () => {
            const newVisible = [];
            columnSettings.order.forEach(col => {
                const cb = document.getElementById(`col_${col}`);
                if (cb && cb.checked) newVisible.push(col);
            });
            columnSettings.visible = newVisible;
            saveToLocalStorage('columnSettings', columnSettings);
            displayList();
            modal.classList.add('hidden');
        });
    });
    
    // Muat data pertama kali
    loadAndDisplay();
}

function renderAturKolomModal() {
    let html = '<h3>Atur Kolom</h3><p>Centang kolom yang ingin ditampilkan:</p>';
    columnSettings.order.forEach(col => {
        const checked = columnSettings.visible.includes(col) ? 'checked' : '';
        html += `<div><input type="checkbox" id="col_${col}" ${checked}> <label for="col_${col}">${getColumnName(col)}</label></div>`;
    });
    html += '<button class="btn btn-primary" id="simpanKolom">Simpan</button>';
    return html;
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
        
        // Event klik
        document.querySelectorAll('#gridMejaCek .meja-item').forEach(item => {
            item.addEventListener('click', () => {
                const meja = item.dataset.meja;
                const terisi = item.dataset.terisi === 'true';
                if (terisi) {
                    // Tampilkan detail reservasi yang menggunakan meja ini pada tanggal tersebut
                    const reservasiMeja = reservations.filter(r => r.nomorMeja && r.nomorMeja.includes(meja));
                    if (reservasiMeja.length > 0) {
                        tampilkanDetailReservasi(reservasiMeja[0]); // ambil yang pertama (bisa lebih dari satu)
                    }
                } else {
                    // Konfirmasi buat reservasi baru dengan meja ini
                    if (confirm(`Buat reservasi baru dengan meja ${meja}?`)) {
                        // Arahkan ke form reservasi dengan meja terpilih
                        selectedDate = tanggal;
                        renderPage('reservasi-baru');
                        // Setelah render, centang checkbox meja dan pilih meja tersebut
                        setTimeout(() => {
                            document.getElementById('sudahMejaCheck').checked = true;
                            document.getElementById('mejaSelection').classList.remove('hidden');
                            // Pilih meja yang dimaksud
                            const mejaItems = document.querySelectorAll('#gridMeja .meja-item');
                            mejaItems.forEach(m => {
                                if (m.dataset.meja === meja) {
                                    m.classList.add('selected');
                                }
                            });
                        }, 100);
                    }
                }
            });
        });
    }
    
    function tampilkanDetailReservasi(r) {
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = `
            <h3>Detail Reservasi</h3>
            <p><strong>Nama:</strong> ${r.nama}</p>
            <p><strong>Jumlah Tamu:</strong> ${r.jumlahTamu}</p>
            <p><strong>No HP:</strong> ${r.noHp}</p>
            <p><strong>Area:</strong> ${r.areaPreferensi}</p>
            <p><strong>Meja:</strong> ${r.nomorMeja ? r.nomorMeja.join(', ') : '-'}</p>
            <p><strong>Order:</strong> ${r.sudahOrder ? 'Ya' : 'Tidak'}</p>
            <p><strong>DP:</strong> ${r.dpCheck ? formatRupiah(r.dpNominal) + ' (' + r.dpJenis + ')' : 'Tidak'}</p>
            <p><strong>Catatan:</strong> ${r.catatan || '-'}</p>
            <button class="btn btn-primary" onclick="editReservasi('${r.id}')">Edit</button>
        `;
        modal.classList.remove('hidden');
    }
    
    tampilBtn.addEventListener('click', tampilkan);
    tampilkan(); // tampilkan default hari ini
}

// Atur Meja
function renderAturMeja() {
    return `
        <div class="page">
            <h2>Atur Meja</h2>
            <button class="btn btn-primary" id="tambahMeja">Tambah Meja Baru</button>
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
        
        // Event listener untuk ubah area
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
            // Cek duplikat
            if (tables.some(t => t.nomorMeja === nomor)) {
                alert('Nomor meja sudah ada');
                return;
            }
            await saveTableToFirebase({ nomorMeja: nomor, area });
            modal.classList.add('hidden');
            renderDaftarMeja();
        });
    });
    
    renderDaftarMeja();
}

// Fungsi global untuk edit (dipanggil dari modal)
window.editReservasi = function(id) {
    // Implementasi edit: bisa diarahkan ke form dengan data yang ada
    // Untuk sederhana, kita reload halaman reservasi baru dengan data
    const reservasi = reservations.find(r => r.id === id);
    if (!reservasi) return;
    
    renderPage('reservasi-baru');
    setTimeout(() => {
        // Isi form dengan data reservasi
        document.getElementById('tanggal').value = reservasi.tanggal;
        document.getElementById('nama').value = reservasi.nama;
        document.getElementById('jumlahTamu').value = reservasi.jumlahTamu;
        document.getElementById('noHp').value = reservasi.noHp;
        document.getElementById('area').value = reservasi.areaPreferensi || 'non';
        if (reservasi.nomorMeja && reservasi.nomorMeja.length) {
            document.getElementById('sudahMejaCheck').checked = true;
            document.getElementById('mejaSelection').classList.remove('hidden');
            // Render grid dan pilih meja yang sesuai
            setTimeout(() => {
                document.querySelectorAll('#gridMeja .meja-item').forEach(item => {
                    if (reservasi.nomorMeja.includes(item.dataset.meja)) {
                        item.classList.add('selected');
                    }
                });
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
        
        // Tambah hidden id untuk update
        const form = document.getElementById('form-reservasi');
        const idInput = document.createElement('input');
        idInput.type = 'hidden';
        idInput.id = 'reservasiId';
        idInput.value = reservasi.id;
        form.appendChild(idInput);
    }, 100);
};

window.hapusReservasi = async function(id) {
    if (confirm('Hapus reservasi ini?')) {
        await deleteReservation(id, selectedDate);
        // Refresh list
        renderPage('list-reservasi');
    }
};

// ==================== INISIALISASI APLIKASI ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Muat data meja
    await loadTablesFromFirebase();
    
    // Muat pengaturan kolom dari localStorage
    const savedCols = loadFromLocalStorage('columnSettings');
    if (savedCols) columnSettings = savedCols;
    
    // Navigasi
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            renderPage(btn.dataset.page);
        });
    });
    
    // Tutup modal saat klik close
    document.querySelector('.close-modal').addEventListener('click', () => {
        document.getElementById('modal').classList.add('hidden');
    });
    
    // Tampilkan dashboard awal
    renderPage('dashboard');
});
