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
const auth = firebase.auth();
const db = firebase.firestore();

// ==================== GLOBAL VARIABLES ====================
let currentUser = null;
let currentPage = 'dashboard';
let editingReservationId = null; // untuk mode edit
let selectedDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD lokal
let reservationsCache = []; // untuk menyimpan data reservasi terakhir dimuat (per tanggal)
let tablesCache = []; // untuk menyimpan data meja

// ==================== UTILITY FUNCTIONS ====================
function showNotification(message, isSuccess = true) {
    const notif = document.getElementById('notification');
    notif.textContent = message;
    notif.style.backgroundColor = isSuccess ? '#4CAF50' : '#f44336';
    notif.classList.add('show');
    setTimeout(() => {
        notif.classList.remove('show');
    }, 3000);
}

function formatRupiah(angka) {
    if (!angka) return '';
    return angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseRupiah(str) {
    return parseInt(str.replace(/\./g, '')) || 0;
}

function capitalizeName(str) {
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function showModal(content) {
    const modal = document.getElementById('modal');
    document.getElementById('modal-body').innerHTML = content;
    modal.style.display = 'block';
}

function hideModal() {
    document.getElementById('modal').style.display = 'none';
}

// Format tanggal untuk tampilan (dd/mm/yyyy)
function formatDateDisplay(isoDate) {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
}

// ==================== RENDER FUNCTIONS ====================
function renderApp() {
    const app = document.getElementById('app');
    if (!currentUser) {
        // Tampilkan halaman login
        app.innerHTML = `
            <h1>Reservasi Bukber</h1>
            <div id="login-form">
                <h2>Login Staf</h2>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="login-email" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="login-password" required>
                </div>
                <button id="login-btn">Login</button>
            </div>
        `;
        document.getElementById('login-btn').addEventListener('click', login);
    } else {
        // Tampilkan konten utama (navbar + halaman)
        app.innerHTML = `
            <h1>Reservasi Bukber</h1>
            <nav>
                <button data-page="dashboard">Dashboard</button>
                <button data-page="reservasi-baru">Reservasi Baru</button>
                <button data-page="list-reservasi">List Reservasi</button>
                <button data-page="cek-meja">Cek Meja</button>
                <button data-page="atur-meja">Atur Meja</button>
            </nav>
            <div id="content"></div>
        `;
        // Pasang event listener navigasi
        document.querySelectorAll('nav button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                currentPage = e.target.dataset.page;
                renderPage(currentPage);
            });
        });
        // Render halaman saat ini
        renderPage(currentPage);
    }
}

async function renderPage(page) {
    const content = document.getElementById('content');
    content.innerHTML = '<p>Loading...</p>';

    switch (page) {
        case 'dashboard':
            await renderDashboard(content);
            break;
        case 'reservasi-baru':
            await renderReservasiBaru(content);
            break;
        case 'list-reservasi':
            await renderListReservasi(content);
            break;
        case 'cek-meja':
            await renderCekMeja(content);
            break;
        case 'atur-meja':
            await renderAturMeja(content);
            break;
        default:
            content.innerHTML = '<p>Halaman tidak ditemukan</p>';
    }
}

// ==================== DASHBOARD ====================
async function renderDashboard(container) {
    try {
        const today = new Date().toISOString().split('T')[0];
        // Ambil reservasi hari ini
        const reservationsSnap = await db.collection('reservations').where('tanggal', '==', today).get();
        const reservations = [];
        reservationsSnap.forEach(doc => reservations.push({ id: doc.id, ...doc.data() }));

        // Ambil semua meja
        const tablesSnap = await db.collection('tables').get();
        const totalMeja = tablesSnap.size;

        // Hitung statistik
        const reservasiHariIni = reservations.length;
        const mejaTerpakai = new Set();
        reservations.forEach(r => {
            if (r.nomorMeja && Array.isArray(r.nomorMeja)) {
                r.nomorMeja.forEach(no => mejaTerpakai.add(no));
            }
        });
        const mejaKosong = totalMeja - mejaTerpakai.size;

        const reservasiBelumDP = reservations.filter(r => r.dpCheck === false && r.nomorMeja && r.nomorMeja.length > 0).length;
        const reservasiTanpaMeja = reservations.filter(r => !r.nomorMeja || r.nomorMeja.length === 0).length;

        container.innerHTML = `
            <div class="dashboard-cards">
                <div class="card">
                    <h3>Reservasi Hari Ini</h3>
                    <div class="value">${reservasiHariIni}</div>
                </div>
                <div class="card">
                    <h3>Meja Kosong</h3>
                    <div class="value">${mejaKosong}</div>
                </div>
                <div class="card">
                    <h3>Reservasi Belum DP</h3>
                    <div class="value">${reservasiBelumDP}</div>
                </div>
                <div class="card">
                    <h3>Reservasi Tanpa Meja</h3>
                    <div class="value">${reservasiTanpaMeja}</div>
                </div>
            </div>
            <button id="logout-btn">Logout</button>
        `;
        document.getElementById('logout-btn').addEventListener('click', logout);
    } catch (error) {
        console.error('Error loading dashboard:', error);
        container.innerHTML = '<p>Gagal memuat dashboard.</p>';
    }
}

// ==================== RESERVASI BARU / EDIT ====================
async function renderReservasiBaru(container) {
    editingReservationId = null; // reset mode edit
    await renderReservasiForm(container);
}

async function renderReservasiForm(container, editId = null) {
    try {
        // Ambil data meja dari Firestore
        const tablesSnap = await db.collection('tables').get();
        const tables = [];
        tablesSnap.forEach(doc => tables.push({ id: doc.id, ...doc.data() }));
        tablesCache = tables;

        // Jika edit, ambil data reservasi
        let editData = null;
        if (editId) {
            const doc = await db.collection('reservations').doc(editId).get();
            if (doc.exists) {
                editData = { id: doc.id, ...doc.data() };
                editingReservationId = editId;
            } else {
                showNotification('Data reservasi tidak ditemukan', false);
            }
        }

        const today = new Date().toISOString().split('T')[0];
        const tanggalValue = editData ? editData.tanggal : today;

        container.innerHTML = `
            <h2>${editId ? 'Edit Reservasi' : 'Reservasi Baru'}</h2>
            <form id="reservasi-form">
                <input type="hidden" id="reservasi-id" value="${editId || ''}">
                
                <div class="form-group">
                    <label>Tanggal Reservasi</label>
                    <input type="date" id="tanggal" value="${tanggalValue}" min="${today}" required>
                </div>

                <div class="form-group">
                    <label>Nama Tamu</label>
                    <input type="text" id="nama" value="${editData ? editData.nama : ''}" required>
                </div>

                <div class="form-group">
                    <label>Jumlah Tamu</label>
                    <input type="number" id="jumlahTamu" min="1" value="${editData ? editData.jumlahTamu : '1'}" required>
                </div>

                <div class="form-group">
                    <label>Nomor HP</label>
                    <input type="text" id="noHp" value="${editData ? editData.noHp : ''}" required>
                </div>

                <div class="form-group">
                    <label>Preferensi Area</label>
                    <select id="areaPreferensi">
                        <option value="non" ${editData && editData.areaPreferensi === 'non' ? 'selected' : ''}>Non Smoking</option>
                        <option value="smoking" ${editData && editData.areaPreferensi === 'smoking' ? 'selected' : ''}>Smoking</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>
                        <input type="checkbox" id="sudahAdaMeja" ${editData && editData.nomorMeja && editData.nomorMeja.length > 0 ? 'checked' : ''}>
                        Sudah Ada Nomor Meja?
                    </label>
                    <div id="meja-selection" style="display: ${editData && editData.nomorMeja && editData.nomorMeja.length > 0 ? 'block' : 'none'};">
                        <p>Pilih meja (bisa lebih dari satu):</p>
                        <div id="meja-grid"></div>
                        <p>Meja terpilih: <span id="selected-meja-text">${editData && editData.nomorMeja ? editData.nomorMeja.join(', ') : ''}</span></p>
                    </div>
                </div>

                <div class="form-group">
                    <label>
                        <input type="checkbox" id="sudahOrder" ${editData && editData.sudahOrder ? 'checked' : ''}>
                        Sudah Ada Orderan?
                    </label>
                </div>

                <div class="form-group">
                    <label>
                        <input type="checkbox" id="adaDP" ${editData && editData.dpCheck ? 'checked' : ''}>
                        Ada Pembayaran DP?
                    </label>
                    <div id="dp-details" style="display: ${editData && editData.dpCheck ? 'block' : 'none'}; margin-top: 10px;">
                        <label>Jenis DP:</label>
                        <select id="dpJenis">
                            <option value="transfer" ${editData && editData.dpJenis === 'transfer' ? 'selected' : ''}>Transfer</option>
                            <option value="cash" ${editData && editData.dpJenis === 'cash' ? 'selected' : ''}>Cash</option>
                        </select>
                        <label>Nominal DP:</label>
                        <input type="text" id="dpNominal" value="${editData && editData.dpNominal ? formatRupiah(editData.dpNominal) : ''}" placeholder="Contoh: 50000">
                    </div>
                </div>

                <div class="form-group">
                    <label>Catatan</label>
                    <textarea id="catatan">${editData ? editData.catatan || '' : ''}</textarea>
                </div>

                <button type="submit">Simpan Reservasi</button>
            </form>
        `;

        // Event listeners
        document.getElementById('tanggal').addEventListener('change', async (e) => {
            if (new Date(e.target.value) < new Date(today)) {
                showNotification('Tidak boleh memilih tanggal lalu', false);
                document.getElementById('tanggal').value = today;
            }
            // Jika tanggal berubah, refresh grid meja
            if (document.getElementById('sudahAdaMeja').checked) {
                await renderMejaGrid(editData ? editData.nomorMeja : []);
            }
        });

        document.getElementById('nama').addEventListener('blur', (e) => {
            e.target.value = capitalizeName(e.target.value);
        });

        document.getElementById('sudahAdaMeja').addEventListener('change', async (e) => {
            const mejaSelection = document.getElementById('meja-selection');
            if (e.target.checked) {
                mejaSelection.style.display = 'block';
                await renderMejaGrid(editData ? editData.nomorMeja : []);
            } else {
                mejaSelection.style.display = 'none';
            }
        });

        document.getElementById('adaDP').addEventListener('change', (e) => {
            document.getElementById('dp-details').style.display = e.target.checked ? 'block' : 'none';
        });

        document.getElementById('dpNominal').addEventListener('input', function(e) {
            let val = e.target.value.replace(/\./g, '');
            if (val) {
                val = parseInt(val, 10);
                e.target.value = formatRupiah(val);
            } else {
                e.target.value = '';
            }
        });

        // Submit form
        document.getElementById('reservasi-form').addEventListener('submit', handleReservasiSubmit);

    } catch (error) {
        console.error('Error rendering form:', error);
        container.innerHTML = '<p>Gagal memuat form.</p>';
    }
}

async function renderMejaGrid(selectedMeja = []) {
    const gridContainer = document.getElementById('meja-grid');
    if (!gridContainer) return;

    const tanggal = document.getElementById('tanggal').value;
    if (!tanggal) return;

    try {
        // Ambil reservasi untuk tanggal yang dipilih untuk mengetahui meja terpakai
        const reservationsSnap = await db.collection('reservations').where('tanggal', '==', tanggal).get();
        const occupiedMeja = new Set();
        reservationsSnap.forEach(doc => {
            const data = doc.data();
            if (data.nomorMeja && Array.isArray(data.nomorMeja)) {
                data.nomorMeja.forEach(no => occupiedMeja.add(no));
            }
        });

        // Kelompokkan meja berdasarkan area
        const tables = tablesCache;
        const mejaByArea = { non: [], smoking: [], tambahan: [] };
        tables.forEach(t => {
            const area = t.area || 'non';
            if (mejaByArea[area]) mejaByArea[area].push(t.nomorMeja);
            else mejaByArea[area] = [t.nomorMeja];
        });

        let html = '';
        for (let area in mejaByArea) {
            if (mejaByArea[area].length === 0) continue;
            const areaLabel = area === 'non' ? 'Non Smoking' : area === 'smoking' ? 'Smoking' : 'Tambahan';
            html += `<div class="area-${area}"><strong>${areaLabel}</strong><div class="meja-grid">`;
            mejaByArea[area].sort().forEach(nomor => {
                const isOccupied = occupiedMeja.has(nomor);
                const isSelected = selectedMeja.includes(nomor);
                html += `<div class="meja-item ${isOccupied ? 'occupied' : ''} ${isSelected ? 'selected' : ''}" data-nomor="${nomor}" data-area="${area}">${nomor}</div>`;
            });
            html += '</div></div>';
        }
        gridContainer.innerHTML = html;

        // Event listener untuk memilih meja
        document.querySelectorAll('#meja-grid .meja-item:not(.occupied)').forEach(item => {
            item.addEventListener('click', function() {
                this.classList.toggle('selected');
                updateSelectedMejaText();
            });
        });

        updateSelectedMejaText();
    } catch (error) {
        console.error('Error rendering meja grid:', error);
    }
}

function updateSelectedMejaText() {
    const selected = [];
    document.querySelectorAll('#meja-grid .meja-item.selected').forEach(item => {
        selected.push(item.dataset.nomor);
    });
    document.getElementById('selected-meja-text').textContent = selected.join(', ');
}

async function handleReservasiSubmit(e) {
    e.preventDefault();

    try {
        const id = document.getElementById('reservasi-id').value;
        const tanggal = document.getElementById('tanggal').value;
        const nama = document.getElementById('nama').value.trim();
        const jumlahTamu = parseInt(document.getElementById('jumlahTamu').value);
        const noHp = document.getElementById('noHp').value.trim();
        const areaPreferensi = document.getElementById('areaPreferensi').value;
        const sudahAdaMeja = document.getElementById('sudahAdaMeja').checked;
        const nomorMeja = sudahAdaMeja ? Array.from(document.querySelectorAll('#meja-grid .meja-item.selected')).map(el => el.dataset.nomor) : [];
        const sudahOrder = document.getElementById('sudahOrder').checked;
        const adaDP = document.getElementById('adaDP').checked;
        const dpJenis = adaDP ? document.getElementById('dpJenis').value : '';
        const dpNominal = adaDP ? parseRupiah(document.getElementById('dpNominal').value) : 0;
        const catatan = document.getElementById('catatan').value;

        // Validasi
        if (!nama || !jumlahTamu || !noHp) {
            showNotification('Harap isi semua field wajib', false);
            return;
        }

        // Hitung status kelengkapan
        let statusKelengkapan = 'Lengkap';
        if (nomorMeja.length === 0 && !adaDP) statusKelengkapan = 'Belum ada Meja & DP';
        else if (nomorMeja.length === 0) statusKelengkapan = 'Belum ada Meja';
        else if (!adaDP) statusKelengkapan = 'Belum ada DP';

        // Siapkan data reservasi
        const reservationData = {
            tanggal,
            nama,
            jumlahTamu,
            noHp,
            areaPreferensi,
            nomorMeja,
            sudahOrder,
            dpCheck: adaDP,
            dpJenis: adaDP ? dpJenis : '',
            dpNominal: adaDP ? dpNominal : 0,
            catatan,
            statusKelengkapan,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Jika ada DP dan belum ada dpTimestamp (reservasi baru atau sebelumnya tidak punya DP), set dpTimestamp
        if (adaDP) {
            if (!id) {
                // reservasi baru
                reservationData.dpTimestamp = firebase.firestore.FieldValue.serverTimestamp();
            } else {
                // edit, cek apakah sebelumnya tidak punya DP
                const oldDoc = await db.collection('reservations').doc(id).get();
                if (oldDoc.exists && !oldDoc.data().dpCheck) {
                    reservationData.dpTimestamp = firebase.firestore.FieldValue.serverTimestamp();
                } else {
                    // pertahankan timestamp lama
                    reservationData.dpTimestamp = oldDoc.data().dpTimestamp || null;
                }
            }
        } else {
            reservationData.dpTimestamp = null;
        }

        if (id) {
            // Update
            await db.collection('reservations').doc(id).update(reservationData);
            showNotification('Reservasi berhasil diperbarui');
        } else {
            // Tambah baru
            await db.collection('reservations').add(reservationData);
            showNotification('Reservasi berhasil disimpan');
        }

        // Kembali ke dashboard
        currentPage = 'dashboard';
        renderPage('dashboard');
    } catch (error) {
        console.error('Error saving reservation:', error);
        showNotification('Gagal menyimpan reservasi', false);
    }
}

// ==================== LIST RESERVASI ====================
async function renderListReservasi(container) {
    container.innerHTML = `
        <h2>Daftar Reservasi</h2>
        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px;">
            <div>
                <label>Pilih Tanggal:</label>
                <input type="date" id="filter-tanggal" value="${selectedDate}">
            </div>
            <button id="load-reservasi">Muat</button>
            <button id="refresh-reservasi">Refresh</button>
            <div>
                <label>Urutkan:</label>
                <select id="sort-reservasi">
                    <option value="dp">Urutan DP</option>
                    <option value="meja">Nomor Meja</option>
                    <option value="status">Status Kelengkapan</option>
                </select>
            </div>
        </div>
        <div id="reservasi-table-container">Loading...</div>
    `;

    document.getElementById('load-reservasi').addEventListener('click', () => {
        selectedDate = document.getElementById('filter-tanggal').value;
        loadReservasiTable();
    });
    document.getElementById('refresh-reservasi').addEventListener('click', loadReservasiTable);
    document.getElementById('sort-reservasi').addEventListener('change', loadReservasiTable);

    await loadReservasiTable();
}

async function loadReservasiTable() {
    const container = document.getElementById('reservasi-table-container');
    if (!container) return;

    try {
        const tanggal = selectedDate;
        const sortBy = document.getElementById('sort-reservasi').value;

        const snapshot = await db.collection('reservations').where('tanggal', '==', tanggal).get();
        const reservations = [];
        snapshot.forEach(doc => reservations.push({ id: doc.id, ...doc.data() }));
        reservationsCache = reservations;

        console.log(`Memuat ${reservations.length} reservasi untuk tanggal ${tanggal}:`, reservations.map(r => r.id));

        // Urutkan berdasarkan pilihan
        if (sortBy === 'dp') {
            // Reservasi dengan DP diurutkan berdasarkan dpTimestamp, yang tanpa DP di akhir
            reservations.sort((a, b) => {
                if (a.dpCheck && b.dpCheck) {
                    return (a.dpTimestamp?.seconds || 0) - (b.dpTimestamp?.seconds || 0);
                } else if (a.dpCheck) return -1;
                else if (b.dpCheck) return 1;
                else return 0;
            });
        } else if (sortBy === 'meja') {
            reservations.sort((a, b) => {
                const aMeja = a.nomorMeja && a.nomorMeja.length ? a.nomorMeja[0] : '';
                const bMeja = b.nomorMeja && b.nomorMeja.length ? b.nomorMeja[0] : '';
                return aMeja.localeCompare(bMeja);
            });
        } else if (sortBy === 'status') {
            reservations.sort((a, b) => a.statusKelengkapan.localeCompare(b.statusKelengkapan));
        }

        // Hitung urutan DP (hanya untuk yang memiliki DP)
        let dpCounter = 1;
        const dpMap = new Map();
        reservations.forEach(r => {
            if (r.dpCheck && r.dpTimestamp) {
                dpMap.set(r.id, dpCounter++);
            }
        });

        // Render tabel
        let html = '<div class="table-responsive"><table><thead><tr><th>Meja</th><th>Nama</th><th>Tamu</th><th>Urutan DP</th><th>Status</th><th>Aksi</th></tr></thead><tbody>';
        reservations.forEach(r => {
            const meja = r.nomorMeja && r.nomorMeja.length ? r.nomorMeja.join(', ') : '-';
            const urutanDP = r.dpCheck && dpMap.has(r.id) ? dpMap.get(r.id) : '-';
            const statusClass = r.statusKelengkapan?.toLowerCase().replace(/ /g, '-') || '';
            html += `<tr data-id="${r.id}">
                <td>${meja}</td>
                <td>${r.nama}</td>
                <td>${r.jumlahTamu}</td>
                <td>${urutanDP}</td>
                <td><span class="status-badge status-${statusClass}">${r.statusKelengkapan || '-'}</span></td>
                <td>
                    <button class="btn-edit" data-id="${r.id}">Edit</button>
                    <button class="btn-hapus" data-id="${r.id}">Hapus</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table></div>';

        container.innerHTML = html;

        // Event listener untuk baris (klik untuk detail)
        document.querySelectorAll('#reservasi-table-container tbody tr').forEach(tr => {
            tr.addEventListener('click', (e) => {
                // Jangan buka detail jika yang diklik adalah tombol
                if (e.target.tagName === 'BUTTON') return;
                const id = tr.dataset.id;
                console.log('Baris diklik, ID:', id);
                showDetailReservasi(id);
            });
        });

        // Event listener untuk tombol edit
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                console.log('Tombol edit diklik, ID:', id);
                editReservasi(id);
            });
        });

        // Event listener untuk tombol hapus
        document.querySelectorAll('.btn-hapus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (confirm('Yakin ingin menghapus reservasi ini?')) {
                    hapusReservasi(id);
                }
            });
        });

    } catch (error) {
        console.error('Error loading reservations:', error);
        container.innerHTML = '<p>Gagal memuat data.</p>';
    }
}

async function showDetailReservasi(id) {
    try {
        const doc = await db.collection('reservations').doc(id).get();
        if (!doc.exists) {
            showNotification('Reservasi tidak ditemukan', false);
            return;
        }
        const data = { id: doc.id, ...doc.data() };
        const tanggalDP = data.dpTimestamp ? new Date(data.dpTimestamp.seconds * 1000).toLocaleDateString('id-ID') : '-';

        const content = `
            <h3>Detail Reservasi</h3>
            <p><strong>ID:</strong> ${data.id}</p>
            <p><strong>Tanggal:</strong> ${formatDateDisplay(data.tanggal)}</p>
            <p><strong>Nama:</strong> ${data.nama}</p>
            <p><strong>Jumlah Tamu:</strong> ${data.jumlahTamu}</p>
            <p><strong>No HP:</strong> ${data.noHp}</p>
            <p><strong>Preferensi Area:</strong> ${data.areaPreferensi === 'non' ? 'Non Smoking' : 'Smoking'}</p>
            <p><strong>Nomor Meja:</strong> ${data.nomorMeja && data.nomorMeja.length ? data.nomorMeja.join(', ') : '-'}</p>
            <p><strong>Sudah Order:</strong> ${data.sudahOrder ? 'Ya' : 'Tidak'}</p>
            <p><strong>DP:</strong> ${data.dpCheck ? `Ya (${data.dpJenis}) - Rp ${formatRupiah(data.dpNominal)}` : 'Tidak'}</p>
            <p><strong>Tanggal DP:</strong> ${tanggalDP}</p>
            <p><strong>Catatan:</strong> ${data.catatan || '-'}</p>
            <p><strong>Status:</strong> ${data.statusKelengkapan}</p>
            <div style="margin-top: 20px;">
                <button class="btn-edit" data-id="${data.id}">Edit</button>
                <button class="btn-hapus" data-id="${data.id}">Hapus</button>
                ${data.dpCheck ? `<button class="btn-hapus-dp" data-id="${data.id}">Hapus DP</button>` : ''}
            </div>
        `;
        showModal(content);

        // Pasang event listener di dalam modal
        document.querySelector('.modal .btn-edit')?.addEventListener('click', () => {
            hideModal();
            editReservasi(data.id);
        });
        document.querySelector('.modal .btn-hapus')?.addEventListener('click', () => {
            hideModal();
            if (confirm('Yakin ingin menghapus reservasi ini?')) {
                hapusReservasi(data.id);
            }
        });
        document.querySelector('.modal .btn-hapus-dp')?.addEventListener('click', async () => {
            if (confirm('Hapus DP? Timestamp DP akan dihapus dan urutan DP berubah.')) {
                await hapusDP(data.id);
                hideModal();
                loadReservasiTable(); // refresh tabel
            }
        });

    } catch (error) {
        console.error('Error loading detail:', error);
        showNotification('Gagal memuat detail', false);
    }
}

async function editReservasi(id) {
    console.log('Mengedit ID:', id);
    const content = document.getElementById('content');
    await renderReservasiForm(content, id);
}

async function hapusReservasi(id) {
    try {
        await db.collection('reservations').doc(id).delete();
        showNotification('Reservasi dihapus');
        loadReservasiTable(); // refresh
    } catch (error) {
        console.error('Error deleting:', error);
        showNotification('Gagal menghapus', false);
    }
}

async function hapusDP(id) {
    try {
        await db.collection('reservations').doc(id).update({
            dpCheck: false,
            dpJenis: '',
            dpNominal: 0,
            dpTimestamp: null,
            statusKelengkapan: 'Belum ada DP' // asumsi ada meja, sesuaikan
        });
        showNotification('DP berhasil dihapus');
    } catch (error) {
        console.error('Error deleting DP:', error);
        showNotification('Gagal menghapus DP', false);
    }
}

// ==================== CEK MEJA ====================
async function renderCekMeja(container) {
    container.innerHTML = `
        <h2>Cek Meja Kosong</h2>
        <div style="margin-bottom: 20px;">
            <label>Pilih Tanggal:</label>
            <input type="date" id="cek-tanggal" value="${selectedDate}">
            <button id="cek-load">Tampilkan</button>
        </div>
        <div id="meja-grid-container">Loading...</div>
    `;

    document.getElementById('cek-load').addEventListener('click', async () => {
        selectedDate = document.getElementById('cek-tanggal').value;
        await loadCekMeja();
    });

    await loadCekMeja();
}

async function loadCekMeja() {
    const container = document.getElementById('meja-grid-container');
    const tanggal = selectedDate;

    try {
        // Ambil semua meja
        const tablesSnap = await db.collection('tables').get();
        const tables = [];
        tablesSnap.forEach(doc => tables.push({ id: doc.id, ...doc.data() }));

        // Ambil reservasi tanggal tersebut
        const reservationsSnap = await db.collection('reservations').where('tanggal', '==', tanggal).get();
        const occupiedMeja = new Set();
        reservationsSnap.forEach(doc => {
            const data = doc.data();
            if (data.nomorMeja && Array.isArray(data.nomorMeja)) {
                data.nomorMeja.forEach(no => occupiedMeja.add(no));
            }
        });

        // Kelompokkan per area
        const mejaByArea = { non: [], smoking: [], tambahan: [] };
        tables.forEach(t => {
            const area = t.area || 'non';
            if (mejaByArea[area]) mejaByArea[area].push(t.nomorMeja);
            else mejaByArea[area] = [t.nomorMeja];
        });

        let html = '';
        for (let area in mejaByArea) {
            if (mejaByArea[area].length === 0) continue;
            const areaLabel = area === 'non' ? 'Non Smoking' : area === 'smoking' ? 'Smoking' : 'Tambahan';
            html += `<div class="area-${area}"><strong>${areaLabel}</strong><div class="meja-grid">`;
            mejaByArea[area].sort().forEach(nomor => {
                const isOccupied = occupiedMeja.has(nomor);
                const bgColor = isOccupied ? '#666' : '#4CAF50'; // abu-abu gelap vs hijau
                html += `<div class="meja-item" data-nomor="${nomor}" data-area="${area}" style="background-color: ${bgColor}; color: white; border: none; opacity: 1; pointer-events: all;">${nomor}</div>`;
            });
            html += '</div></div>';
        }
        container.innerHTML = html;

        // Event listener klik meja
        document.querySelectorAll('#meja-grid-container .meja-item').forEach(item => {
            item.addEventListener('click', async () => {
                const nomor = item.dataset.nomor;
                const isOccupied = item.style.backgroundColor === 'rgb(102, 102, 102)'; // abu-abu gelap
                if (isOccupied) {
                    // Cari reservasi yang menggunakan meja ini pada tanggal ini
                    const reservationsSnap = await db.collection('reservations')
                        .where('tanggal', '==', tanggal)
                        .where('nomorMeja', 'array-contains', nomor)
                        .get();
                    if (!reservationsSnap.empty) {
                        const doc = reservationsSnap.docs[0]; // ambil yang pertama
                        showDetailReservasi(doc.id);
                    } else {
                        showNotification('Data reservasi tidak ditemukan', false);
                    }
                } else {
                    // Meja kosong, tawarkan buat reservasi baru
                    if (confirm(`Buat reservasi baru dengan meja ${nomor}?`)) {
                        // Arahkan ke form reservasi baru dengan meja terpilih
                        currentPage = 'reservasi-baru';
                        await renderPage('reservasi-baru');
                        // Set checkbox meja dan pilih meja
                        document.getElementById('sudahAdaMeja').checked = true;
                        document.getElementById('meja-selection').style.display = 'block';
                        // Tunggu grid meja terender
                        setTimeout(() => {
                            const mejaItem = document.querySelector(`#meja-grid .meja-item[data-nomor="${nomor}"]`);
                            if (mejaItem) {
                                mejaItem.classList.add('selected');
                                updateSelectedMejaText();
                            }
                        }, 500);
                    }
                }
            });
        });

    } catch (error) {
        console.error('Error loading cek meja:', error);
        container.innerHTML = '<p>Gagal memuat data meja.</p>';
    }
}

// ==================== ATUR MEJA ====================
async function renderAturMeja(container) {
    container.innerHTML = `
        <h2>Atur Meja</h2>
        <div style="margin-bottom: 20px;">
            <button id="tambah-meja-btn">Tambah Meja Baru</button>
            <button id="import-csv-btn">Import dari CSV</button>
        </div>
        <div id="meja-list-container">Loading...</div>
    `;

    document.getElementById('tambah-meja-btn').addEventListener('click', () => {
        showModal(`
            <h3>Tambah Meja Baru</h3>
            <div class="form-group">
                <label>Nomor Meja</label>
                <input type="text" id="new-nomor-meja" placeholder="Contoh: 1, 2A">
            </div>
            <div class="form-group">
                <label>Area</label>
                <select id="new-area">
                    <option value="non">Non Smoking</option>
                    <option value="smoking">Smoking</option>
                    <option value="tambahan">Tambahan</option>
                </select>
            </div>
            <button id="save-new-meja">Simpan</button>
        `);
        document.getElementById('save-new-meja').addEventListener('click', tambahMeja);
    });

    document.getElementById('import-csv-btn').addEventListener('click', () => {
        showModal(`
            <h3>Import Meja dari CSV</h3>
            <p>Format: nomorMeja,area (contoh: 1,non). Setiap baris satu meja.</p>
            <textarea id="csv-data" rows="10" style="width: 100%;"></textarea>
            <button id="import-csv-save">Import</button>
        `);
        document.getElementById('import-csv-save').addEventListener('click', importMejaCSV);
    });

    await loadMejaList();
}

async function loadMejaList() {
    const container = document.getElementById('meja-list-container');
    try {
        const snapshot = await db.collection('tables').orderBy('nomorMeja').get();
        const tables = [];
        snapshot.forEach(doc => tables.push({ id: doc.id, ...doc.data() }));

        let html = '<div class="table-responsive"><table><thead><tr><th>Nomor Meja</th><th>Area</th><th>Aksi</th></tr></thead><tbody>';
        tables.forEach(t => {
            html += `<tr data-id="${t.id}">
                <td>${t.nomorMeja}</td>
                <td>
                    <select class="area-select" data-id="${t.id}">
                        <option value="non" ${t.area === 'non' ? 'selected' : ''}>Non Smoking</option>
                        <option value="smoking" ${t.area === 'smoking' ? 'selected' : ''}>Smoking</option>
                        <option value="tambahan" ${t.area === 'tambahan' ? 'selected' : ''}>Tambahan</option>
                    </select>
                </td>
                <td><button class="btn-hapus" data-id="${t.id}">Hapus</button></td>
            </tr>`;
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;

        // Event listener untuk perubahan area
        document.querySelectorAll('.area-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const id = e.target.dataset.id;
                const area = e.target.value;
                try {
                    await db.collection('tables').doc(id).update({ area });
                    showNotification('Area meja diperbarui');
                } catch (error) {
                    console.error('Error updating area:', error);
                    showNotification('Gagal memperbarui area', false);
                }
            });
        });

        // Event listener untuk hapus
        document.querySelectorAll('.btn-hapus').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = btn.dataset.id;
                if (confirm('Yakin ingin menghapus meja ini?')) {
                    try {
                        await db.collection('tables').doc(id).delete();
                        showNotification('Meja dihapus');
                        loadMejaList(); // refresh
                    } catch (error) {
                        console.error('Error deleting table:', error);
                        showNotification('Gagal menghapus', false);
                    }
                }
            });
        });

    } catch (error) {
        console.error('Error loading tables:', error);
        container.innerHTML = '<p>Gagal memuat data meja.</p>';
    }
}

async function tambahMeja() {
    const nomor = document.getElementById('new-nomor-meja').value.trim();
    const area = document.getElementById('new-area').value;
    if (!nomor) {
        showNotification('Nomor meja harus diisi', false);
        return;
    }
    try {
        // Cek duplikat
        const existing = await db.collection('tables').where('nomorMeja', '==', nomor).get();
        if (!existing.empty) {
            showNotification('Nomor meja sudah ada', false);
            return;
        }
        await db.collection('tables').add({ nomorMeja: nomor, area });
        showNotification('Meja ditambahkan');
        hideModal();
        loadMejaList(); // refresh
    } catch (error) {
        console.error('Error adding table:', error);
        showNotification('Gagal menambah meja', false);
    }
}

async function importMejaCSV() {
    const csv = document.getElementById('csv-data').value.trim();
    if (!csv) {
        showNotification('Data CSV kosong', false);
        return;
    }
    const lines = csv.split('\n');
    let success = 0;
    let failed = 0;
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length < 2) {
            failed++;
            continue;
        }
        const nomor = parts[0].trim();
        const area = parts[1].trim().toLowerCase();
        if (!nomor || !['non', 'smoking', 'tambahan'].includes(area)) {
            failed++;
            continue;
        }
        try {
            // Cek duplikat
            const existing = await db.collection('tables').where('nomorMeja', '==', nomor).get();
            if (existing.empty) {
                await db.collection('tables').add({ nomorMeja: nomor, area });
                success++;
            } else {
                failed++;
            }
        } catch (e) {
            console.error('Error adding meja:', e);
            failed++;
        }
    }
    showNotification(`Import selesai: ${success} berhasil, ${failed} gagal`);
    hideModal();
    loadMejaList();
}

// ==================== AUTH ====================
function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            showNotification('Login berhasil');
        })
        .catch(error => {
            console.error('Login error:', error);
            showNotification('Login gagal: ' + error.message, false);
        });
}

function logout() {
    auth.signOut().then(() => {
        showNotification('Logout berhasil');
    }).catch(error => {
        console.error('Logout error:', error);
    });
}

// ==================== AUTH STATE OBSERVER ====================
auth.onAuthStateChanged(user => {
    currentUser = user;
    renderApp();
});

// ==================== EVENT DELEGATION GLOBAL (untuk menutup modal) ====================
window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

document.querySelector('.close')?.addEventListener('click', hideModal);
// Catatan: .close akan ada setelah modal dirender, tapi event delegation bisa dipasang di document
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('close')) {
        hideModal();
    }
});
