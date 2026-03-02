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
const db = firebase.firestore();
const auth = firebase.auth();

// State Aplikasi
let currentUser = null;
let currentReservationId = null; // untuk edit
let tablesCache = []; // semua meja
let selectedTables = []; // untuk form reservasi
let currentListDate = new Date().toISOString().split('T')[0];
let currentSort = 'dp';

// Elemen DOM
const loginContainer = document.getElementById('loginContainer');
const appContainer = document.getElementById('appContainer');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const navLinks = document.querySelectorAll('[data-section]');
const sections = document.querySelectorAll('.section');
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');

// Form Reservasi
const reservationForm = document.getElementById('reservationForm');
const formTitle = document.getElementById('formTitle');
const reservationId = document.getElementById('reservationId');
const tanggalInput = document.getElementById('tanggal');
const namaInput = document.getElementById('nama');
const jumlahTamuInput = document.getElementById('jumlahTamu');
const noHpInput = document.getElementById('noHp');
const areaPreferensi = document.getElementById('areaPreferensi');
const sudahAdaMejaCheck = document.getElementById('sudahAdaMeja');
const mejaGridContainer = document.getElementById('mejaGridContainer');
const mejaGrid = document.getElementById('mejaGrid');
const selectedMejaDisplay = document.getElementById('selectedMejaDisplay');
const sudahOrderCheck = document.getElementById('sudahOrder');
const adaDPCheck = document.getElementById('adaDP');
const dpFields = document.getElementById('dpFields');
const dpJenis = document.getElementById('dpJenis');
const dpNominal = document.getElementById('dpNominal');
const catatan = document.getElementById('catatan');
const batalEdit = document.getElementById('batalEdit');

// List Reservasi
const listTanggal = document.getElementById('listTanggal');
const muatReservasiBtn = document.getElementById('muatReservasi');
const sortBy = document.getElementById('sortBy');
const reservasiTableBody = document.getElementById('reservasiTableBody');

// Cek Meja
const checkTanggal = document.getElementById('checkTanggal');
const muatMejaKosongBtn = document.getElementById('muatMejaKosong');
const mejaKosongGrid = document.getElementById('mejaKosongGrid');

// Atur Meja
const mejaTableBody = document.getElementById('mejaTableBody');
const tambahMejaBtn = document.getElementById('tambahMejaBtn');
const importCsvBtn = document.getElementById('importCsvBtn');

// Modal
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const closeModal = document.querySelector('.close-modal');

// Notifikasi
const notification = document.getElementById('notification');

// ==================== UTILITY FUNCTIONS ====================
function showNotification(message, isError = false) {
    notification.textContent = message;
    notification.style.backgroundColor = isError ? '#f44336' : '#333';
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function formatRupiah(angka) {
    if (!angka) return '';
    return angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseRupiah(str) {
    if (!str) return 0;
    return parseInt(str.replace(/\./g, '')) || 0;
}

function capitalizeName(str) {
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

// Set min date input ke hari ini
tanggalInput.min = getTodayString();
listTanggal.value = getTodayString();
checkTanggal.value = getTodayString();

// ==================== AUTHENTICATION ====================
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        loginContainer.style.display = 'none';
        appContainer.style.display = 'flex';
        loadInitialData();
        showSection('dashboard');
    } else {
        currentUser = null;
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
        await auth.signInWithEmailAndPassword(email, password);
        loginError.textContent = '';
    } catch (error) {
        loginError.textContent = 'Email atau password salah';
    }
});

logoutBtn.addEventListener('click', () => {
    auth.signOut();
});

// ==================== NAVIGASI & UI ====================
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.dataset.section;
        showSection(section);
        if (section === 'new') resetForm();
        else if (section === 'list') loadReservasiList();
        else if (section === 'check') loadMejaKosong();
        else if (section === 'tables') loadTables();
        else if (section === 'dashboard') loadDashboard();
    });
});

hamburger.addEventListener('click', () => {
    navMenu.classList.toggle('active');
});

function showSection(sectionId) {
    sections.forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId + 'Section').classList.add('active');
    navMenu.classList.remove('active'); // tutup menu mobile
}

// ==================== DATA OFFLINE (localStorage) ====================
function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {}
}

function loadFromLocalStorage(key) {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch (e) {
        return null;
    }
}

// ==================== LOAD TABLES (CACHE) ====================
async function loadTablesFromFirestore(force = false) {
    if (tablesCache.length && !force) return tablesCache;
    try {
        const snapshot = await db.collection('tables').get();
        tablesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        saveToLocalStorage('tables', tablesCache);
    } catch (error) {
        showNotification('Gagal memuat data meja, menggunakan cache lokal', true);
        tablesCache = loadFromLocalStorage('tables') || [];
    }
    return tablesCache;
}

// ==================== DASHBOARD ====================
async function loadDashboard() {
    const today = getTodayString();
    try {
        const snapshot = await db.collection('reservations').where('tanggal', '==', today).get();
        const reservasi = snapshot.docs.map(d => d.data());
        const totalMeja = tablesCache.length;
        const mejaTerpakai = new Set();
        reservasi.forEach(r => {
            if (r.nomorMeja) r.nomorMeja.forEach(m => mejaTerpakai.add(m));
        });
        const mejaKosong = totalMeja - mejaTerpakai.size;
        const belumDP = reservasi.filter(r => r.dpCheck !== true).length;
        const tanpaMeja = reservasi.filter(r => !r.nomorMeja || r.nomorMeja.length === 0).length;

        document.getElementById('statReservasiHariIni').setAttribute('data-label', 'Reservasi hari ini');
        document.getElementById('statReservasiHariIni').textContent = reservasi.length;
        document.getElementById('statMejaKosong').setAttribute('data-label', 'Meja kosong');
        document.getElementById('statMejaKosong').textContent = mejaKosong;
        document.getElementById('statBelumDP').setAttribute('data-label', 'Reservasi belum DP');
        document.getElementById('statBelumDP').textContent = belumDP;
        document.getElementById('statTanpaMeja').setAttribute('data-label', 'Reservasi tanpa meja');
        document.getElementById('statTanpaMeja').textContent = tanpaMeja;
    } catch (error) {
        showNotification('Gagal memuat dashboard', true);
    }
}

// ==================== FORM RESERVASI ====================
namaInput.addEventListener('blur', () => {
    namaInput.value = capitalizeName(namaInput.value);
});

sudahAdaMejaCheck.addEventListener('change', async () => {
    if (sudahAdaMejaCheck.checked) {
        await loadTablesFromFirestore();
        renderMejaGridForForm(tablesCache);
        mejaGridContainer.style.display = 'block';
    } else {
        mejaGridContainer.style.display = 'none';
        selectedTables = [];
        selectedMejaDisplay.textContent = '';
    }
});

adaDPCheck.addEventListener('change', () => {
    dpFields.style.display = adaDPCheck.checked ? 'block' : 'none';
    if (!adaDPCheck.checked) {
        dpJenis.value = 'Transfer';
        dpNominal.value = '';
    }
});

dpNominal.addEventListener('input', (e) => {
    let value = e.target.value.replace(/[^0-9]/g, '');
    if (value) {
        e.target.value = formatRupiah(value);
    } else {
        e.target.value = '';
    }
});

function renderMejaGridForForm(mejaList) {
    const tanggal = tanggalInput.value;
    if (!tanggal) {
        alert('Pilih tanggal terlebih dahulu');
        sudahAdaMejaCheck.checked = false;
        mejaGridContainer.style.display = 'none';
        return;
    }
    // Ambil reservasi di tanggal yang sama untuk nonaktifkan meja terpakai
    db.collection('reservations').where('tanggal', '==', tanggal).get()
        .then(snapshot => {
            const mejaTerpakai = new Set();
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.nomorMeja) data.nomorMeja.forEach(m => mejaTerpakai.add(m));
            });
            renderGrid(mejaList, mejaGrid, mejaTerpakai, true);
        })
        .catch(() => {
            renderGrid(mejaList, mejaGrid, new Set(), true);
        });
}

function renderGrid(mejaList, container, mejaTerpakai, isForm = false) {
    container.innerHTML = '';
    const grouped = {
        non: mejaList.filter(m => m.area === 'non'),
        smoking: mejaList.filter(m => m.area === 'smoking'),
        tambahan: mejaList.filter(m => m.area === 'tambahan')
    };
    ['non', 'smoking', 'tambahan'].forEach(area => {
        grouped[area].forEach(meja => {
            const div = document.createElement('div');
            div.className = `meja-item ${area}`;
            div.textContent = meja.nomorMeja;
            div.dataset.id = meja.id;
            div.dataset.nomor = meja.nomorMeja;
            div.dataset.area = area;
            if (mejaTerpakai.has(meja.nomorMeja)) {
                div.classList.add('terisi');
            } else if (isForm) {
                div.addEventListener('click', () => toggleSelectMeja(div, meja.nomorMeja));
            } else {
                div.classList.add('kosong');
                div.addEventListener('click', () => onMejaKosongClick(meja.nomorMeja, area));
            }
            container.appendChild(div);
        });
    });
}

function toggleSelectMeja(element, nomorMeja) {
    if (element.classList.contains('terisi')) return;
    if (element.classList.contains('selected')) {
        element.classList.remove('selected');
        selectedTables = selectedTables.filter(m => m !== nomorMeja);
    } else {
        element.classList.add('selected');
        selectedTables.push(nomorMeja);
    }
    selectedMejaDisplay.textContent = selectedTables.join(', ');
}

function onMejaKosongClick(nomorMeja, area) {
    if (confirm(`Buat reservasi baru dengan meja ${nomorMeja}?`)) {
        showSection('new');
        resetForm();
        sudahAdaMejaCheck.checked = true;
        mejaGridContainer.style.display = 'block';
        // Tunggu grid terender, lalu pilih meja
        setTimeout(() => {
            const mejaItems = document.querySelectorAll('#mejaGrid .meja-item');
            mejaItems.forEach(item => {
                if (item.dataset.nomor === nomorMeja) {
                    toggleSelectMeja(item, nomorMeja);
                }
            });
        }, 500);
    }
}

// Simpan reservasi
reservationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        tanggal: tanggalInput.value,
        nama: namaInput.value,
        jumlahTamu: parseInt(jumlahTamuInput.value),
        noHp: noHpInput.value,
        areaPreferensi: areaPreferensi.value,
        nomorMeja: sudahAdaMejaCheck.checked ? selectedTables : [],
        sudahOrder: sudahOrderCheck.checked,
        dpCheck: adaDPCheck.checked,
        dpJenis: adaDPCheck.checked ? dpJenis.value : null,
        dpNominal: adaDPCheck.checked ? parseRupiah(dpNominal.value) : 0,
        catatan: catatan.value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Validasi meja tidak kosong jika dicentang
    if (sudahAdaMejaCheck.checked && selectedTables.length === 0) {
        alert('Pilih minimal satu meja');
        return;
    }

    // Hitung status kelengkapan
    let status = 'Lengkap';
    if (!data.nomorMeja.length && !data.dpCheck) status = 'Belum ada Meja & DP';
    else if (!data.nomorMeja.length) status = 'Belum ada Meja';
    else if (!data.dpCheck) status = 'Belum ada DP';
    data.statusKelengkapan = status;

    // Jika ada DP, tambahkan timestamp DP (jika baru)
    if (data.dpCheck && data.dpNominal > 0) {
        if (!reservationId.value) {
            // Reservasi baru, set dpTimestamp
            data.dpTimestamp = firebase.firestore.FieldValue.serverTimestamp();
        } else {
            // Edit, pertahankan dpTimestamp lama jika sudah ada
            // Nanti kita akan ambil dari dokumen lama
        }
    }

    try {
        if (reservationId.value) {
            // Update
            const docRef = db.collection('reservations').doc(reservationId.value);
            const oldDoc = await docRef.get();
            const oldData = oldDoc.data();
            // Jika DP baru ditambahkan dan sebelumnya tidak ada, set timestamp
            if (data.dpCheck && !oldData.dpCheck) {
                data.dpTimestamp = firebase.firestore.FieldValue.serverTimestamp();
            } else if (!data.dpCheck) {
                // Hapus dpTimestamp jika DP dicentang off
                data.dpTimestamp = null;
            } else {
                // Pertahankan timestamp lama
                data.dpTimestamp = oldData.dpTimestamp || firebase.firestore.FieldValue.serverTimestamp();
            }
            await docRef.update(data);
            showNotification('Reservasi berhasil diperbarui');
        } else {
            // Insert
            data.dpTimestamp = data.dpCheck ? firebase.firestore.FieldValue.serverTimestamp() : null;
            await db.collection('reservations').add(data);
            showNotification('Reservasi berhasil disimpan');
        }
        resetForm();
        showSection('dashboard');
        loadDashboard();
    } catch (error) {
        showNotification('Gagal menyimpan reservasi, data disimpan lokal', true);
        // Simpan ke localStorage dengan id lokal
        const localId = 'local_' + Date.now();
        const localData = { ...data, id: localId, offline: true };
        let localReservasi = loadFromLocalStorage('reservations_offline') || [];
        localReservasi.push(localData);
        saveToLocalStorage('reservations_offline', localReservasi);
        resetForm();
    }
});

batalEdit.addEventListener('click', () => {
    resetForm();
    showSection('dashboard');
});

function resetForm() {
    reservationForm.reset();
    reservationId.value = '';
    formTitle.textContent = 'Buat Reservasi Baru';
    tanggalInput.value = getTodayString();
    selectedTables = [];
    selectedMejaDisplay.textContent = '';
    mejaGridContainer.style.display = 'none';
    dpFields.style.display = 'none';
    sudahAdaMejaCheck.checked = false;
    adaDPCheck.checked = false;
    sudahOrderCheck.checked = false;
}

// ==================== LIST RESERVASI ====================
muatReservasiBtn.addEventListener('click', loadReservasiList);
sortBy.addEventListener('change', (e) => {
    currentSort = e.target.value;
    loadReservasiList();
});

async function loadReservasiList() {
    const tanggal = listTanggal.value;
    if (!tanggal) return;
    currentListDate = tanggal;

    try {
        const snapshot = await db.collection('reservations')
            .where('tanggal', '==', tanggal)
            .get();
        let reservasi = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Simpan ke localStorage
        saveToLocalStorage(`reservations_${tanggal}`, reservasi);

        // Hitung urutan DP
        const dpList = reservasi.filter(r => r.dpCheck && r.dpNominal > 0 && r.dpTimestamp)
            .sort((a, b) => {
                if (!a.dpTimestamp) return 1;
                if (!b.dpTimestamp) return -1;
                return a.dpTimestamp.toDate() - b.dpTimestamp.toDate();
            });
        const dpMap = new Map();
        dpList.forEach((r, index) => dpMap.set(r.id, index + 1));

        // Sorting berdasarkan pilihan
        if (currentSort === 'dp') {
            reservasi.sort((a, b) => {
                const dpA = dpMap.get(a.id) || 9999;
                const dpB = dpMap.get(b.id) || 9999;
                return dpA - dpB;
            });
        } else if (currentSort === 'meja') {
            reservasi.sort((a, b) => {
                const mejaA = a.nomorMeja && a.nomorMeja.length ? a.nomorMeja[0] : '';
                const mejaB = b.nomorMeja && b.nomorMeja.length ? b.nomorMeja[0] : '';
                return mejaA.localeCompare(mejaB);
            });
        } // else status (sudah terurut dari query, bisa ditambah)

        renderReservasiTable(reservasi, dpMap);
    } catch (error) {
        showNotification('Gagal memuat reservasi, menggunakan cache lokal', true);
        const cached = loadFromLocalStorage(`reservations_${tanggal}`) || [];
        renderReservasiTable(cached, new Map());
    }
}

function renderReservasiTable(reservasi, dpMap) {
    reservasiTableBody.innerHTML = '';
    reservasi.forEach(r => {
        const tr = document.createElement('tr');
        tr.dataset.id = r.id;

        // Meja
        const mejaTd = document.createElement('td');
        mejaTd.textContent = r.nomorMeja ? r.nomorMeja.join(', ') : '-';

        // Nama
        const namaTd = document.createElement('td');
        namaTd.textContent = r.nama;

        // Jumlah tamu
        const tamuTd = document.createElement('td');
        tamuTd.textContent = r.jumlahTamu;

        // Urutan DP
        const dpTd = document.createElement('td');
        dpTd.textContent = dpMap.get(r.id) || '-';

        // Status dengan badge
        const statusTd = document.createElement('td');
        const badge = document.createElement('span');
        badge.classList.add('status-badge');
        let statusClass = '';
        if (r.statusKelengkapan === 'Lengkap') statusClass = 'status-lengkap';
        else if (r.statusKelengkapan === 'Belum ada Meja') statusClass = 'status-belum-meja';
        else if (r.statusKelengkapan === 'Belum ada DP') statusClass = 'status-belum-dp';
        else statusClass = 'status-belum-keduanya';
        badge.classList.add(statusClass);
        badge.textContent = r.statusKelengkapan || 'Lengkap';
        statusTd.appendChild(badge);

        // Aksi
        const aksiTd = document.createElement('td');
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.classList.add('edit-btn');
        const hapusBtn = document.createElement('button');
        hapusBtn.textContent = 'Hapus';
        hapusBtn.classList.add('hapus-btn');
        aksiTd.appendChild(editBtn);
        aksiTd.appendChild(hapusBtn);

        tr.appendChild(mejaTd);
        tr.appendChild(namaTd);
        tr.appendChild(tamuTd);
        tr.appendChild(dpTd);
        tr.appendChild(statusTd);
        tr.appendChild(aksiTd);

        // Event klik baris untuk detail
        tr.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            showDetailReservasi(r);
        });

        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            editReservasi(r.id);
        });

        hapusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            hapusReservasi(r.id);
        });

        reservasiTableBody.appendChild(tr);
    });
}

async function showDetailReservasi(data) {
    modalBody.innerHTML = '';
    const detail = document.createElement('div');
    detail.innerHTML = `
        <h3>Detail Reservasi</h3>
        <p><strong>ID:</strong> ${data.id}</p>
        <p><strong>Tanggal:</strong> ${data.tanggal}</p>
        <p><strong>Nama:</strong> ${data.nama}</p>
        <p><strong>Jumlah Tamu:</strong> ${data.jumlahTamu}</p>
        <p><strong>No HP:</strong> ${data.noHp}</p>
        <p><strong>Area Preferensi:</strong> ${data.areaPreferensi}</p>
        <p><strong>Nomor Meja:</strong> ${data.nomorMeja ? data.nomorMeja.join(', ') : '-'}</p>
        <p><strong>Sudah Order:</strong> ${data.sudahOrder ? 'Ya' : 'Tidak'}</p>
        <p><strong>DP:</strong> ${data.dpCheck ? `Ya (${data.dpJenis} - Rp ${formatRupiah(data.dpNominal)})` : 'Tidak'}</p>
        <p><strong>Tanggal DP:</strong> ${data.dpTimestamp ? new Date(data.dpTimestamp.toDate()).toLocaleDateString('id-ID') : '-'}</p>
        <p><strong>Catatan:</strong> ${data.catatan || '-'}</p>
        <p><strong>Status:</strong> ${data.statusKelengkapan}</p>
        <div style="margin-top: 1rem;">
            <button id="modalEditBtn">Edit</button>
            <button id="modalHapusBtn">Hapus</button>
            ${data.dpCheck ? '<button id="modalHapusDPBtn">Hapus DP</button>' : ''}
        </div>
    `;
    modalBody.appendChild(detail);
    modal.style.display = 'block';

    document.getElementById('modalEditBtn').addEventListener('click', () => {
        modal.style.display = 'none';
        editReservasi(data.id);
    });
    document.getElementById('modalHapusBtn').addEventListener('click', () => {
        modal.style.display = 'none';
        hapusReservasi(data.id);
    });
    const hapusDPBtn = document.getElementById('modalHapusDPBtn');
    if (hapusDPBtn) {
        hapusDPBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            hapusDP(data.id);
        });
    }
}

async function editReservasi(id) {
    try {
        const doc = await db.collection('reservations').doc(id).get();
        if (!doc.exists) return;
        const data = doc.data();
        // Isi form
        reservationId.value = id;
        formTitle.textContent = 'Edit Reservasi';
        tanggalInput.value = data.tanggal;
        namaInput.value = data.nama;
        jumlahTamuInput.value = data.jumlahTamu;
        noHpInput.value = data.noHp;
        areaPreferensi.value = data.areaPreferensi;
        sudahOrderCheck.checked = data.sudahOrder || false;
        adaDPCheck.checked = data.dpCheck || false;
        if (data.dpCheck) {
            dpFields.style.display = 'block';
            dpJenis.value = data.dpJenis || 'Transfer';
            dpNominal.value = formatRupiah(data.dpNominal);
        } else {
            dpFields.style.display = 'none';
        }
        catatan.value = data.catatan || '';

        // Meja
        if (data.nomorMeja && data.nomorMeja.length) {
            sudahAdaMejaCheck.checked = true;
            mejaGridContainer.style.display = 'block';
            selectedTables = [...data.nomorMeja];
            selectedMejaDisplay.textContent = selectedTables.join(', ');
            // Render grid setelah data meja dimuat
            await loadTablesFromFirestore();
            renderMejaGridForForm(tablesCache);
            // Set selected
            setTimeout(() => {
                const items = document.querySelectorAll('#mejaGrid .meja-item');
                items.forEach(item => {
                    if (selectedTables.includes(item.dataset.nomor)) {
                        item.classList.add('selected');
                    }
                });
            }, 500);
        } else {
            sudahAdaMejaCheck.checked = false;
            mejaGridContainer.style.display = 'none';
        }

        showSection('new');
    } catch (error) {
        showNotification('Gagal mengambil data reservasi', true);
    }
}

async function hapusReservasi(id) {
    if (!confirm('Yakin ingin menghapus reservasi ini?')) return;
    try {
        await db.collection('reservations').doc(id).delete();
        showNotification('Reservasi dihapus');
        loadReservasiList();
    } catch (error) {
        showNotification('Gagal menghapus', true);
    }
}

async function hapusDP(id) {
    if (!confirm('Hapus data DP? Urutan DP akan hilang.')) return;
    try {
        await db.collection('reservations').doc(id).update({
            dpCheck: false,
            dpJenis: null,
            dpNominal: 0,
            dpTimestamp: null
        });
        showNotification('DP dihapus');
        loadReservasiList();
    } catch (error) {
        showNotification('Gagal menghapus DP', true);
    }
}

// ==================== CEK MEJA KOSONG ====================
muatMejaKosongBtn.addEventListener('click', loadMejaKosong);

async function loadMejaKosong() {
    const tanggal = checkTanggal.value;
    if (!tanggal) return;
    await loadTablesFromFirestore();
    try {
        const snapshot = await db.collection('reservations').where('tanggal', '==', tanggal).get();
        const mejaTerpakai = new Set();
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.nomorMeja) data.nomorMeja.forEach(m => mejaTerpakai.add(m));
        });
        renderGrid(tablesCache, mejaKosongGrid, mejaTerpakai, false);
    } catch (error) {
        showNotification('Gagal memuat data, menggunakan lokal', true);
        renderGrid(tablesCache, mejaKosongGrid, new Set(), false);
    }
}

// ==================== ATUR MEJA ====================
async function loadTables() {
    await loadTablesFromFirestore(true); // force refresh
    renderMejaTable();
}

function renderMejaTable() {
    mejaTableBody.innerHTML = '';
    tablesCache.forEach(meja => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${meja.nomorMeja}</td>
            <td>
                <select class="area-select" data-id="${meja.id}">
                    <option value="non" ${meja.area === 'non' ? 'selected' : ''}>Non Smoking</option>
                    <option value="smoking" ${meja.area === 'smoking' ? 'selected' : ''}>Smoking</option>
                    <option value="tambahan" ${meja.area === 'tambahan' ? 'selected' : ''}>Tambahan</option>
                </select>
            </td>
            <td>
                <button class="hapus-meja" data-id="${meja.id}">Hapus</button>
            </td>
        `;
        mejaTableBody.appendChild(tr);
    });

    // Event listener untuk select area
    document.querySelectorAll('.area-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const id = e.target.dataset.id;
            const area = e.target.value;
            try {
                await db.collection('tables').doc(id).update({ area });
                showNotification('Area meja diperbarui');
                await loadTablesFromFirestore(true);
            } catch (error) {
                showNotification('Gagal mengupdate area', true);
            }
        });
    });

    document.querySelectorAll('.hapus-meja').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (!confirm('Hapus meja ini?')) return;
            try {
                await db.collection('tables').doc(id).delete();
                showNotification('Meja dihapus');
                await loadTablesFromFirestore(true);
                renderMejaTable();
            } catch (error) {
                showNotification('Gagal menghapus meja', true);
            }
        });
    });
}

tambahMejaBtn.addEventListener('click', () => {
    modalBody.innerHTML = `
        <h3>Tambah Meja Baru</h3>
        <form id="tambahMejaForm">
            <label>Nomor Meja</label>
            <input type="text" id="nomorMejaBaru" required>
            <label>Area</label>
            <select id="areaMejaBaru">
                <option value="non">Non Smoking</option>
                <option value="smoking">Smoking</option>
                <option value="tambahan">Tambahan</option>
            </select>
            <div style="margin-top: 1rem;">
                <button type="submit">Simpan</button>
                <button type="button" id="batalTambahMeja">Batal</button>
            </div>
        </form>
    `;
    modal.style.display = 'block';

    document.getElementById('tambahMejaForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nomor = document.getElementById('nomorMejaBaru').value.trim();
        const area = document.getElementById('areaMejaBaru').value;
        if (!nomor) return;

        // Cek duplikat
        if (tablesCache.some(m => m.nomorMeja === nomor)) {
            alert('Nomor meja sudah ada');
            return;
        }

        try {
            await db.collection('tables').add({ nomorMeja: nomor, area });
            showNotification('Meja ditambahkan');
            modal.style.display = 'none';
            await loadTablesFromFirestore(true);
            renderMejaTable();
        } catch (error) {
            showNotification('Gagal menambah meja', true);
        }
    });

    document.getElementById('batalTambahMeja').addEventListener('click', () => {
        modal.style.display = 'none';
    });
});

importCsvBtn.addEventListener('click', () => {
    modalBody.innerHTML = `
        <h3>Import Meja dari CSV</h3>
        <p>Format: nomorMeja,area (area: non, smoking, tambahan)</p>
        <textarea id="csvData" rows="10" placeholder="Contoh:
M1,non
M2,smoking
M3,tambahan"></textarea>
        <div style="margin-top: 1rem;">
            <button id="prosesCsv">Proses</button>
            <button id="batalCsv">Batal</button>
        </div>
    `;
    modal.style.display = 'block';

    document.getElementById('prosesCsv').addEventListener('click', async () => {
        const csv = document.getElementById('csvData').value.trim();
        if (!csv) return;
        const lines = csv.split('\n');
        const berhasil = [];
        const gagal = [];
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            const parts = line.split(',');
            if (parts.length < 2) {
                gagal.push(line);
                continue;
            }
            const nomor = parts[0].trim();
            const area = parts[1].trim();
            if (!['non', 'smoking', 'tambahan'].includes(area)) {
                gagal.push(line);
                continue;
            }
            if (tablesCache.some(m => m.nomorMeja === nomor)) {
                gagal.push(line + ' (duplikat)');
                continue;
            }
            try {
                await db.collection('tables').add({ nomorMeja: nomor, area });
                berhasil.push(nomor);
            } catch {
                gagal.push(line);
            }
        }
        showNotification(`Berhasil: ${berhasil.length}, Gagal: ${gagal.length}`);
        modal.style.display = 'none';
        await loadTablesFromFirestore(true);
        renderMejaTable();
    });

    document.getElementById('batalCsv').addEventListener('click', () => {
        modal.style.display = 'none';
    });
});

// ==================== MODAL CLOSE ====================
closeModal.addEventListener('click', () => {
    modal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

// ==================== INITIAL LOAD ====================
async function loadInitialData() {
    await loadTablesFromFirestore();
    loadDashboard();
}

// Set tanggal default
tanggalInput.value = getTodayString();
listTanggal.value = getTodayString();
checkTanggal.value = getTodayString();
