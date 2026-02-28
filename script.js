// ================== KONFIGURASI FIREBASE ==================
const firebaseConfig = {
    apiKey: "AIzaSyD0r4H0CVS45gbnO9HILt8VStX77KPA0bQ",
    authDomain: "reservasi-574aa.firebaseapp.com",
    projectId: "reservasi-574aa",
    storageBucket: "reservasi-574aa.firebasestorage.app",
    messagingSenderId: "357990257039",
    appId: "1:357990257039:web:3398c968da7b24490cbbfa"
};
// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Aktifkan persistence offline Firestore
db.enablePersistence()
    .catch(err => console.log('Persistence error:', err));

// ==================== STATE GLOBAL ====================
let currentPage = 'dashboard';
let tables = [];                  // Data meja (selalu update dari listener)
let selectedTables = [];           // Untuk form reservasi
let columnSettings = JSON.parse(localStorage.getItem('columnSettings')) || {
    columns: ['namaTamu', 'jumlahTamu', 'noHP', 'area', 'nomorMeja', 'statusOrder', 'statusDP', 'nominalDP', 'urutanDP', 'statusKelengkapan'],
    order: ['namaTamu', 'jumlahTamu', 'noHP', 'area', 'nomorMeja', 'statusOrder', 'statusDP', 'nominalDP', 'urutanDP', 'statusKelengkapan']
};
let deleteCallback = null;

// ==================== LISTENER HANDLES ====================
let unsubscribeReservations = null;   // untuk dashboard
let unsubscribeTables = null;         // untuk dashboard dan manage
let unsubscribeList = null;           // untuk list reservasi
let unsubscribeCheck = null;          // untuk cek meja

// ==================== UTILITY FUNCTIONS ====================
function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID').format(angka);
}
function capitalizeWords(str) {
    return str.replace(/\b\w/g, l => l.toUpperCase());
}
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}
function getBadgeClass(status) {
    if (status === 'Lengkap') return 'lengkap';
    if (status === 'Belum ada Meja') return 'belum-meja';
    if (status === 'Belum ada DP') return 'belum-dp';
    return 'belum-meja-dp';
}

// ==================== NAVIGASI ====================
function showPage(pageId) {
    // Hentikan semua listener yang tidak diperlukan
    if (unsubscribeReservations) { unsubscribeReservations(); unsubscribeReservations = null; }
    if (unsubscribeTables) { unsubscribeTables(); unsubscribeTables = null; }
    if (unsubscribeList) { unsubscribeList(); unsubscribeList = null; }
    if (unsubscribeCheck) { unsubscribeCheck(); unsubscribeCheck = null; }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    currentPage = pageId;

    // Panggil inisialisasi halaman
    if (pageId === 'dashboard') {
        initDashboard();
    } else if (pageId === 'newReservation') {
        initNewReservation();
    } else if (pageId === 'listReservation') {
        initListReservation();
    } else if (pageId === 'checkTable') {
        initCheckTable();
    } else if (pageId === 'manageTable') {
        initManageTable();
    }
}

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
});

// ==================== DASHBOARD ====================
function initDashboard() {
    const today = new Date().toISOString().split('T')[0];

    // Listener reservasi hari ini
    unsubscribeReservations = db.collection('reservations')
        .where('tanggal', '==', today)
        .onSnapshot(snapshot => {
            const todayRes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            document.getElementById('todayResCount').textContent = todayRes.length;
            const incomplete = todayRes.filter(r => r.statusKelengkapan !== 'Lengkap').length;
            document.getElementById('incompleteCount').textContent = incomplete;
            // Update meja tersedia nanti setelah tables tersedia
            if (tables.length > 0) {
                updateAvailableTables(todayRes);
            }
        }, error => {
            console.log('Dashboard listener error, fallback ke localStorage', error);
            loadDashboardFallback(today);
        });

    // Listener meja (untuk semua halaman, tapi kita pakai untuk update tables global)
    unsubscribeTables = db.collection('tables').onSnapshot(snapshot => {
        tables = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        localStorage.setItem('tables', JSON.stringify(tables));
        // Jika sudah ada data reservasi hari ini, hitung ulang meja tersedia
        const todayResEl = document.getElementById('todayResCount');
        if (todayResEl.textContent !== '0') {
            // Ambil data reservasi dari state atau bisa pakai listener terpisah
            // Karena kita tidak menyimpan reservasi di global, kita bisa pakai data terakhir dari listener
        }
    }, error => {
        console.log('Tables listener error, pakai localStorage', error);
        tables = JSON.parse(localStorage.getItem('tables')) || [];
    });
}

function updateAvailableTables(todayRes) {
    const totalTables = tables.length;
    const usedTables = new Set();
    todayRes.forEach(r => {
        if (r.nomorMeja) r.nomorMeja.forEach(m => usedTables.add(m));
    });
    const available = totalTables - usedTables.size;
    document.getElementById('availableTableCount').textContent = available;
}

function loadDashboardFallback(today) {
    const cachedRes = JSON.parse(localStorage.getItem('reservations')) || [];
    const todayRes = cachedRes.filter(r => r.tanggal === today);
    document.getElementById('todayResCount').textContent = todayRes.length;
    document.getElementById('incompleteCount').textContent = todayRes.filter(r => r.statusKelengkapan !== 'Lengkap').length;
    tables = JSON.parse(localStorage.getItem('tables')) || [];
    updateAvailableTables(todayRes);
}

// ==================== BUAT RESERVASI BARU ====================
function initNewReservation() {
    // Reset form
    document.getElementById('resDate').valueAsDate = new Date();
    document.getElementById('guestName').value = '';
    document.getElementById('guestCount').value = '';
    document.getElementById('guestPhone').value = '';
    document.getElementById('areaPref').value = 'Non Smoking';
    document.getElementById('hasTable').checked = false;
    document.getElementById('tableGridContainer').style.display = 'none';
    document.getElementById('hasOrder').checked = false;
    document.getElementById('hasDP').checked = false;
    document.getElementById('dpFields').style.display = 'none';
    document.getElementById('dpAmount').value = '';
    selectedTables = [];

    // Event listeners
    document.getElementById('hasTable').addEventListener('change', toggleTableGrid);
    document.getElementById('hasDP').addEventListener('change', toggleDPFields);
    document.getElementById('resDate').addEventListener('change', renderTableGrid);
    document.getElementById('reservationForm').onsubmit = submitReservation;

    // Load meja untuk grid (pakai data tables global, pastikan sudah ada)
    if (tables.length === 0) {
        // Ambil dari localStorage dulu, nanti akan diupdate listener
        tables = JSON.parse(localStorage.getItem('tables')) || [];
    }
    renderTableGrid();
}

function toggleTableGrid() {
    const checked = document.getElementById('hasTable').checked;
    document.getElementById('tableGridContainer').style.display = checked ? 'block' : 'none';
    if (checked) renderTableGrid();
}

function toggleDPFields() {
    const checked = document.getElementById('hasDP').checked;
    document.getElementById('dpFields').style.display = checked ? 'block' : 'none';
}

function renderTableGrid() {
    const tanggal = document.getElementById('resDate').value;
    const grid = document.getElementById('tableGrid');
    if (!grid) return;
    grid.innerHTML = '';

    // Ambil reservasi di tanggal yang sama (dari listener atau localStorage)
    db.collection('reservations').where('tanggal', '==', tanggal).get()
        .then(snapshot => {
            const reservedTables = snapshot.docs
                .flatMap(doc => doc.data().nomorMeja || []);
            tables.forEach(table => {
                const div = document.createElement('div');
                div.className = 'table-item';
                if (reservedTables.includes(table.nomorMeja)) {
                    div.classList.add('unavailable');
                } else {
                    div.classList.add('available');
                }
                div.textContent = table.nomorMeja;
                div.dataset.no = table.nomorMeja;
                div.onclick = () => {
                    if (div.classList.contains('unavailable')) return;
                    div.classList.toggle('selected');
                    if (div.classList.contains('selected')) {
                        selectedTables.push(table.nomorMeja);
                    } else {
                        selectedTables = selectedTables.filter(t => t !== table.nomorMeja);
                    }
                };
                grid.appendChild(div);
            });
        })
        .catch(err => {
            console.log('Gagal ambil reservasi, pakai localStorage', err);
            const cachedRes = JSON.parse(localStorage.getItem('reservations')) || [];
            const reservedTables = cachedRes
                .filter(r => r.tanggal === tanggal)
                .flatMap(r => r.nomorMeja || []);
            tables.forEach(table => {
                const div = document.createElement('div');
                div.className = 'table-item';
                if (reservedTables.includes(table.nomorMeja)) {
                    div.classList.add('unavailable');
                } else {
                    div.classList.add('available');
                }
                div.textContent = table.nomorMeja;
                div.dataset.no = table.nomorMeja;
                div.onclick = () => {
                    if (div.classList.contains('unavailable')) return;
                    div.classList.toggle('selected');
                    if (div.classList.contains('selected')) {
                        selectedTables.push(table.nomorMeja);
                    } else {
                        selectedTables = selectedTables.filter(t => t !== table.nomorMeja);
                    }
                };
                grid.appendChild(div);
            });
        });
}

async function submitReservation(e) {
    e.preventDefault();
    const tanggal = document.getElementById('resDate').value;
    const namaTamu = capitalizeWords(document.getElementById('guestName').value);
    const jumlahTamu = parseInt(document.getElementById('guestCount').value);
    const noHP = document.getElementById('guestPhone').value;
    const areaPref = document.getElementById('areaPref').value;
    const hasTable = document.getElementById('hasTable').checked;
    const nomorMeja = hasTable ? selectedTables : [];
    const sudahOrder = document.getElementById('hasOrder').checked;
    const adaDP = document.getElementById('hasDP').checked;
    let jenisPembayaran = null, nominalDP = 0;
    if (adaDP) {
        jenisPembayaran = document.getElementById('paymentType').value;
        nominalDP = parseInt(document.getElementById('dpAmount').value.replace(/[^0-9]/g, '')) || 0;
    }

    // Hitung urutanDP berdasarkan reservasi yang sudah ada di tanggal yang sama
    let urutanDP = 0;
    try {
        const snapshot = await db.collection('reservations')
            .where('tanggal', '==', tanggal)
            .where('adaDP', '==', true)
            .get();
        urutanDP = snapshot.size + 1;
    } catch (err) {
        console.log('Gagal hitung urutan DP, pakai lokal', err);
        const cached = JSON.parse(localStorage.getItem('reservations')) || [];
        const todayDP = cached.filter(r => r.tanggal === tanggal && r.adaDP);
        urutanDP = todayDP.length + 1;
    }

    // Tentukan status kelengkapan
    let statusKelengkapan = 'Lengkap';
    if (!hasTable && !adaDP) statusKelengkapan = 'Belum ada Meja & DP';
    else if (!hasTable) statusKelengkapan = 'Belum ada Meja';
    else if (!adaDP) statusKelengkapan = 'Belum ada DP';

    const reservation = {
        tanggal, namaTamu, jumlahTamu, noHP, areaPref, nomorMeja,
        sudahOrder, adaDP, jenisPembayaran, nominalDP, urutanDP, statusKelengkapan,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        const docRef = await db.collection('reservations').add(reservation);
        console.log('Reservasi tersimpan dengan ID:', docRef.id);
    } catch (err) {
        console.log('Gagal simpan ke Firestore, simpan ke localStorage', err);
        let localRes = JSON.parse(localStorage.getItem('reservations')) || [];
        const newId = 'local_' + Date.now();
        localRes.push({ id: newId, ...reservation });
        localStorage.setItem('reservations', JSON.stringify(localRes));
        alert('Koneksi terputus, data disimpan lokal. Akan sinkron saat online.');
    }

    // Arahkan ke List Reservasi dengan tanggal yang sama
    document.getElementById('listDate').value = tanggal;
    showPage('listReservation');
}

// ==================== LIST RESERVASI ====================
function initListReservation() {
    document.getElementById('listDate').valueAsDate = new Date();
    document.getElementById('loadList').addEventListener('click', () => {
        if (unsubscribeList) unsubscribeList();
        listenListReservations();
    });
    document.getElementById('viewMode').addEventListener('change', () => {
        if (unsubscribeList) return; // nanti diproses di listener
    });
    document.getElementById('sortBy').addEventListener('change', () => {
        if (unsubscribeList) return;
    });
    document.getElementById('configureColumns').addEventListener('click', openColumnModal);

    listenListReservations();
}

function listenListReservations() {
    const tanggal = document.getElementById('listDate').value;
    if (!tanggal) return;

    if (unsubscribeList) unsubscribeList();

    unsubscribeList = db.collection('reservations')
        .where('tanggal', '==', tanggal)
        .onSnapshot(snapshot => {
            const reservations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            applySortAndView(reservations);
            localStorage.setItem('reservations', JSON.stringify(reservations));
        }, error => {
            console.log('List listener error, pakai localStorage', error);
            const cached = JSON.parse(localStorage.getItem('reservations')) || [];
            const filtered = cached.filter(r => r.tanggal === tanggal);
            applySortAndView(filtered);
        });
}

function applySortAndView(reservations) {
    const sortBy = document.getElementById('sortBy').value;
    // Sorting
    if (sortBy === 'urutanDP') {
        reservations.sort((a, b) => (a.urutanDP || 0) - (b.urutanDP || 0));
    } else if (sortBy === 'nomorMeja') {
        reservations.sort((a, b) => {
            const aMeja = a.nomorMeja && a.nomorMeja[0] ? a.nomorMeja[0].toString() : '';
            const bMeja = b.nomorMeja && b.nomorMeja[0] ? b.nomorMeja[0].toString() : '';
            return aMeja.localeCompare(bMeja);
        });
    } else if (sortBy === 'statusKelengkapan') {
        const order = { 'Lengkap': 1, 'Belum ada Meja': 2, 'Belum ada DP': 3, 'Belum ada Meja & DP': 4 };
        reservations.sort((a, b) => order[a.statusKelengkapan] - order[b.statusKelengkapan]);
    }

    const viewMode = document.getElementById('viewMode').value;
    renderList(reservations, viewMode);
}

function renderList(reservations, viewMode) {
    const container = document.getElementById('listContainer');
    if (viewMode === 'table') {
        container.innerHTML = renderTableView(reservations);
    } else {
        container.innerHTML = renderCardView(reservations);
    }
    // Tambahkan event listener untuk tombol edit/hapus
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', e => editReservation(e.target.dataset.id));
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', e => confirmDelete(e.target.dataset.id, 'reservations'));
    });
}

function renderTableView(reservations) {
    let html = '<table><thead><tr>';
    const colOrder = columnSettings.order;
    const colNames = {
        namaTamu: 'Nama', jumlahTamu: 'Jumlah', noHP: 'No HP', area: 'Area',
        nomorMeja: 'Nomor Meja', statusOrder: 'Order', statusDP: 'DP',
        nominalDP: 'Nominal DP', urutanDP: 'Urutan DP', statusKelengkapan: 'Status'
    };
    colOrder.forEach(col => {
        if (col !== 'id') html += `<th>${colNames[col] || col}</th>`;
    });
    html += '<th>Aksi</th></tr></thead><tbody>';
    reservations.forEach(r => {
        html += '<tr>';
        colOrder.forEach(col => {
            if (col === 'id') return;
            let value = r[col];
            if (col === 'nomorMeja') value = r.nomorMeja ? r.nomorMeja.join(', ') : '-';
            else if (col === 'statusOrder') value = r.sudahOrder ? 'Ya' : 'Tidak';
            else if (col === 'statusDP') value = r.adaDP ? 'Ya' : 'Tidak';
            else if (col === 'nominalDP') value = r.adaDP ? 'Rp ' + formatRupiah(r.nominalDP) : '-';
            else if (col === 'urutanDP') value = r.urutanDP || '-';
            else if (col === 'statusKelengkapan') value = `<span class="badge ${getBadgeClass(r.statusKelengkapan)}">${r.statusKelengkapan}</span>`;
            html += `<td>${value}</td>`;
        });
        html += `<td><button class="edit-btn" data-id="${r.id}">Edit</button> <button class="delete-btn" data-id="${r.id}">Hapus</button></td>`;
        html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
}

function renderCardView(reservations) {
    let html = '<div class="card-view">';
    reservations.forEach(r => {
        html += `<div class="res-card">
            <p><strong>${r.namaTamu}</strong> (${r.jumlahTamu} org)</p>
            <p>HP: ${r.noHP}</p>
            <p>Area: ${r.areaPref}</p>
            <p>Meja: ${r.nomorMeja ? r.nomorMeja.join(', ') : '-'}</p>
            <p>Order: ${r.sudahOrder ? 'Ya' : 'Tidak'}</p>
            <p>DP: ${r.adaDP ? 'Rp ' + formatRupiah(r.nominalDP) : 'Tidak'}</p>
            <p>Urutan DP: ${r.urutanDP || '-'}</p>
            <p>Status: <span class="badge ${getBadgeClass(r.statusKelengkapan)}">${r.statusKelengkapan}</span></p>
            <button class="edit-btn" data-id="${r.id}">Edit</button>
            <button class="delete-btn" data-id="${r.id}">Hapus</button>
        </div>`;
    });
    html += '</div>';
    return html;
}

function editReservation(id) {
    alert('Fitur edit akan diimplementasikan. ID: ' + id);
    // Untuk implementasi lengkap, arahkan ke form dengan data terisi
}

// ==================== CEK MEJA KOSONG ====================
function initCheckTable() {
    document.getElementById('loadTables').addEventListener('click', () => {
        if (unsubscribeCheck) unsubscribeCheck();
        listenCheckTables();
    });
    document.getElementById('checkDate').valueAsDate = new Date();
    listenCheckTables();
}

function listenCheckTables() {
    const tanggal = document.getElementById('checkDate').value;
    if (!tanggal) return;

    if (unsubscribeCheck) unsubscribeCheck();

    unsubscribeCheck = db.collection('reservations')
        .where('tanggal', '==', tanggal)
        .onSnapshot(snapshot => {
            const reservations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderTableAreaWithData(tables, reservations, tanggal);
        }, error => {
            console.log('Check listener error, pakai localStorage', error);
            const cachedRes = JSON.parse(localStorage.getItem('reservations')) || [];
            const filtered = cachedRes.filter(r => r.tanggal === tanggal);
            renderTableAreaWithData(tables, filtered, tanggal);
        });
}

function renderTableAreaWithData(tables, reservations, tanggal) {
    const reservedOnDate = reservations.flatMap(r => r.nomorMeja || []);
    const grouped = { 'Non Smoking': [], 'Smoking': [], 'Tambahan': [] };
    tables.forEach(t => grouped[t.area].push(t));

    const container = document.getElementById('tableAreaGrid');
    container.innerHTML = '';

    for (let area in grouped) {
        const section = document.createElement('div');
        section.innerHTML = `<h3>${area}</h3><div class="table-grid"></div>`;
        const grid = section.querySelector('.table-grid');
        grouped[area].forEach(t => {
            const div = document.createElement('div');
            div.className = 'table-item';
            const isReserved = reservedOnDate.includes(t.nomorMeja);
            if (isReserved) {
                div.classList.add('unavailable');
            } else {
                div.classList.add('available');
            }
            div.textContent = t.nomorMeja;
            div.dataset.no = t.nomorMeja;
            div.onclick = () => {
                if (isReserved) {
                    showTableDetail(t, tanggal, reservations);
                } else {
                    if (confirm(`Buat reservasi baru dengan meja ${t.nomorMeja}?`)) {
                        showPage('newReservation');
                        document.getElementById('hasTable').checked = true;
                        toggleTableGrid();
                        document.getElementById('resDate').value = tanggal;
                        selectedTables = [t.nomorMeja];
                        // Render grid dan tandai selected (setelah halaman siap)
                        setTimeout(() => {
                            renderTableGrid();
                            // Setelah grid ter-render, tandai yang selected
                            const gridItems = document.querySelectorAll('#tableGrid .table-item');
                            gridItems.forEach(item => {
                                if (item.dataset.no == t.nomorMeja) {
                                    item.classList.add('selected');
                                }
                            });
                        }, 500);
                    }
                }
            };
            grid.appendChild(div);
        });
        container.appendChild(section);
    }
}

function showTableDetail(table, tanggal, reservations) {
    const res = reservations.find(r => r.nomorMeja && r.nomorMeja.includes(table.nomorMeja));
    if (!res) return;
    const content = document.getElementById('tableDetailContent');
    content.innerHTML = `
        <p><strong>Nama:</strong> ${res.namaTamu}</p>
        <p><strong>Jumlah:</strong> ${res.jumlahTamu}</p>
        <p><strong>HP:</strong> ${res.noHP}</p>
        <p><strong>Area:</strong> ${res.areaPref}</p>
        <p><strong>Order:</strong> ${res.sudahOrder ? 'Ya' : 'Tidak'}</p>
        <p><strong>DP:</strong> ${res.adaDP ? 'Rp ' + formatRupiah(res.nominalDP) : 'Tidak'}</p>
        <p><strong>Status:</strong> ${res.statusKelengkapan}</p>
        <button onclick="editReservation('${res.id}')">Edit</button>
    `;
    document.getElementById('tableDetailModal').style.display = 'block';
}

document.querySelector('#tableDetailModal .close').onclick = () => closeModal('tableDetailModal');

// ==================== ATUR MEJA ====================
function initManageTable() {
    if (unsubscribeTables) unsubscribeTables();
    unsubscribeTables = db.collection('tables').onSnapshot(snapshot => {
        tables = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderManageTables(tables);
        localStorage.setItem('tables', JSON.stringify(tables));
    }, error => {
        console.log('Manage tables listener error, pakai localStorage', error);
        tables = JSON.parse(localStorage.getItem('tables')) || [];
        renderManageTables(tables);
    });

    document.getElementById('addNewTable').onclick = addNewTable;
}

function renderManageTables(tables) {
    const container = document.getElementById('tableList');
    container.innerHTML = '';
    tables.forEach(t => {
        const div = document.createElement('div');
        div.className = 'table-row';
        div.innerHTML = `
            <span>${t.nomorMeja}</span>
            <select data-id="${t.id}" class="area-select">
                <option value="Non Smoking" ${t.area === 'Non Smoking' ? 'selected' : ''}>Non Smoking</option>
                <option value="Smoking" ${t.area === 'Smoking' ? 'selected' : ''}>Smoking</option>
                <option value="Tambahan" ${t.area === 'Tambahan' ? 'selected' : ''}>Tambahan</option>
            </select>
            <button class="delete-table" data-id="${t.id}">Hapus</button>
        `;
        container.appendChild(div);
    });

    // Event untuk ubah area
    document.querySelectorAll('.area-select').forEach(sel => {
        sel.addEventListener('change', async e => {
            const id = e.target.dataset.id;
            const newArea = e.target.value;
            const table = tables.find(t => t.id === id);
            if (table) {
                table.area = newArea;
                try {
                    await db.collection('tables').doc(id).update({ area: newArea });
                } catch (err) {
                    console.log('Gagal update area, simpan ke localStorage', err);
                    // Update di localStorage
                    let localTables = JSON.parse(localStorage.getItem('tables')) || [];
                    const idx = localTables.findIndex(t => t.id === id);
                    if (idx >= 0) localTables[idx].area = newArea;
                    localStorage.setItem('tables', JSON.stringify(localTables));
                }
            }
        });
    });

    // Event hapus
    document.querySelectorAll('.delete-table').forEach(btn => {
        btn.addEventListener('click', e => {
            const id = e.target.dataset.id;
            confirmDelete(id, 'tables');
        });
    });
}

async function addNewTable() {
    const nomor = prompt('Masukkan nomor meja baru:');
    if (!nomor) return;
    const area = prompt('Masukkan area (Smoking / Non Smoking / Tambahan):', 'Non Smoking');
    if (!area || !['Smoking', 'Non Smoking', 'Tambahan'].includes(area)) {
        alert('Area tidak valid');
        return;
    }
    const newTable = { nomorMeja: nomor, area };
    try {
        await db.collection('tables').add(newTable);
    } catch (err) {
        console.log('Gagal tambah meja, simpan lokal', err);
        let localTables = JSON.parse(localStorage.getItem('tables')) || [];
        const newId = 'local_' + Date.now();
        localTables.push({ id: newId, ...newTable });
        localStorage.setItem('tables', JSON.stringify(localTables));
        alert('Koneksi terputus, data meja disimpan lokal.');
    }
}

// ==================== MODAL KONFIRMASI HAPUS ====================
function confirmDelete(id, collection) {
    deleteCallback = async () => {
        try {
            await db.collection(collection).doc(id).delete();
        } catch (err) {
            console.log('Gagal hapus dari Firestore, hapus dari localStorage', err);
            let localData = JSON.parse(localStorage.getItem(collection)) || [];
            localData = localData.filter(d => d.id !== id);
            localStorage.setItem(collection, JSON.stringify(localData));
        }
        closeModal('confirmModal');
        // Refresh halaman saat ini
        if (currentPage === 'listReservation') {
            if (unsubscribeList) unsubscribeList();
            listenListReservations();
        } else if (currentPage === 'manageTable') {
            // sudah otomatis karena listener
        }
    };
    document.getElementById('confirmModal').style.display = 'block';
}

document.getElementById('confirmYes').onclick = () => {
    if (deleteCallback) deleteCallback();
};
document.getElementById('confirmNo').onclick = () => closeModal('confirmModal');

// ==================== ATUR KOLOM (SEDERHANA) ====================
function openColumnModal() {
    const modal = document.getElementById('columnModal');
    const list = document.getElementById('columnList');
    list.innerHTML = '';
    columnSettings.order.forEach(col => {
        const div = document.createElement('div');
        div.innerHTML = `<input type="checkbox" data-col="${col}" checked> ${col} `;
        list.appendChild(div);
    });
    modal.style.display = 'block';
}

document.querySelector('#columnModal .close').onclick = () => closeModal('columnModal');
document.getElementById('saveColumnOrder').onclick = () => {
    // Di sini bisa implementasi drag-drop atau sederhana ambil urutan dari checkbox
    alert('Fitur atur kolom perlu implementasi lebih lanjut (drag-drop)');
    closeModal('columnModal');
};

// ==================== GLOBAL CLICK MODAL ====================
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};

// ==================== INITIAL LOAD ====================
// Muat data awal dari localStorage untuk tables, agar cepat
tables = JSON.parse(localStorage.getItem('tables')) || [];
showPage('dashboard');
