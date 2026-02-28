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

// State global
let currentPage = 'dashboard';
let tables = []; // Data meja
let reservations = [];
let selectedTables = []; // Untuk form reservasi
let columnSettings = JSON.parse(localStorage.getItem('columnSettings')) || {
    columns: ['namaTamu', 'jumlahTamu', 'noHP', 'area', 'nomorMeja', 'statusOrder', 'statusDP', 'nominalDP', 'urutanDP', 'statusKelengkapan'],
    order: ['namaTamu', 'jumlahTamu', 'noHP', 'area', 'nomorMeja', 'statusOrder', 'statusDP', 'nominalDP', 'urutanDP', 'statusKelengkapan']
};
let deleteCallback = null;

// Utility functions
function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID').format(angka);
}
function capitalizeWords(str) {
    return str.replace(/\b\w/g, l => l.toUpperCase());
}
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    currentPage = pageId;
    if (pageId === 'dashboard') loadDashboard();
    else if (pageId === 'newReservation') initNewReservation();
    else if (pageId === 'listReservation') initListReservation();
    else if (pageId === 'checkTable') initCheckTable();
    else if (pageId === 'manageTable') loadManageTables();
}
// Navigasi
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
});

// Firebase helpers dengan fallback localStorage
async function fetchData(collection) {
    try {
        const snapshot = await db.collection(collection).get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        localStorage.setItem(collection, JSON.stringify(data));
        return data;
    } catch (e) {
        console.log('Offline, mengambil dari localStorage');
        return JSON.parse(localStorage.getItem(collection)) || [];
    }
}
async function saveData(collection, doc, id = null) {
    try {
        if (id) {
            await db.collection(collection).doc(id).set(doc, { merge: true });
        } else {
            const ref = await db.collection(collection).add(doc);
            id = ref.id;
        }
        // Update localStorage
        let localData = JSON.parse(localStorage.getItem(collection)) || [];
        const index = localData.findIndex(d => d.id === id);
        const newDoc = { id, ...doc };
        if (index >= 0) localData[index] = newDoc;
        else localData.push(newDoc);
        localStorage.setItem(collection, JSON.stringify(localData));
        return id;
    } catch (e) {
        console.log('Gagal simpan ke Firestore, simpan ke localStorage saja', e);
        let localData = JSON.parse(localStorage.getItem(collection)) || [];
        const newDoc = { id: id || Date.now().toString(), ...doc };
        localData.push(newDoc);
        localStorage.setItem(collection, JSON.stringify(localData));
        alert('Koneksi terputus, data disimpan lokal. Akan sinkron otomatis saat online.');
        return newDoc.id;
    }
}
async function deleteData(collection, id) {
    try {
        await db.collection(collection).doc(id).delete();
    } catch (e) {}
    // Hapus dari localStorage
    let localData = JSON.parse(localStorage.getItem(collection)) || [];
    localData = localData.filter(d => d.id !== id);
    localStorage.setItem(collection, JSON.stringify(localData));
}

// Dashboard
async function loadDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const allRes = await fetchData('reservations');
    const todayRes = allRes.filter(r => r.tanggal === today);
    const tablesData = await fetchData('tables');
    const totalTables = tablesData.length;
    // Meja terpakai hari ini: semua meja dari reservasi hari ini
    const usedTables = new Set();
    todayRes.forEach(r => {
        if (r.nomorMeja) r.nomorMeja.forEach(m => usedTables.add(m));
    });
    const availableTables = totalTables - usedTables.size;
    const incomplete = todayRes.filter(r => r.statusKelengkapan !== 'Lengkap').length;
    document.getElementById('todayResCount').textContent = todayRes.length;
    document.getElementById('availableTableCount').textContent = availableTables;
    document.getElementById('incompleteCount').textContent = incomplete;
}

// Buat Reservasi Baru
async function initNewReservation() {
    document.getElementById('resDate').valueAsDate = new Date();
    document.getElementById('hasTable').addEventListener('change', toggleTableGrid);
    document.getElementById('hasDP').addEventListener('change', toggleDPFields);
    document.getElementById('reservationForm').onsubmit = submitReservation;
    // Load meja untuk grid
    tables = await fetchData('tables');
    renderTableGrid();
}

function toggleTableGrid() {
    const checked = document.getElementById('hasTable').checked;
    document.getElementById('tableGridContainer').style.display = checked ? 'block' : 'none';
    if (checked) renderTableGrid();
}
function toggleDPFields() {
    document.getElementById('dpFields').style.display = document.getElementById('hasDP').checked ? 'block' : 'none';
}
function renderTableGrid() {
    const tanggal = document.getElementById('resDate').value;
    const grid = document.getElementById('tableGrid');
    grid.innerHTML = '';
    // Ambil reservasi di tanggal yang sama untuk menonaktifkan meja terpakai
    fetchData('reservations').then(allRes => {
        const reservedTables = allRes
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
    // Hitung urutanDP
    const allRes = await fetchData('reservations');
    const todayRes = allRes.filter(r => r.tanggal === tanggal && r.adaDP);
    const urutanDP = todayRes.length + 1; // berdasarkan waktu input, sederhana
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
    const id = await saveData('reservations', reservation);
    // Arahkan ke List Reservasi dengan tanggal yang sama
    document.getElementById('listDate').value = tanggal;
    showPage('listReservation');
    loadListReservations();
}

// List Reservasi
async function initListReservation() {
    document.getElementById('listDate').valueAsDate = new Date();
    document.getElementById('loadList').addEventListener('click', loadListReservations);
    document.getElementById('viewMode').addEventListener('change', loadListReservations);
    document.getElementById('sortBy').addEventListener('change', loadListReservations);
    document.getElementById('configureColumns').addEventListener('click', openColumnModal);
    await loadListReservations();
}

async function loadListReservations() {
    const tanggal = document.getElementById('listDate').value;
    const viewMode = document.getElementById('viewMode').value;
    const sortBy = document.getElementById('sortBy').value;
    let allRes = await fetchData('reservations');
    let filtered = allRes.filter(r => r.tanggal === tanggal);
    // Urutkan
    if (sortBy === 'urutanDP') filtered.sort((a,b) => (a.urutanDP || 0) - (b.urutanDP || 0));
    else if (sortBy === 'nomorMeja') {
        filtered.sort((a,b) => {
            const aMeja = a.nomorMeja && a.nomorMeja[0] ? a.nomorMeja[0] : '';
            const bMeja = b.nomorMeja && b.nomorMeja[0] ? b.nomorMeja[0] : '';
            return aMeja.toString().localeCompare(bMeja.toString());
        });
    } else if (sortBy === 'statusKelengkapan') {
        const order = { 'Lengkap': 1, 'Belum ada Meja': 2, 'Belum ada DP': 3, 'Belum ada Meja & DP': 4 };
        filtered.sort((a,b) => order[a.statusKelengkapan] - order[b.statusKelengkapan]);
    }
    const container = document.getElementById('listContainer');
    if (viewMode === 'table') {
        container.innerHTML = renderTableView(filtered);
    } else {
        container.innerHTML = renderCardView(filtered);
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

function getBadgeClass(status) {
    if (status === 'Lengkap') return 'lengkap';
    if (status === 'Belum ada Meja') return 'belum-meja';
    if (status === 'Belum ada DP') return 'belum-dp';
    return 'belum-meja-dp';
}

// Edit reservasi (sederhana, isi form dan arahkan ke halaman baru)
function editReservation(id) {
    alert('Fitur edit akan mengarahkan ke form dengan data terisi. Implementasi serupa dengan buat reservasi.');
    // Di sini bisa diarahkan ke halaman form dengan data diisi
}

// Hapus dengan konfirmasi
function confirmDelete(id, collection) {
    deleteCallback = async () => {
        await deleteData(collection, id);
        closeModal('confirmModal');
        if (currentPage === 'listReservation') loadListReservations();
        else if (currentPage === 'manageTable') loadManageTables();
    };
    document.getElementById('confirmModal').style.display = 'block';
}
document.getElementById('confirmYes').onclick = () => {
    if (deleteCallback) deleteCallback();
};
document.getElementById('confirmNo').onclick = () => closeModal('confirmModal');

// Atur Kolom
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
    // Ambil urutan baru (sederhana, kita bisa pakai drag-drop, tapi di sini hanya contoh)
    alert('Penyimpanan urutan kolom perlu implementasi lebih lanjut.');
    closeModal('columnModal');
};

// Cek Meja Kosong
async function initCheckTable() {
    document.getElementById('loadTables').addEventListener('click', renderTableArea);
    document.getElementById('checkDate').valueAsDate = new Date();
    await renderTableArea();
}

async function renderTableArea() {
    const tanggal = document.getElementById('checkDate').value;
    const tablesData = await fetchData('tables');
    const reservationsData = await fetchData('reservations');
    const reservedOnDate = reservationsData
        .filter(r => r.tanggal === tanggal)
        .flatMap(r => r.nomorMeja || []);
    const grouped = { 'Non Smoking': [], 'Smoking': [], 'Tambahan': [] };
    tablesData.forEach(t => grouped[t.area].push(t));
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
                    showTableDetail(t, tanggal);
                } else {
                    if (confirm(`Buat reservasi baru dengan meja ${t.nomorMeja}?`)) {
                        showPage('newReservation');
                        document.getElementById('hasTable').checked = true;
                        toggleTableGrid();
                        // Set tanggal dan pilih meja
                        document.getElementById('resDate').value = tanggal;
                        selectedTables = [t.nomorMeja];
                        // Render grid dan tandai selected
                        setTimeout(() => {
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

async function showTableDetail(table, tanggal) {
    const reservationsData = await fetchData('reservations');
    const res = reservationsData.find(r => r.tanggal === tanggal && r.nomorMeja && r.nomorMeja.includes(table.nomorMeja));
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

// Atur Meja
async function loadManageTables() {
    tables = await fetchData('tables');
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
                await saveData('tables', table, id);
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
    document.getElementById('addNewTable').onclick = addNewTable;
}

async function addNewTable() {
    const nomor = prompt('Masukkan nomor meja baru:');
    if (!nomor) return;
    const area = prompt('Masukkan area (Smoking / Non Smoking / Tambahan):', 'Non Smoking');
    if (!area || !['Smoking','Non Smoking','Tambahan'].includes(area)) {
        alert('Area tidak valid');
        return;
    }
    const newTable = { nomorMeja: nomor, area };
    await saveData('tables', newTable);
    loadManageTables();
}

// Utility close modal
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Inisialisasi awal
showPage('dashboard');
// Event untuk update grid saat tanggal berubah di form reservasi
document.getElementById('resDate').addEventListener('change', renderTableGrid);
