// Konfigurasi Firebase - GANTI DENGAN MILIK ANDA
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

// State aplikasi
let currentUser = null;
let currentPage = 'dashboard';
let tablesCache = []; // untuk menyimpan data meja
let reservationsCache = {}; // cache per tanggal { "2025-03-02": [...] }

// Elemen global
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app');
const contentDiv = document.getElementById('content');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const closeModal = document.querySelector('.close');
const notification = document.getElementById('notification');

// Helper: Notifikasi
function showNotification(message, type = 'success') {
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

// Helper: Format Rupiah
function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID').format(angka);
}

// Helper: Kapitalisasi nama
function capitalizeName(nama) {
    return nama.replace(/\b\w/g, char => char.toUpperCase());
}

// Helper: Simpan ke localStorage
function saveToLocalStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// Helper: Baca dari localStorage
function getFromLocalStorage(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

// Helper: Hitung status kelengkapan
function hitungStatusKelengkapan(reservasi) {
    const punyaMeja = reservasi.nomorMeja && reservasi.nomorMeja.length > 0;
    const punyaDP = reservasi.dpCheck && reservasi.dpNominal > 0;
    if (punyaMeja && punyaDP) return 'Lengkap';
    if (!punyaMeja && punyaDP) return 'Belum ada Meja';
    if (punyaMeja && !punyaDP) return 'Belum ada DP';
    return 'Belum ada Meja & DP';
}

// Fungsi autentikasi
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        await auth.signInWithEmailAndPassword(email, password);
        showNotification('Login berhasil');
    } catch (error) {
        showNotification('Login gagal: ' + error.message, 'error');
    }
});

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        loginContainer.style.display = 'none';
        appContainer.style.display = 'flex';
        loadInitialData();
        navigateTo('dashboard');
    } else {
        currentUser = null;
        loginContainer.style.display = 'block';
        appContainer.style.display = 'none';
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    auth.signOut();
});

// Navigasi SPA
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = e.target.dataset.page;
        navigateTo(page);
    });
});

function navigateTo(page) {
    currentPage = page;
    renderPage(page);
}

// Render halaman berdasarkan nama
async function renderPage(page) {
    switch (page) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'reservation-form':
            renderFormReservasi();
            break;
        case 'reservation-list':
            renderListReservasi();
            break;
        case 'check-tables':
            renderCekMeja();
            break;
        case 'manage-tables':
            renderManageTables();
            break;
        default:
            renderDashboard();
    }
}

// ==================== DASHBOARD ====================
async function renderDashboard() {
    const today = new Date().toISOString().split('T')[0];
    let reservations = await getReservationsByDate(today);
    let tables = await getTables();

    // Hitung statistik
    const totalReservasi = reservations.length;
    const totalMeja = tables.length;
    const mejaTerpakai = new Set();
    reservations.forEach(r => {
        if (r.nomorMeja) r.nomorMeja.forEach(m => mejaTerpakai.add(m));
    });
    const mejaKosong = totalMeja - mejaTerpakai.size;
    const reservasiBelumDP = reservations.filter(r => r.dpCheck && r.dpNominal > 0).length;
    const reservasiTanpaMeja = reservations.filter(r => !r.nomorMeja || r.nomorMeja.length === 0).length;

    contentDiv.innerHTML = `
        <h2>Dashboard</h2>
        <div class="dashboard-cards">
            <div class="card"><h3>Reservasi Hari Ini</h3><div class="value">${totalReservasi}</div></div>
            <div class="card"><h3>Meja Kosong</h3><div class="value">${mejaKosong}</div></div>
            <div class="card"><h3>Reservasi Belum DP</h3><div class="value">${reservasiBelumDP}</div></div>
            <div class="card"><h3>Reservasi Tanpa Meja</h3><div class="value">${reservasiTanpaMeja}</div></div>
        </div>
    `;
}

// ==================== FORM RESERVASI ====================
async function renderFormReservasi(editId = null, preselectedMeja = []) {
    const today = new Date().toISOString().split('T')[0];
    let reservasi = null;
    if (editId) {
        reservasi = await getReservationById(editId);
    }

    // Ambil semua meja
    const tables = await getTables();
    // Kelompokkan berdasarkan area
    const grouped = { non: [], smoking: [], tambahan: [] };
    tables.forEach(t => {
        if (t.area === 'non') grouped.non.push(t);
        else if (t.area === 'smoking') grouped.smoking.push(t);
        else if (t.area === 'tambahan') grouped.tambahan.push(t);
    });

    // Untuk tanggal yang dipilih (default hari ini, atau dari reservasi)
    const selectedDate = reservasi ? reservasi.tanggal : today;

    // Dapatkan meja yang sudah terpakai di tanggal tersebut (kecuali untuk reservasi ini jika edit)
    let occupiedTables = [];
    if (selectedDate) {
        const reservationsOnDate = await getReservationsByDate(selectedDate);
        occupiedTables = reservationsOnDate
            .filter(r => r.id !== editId) // kecualikan diri sendiri
            .flatMap(r => r.nomorMeja || []);
    }

    // HTML form
    let html = `
        <div class="form-reservasi">
            <h2>${editId ? 'Edit Reservasi' : 'Buat Reservasi Baru'}</h2>
            <form id="reservation-form">
                <input type="hidden" id="reservation-id" value="${editId || ''}">
                <div class="form-group">
                    <label>Tanggal Reservasi</label>
                    <input type="date" id="tanggal" value="${selectedDate}" min="${today}" required>
                </div>
                <div class="form-group">
                    <label>Nama Tamu</label>
                    <input type="text" id="nama" value="${reservasi ? reservasi.nama : ''}" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Jumlah Tamu</label>
                        <input type="number" id="jumlahTamu" min="1" value="${reservasi ? reservasi.jumlahTamu : 1}" required>
                    </div>
                    <div class="form-group">
                        <label>Nomor HP</label>
                        <input type="text" id="noHp" value="${reservasi ? reservasi.noHp : ''}" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Preferensi Area</label>
                    <select id="areaPreferensi">
                        <option value="non" ${reservasi && reservasi.areaPreferensi === 'non' ? 'selected' : ''}>Non Smoking</option>
                        <option value="smoking" ${reservasi && reservasi.areaPreferensi === 'smoking' ? 'selected' : ''}>Smoking</option>
                        <option value="tambahan" ${reservasi && reservasi.areaPreferensi === 'tambahan' ? 'selected' : ''}>Tambahan</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="sudahMejaCheck" ${(reservasi && reservasi.nomorMeja && reservasi.nomorMeja.length > 0) || preselectedMeja.length > 0 ? 'checked' : ''}>
                        Sudah Ada Nomor Meja?
                    </label>
                    <div id="mejaGridContainer" style="margin-top:10px; ${(reservasi && reservasi.nomorMeja && reservasi.nomorMeja.length > 0) || preselectedMeja.length > 0 ? '' : 'display:none;'}">
                        <p>Pilih meja (bisa lebih dari satu):</p>
                        <div class="meja-grid">
    `;

    // Render grid meja per area
    for (let area in grouped) {
        let areaLabel = area === 'non' ? 'Non Smoking' : area === 'smoking' ? 'Smoking' : 'Tambahan';
        html += `<div class="meja-area"><h4>${areaLabel}</h4><div class="meja-items">`;
        grouped[area].forEach(meja => {
            const isOccupied = occupiedTables.includes(meja.nomorMeja);
            const isSelected = (reservasi && reservasi.nomorMeja && reservasi.nomorMeja.includes(meja.nomorMeja)) || preselectedMeja.includes(meja.nomorMeja);
            const disabledClass = isOccupied ? 'terisi' : 'kosong';
            const selectedClass = isSelected ? 'selected' : '';
            html += `<div class="meja-item ${disabledClass} ${selectedClass}" data-meja="${meja.nomorMeja}" data-area="${meja.area}" style="cursor: ${isOccupied ? 'not-allowed' : 'pointer'};">${meja.nomorMeja}</div>`;
        });
        html += `</div></div>`;
    }

    html += `
                        </div>
                        <div>Meja terpilih: <span id="selectedMejaDisplay">${reservasi && reservasi.nomorMeja ? reservasi.nomorMeja.join(', ') : preselectedMeja.join(', ')}</span></div>
                        <input type="hidden" id="selectedMeja" value="${reservasi && reservasi.nomorMeja ? reservasi.nomorMeja.join(',') : preselectedMeja.join(',')}">
                    </div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="sudahOrder" ${reservasi && reservasi.sudahOrder ? 'checked' : ''}>
                        Sudah Ada Orderan?
                    </label>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="dpCheck" ${reservasi && reservasi.dpCheck ? 'checked' : ''}>
                        Ada Pembayaran DP?
                    </label>
                    <div id="dpFields" style="margin-top:10px; ${reservasi && reservasi.dpCheck ? '' : 'display:none;'}">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Jenis Pembayaran</label>
                                <select id="dpJenis">
                                    <option value="Transfer" ${reservasi && reservasi.dpJenis === 'Transfer' ? 'selected' : ''}>Transfer</option>
                                    <option value="Cash" ${reservasi && reservasi.dpJenis === 'Cash' ? 'selected' : ''}>Cash</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Nominal DP</label>
                                <input type="text" id="dpNominal" value="${reservasi && reservasi.dpNominal ? formatRupiah(reservasi.dpNominal) : ''}" placeholder="Contoh: 50000">
                            </div>
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label>Catatan</label>
                    <textarea id="catatan">${reservasi ? reservasi.catatan || '' : ''}</textarea>
                </div>
                <button type="submit" class="btn">Simpan Reservasi</button>
            </form>
        </div>
    `;

    contentDiv.innerHTML = html;

    // Event listener untuk checkbox meja
    const checkMeja = document.getElementById('sudahMejaCheck');
    const mejaGridContainer = document.getElementById('mejaGridContainer');
    checkMeja.addEventListener('change', () => {
        mejaGridContainer.style.display = checkMeja.checked ? 'block' : 'none';
        if (!checkMeja.checked) {
            document.getElementById('selectedMeja').value = '';
            document.getElementById('selectedMejaDisplay').innerText = '';
        }
    });

    // Event listener untuk memilih meja
    document.querySelectorAll('.meja-item.kosong').forEach(item => {
        item.addEventListener('click', () => {
            if (item.classList.contains('terisi')) return;
            const meja = item.dataset.meja;
            const selectedInput = document.getElementById('selectedMeja');
            let selected = selectedInput.value ? selectedInput.value.split(',') : [];
            if (item.classList.contains('selected')) {
                // hapus
                selected = selected.filter(m => m !== meja);
                item.classList.remove('selected');
            } else {
                // tambah
                selected.push(meja);
                item.classList.add('selected');
            }
            selectedInput.value = selected.join(',');
            document.getElementById('selectedMejaDisplay').innerText = selected.join(', ');
        });
    });

    // DP checkbox toggle
    const dpCheck = document.getElementById('dpCheck');
    const dpFields = document.getElementById('dpFields');
    dpCheck.addEventListener('change', () => {
        dpFields.style.display = dpCheck.checked ? 'block' : 'none';
    });

    // Format Rupiah saat mengetik nominal
    const dpNominalInput = document.getElementById('dpNominal');
    dpNominalInput.addEventListener('input', function(e) {
        let value = this.value.replace(/\D/g, '');
        if (value) {
            this.value = formatRupiah(parseInt(value));
        } else {
            this.value = '';
        }
    });

    // Kapitalisasi nama saat blur
    document.getElementById('nama').addEventListener('blur', function() {
        this.value = capitalizeName(this.value);
    });

    // Submit form
    document.getElementById('reservation-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('reservation-id').value || null;
        const tanggal = document.getElementById('tanggal').value;
        const nama = capitalizeName(document.getElementById('nama').value);
        const jumlahTamu = parseInt(document.getElementById('jumlahTamu').value);
        const noHp = document.getElementById('noHp').value;
        const areaPreferensi = document.getElementById('areaPreferensi').value;
        const sudahMejaCheck = document.getElementById('sudahMejaCheck').checked;
        let nomorMeja = sudahMejaCheck ? document.getElementById('selectedMeja').value.split(',').filter(m => m) : [];
        const sudahOrder = document.getElementById('sudahOrder').checked;
        const dpCheckVal = document.getElementById('dpCheck').checked;
        let dpJenis = '', dpNominal = 0, dpTimestamp = null;
        if (dpCheckVal) {
            dpJenis = document.getElementById('dpJenis').value;
            const nominalStr = document.getElementById('dpNominal').value.replace(/\D/g, '');
            dpNominal = parseInt(nominalStr) || 0;
            if (dpNominal <= 0) {
                showNotification('Nominal DP harus diisi', 'error');
                return;
            }
        }

        // Jika edit dan sebelumnya ada DP tetapi sekarang dihilangkan, kita akan hapus timestamp nanti
        const existingReservation = id ? await getReservationById(id) : null;

        // Tentukan dpTimestamp: jika baru dicentang dan nominal>0, set ke sekarang. Jika sebelumnya ada dan masih dicentang, pertahankan timestamp lama.
        if (dpCheckVal && dpNominal > 0) {
            if (existingReservation && existingReservation.dpCheck && existingReservation.dpNominal > 0) {
                dpTimestamp = existingReservation.dpTimestamp; // pertahankan
            } else {
                dpTimestamp = firebase.firestore.FieldValue.serverTimestamp();
            }
        } else {
            dpTimestamp = null; // hapus DP
        }

        // Validasi tanggal tidak boleh sebelum hari ini
        const today = new Date().toISOString().split('T')[0];
        if (tanggal < today) {
            showNotification('Tanggal tidak boleh sebelum hari ini', 'error');
            return;
        }

        // Validasi meja tidak bentrok dengan reservasi lain
        if (nomorMeja.length > 0) {
            const reservationsOnDate = await getReservationsByDate(tanggal);
            const conflict = reservationsOnDate.some(r => {
                if (r.id === id) return false;
                return r.nomorMeja && r.nomorMeja.some(m => nomorMeja.includes(m));
            });
            if (conflict) {
                showNotification('Salah satu meja sudah dipesan untuk tanggal ini', 'error');
                return;
            }
        }

        const reservasiData = {
            tanggal,
            nama,
            jumlahTamu,
            noHp,
            areaPreferensi,
            nomorMeja,
            sudahOrder,
            dpCheck: dpCheckVal,
            dpJenis: dpCheckVal ? dpJenis : null,
            dpNominal: dpCheckVal ? dpNominal : 0,
            dpTimestamp: dpTimestamp,
            catatan: document.getElementById('catatan').value,
            statusKelengkapan: hitungStatusKelengkapan({ nomorMeja, dpCheck: dpCheckVal, dpNominal }),
            createdAt: existingReservation?.createdAt || firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            if (id) {
                await db.collection('reservations').doc(id).update(reservasiData);
            } else {
                await db.collection('reservations').add(reservasiData);
            }
            showNotification('Reservasi berhasil disimpan');
            // Hapus cache untuk tanggal tersebut
            delete reservationsCache[tanggal];
            navigateTo('dashboard');
        } catch (error) {
            console.error(error);
            // Simpan ke localStorage sebagai cadangan
            const localId = id || 'local_' + Date.now();
            const localData = { ...reservasiData, id: localId };
            let localReservations = getFromLocalStorage('reservations_offline') || [];
            localReservations = localReservations.filter(r => r.id !== localId);
            localReservations.push(localData);
            saveToLocalStorage('reservations_offline', localReservations);
            showNotification('Gagal menyimpan ke server, disimpan lokal', 'error');
        }
    });
}

// ==================== LIST RESERVASI ====================
async function renderListReservasi() {
    const today = new Date().toISOString().split('T')[0];
    let html = `
        <h2>Daftar Reservasi</h2>
        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px;">
            <input type="date" id="filter-tanggal" value="${today}">
            <button id="load-reservations" class="btn">Muat</button>
            <select id="sort-by">
                <option value="dp">Urutan DP</option>
                <option value="meja">Nomor Meja</option>
                <option value="status">Status Kelengkapan</option>
            </select>
        </div>
        <div id="reservation-table-container" class="table-container">
            <!-- Tabel akan diisi -->
        </div>
    `;
    contentDiv.innerHTML = html;

    document.getElementById('load-reservations').addEventListener('click', async () => {
        const tanggal = document.getElementById('filter-tanggal').value;
        const sortBy = document.getElementById('sort-by').value;
        await loadReservationsTable(tanggal, sortBy);
    });

    // Muat default hari ini
    await loadReservationsTable(today, 'dp');
}

async function loadReservationsTable(tanggal, sortBy) {
    let reservations = await getReservationsByDate(tanggal);
    const tables = await getTables();

    // Urutkan DP: hanya yang punya DP, beri nomor urut
    let dpReservations = reservations.filter(r => r.dpCheck && r.dpNominal > 0 && r.dpTimestamp);
    dpReservations.sort((a, b) => {
        const ta = a.dpTimestamp?.seconds || 0;
        const tb = b.dpTimestamp?.seconds || 0;
        return ta - tb;
    });
    const dpMap = new Map();
    dpReservations.forEach((r, idx) => dpMap.set(r.id, idx + 1));

    // Urutkan sesuai pilihan
    if (sortBy === 'dp') {
        reservations.sort((a, b) => {
            const aHasDP = dpMap.has(a.id) ? dpMap.get(a.id) : Infinity;
            const bHasDP = dpMap.has(b.id) ? dpMap.get(b.id) : Infinity;
            if (aHasDP !== bHasDP) return aHasDP - bHasDP;
            return (a.nama || '').localeCompare(b.nama || '');
        });
    } else if (sortBy === 'meja') {
        reservations.sort((a, b) => {
            const aMeja = a.nomorMeja && a.nomorMeja.length ? a.nomorMeja[0] : '';
            const bMeja = b.nomorMeja && b.nomorMeja.length ? b.nomorMeja[0] : '';
            return aMeja.localeCompare(bMeja);
        });
    } else if (sortBy === 'status') {
        const statusOrder = { 'Lengkap': 1, 'Belum ada Meja': 2, 'Belum ada DP': 3, 'Belum ada Meja & DP': 4 };
        reservations.sort((a, b) => (statusOrder[a.statusKelengkapan] || 5) - (statusOrder[b.statusKelengkapan] || 5));
    }

    let tableHtml = `
        <table>
            <thead>
                <tr>
                    <th>Meja</th><th>Nama</th><th>Tamu</th><th>Urutan DP</th><th>Status</th><th>Aksi</th>
                </tr>
            </thead>
            <tbody>
    `;

    reservations.forEach(r => {
        const meja = r.nomorMeja && r.nomorMeja.length ? r.nomorMeja.join(', ') : '-';
        const urutanDP = dpMap.has(r.id) ? dpMap.get(r.id) : '-';
        let statusClass = '';
        if (r.statusKelengkapan === 'Lengkap') statusClass = 'lengkap';
        else if (r.statusKelengkapan === 'Belum ada Meja') statusClass = 'belum-meja';
        else if (r.statusKelengkapan === 'Belum ada DP') statusClass = 'belum-dp';
        else statusClass = 'belum-keduanya';

        tableHtml += `
            <tr data-id="${r.id}">
                <td>${meja}</td>
                <td>${r.nama}</td>
                <td>${r.jumlahTamu}</td>
                <td>${urutanDP}</td>
                <td><span class="badge ${statusClass}">${r.statusKelengkapan}</span></td>
                <td>
                    <button class="btn-edit" data-id="${r.id}">Edit</button>
                    <button class="btn-delete" data-id="${r.id}">Hapus</button>
                </td>
            </tr>
        `;
    });

    tableHtml += '</tbody></table>';
    document.getElementById('reservation-table-container').innerHTML = tableHtml;

    // Event listener untuk baris (detail)
    document.querySelectorAll('#reservation-table-container tbody tr').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            const id = row.dataset.id;
            showDetailReservasi(id);
        });
    });

    // Tombol edit
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            renderFormReservasi(id);
        });
    });

    // Tombol hapus
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            confirmHapusReservasi(id);
        });
    });
}

// ==================== DETAIL RESERVASI MODAL ====================
async function showDetailReservasi(id) {
    const reservasi = await getReservationById(id);
    if (!reservasi) return;

    // Format tanggal DP jika ada
    let tanggalDP = '-';
    if (reservasi.dpTimestamp) {
        const ts = reservasi.dpTimestamp.toDate ? reservasi.dpTimestamp.toDate() : new Date(reservasi.dpTimestamp);
        tanggalDP = ts.toLocaleDateString('id-ID');
    }

    modalBody.innerHTML = `
        <h3>Detail Reservasi</h3>
        <p><strong>Tanggal:</strong> ${reservasi.tanggal}</p>
        <p><strong>Nama:</strong> ${reservasi.nama}</p>
        <p><strong>Jumlah Tamu:</strong> ${reservasi.jumlahTamu}</p>
        <p><strong>No HP:</strong> ${reservasi.noHp}</p>
        <p><strong>Preferensi Area:</strong> ${reservasi.areaPreferensi}</p>
        <p><strong>Nomor Meja:</strong> ${reservasi.nomorMeja && reservasi.nomorMeja.length ? reservasi.nomorMeja.join(', ') : '-'}</p>
        <p><strong>Sudah Order:</strong> ${reservasi.sudahOrder ? 'Ya' : 'Tidak'}</p>
        <p><strong>DP:</strong> ${reservasi.dpCheck ? `Ya (${reservasi.dpJenis} ${formatRupiah(reservasi.dpNominal)})` : 'Tidak'}</p>
        <p><strong>Tanggal DP:</strong> ${tanggalDP}</p>
        <p><strong>Catatan:</strong> ${reservasi.catatan || '-'}</p>
        <p><strong>Status:</strong> ${reservasi.statusKelengkapan}</p>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button id="modal-edit" class="btn" data-id="${id}">Edit</button>
            <button id="modal-delete" class="btn btn-danger" data-id="${id}">Hapus</button>
            ${reservasi.dpCheck && reservasi.dpNominal > 0 ? `<button id="modal-delete-dp" class="btn btn-secondary" data-id="${id}">Hapus DP</button>` : ''}
        </div>
    `;
    modal.style.display = 'block';

    document.getElementById('modal-edit').addEventListener('click', () => {
        modal.style.display = 'none';
        renderFormReservasi(id);
    });
    document.getElementById('modal-delete').addEventListener('click', () => {
        modal.style.display = 'none';
        confirmHapusReservasi(id);
    });
    const deleteDpBtn = document.getElementById('modal-delete-dp');
    if (deleteDpBtn) {
        deleteDpBtn.addEventListener('click', async () => {
            if (confirm('Hapus DP dari reservasi ini?')) {
                await hapusDPReservasi(id);
                modal.style.display = 'none';
            }
        });
    }
}

// Hapus DP
async function hapusDPReservasi(id) {
    try {
        await db.collection('reservations').doc(id).update({
            dpCheck: false,
            dpJenis: null,
            dpNominal: 0,
            dpTimestamp: null,
            statusKelengkapan: hitungStatusKelengkapan({ nomorMeja: (await getReservationById(id)).nomorMeja, dpCheck: false, dpNominal: 0 })
        });
        showNotification('DP berhasil dihapus');
        // Refresh list jika perlu
        const tanggal = document.getElementById('filter-tanggal')?.value;
        if (tanggal) loadReservationsTable(tanggal, document.getElementById('sort-by')?.value);
    } catch (error) {
        showNotification('Gagal hapus DP', 'error');
    }
}

// Konfirmasi hapus reservasi
function confirmHapusReservasi(id) {
    if (confirm('Yakin ingin menghapus reservasi ini?')) {
        hapusReservasi(id);
    }
}

async function hapusReservasi(id) {
    try {
        await db.collection('reservations').doc(id).delete();
        showNotification('Reservasi dihapus');
        const tanggal = document.getElementById('filter-tanggal')?.value;
        if (tanggal) {
            delete reservationsCache[tanggal];
            loadReservationsTable(tanggal, document.getElementById('sort-by')?.value);
        }
    } catch (error) {
        showNotification('Gagal hapus', 'error');
    }
}

// ==================== CEK MEJA KOSONG ====================
async function renderCekMeja() {
    const today = new Date().toISOString().split('T')[0];
    let html = `
        <h2>Cek Ketersediaan Meja</h2>
        <div style="margin-bottom: 20px;">
            <label>Pilih Tanggal: </label>
            <input type="date" id="cek-tanggal" value="${today}">
            <button id="cek-load" class="btn">Tampilkan</button>
        </div>
        <div id="meja-grid-container"></div>
    `;
    contentDiv.innerHTML = html;

    document.getElementById('cek-load').addEventListener('click', async () => {
        const tanggal = document.getElementById('cek-tanggal').value;
        await renderMejaGridByDate(tanggal);
    });

    await renderMejaGridByDate(today);
}

async function renderMejaGridByDate(tanggal) {
    const tables = await getTables();
    const reservations = await getReservationsByDate(tanggal);
    const occupiedMap = new Map(); // nomorMeja -> reservasi id
    reservations.forEach(r => {
        if (r.nomorMeja) {
            r.nomorMeja.forEach(m => occupiedMap.set(m, r.id));
        }
    });

    // Kelompokkan
    const grouped = { non: [], smoking: [], tambahan: [] };
    tables.forEach(t => {
        grouped[t.area].push(t);
    });

    let gridHtml = '<div class="meja-grid">';
    for (let area in grouped) {
        let areaLabel = area === 'non' ? 'Non Smoking' : area === 'smoking' ? 'Smoking' : 'Tambahan';
        gridHtml += `<div class="meja-area"><h4>${areaLabel}</h4><div class="meja-items">`;
        grouped[area].forEach(meja => {
            const isOccupied = occupiedMap.has(meja.nomorMeja);
            const kelas = isOccupied ? 'terisi' : 'kosong';
            gridHtml += `<div class="meja-item ${kelas}" data-meja="${meja.nomorMeja}" data-tanggal="${tanggal}" data-reservasi-id="${occupiedMap.get(meja.nomorMeja) || ''}">${meja.nomorMeja}</div>`;
        });
        gridHtml += `</div></div>`;
    }
    gridHtml += '</div>';
    document.getElementById('meja-grid-container').innerHTML = gridHtml;

    // Event klik
    document.querySelectorAll('.meja-item').forEach(item => {
        item.addEventListener('click', async () => {
            const tanggal = item.dataset.tanggal;
            const meja = item.dataset.meja;
            const reservasiId = item.dataset.reservasiId;
            if (item.classList.contains('terisi')) {
                // Tampilkan detail reservasi
                if (reservasiId) showDetailReservasi(reservasiId);
            } else {
                // Kosong: konfirmasi buat reservasi baru
                if (confirm(`Buat reservasi baru untuk meja ${meja} pada tanggal ${tanggal}?`)) {
                    navigateTo('reservation-form');
                    // Kita perlu melempar data ke form: pilih meja dan tanggal
                    // Gunakan setTimeout agar form sudah dirender
                    setTimeout(() => {
                        renderFormReservasi(null, [meja]);
                        document.getElementById('tanggal').value = tanggal;
                        document.getElementById('sudahMejaCheck').checked = true;
                        document.getElementById('mejaGridContainer').style.display = 'block';
                        // Pilih meja
                        const mejaItems = document.querySelectorAll('.meja-item.kosong');
                        mejaItems.forEach(m => {
                            if (m.dataset.meja === meja) {
                                m.classList.add('selected');
                            }
                        });
                        document.getElementById('selectedMeja').value = meja;
                        document.getElementById('selectedMejaDisplay').innerText = meja;
                    }, 100);
                }
            }
        });
    });
}

// ==================== ATUR MEJA ====================
async function renderManageTables() {
    let html = `
        <h2>Atur Meja</h2>
        <div style="margin-bottom: 20px;">
            <button id="add-table-btn" class="btn">Tambah Meja Baru</button>
            <button id="import-csv-btn" class="btn btn-secondary">Import CSV</button>
        </div>
        <div id="tables-list" class="table-container"></div>
    `;
    contentDiv.innerHTML = html;

    document.getElementById('add-table-btn').addEventListener('click', () => {
        showAddTableModal();
    });
    document.getElementById('import-csv-btn').addEventListener('click', () => {
        showImportCSVModal();
    });

    await loadTablesList();
}

async function loadTablesList() {
    const tables = await getTables();
    let html = `
        <table>
            <thead><tr><th>Nomor Meja</th><th>Area</th><th>Aksi</th></tr></thead>
            <tbody>
    `;
    tables.forEach(t => {
        html += `
            <tr data-id="${t.id}">
                <td>${t.nomorMeja}</td>
                <td>
                    <select class="table-area" data-id="${t.id}">
                        <option value="non" ${t.area === 'non' ? 'selected' : ''}>Non Smoking</option>
                        <option value="smoking" ${t.area === 'smoking' ? 'selected' : ''}>Smoking</option>
                        <option value="tambahan" ${t.area === 'tambahan' ? 'selected' : ''}>Tambahan</option>
                    </select>
                </td>
                <td><button class="btn-delete-table" data-id="${t.id}">Hapus</button></td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    document.getElementById('tables-list').innerHTML = html;

    // Event listener ganti area
    document.querySelectorAll('.table-area').forEach(select => {
        select.addEventListener('change', async (e) => {
            const id = e.target.dataset.id;
            const area = e.target.value;
            try {
                await db.collection('tables').doc(id).update({ area });
                showNotification('Area meja diperbarui');
                tablesCache = []; // invalidate cache
            } catch (error) {
                showNotification('Gagal update', 'error');
            }
        });
    });

    // Tombol hapus
    document.querySelectorAll('.btn-delete-table').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (confirm('Hapus meja ini?')) {
                try {
                    await db.collection('tables').doc(id).delete();
                    showNotification('Meja dihapus');
                    tablesCache = [];
                    loadTablesList();
                } catch (error) {
                    showNotification('Gagal hapus', 'error');
                }
            }
        });
    });
}

function showAddTableModal() {
    modalBody.innerHTML = `
        <h3>Tambah Meja Baru</h3>
        <form id="add-table-form">
            <div class="form-group">
                <label>Nomor Meja</label>
                <input type="text" id="new-table-number" required>
            </div>
            <div class="form-group">
                <label>Area</label>
                <select id="new-table-area">
                    <option value="non">Non Smoking</option>
                    <option value="smoking">Smoking</option>
                    <option value="tambahan">Tambahan</option>
                </select>
            </div>
            <button type="submit" class="btn">Simpan</button>
        </form>
    `;
    modal.style.display = 'block';

    document.getElementById('add-table-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nomorMeja = document.getElementById('new-table-number').value.trim();
        const area = document.getElementById('new-table-area').value;

        // Cek duplikat
        const existing = await db.collection('tables').where('nomorMeja', '==', nomorMeja).get();
        if (!existing.empty) {
            showNotification('Nomor meja sudah ada', 'error');
            return;
        }

        try {
            await db.collection('tables').add({ nomorMeja, area });
            showNotification('Meja ditambahkan');
            tablesCache = [];
            modal.style.display = 'none';
            loadTablesList();
        } catch (error) {
            showNotification('Gagal simpan', 'error');
        }
    });
}

function showImportCSVModal() {
    modalBody.innerHTML = `
        <h3>Import Meja dari CSV</h3>
        <p>Format: nomorMeja,area (area: non/smoking/tambahan)</p>
        <textarea id="csv-text" rows="10" placeholder="Contoh:
M1,non
M2,smoking
M3,tambahan" style="width:100%;"></textarea>
        <button id="import-csv-submit" class="btn" style="margin-top:10px;">Import</button>
    `;
    modal.style.display = 'block';

    document.getElementById('import-csv-submit').addEventListener('click', async () => {
        const csv = document.getElementById('csv-text').value.trim();
        const lines = csv.split('\n');
        const added = [];
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
            if (!['non', 'smoking', 'tambahan'].includes(area)) {
                errors.push(`Area salah di baris: ${line}`);
                continue;
            }
            // Cek duplikat di DB
            const existing = await db.collection('tables').where('nomorMeja', '==', nomorMeja).get();
            if (!existing.empty) {
                errors.push(`Nomor meja ${nomorMeja} sudah ada`);
                continue;
            }
            try {
                await db.collection('tables').add({ nomorMeja, area });
                added.push(nomorMeja);
            } catch (error) {
                errors.push(`Gagal simpan ${nomorMeja}: ${error.message}`);
            }
        }

        let msg = `Berhasil menambah ${added.length} meja.`;
        if (errors.length) msg += ` Gagal: ${errors.join('; ')}`;
        showNotification(msg, errors.length ? 'error' : 'success');
        tablesCache = [];
        modal.style.display = 'none';
        loadTablesList();
    });
}

// ==================== FUNGSI DATABASE ====================
async function getTables() {
    if (tablesCache.length > 0) return tablesCache;
    try {
        const snapshot = await db.collection('tables').get();
        tablesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        saveToLocalStorage('tables', tablesCache);
        return tablesCache;
    } catch (error) {
        console.warn('Gagal ambil tables, pakai localStorage', error);
        return getFromLocalStorage('tables') || [];
    }
}

async function getReservationsByDate(tanggal) {
    if (reservationsCache[tanggal]) return reservationsCache[tanggal];
    try {
        const snapshot = await db.collection('reservations').where('tanggal', '==', tanggal).get();
        const reservations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        reservationsCache[tanggal] = reservations;
        saveToLocalStorage(`reservations_${tanggal}`, reservations);
        return reservations;
    } catch (error) {
        console.warn('Gagal ambil reservasi, pakai localStorage', error);
        return getFromLocalStorage(`reservations_${tanggal}`) || [];
    }
}

async function getReservationById(id) {
    // Coba dari cache dulu
    for (let tanggal in reservationsCache) {
        const found = reservationsCache[tanggal].find(r => r.id === id);
        if (found) return found;
    }
    try {
        const doc = await db.collection('reservations').doc(id).get();
        if (doc.exists) return { id: doc.id, ...doc.data() };
    } catch (error) {
        // Cari di localStorage
        const allLocal = getFromLocalStorage('reservations_offline') || [];
        return allLocal.find(r => r.id === id);
    }
    return null;
}

async function loadInitialData() {
    // Pre-fetch tables
    await getTables();
}

// Tutup modal
closeModal.onclick = () => modal.style.display = 'none';
window.onclick = (e) => {
    if (e.target === modal) modal.style.display = 'none';
};
