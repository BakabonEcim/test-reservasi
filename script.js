// ================== KONFIGURASI FIREBASE ==================
// Ganti dengan konfigurasi Firebase Anda
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

// ================== DATA GLOBAL ==================
let reservations = [];
let tables = [];
let kolomSetting = {
    urutan: ['nama', 'jumlahTamu', 'noHp', 'area', 'nomorMeja', 'statusOrder', 'statusDP', 'nominalDP', 'urutanDP', 'statusKelengkapan'],
    ditampilkan: ['nama', 'jumlahTamu', 'noHp', 'area', 'nomorMeja', 'statusOrder', 'statusDP', 'nominalDP', 'urutanDP', 'statusKelengkapan']
};

// ================== LOAD DATA DARI FIREBASE ==================
async function loadData() {
    try {
        // Load reservasi
        const reservationsSnapshot = await db.collection('reservations').get();
        reservations = [];
        reservationsSnapshot.forEach(doc => {
            reservations.push({ id: doc.id, ...doc.data() });
        });
        
        // Load meja
        const tablesSnapshot = await db.collection('tables').get();
        if (tablesSnapshot.empty) {
            // Inisialisasi meja default jika kosong
            tables = [];
            for (let i = 1; i <= 70; i++) {
                let area = 'Non Smoking';
                if (i > 30 && i <= 50) area = 'Smoking';
                else if (i > 50) area = 'Tambahan';
                tables.push({ nomorMeja: i.toString(), area });
            }
            await saveTables();
        } else {
            tables = [];
            tablesSnapshot.forEach(doc => {
                tables.push({ id: doc.id, ...doc.data() });
            });
        }
        
        // Load kolom setting dari localStorage (tetap lokal karena preference user)
        const savedKolom = localStorage.getItem('kolomSetting');
        if (savedKolom) {
            kolomSetting = JSON.parse(savedKolom);
        }
        
        updateDashboardCards();
        console.log('Data loaded from Firebase');
    } catch (error) {
        console.error('Error loading data: ', error);
        alert('Gagal memuat data. Periksa koneksi internet Anda.');
    }
}

// ================== SIMPAN KE FIREBASE ==================
async function saveReservations() {
    try {
        const batch = db.batch();
        
        // Hapus semua data lama (pendekatan sederhana - bisa dioptimalkan)
        const snapshot = await db.collection('reservations').get();
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Tambah data baru
        reservations.forEach(res => {
            const { id, ...data } = res;
            const docRef = db.collection('reservations').doc(id);
            batch.set(docRef, data);
        });
        
        await batch.commit();
        console.log('Reservations saved to Firebase');
        updateDashboardCards();
    } catch (error) {
        console.error('Error saving reservations: ', error);
        alert('Gagal menyimpan data. Periksa koneksi internet Anda.');
    }
}

async function saveTables() {
    try {
        const batch = db.batch();
        
        const snapshot = await db.collection('tables').get();
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        tables.forEach((meja, index) => {
            const docRef = db.collection('tables').doc(`table_${index}`);
            batch.set(docRef, meja);
        });
        
        await batch.commit();
        console.log('Tables saved to Firebase');
    } catch (error) {
        console.error('Error saving tables: ', error);
        alert('Gagal menyimpan data meja. Periksa koneksi internet Anda.');
    }
}

// ================== HELPER FUNCTIONS ==================
// Format tanggal YYYY-MM-DD
function getToday() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Format angka dengan pemisah ribuan
function formatRupiah(angka) {
    if (!angka) return '';
    const number = angka.toString().replace(/[^0-9]/g, '');
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Parse angka dari format rupiah
function parseRupiah(rupiah) {
    if (!rupiah) return '';
    return rupiah.toString().replace(/[^0-9]/g, '');
}

// Capitalize first letter of each word
function capitalizeName(nama) {
    if (!nama) return '';
    return nama.split(' ').map(kata => {
        return kata.charAt(0).toUpperCase() + kata.slice(1).toLowerCase();
    }).join(' ');
}

// Fungsi untuk menentukan status kelengkapan
function getStatusKelengkapan(reservasi) {
    const punyaMeja = reservasi.nomorMeja && reservasi.nomorMeja.length > 0;
    const punyaDP = reservasi.statusDP === 'Ya' && reservasi.nominalDP && reservasi.nominalDP > 0;
    
    if (punyaMeja && punyaDP) return 'Lengkap';
    if (!punyaMeja && punyaDP) return 'Belum ada Meja';
    if (punyaMeja && !punyaDP) return 'Belum ada DP';
    if (!punyaMeja && !punyaDP) return 'Belum ada Meja & DP';
    return 'Belum Lengkap';
}

// Update Dashboard Cards
function updateDashboardCards() {
    const today = getToday();
    const reservasiHariIni = reservations.filter(r => r.tanggal === today);
    const mejaTerpakai = reservasiHariIni.flatMap(r => r.nomorMeja || []);
    const mejaAvailable = tables.length - mejaTerpakai.length;
    const belumLengkap = reservasiHariIni.filter(r => {
        const status = getStatusKelengkapan(r);
        return status !== 'Lengkap';
    }).length;

    document.getElementById('dashboard-reservasi-count').innerText = reservasiHariIni.length;
    document.getElementById('dashboard-meja-available').innerText = mejaAvailable;
    document.getElementById('dashboard-belum-lengkap').innerText = belumLengkap;
}

// ================== NAVIGASI ==================
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action === 'buat') {
            showPage('buat-page');
            resetFormReservasi();
        } else if (action === 'list') {
            showPage('list-page');
            document.getElementById('list-tanggal').value = getToday();
            loadListReservasi();
        } else if (action === 'cek') {
            showPage('cek-page');
            document.getElementById('cek-tanggal').value = getToday();
            loadMejaKosong();
        } else if (action === 'atur-meja') {
            showPage('atur-meja-page');
            renderDaftarMeja();
        }
    });
});

document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => showPage('dashboard-page'));
});

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

// ================== FITUR A: BUAT RESERVASI ==================
let editId = null;

// Auto-capitalize nama
document.getElementById('nama').addEventListener('input', function(e) {
    const cursorPos = this.selectionStart;
    this.value = capitalizeName(this.value);
    this.setSelectionRange(cursorPos, cursorPos);
});

// Format Rupiah untuk input nominal DP
document.getElementById('nominal-dp').addEventListener('input', function(e) {
    const value = this.value.replace(/[^0-9]/g, '');
    if (value) {
        this.value = formatRupiah(value);
    } else {
        this.value = '';
    }
});

function resetFormReservasi() {
    editId = null;
    document.getElementById('nama').value = '';
    document.getElementById('jumlah').value = '';
    document.getElementById('hp').value = '';
    document.getElementById('area').value = 'Non Smoking';
    document.getElementById('punya-meja').checked = false;
    document.getElementById('punya-order').checked = false;
    document.getElementById('punya-dp').checked = false;
    document.getElementById('pilih-meja-container').style.display = 'none';
    document.getElementById('dp-container').style.display = 'none';
    document.getElementById('nominal-dp').value = '';
    document.getElementById('buat-tanggal').value = getToday();
}

// Event listener untuk checkbox punya meja
document.getElementById('punya-meja').addEventListener('change', function(e) {
    const container = document.getElementById('pilih-meja-container');
    if (this.checked) {
        container.style.display = 'block';
        loadMejaGrid();
    } else {
        container.style.display = 'none';
    }
});

// Event listener untuk checkbox punya DP
document.getElementById('punya-dp').addEventListener('change', function(e) {
    const container = document.getElementById('dp-container');
    container.style.display = this.checked ? 'block' : 'none';
    if (!this.checked) {
        document.getElementById('nominal-dp').value = '';
    }
});

function loadMejaGrid(selectedMejas = []) {
    const tanggal = document.getElementById('buat-tanggal').value;
    const semuaMeja = tables;
    
    let mejaTerpakai;
    if (editId) {
        mejaTerpakai = reservations.filter(r => r.tanggal === tanggal && r.id !== editId).flatMap(r => r.nomorMeja || []);
    } else {
        mejaTerpakai = reservations.filter(r => r.tanggal === tanggal).flatMap(r => r.nomorMeja || []);
    }
    
    const container = document.getElementById('meja-grid-container');
    let html = '';
    
    // URUTAN: Non Smoking dulu, lalu Smoking, lalu Tambahan
    const nonSmoking = semuaMeja.filter(m => m.area === 'Non Smoking');
    const smoking = semuaMeja.filter(m => m.area === 'Smoking');
    const tambahan = semuaMeja.filter(m => m.area === 'Tambahan');
    
    if (nonSmoking.length) {
        html += '<div class="meja-area">🚭 Non Smoking</div>';
        nonSmoking.forEach(m => {
            const tersedia = !mejaTerpakai.includes(m.nomorMeja);
            const isSelected = selectedMejas.includes(m.nomorMeja);
            html += `<div class="meja-pilih-item ${tersedia ? 'tersedia' : ''} ${isSelected ? 'selected' : ''}" 
                         data-meja="${m.nomorMeja}" 
                         data-tersedia="${tersedia}"
                         style="${!tersedia ? 'opacity:0.3; pointer-events:none;' : ''}">
                         ${m.nomorMeja}
                    </div>`;
        });
    }
    
    if (smoking.length) {
        html += '<div class="meja-area">🚬 Smoking</div>';
        smoking.forEach(m => {
            const tersedia = !mejaTerpakai.includes(m.nomorMeja);
            const isSelected = selectedMejas.includes(m.nomorMeja);
            html += `<div class="meja-pilih-item ${tersedia ? 'tersedia' : ''} ${isSelected ? 'selected' : ''}" 
                         data-meja="${m.nomorMeja}" 
                         data-tersedia="${tersedia}"
                         style="${!tersedia ? 'opacity:0.3; pointer-events:none;' : ''}">
                         ${m.nomorMeja}
                    </div>`;
        });
    }
    
    if (tambahan.length) {
        html += '<div class="meja-area">➕ Tambahan</div>';
        tambahan.forEach(m => {
            const tersedia = !mejaTerpakai.includes(m.nomorMeja);
            const isSelected = selectedMejas.includes(m.nomorMeja);
            html += `<div class="meja-pilih-item ${tersedia ? 'tersedia' : ''} ${isSelected ? 'selected' : ''}" 
                         data-meja="${m.nomorMeja}" 
                         data-tersedia="${tersedia}"
                         style="${!tersedia ? 'opacity:0.3; pointer-events:none;' : ''}">
                         ${m.nomorMeja}
                    </div>`;
        });
    }
    
    container.innerHTML = html;
    
    setTimeout(() => {
        let selected = [...selectedMejas];
        document.querySelectorAll('.meja-pilih-item.tersedia').forEach(item => {
            item.addEventListener('click', function() {
                const meja = this.dataset.meja;
                if (selected.includes(meja)) {
                    selected = selected.filter(m => m !== meja);
                    this.classList.remove('selected');
                } else {
                    selected.push(meja);
                    this.classList.add('selected');
                }
            });
        });
    }, 100);
}

// Tombol Simpan Reservasi
document.getElementById('simpan-reservasi').addEventListener('click', async function() {
    // Validasi field wajib
    const tanggal = document.getElementById('buat-tanggal').value;
    const nama = document.getElementById('nama').value;
    const jumlah = document.getElementById('jumlah').value;
    const hp = document.getElementById('hp').value;
    
    if (!tanggal || !nama || !jumlah || !hp) {
        alert('Harap isi semua field wajib (Tanggal, Nama, Jumlah Tamu, No HP)');
        return;
    }
    
    let nomorMeja = [];
    if (document.getElementById('punya-meja').checked) {
        const selectedMejas = [];
        document.querySelectorAll('.meja-pilih-item.selected').forEach(item => {
            selectedMejas.push(item.dataset.meja);
        });
        if (selectedMejas.length === 0) {
            alert('Harap pilih minimal satu meja');
            return;
        }
        nomorMeja = selectedMejas;
    }
    
    let statusDP = 'Tidak';
    let jenisPembayaran = null;
    let nominalDP = null;
    let waktuInputDP = null;
    
    if (document.getElementById('punya-dp').checked) {
        const nominal = parseRupiah(document.getElementById('nominal-dp').value);
        if (!nominal || nominal <= 0) {
            alert('Harap isi nominal DP');
            return;
        }
        statusDP = 'Ya';
        jenisPembayaran = document.getElementById('jenis-pembayaran').value;
        nominalDP = nominal;
        waktuInputDP = new Date().toISOString();
    }
    
    const reservasi = {
        id: editId || (Date.now() + '-' + Math.random().toString(36).substr(2, 5)),
        tanggal: tanggal,
        nama: capitalizeName(nama),
        jumlahTamu: jumlah,
        noHp: hp,
        area: document.getElementById('area').value,
        nomorMeja: nomorMeja,
        statusOrder: document.getElementById('punya-order').checked ? 'Ya' : 'Tidak',
        statusDP: statusDP,
        jenisPembayaran: jenisPembayaran,
        nominalDP: nominalDP,
        waktuInputDP: waktuInputDP
    };
    
    if (statusDP === 'Ya' && nominalDP > 0) {
        reservasi.urutanDP = hitungUrutanDP(tanggal, waktuInputDP, editId);
    }
    
    reservasi.statusKelengkapan = getStatusKelengkapan(reservasi);
    
    if (editId) {
        const index = reservations.findIndex(r => r.id === editId);
        if (index !== -1) {
            reservations[index] = reservasi;
        }
    } else {
        reservations.push(reservasi);
    }
    
    await saveReservations();
    alert('Reservasi Berhasil Disimpan');
    
    document.getElementById('list-tanggal').value = tanggal;
    showPage('list-page');
    loadListReservasi();
});

function hitungUrutanDP(tanggal, waktu, excludeId = null) {
    let dpReservations = reservations.filter(r => 
        r.tanggal === tanggal && 
        r.statusDP === 'Ya' && 
        r.nominalDP && 
        r.nominalDP > 0 &&
        r.id !== excludeId
    );
    dpReservations.sort((a, b) => new Date(a.waktuInputDP) - new Date(b.waktuInputDP));
    
    let pos = 1;
    for (let r of dpReservations) {
        if (new Date(r.waktuInputDP) < new Date(waktu)) pos++;
    }
    return pos;
}

// ================== FITUR C: LIST RESERVASI ==================
let currentView = 'table';

document.getElementById('toggle-view').addEventListener('click', () => {
    currentView = currentView === 'table' ? 'card' : 'table';
    document.getElementById('toggle-view').innerText = currentView === 'table' ? '📱 Tampilan Card' : '📋 Tampilan Table';
    loadListReservasi();
});

document.getElementById('sort-by').addEventListener('change', loadListReservasi);
document.querySelector('#list-page .btn-load-tanggal').addEventListener('click', loadListReservasi);

function loadListReservasi() {
    const tanggal = document.getElementById('list-tanggal').value;
    let list = reservations.filter(r => r.tanggal === tanggal);
    const sortBy = document.getElementById('sort-by').value;
    
    if (sortBy === 'urutanDP') {
        list.sort((a, b) => (a.urutanDP || 999) - (b.urutanDP || 999));
    } else if (sortBy === 'nomorMeja') {
        list.sort((a, b) => {
            const aMeja = a.nomorMeja && a.nomorMeja.length ? parseInt(a.nomorMeja[0]) : 999;
            const bMeja = b.nomorMeja && b.nomorMeja.length ? parseInt(b.nomorMeja[0]) : 999;
            return aMeja - bMeja;
        });
    } else if (sortBy === 'kelengkapan') {
        list.sort((a, b) => {
            const statusOrder = ['Lengkap', 'Belum ada DP', 'Belum ada Meja', 'Belum ada Meja & DP'];
            return statusOrder.indexOf(a.statusKelengkapan) - statusOrder.indexOf(b.statusKelengkapan);
        });
    }
    
    const container = document.getElementById('list-container');
    if (currentView === 'table') {
        let html = '<table><thead><tr>';
        kolomSetting.ditampilkan.forEach(k => {
            html += `<th>${getNamaKolom(k)}</th>`;
        });
        html += '<th>Aksi</th></tr></thead><tbody>';
        list.forEach(r => {
            html += '<tr>';
            kolomSetting.ditampilkan.forEach(k => {
                html += `<td>${formatKolom(r, k)}</td>`;
            });
            html += `<td>
                <button class="action-btn edit-btn" data-id="${r.id}">Edit</button>
                <button class="action-btn hapus-btn" data-id="${r.id}">Hapus</button>
            </td></tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    } else {
        let html = '<div class="card-view">';
        list.forEach(r => {
            const statusClass = r.statusKelengkapan.toLowerCase().replace(/ /g, '-').replace(/&/g, '');
            html += `<div class="card-item" data-id="${r.id}">
                <div><strong>${r.nama}</strong> (${r.jumlahTamu} org)</div>
                <div>Meja: ${r.nomorMeja ? r.nomorMeja.join(', ') : '-'}</div>
                <div>DP: ${r.statusDP === 'Ya' && r.nominalDP ? 'Rp ' + formatRupiah(r.nominalDP) : '-'}</div>
                <div>Status: <span class="status-badge status-${statusClass}">${r.statusKelengkapan}</span></div>
                <div>
                    <button class="action-btn edit-btn" data-id="${r.id}">Edit</button>
                    <button class="action-btn hapus-btn" data-id="${r.id}">Hapus</button>
                </div>
            </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    }
    
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            editReservasi(id);
        });
    });
    document.querySelectorAll('.hapus-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm('Hapus reservasi ini?')) {
                const id = e.target.dataset.id;
                reservations = reservations.filter(r => r.id !== id);
                await saveReservations();
                loadListReservasi();
            }
        });
    });
}

function getNamaKolom(k) {
    const map = {
        nama: 'Nama', jumlahTamu: 'Jml', noHp: 'HP', area: 'Area',
        nomorMeja: 'No Meja', statusOrder: 'Order', statusDP: 'DP',
        nominalDP: 'Nominal', urutanDP: 'Urutan', statusKelengkapan: 'Kelengkapan'
    };
    return map[k] || k;
}

function formatKolom(r, k) {
    if (k === 'nomorMeja') return r.nomorMeja ? r.nomorMeja.join(', ') : '-';
    if (k === 'nominalDP') return r.nominalDP ? 'Rp ' + formatRupiah(r.nominalDP) : '-';
    if (k === 'urutanDP') return r.urutanDP || '-';
    if (k === 'statusKelengkapan') {
        const statusClass = r.statusKelengkapan.toLowerCase().replace(/ /g, '-').replace(/&/g, '');
        return `<span class="status-badge status-${statusClass}">${r.statusKelengkapan}</span>`;
    }
    return r[k] || '-';
}

function editReservasi(id) {
    const reservasi = reservations.find(r => r.id === id);
    if (!reservasi) return;
    
    editId = id;
    
    document.getElementById('buat-tanggal').value = reservasi.tanggal;
    document.getElementById('nama').value = reservasi.nama;
    document.getElementById('jumlah').value = reservasi.jumlahTamu;
    document.getElementById('hp').value = reservasi.noHp;
    document.getElementById('area').value = reservasi.area;
    
    document.getElementById('punya-meja').checked = reservasi.nomorMeja && reservasi.nomorMeja.length > 0;
    document.getElementById('punya-order').checked = reservasi.statusOrder === 'Ya';
    document.getElementById('punya-dp').checked = reservasi.statusDP === 'Ya';
    
    if (document.getElementById('punya-meja').checked) {
        document.getElementById('pilih-meja-container').style.display = 'block';
        setTimeout(() => {
            loadMejaGrid(reservasi.nomorMeja || []);
        }, 100);
    } else {
        document.getElementById('pilih-meja-container').style.display = 'none';
    }
    
    if (document.getElementById('punya-dp').checked) {
        document.getElementById('dp-container').style.display = 'block';
        document.getElementById('jenis-pembayaran').value = reservasi.jenisPembayaran || 'Transfer';
        document.getElementById('nominal-dp').value = reservasi.nominalDP ? formatRupiah(reservasi.nominalDP) : '';
    } else {
        document.getElementById('dp-container').style.display = 'none';
    }
    
    showPage('buat-page');
}

// ================== ATUR KOLOM ==================
document.getElementById('atur-kolom').addEventListener('click', () => {
    const modal = document.getElementById('modal-kolom');
    const list = document.getElementById('kolom-list');
    let html = '';
    kolomSetting.urutan.forEach((k, index) => {
        html += `<div style="margin-bottom:8px;">
            <input type="checkbox" data-kolom="${k}" ${kolomSetting.ditampilkan.includes(k) ? 'checked' : ''}>
            ${getNamaKolom(k)}
            <button class="naik" data-index="${index}">⬆️</button>
            <button class="turun" data-index="${index}">⬇️</button>
        </div>`;
    });
    list.innerHTML = html;
    modal.style.display = 'flex';
    
    list.querySelectorAll('.naik').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const i = parseInt(e.target.dataset.index);
            if (i > 0) {
                [kolomSetting.urutan[i-1], kolomSetting.urutan[i]] = [kolomSetting.urutan[i], kolomSetting.urutan[i-1]];
                localStorage.setItem('kolomSetting', JSON.stringify(kolomSetting));
                document.getElementById('atur-kolom').click();
            }
        });
    });
    list.querySelectorAll('.turun').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const i = parseInt(e.target.dataset.index);
            if (i < kolomSetting.urutan.length-1) {
                [kolomSetting.urutan[i], kolomSetting.urutan[i+1]] = [kolomSetting.urutan[i+1], kolomSetting.urutan[i]];
                localStorage.setItem('kolomSetting', JSON.stringify(kolomSetting));
                document.getElementById('atur-kolom').click();
            }
        });
    });
});

document.getElementById('simpan-kolom').addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('#kolom-list input[type=checkbox]');
    kolomSetting.ditampilkan = [];
    checkboxes.forEach(cb => {
        if (cb.checked) kolomSetting.ditampilkan.push(cb.dataset.kolom);
    });
    localStorage.setItem('kolomSetting', JSON.stringify(kolomSetting));
    document.getElementById('modal-kolom').style.display = 'none';
    loadListReservasi();
});

document.getElementById('tutup-modal').addEventListener('click', () => {
    document.getElementById('modal-kolom').style.display = 'none';
});

// ================== FITUR D: CEK MEJA KOSONG ==================
document.querySelector('#cek-page .btn-load-tanggal').addEventListener('click', loadMejaKosong);

function loadMejaKosong() {
    const tanggal = document.getElementById('cek-tanggal').value;
    const semuaMeja = tables;
    
    const mejaDenganStatus = semuaMeja.map(meja => {
        const reservasiMeja = reservations.find(r => r.tanggal === tanggal && r.nomorMeja && r.nomorMeja.includes(meja.nomorMeja));
        return {
            ...meja,
            terisi: !!reservasiMeja,
            reservasi: reservasiMeja
        };
    });
    
    const container = document.getElementById('meja-kosong-container');
    let html = '<div class="meja-grid">';
    
    const nonSmoking = mejaDenganStatus.filter(m => m.area === 'Non Smoking');
    const smoking = mejaDenganStatus.filter(m => m.area === 'Smoking');
    const tambahan = mejaDenganStatus.filter(m => m.area === 'Tambahan');
    
    if (nonSmoking.length) {
        html += '<div class="meja-area">🚭 Non Smoking</div>';
        nonSmoking.forEach(m => {
            html += `<div class="meja-item ${m.terisi ? 'terisi' : 'kosong'}" 
                         data-meja="${m.nomorMeja}" 
                         data-terisi="${m.terisi}">
                         ${m.nomorMeja}
                    </div>`;
        });
    }
    
    if (smoking.length) {
        html += '<div class="meja-area">🚬 Smoking</div>';
        smoking.forEach(m => {
            html += `<div class="meja-item ${m.terisi ? 'terisi' : 'kosong'}" 
                         data-meja="${m.nomorMeja}" 
                         data-terisi="${m.terisi}">
                         ${m.nomorMeja}
                    </div>`;
        });
    }
    
    if (tambahan.length) {
        html += '<div class="meja-area">➕ Tambahan</div>';
        tambahan.forEach(m => {
            html += `<div class="meja-item ${m.terisi ? 'terisi' : 'kosong'}" 
                         data-meja="${m.nomorMeja}" 
                         data-terisi="${m.terisi}">
                         ${m.nomorMeja}
                    </div>`;
        });
    }
    
    html += '</div>';
    container.innerHTML = html;
    
    document.querySelectorAll('.meja-item').forEach(item => {
        item.addEventListener('click', () => {
            const meja = item.dataset.meja;
            const terisi = item.dataset.terisi === 'true';
            const tanggal = document.getElementById('cek-tanggal').value;
            
            if (!terisi) {
                if (confirm(`Buat reservasi baru untuk meja ${meja}?`)) {
                    resetFormReservasi();
                    document.getElementById('buat-tanggal').value = tanggal;
                    document.getElementById('punya-meja').checked = true;
                    document.getElementById('pilih-meja-container').style.display = 'block';
                    
                    setTimeout(() => {
                        loadMejaGrid([meja]);
                    }, 100);
                    
                    showPage('buat-page');
                }
            } else {
                const reservasi = reservations.find(r => r.tanggal === tanggal && r.nomorMeja && r.nomorMeja.includes(meja));
                if (reservasi) {
                    tampilkanDetailReservasi(reservasi);
                }
            }
        });
    });
}

function tampilkanDetailReservasi(reservasi) {
    const modal = document.getElementById('modal-detail');
    const container = document.getElementById('detail-reservasi');
    
    container.innerHTML = `
        <p><strong>Nama:</strong> ${reservasi.nama}</p>
        <p><strong>Jumlah Tamu:</strong> ${reservasi.jumlahTamu}</p>
        <p><strong>No HP:</strong> ${reservasi.noHp}</p>
        <p><strong>Area:</strong> ${reservasi.area}</p>
        <p><strong>Nomor Meja:</strong> ${reservasi.nomorMeja ? reservasi.nomorMeja.join(', ') : '-'}</p>
        <p><strong>Status Order:</strong> ${reservasi.statusOrder || '-'}</p>
        <p><strong>Status DP:</strong> ${reservasi.statusDP || '-'}</p>
        ${reservasi.nominalDP ? `<p><strong>Nominal DP:</strong> Rp ${formatRupiah(reservasi.nominalDP)}</p>` : ''}
        ${reservasi.urutanDP ? `<p><strong>Urutan DP:</strong> ${reservasi.urutanDP}</p>` : ''}
        <p><strong>Status:</strong> <span class="status-badge status-${reservasi.statusKelengkapan.toLowerCase().replace(/ /g, '-').replace(/&/g, '')}">${reservasi.statusKelengkapan}</span></p>
    `;
    
    modal.style.display = 'flex';
    
    document.getElementById('edit-detail').onclick = () => {
        modal.style.display = 'none';
        editReservasi(reservasi.id);
    };
    
    document.getElementById('tutup-detail').onclick = () => {
        modal.style.display = 'none';
    };
}

// ================== ATUR MEJA ==================
document.getElementById('tambah-meja').addEventListener('click', async () => {
    const no = prompt('Nomor Meja baru:');
    if (!no) return;
    if (tables.find(t => t.nomorMeja === no)) {
        alert('Nomor meja sudah ada');
        return;
    }
    const area = prompt('Area (Smoking / Non Smoking / Tambahan):', 'Non Smoking');
    if (area && ['Smoking','Non Smoking','Tambahan'].includes(area)) {
        tables.push({ nomorMeja: no, area });
        await saveTables();
        renderDaftarMeja();
    } else alert('Area tidak valid');
});

function renderDaftarMeja() {
    const container = document.getElementById('daftar-meja');
    let html = '';
    tables.sort((a,b) => parseInt(a.nomorMeja) - parseInt(b.nomorMeja)).forEach(t => {
        html += `<div class="meja-item-edit">
            <span>${t.nomorMeja} - ${t.area}</span>
            <select onchange="ubahAreaMeja('${t.nomorMeja}', this.value)">
                <option value="Smoking" ${t.area === 'Smoking' ? 'selected' : ''}>Smoking</option>
                <option value="Non Smoking" ${t.area === 'Non Smoking' ? 'selected' : ''}>Non Smoking</option>
                <option value="Tambahan" ${t.area === 'Tambahan' ? 'selected' : ''}>Tambahan</option>
            </select>
            <button onclick="hapusMeja('${t.nomorMeja}')">🗑️</button>
        </div>`;
    });
    container.innerHTML = html;
}

window.ubahAreaMeja = async (nomor, area) => {
    const meja = tables.find(t => t.nomorMeja === nomor);
    if (meja) {
        meja.area = area;
        await saveTables();
        renderDaftarMeja();
    }
};

window.hapusMeja = async (nomor) => {
    if (confirm(`Hapus meja ${nomor}?`)) {
        tables = tables.filter(t => t.nomorMeja !== nomor);
        await saveTables();
        renderDaftarMeja();
    }
};

// ================== INITIALIZATION ==================
// Load data saat aplikasi dimulai
loadData();

// Auto refresh setiap 30 detik (untuk sync antar device)
setInterval(loadData, 30000);
