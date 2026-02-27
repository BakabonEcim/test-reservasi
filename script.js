// Data Awal
let reservations = JSON.parse(localStorage.getItem('reservations')) || [];
let tables = JSON.parse(localStorage.getItem('tables')) || [];
let kolomSetting = JSON.parse(localStorage.getItem('kolomSetting')) || {
    urutan: ['nama', 'jumlahTamu', 'noHp', 'area', 'nomorMeja', 'statusOrder', 'statusDP', 'nominalDP', 'urutanDP', 'statusKelengkapan'],
    ditampilkan: ['nama', 'jumlahTamu', 'noHp', 'area', 'nomorMeja', 'statusOrder', 'statusDP', 'nominalDP', 'urutanDP', 'statusKelengkapan']
};

// Inisialisasi meja default jika kosong
if (tables.length === 0) {
    for (let i = 1; i <= 70; i++) {
        let area = 'Non Smoking';
        if (i > 30 && i <= 50) area = 'Smoking';
        else if (i > 50) area = 'Tambahan';
        tables.push({ nomorMeja: i.toString(), area });
    }
    saveTables();
}

// Helper Simpan
function saveReservations() {
    localStorage.setItem('reservations', JSON.stringify(reservations));
    updateDashboardCards();
}
function saveTables() {
    localStorage.setItem('tables', JSON.stringify(tables));
}

// Format tanggal YYYY-MM-DD
function getToday() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

// Navigasi
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action === 'buat') {
            showPage('buat-page');
            resetFormReservasi();
        } else if (action === 'tambah-meja') {
            showPage('tambah-meja-page');
            document.getElementById('tambah-meja-tanggal').value = getToday();
            loadReservasiButuhMeja();
        } else if (action === 'tambah-dp') {
            showPage('tambah-dp-page');
            document.getElementById('tambah-dp-tanggal').value = getToday();
            loadReservasiButuhDP();
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

// ================== FITUR A: BUAT RESERVASI (1 HALAMAN) ==================
let editId = null;

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
    
    // Jika mode edit, exclude reservasi ini sendiri
    let mejaTerpakai;
    if (editId) {
        mejaTerpakai = reservations.filter(r => r.tanggal === tanggal && r.id !== editId).flatMap(r => r.nomorMeja || []);
    } else {
        mejaTerpakai = reservations.filter(r => r.tanggal === tanggal).flatMap(r => r.nomorMeja || []);
    }
    
    const container = document.getElementById('meja-grid-container');
    let html = '';
    
    // Kelompokkan berdasarkan area
    const smoking = semuaMeja.filter(m => m.area === 'Smoking');
    const nonSmoking = semuaMeja.filter(m => m.area === 'Non Smoking');
    const tambahan = semuaMeja.filter(m => m.area === 'Tambahan');
    
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
    
    // Event klik pada meja
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
document.getElementById('simpan-reservasi').addEventListener('click', function() {
    // Validasi field wajib
    const tanggal = document.getElementById('buat-tanggal').value;
    const nama = document.getElementById('nama').value;
    const jumlah = document.getElementById('jumlah').value;
    const hp = document.getElementById('hp').value;
    
    if (!tanggal || !nama || !jumlah || !hp) {
        alert('Harap isi semua field wajib (Tanggal, Nama, Jumlah Tamu, No HP)');
        return;
    }
    
    // Ambil data meja yang dipilih
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
    
    // Ambil data DP
    let statusDP = 'Tidak';
    let jenisPembayaran = null;
    let nominalDP = null;
    let waktuInputDP = null;
    
    if (document.getElementById('punya-dp').checked) {
        const nominal = document.getElementById('nominal-dp').value;
        if (!nominal || nominal <= 0) {
            alert('Harap isi nominal DP');
            return;
        }
        statusDP = 'Ya';
        jenisPembayaran = document.getElementById('jenis-pembayaran').value;
        nominalDP = nominal;
        waktuInputDP = new Date().toISOString();
    }
    
    // Buat objek reservasi
    const reservasi = {
        id: editId || (Date.now() + '-' + Math.random().toString(36).substr(2, 5)),
        tanggal: tanggal,
        nama: nama,
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
    
    // Hitung urutan DP jika ada
    if (statusDP === 'Ya' && nominalDP > 0) {
        reservasi.urutanDP = hitungUrutanDP(tanggal, waktuInputDP, editId);
    }
    
    // Set status kelengkapan
    reservasi.statusKelengkapan = getStatusKelengkapan(reservasi);
    
    // Simpan
    if (editId) {
        const index = reservations.findIndex(r => r.id === editId);
        if (index !== -1) {
            reservations[index] = reservasi;
        }
    } else {
        reservations.push(reservasi);
    }
    
    saveReservations();
    alert('Reservasi Berhasil Disimpan');
    
    // Redirect ke list
    document.getElementById('list-tanggal').value = tanggal;
    showPage('list-page');
    loadListReservasi();
});

// Fungsi hitung urutan DP
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

// ================== FITUR B1: TAMBAH MEJA ==================
document.querySelector('#tambah-meja-page .btn-load-tanggal').addEventListener('click', loadReservasiButuhMeja);

function loadReservasiButuhMeja() {
    const tanggal = document.getElementById('tambah-meja-tanggal').value;
    const butuhMeja = reservations.filter(r => 
        r.tanggal === tanggal && 
        (!r.nomorMeja || r.nomorMeja.length === 0)
    );
    
    const container = document.getElementById('daftar-reservasi-butuh-meja');
    if (butuhMeja.length === 0) {
        container.innerHTML = '<p>Tidak ada reservasi yang butuh meja</p>';
        return;
    }
    
    let html = '<h3>Pilih reservasi untuk ditambahkan meja:</h3>';
    butuhMeja.forEach(r => {
        const status = getStatusKelengkapan(r);
        html += `<div class="card-item" data-id="${r.id}">
            <div><strong>${r.nama}</strong> - ${r.jumlahTamu} org</div>
            <div>HP: ${r.noHp} | Area: ${r.area}</div>
            <div>Status: <span class="status-badge status-${status.toLowerCase().replace(/ /g, '-')}">${status}</span></div>
            <button class="btn-pilih-tambah-meja" data-id="${r.id}">Pilih untuk Tambah Meja</button>
        </div>`;
    });
    container.innerHTML = html;
    
    document.querySelectorAll('.btn-pilih-tambah-meja').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            tampilkanFormTambahMeja(id);
        });
    });
}

function tampilkanFormTambahMeja(id) {
    const reservasi = reservations.find(r => r.id === id);
    const container = document.getElementById('form-tambah-meja');
    container.style.display = 'block';
    
    const tanggal = reservasi.tanggal;
    const semuaMeja = tables;
    const mejaTerpakai = reservations.filter(r => r.tanggal === tanggal && r.id !== id).flatMap(r => r.nomorMeja || []);
    
    let html = '<h3>Tambah Meja untuk ' + reservasi.nama + '</h3>';
    html += '<div class="meja-pilih-grid" id="grid-tambah-meja">';
    
    const smoking = semuaMeja.filter(m => m.area === 'Smoking');
    const nonSmoking = semuaMeja.filter(m => m.area === 'Non Smoking');
    const tambahan = semuaMeja.filter(m => m.area === 'Tambahan');
    
    if (smoking.length) {
        html += '<div class="meja-area">🚬 Smoking</div>';
        smoking.forEach(m => {
            const tersedia = !mejaTerpakai.includes(m.nomorMeja);
            html += `<div class="meja-pilih-item ${tersedia ? 'tersedia' : ''}" 
                         data-meja="${m.nomorMeja}" 
                         data-tersedia="${tersedia}"
                         style="${!tersedia ? 'opacity:0.3; pointer-events:none;' : ''}">
                         ${m.nomorMeja}
                    </div>`;
        });
    }
    
    if (nonSmoking.length) {
        html += '<div class="meja-area">🚭 Non Smoking</div>';
        nonSmoking.forEach(m => {
            const tersedia = !mejaTerpakai.includes(m.nomorMeja);
            html += `<div class="meja-pilih-item ${tersedia ? 'tersedia' : ''}" 
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
            html += `<div class="meja-pilih-item ${tersedia ? 'tersedia' : ''}" 
                         data-meja="${m.nomorMeja}" 
                         data-tersedia="${tersedia}"
                         style="${!tersedia ? 'opacity:0.3; pointer-events:none;' : ''}">
                         ${m.nomorMeja}
                    </div>`;
        });
    }
    
    html += '</div>';
    html += '<button class="btn" id="simpan-tambah-meja">Simpan Meja</button>';
    container.innerHTML = html;
    
    let selectedMejas = [];
    setTimeout(() => {
        document.querySelectorAll('#grid-tambah-meja .meja-pilih-item.tersedia').forEach(item => {
            item.addEventListener('click', function() {
                const meja = this.dataset.meja;
                if (selectedMejas.includes(meja)) {
                    selectedMejas = selectedMejas.filter(m => m !== meja);
                    this.classList.remove('selected');
                } else {
                    selectedMejas.push(meja);
                    this.classList.add('selected');
                }
            });
        });
    }, 100);
    
    document.getElementById('simpan-tambah-meja').addEventListener('click', function() {
        if (selectedMejas.length === 0) {
            alert('Pilih minimal satu meja');
            return;
        }
        
        reservasi.nomorMeja = selectedMejas;
        reservasi.statusKelengkapan = getStatusKelengkapan(reservasi);
        saveReservations();
        
        alert('Meja berhasil ditambahkan');
        container.style.display = 'none';
        loadReservasiButuhMeja();
    });
}

// ================== FITUR B2: TAMBAH DP ==================
document.querySelector('#tambah-dp-page .btn-load-tanggal').addEventListener('click', loadReservasiButuhDP);

function loadReservasiButuhDP() {
    const tanggal = document.getElementById('tambah-dp-tanggal').value;
    const butuhDP = reservations.filter(r => 
        r.tanggal === tanggal && 
        r.statusDP === 'Ya' && 
        (!r.nominalDP || r.nominalDP <= 0)
    );
    
    const container = document.getElementById('daftar-reservasi-butuh-dp');
    if (butuhDP.length === 0) {
        container.innerHTML = '<p>Tidak ada reservasi yang butuh DP</p>';
        return;
    }
    
    let html = '<h3>Pilih reservasi untuk ditambahkan DP:</h3>';
    butuhDP.forEach(r => {
        const status = getStatusKelengkapan(r);
        html += `<div class="card-item" data-id="${r.id}">
            <div><strong>${r.nama}</strong> - ${r.jumlahTamu} org</div>
            <div>HP: ${r.noHp} | Area: ${r.area}</div>
            <div>Meja: ${r.nomorMeja ? r.nomorMeja.join(', ') : '-'}</div>
            <div>Status: <span class="status-badge status-${status.toLowerCase().replace(/ /g, '-')}">${status}</span></div>
            <button class="btn-pilih-tambah-dp" data-id="${r.id}">Pilih untuk Tambah DP</button>
        </div>`;
    });
    container.innerHTML = html;
    
    document.querySelectorAll('.btn-pilih-tambah-dp').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            tampilkanFormTambahDP(id);
        });
    });
}

function tampilkanFormTambahDP(id) {
    const reservasi = reservations.find(r => r.id === id);
    const container = document.getElementById('form-tambah-dp');
    container.style.display = 'block';
    
    let html = '<h3>Tambah DP untuk ' + reservasi.nama + '</h3>';
    html += `
        <div class="form-group">
            <label>Jenis Pembayaran</label>
            <select id="tambah-dp-jenis">
                <option value="Cash">Cash</option>
                <option value="Transfer">Transfer</option>
            </select>
        </div>
        <div class="form-group">
            <label>Nominal DP</label>
            <input type="number" id="tambah-dp-nominal" min="0" required>
        </div>
        <button class="btn" id="simpan-tambah-dp">Simpan DP</button>
    `;
    container.innerHTML = html;
    
    document.getElementById('simpan-tambah-dp').addEventListener('click', function() {
        const jenis = document.getElementById('tambah-dp-jenis').value;
        const nominal = document.getElementById('tambah-dp-nominal').value;
        
        if (!nominal || nominal <= 0) {
            alert('Isi nominal DP');
            return;
        }
        
        reservasi.jenisPembayaran = jenis;
        reservasi.nominalDP = nominal;
        reservasi.waktuInputDP = new Date().toISOString();
        reservasi.urutanDP = hitungUrutanDP(reservasi.tanggal, reservasi.waktuInputDP, reservasi.id);
        reservasi.statusKelengkapan = getStatusKelengkapan(reservasi);
        
        saveReservations();
        alert('DP berhasil ditambahkan');
        container.style.display = 'none';
        loadReservasiButuhDP();
    });
}

// ================== FITUR C: LIST RESERVASI ==================
let currentView = 'table';

document.getElementById('toggle-view').addEventListener('click', () => {
    currentView = currentView === 'table' ? 'card' : 'table';
    document.getElementById('toggle-view').innerText = currentView === 'table' ? '📱 Tampilan Card' : '📋 Tampilan Table';
    loadListReservasi();
});

document.getElementById('sort-by').addEventListener('change', loadListReservasi);

// Tombol Muat di List Reservasi
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
                <button class="edit-btn" data-id="${r.id}">✏️</button>
                <button class="hapus-btn" data-id="${r.id}">🗑️</button>
            </td></tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    } else {
        let html = '<div class="card-view">';
        list.forEach(r => {
            const statusClass = r.statusKelengkapan.toLowerCase().replace(/ /g, '-');
            html += `<div class="card-item" data-id="${r.id}">
                <div><strong>${r.nama}</strong> (${r.jumlahTamu} org)</div>
                <div>Meja: ${r.nomorMeja ? r.nomorMeja.join(', ') : '-'}</div>
                <div>DP: ${r.statusDP === 'Ya' && r.nominalDP ? 'Rp '+r.nominalDP : '-'}</div>
                <div>Status: <span class="status-badge status-${statusClass}">${r.statusKelengkapan}</span></div>
                <div>
                    <button class="edit-btn" data-id="${r.id}">✏️ Edit</button>
                    <button class="hapus-btn" data-id="${r.id}">🗑️ Hapus</button>
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
        btn.addEventListener('click', (e) => {
            if (confirm('Hapus reservasi ini?')) {
                const id = e.target.dataset.id;
                reservations = reservations.filter(r => r.id !== id);
                saveReservations();
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
    if (k === 'nominalDP') return r.nominalDP ? 'Rp '+r.nominalDP : '-';
    if (k === 'urutanDP') return r.urutanDP || '-';
    if (k === 'statusKelengkapan') {
        const statusClass = r.statusKelengkapan.toLowerCase().replace(/ /g, '-');
        return `<span class="status-badge status-${statusClass}">${r.statusKelengkapan}</span>`;
    }
    return r[k] || '-';
}

function editReservasi(id) {
    const reservasi = reservations.find(r => r.id === id);
    if (!reservasi) return;
    
    editId = id;
    
    // Isi form
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
        document.getElementById('jenis-pembayaran').value = reservasi.jenisPembayaran || 'Cash';
        document.getElementById('nominal-dp').value = reservasi.nominalDP || '';
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
    
    const smoking = mejaDenganStatus.filter(m => m.area === 'Smoking');
    if (smoking.length) {
        html += '<div class="meja-area">🚬 Smoking</div>';
        smoking.forEach(m => {
            html += `<div class="meja-item ${m.area.toLowerCase().replace(' ', '-')} ${m.terisi ? 'terisi' : 'kosong'}" 
                         data-meja="${m.nomorMeja}" 
                         data-terisi="${m.terisi}">
                         ${m.nomorMeja}
                    </div>`;
        });
    }
    
    const nonSmoking = mejaDenganStatus.filter(m => m.area === 'Non Smoking');
    if (nonSmoking.length) {
        html += '<div class="meja-area">🚭 Non Smoking</div>';
        nonSmoking.forEach(m => {
            html += `<div class="meja-item ${m.area.toLowerCase().replace(' ', '-')} ${m.terisi ? 'terisi' : 'kosong'}" 
                         data-meja="${m.nomorMeja}" 
                         data-terisi="${m.terisi}">
                         ${m.nomorMeja}
                    </div>`;
        });
    }
    
    const tambahan = mejaDenganStatus.filter(m => m.area === 'Tambahan');
    if (tambahan.length) {
        html += '<div class="meja-area">➕ Tambahan</div>';
        tambahan.forEach(m => {
            html += `<div class="meja-item tambahan ${m.terisi ? 'terisi' : 'kosong'}" 
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
        ${reservasi.nominalDP ? `<p><strong>Nominal DP:</strong> Rp ${reservasi.nominalDP}</p>` : ''}
        ${reservasi.urutanDP ? `<p><strong>Urutan DP:</strong> ${reservasi.urutanDP}</p>` : ''}
        <p><strong>Status:</strong> <span class="status-badge status-${reservasi.statusKelengkapan.toLowerCase().replace(/ /g, '-')}">${reservasi.statusKelengkapan}</span></p>
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
document.getElementById('tambah-meja').addEventListener('click', () => {
    const no = prompt('Nomor Meja baru:');
    if (!no) return;
    if (tables.find(t => t.nomorMeja === no)) {
        alert('Nomor meja sudah ada');
        return;
    }
    const area = prompt('Area (Smoking / Non Smoking / Tambahan):', 'Non Smoking');
    if (area && ['Smoking','Non Smoking','Tambahan'].includes(area)) {
        tables.push({ nomorMeja: no, area });
        saveTables();
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

window.ubahAreaMeja = (nomor, area) => {
    const meja = tables.find(t => t.nomorMeja === nomor);
    if (meja) {
        meja.area = area;
        saveTables();
        renderDaftarMeja();
    }
};

window.hapusMeja = (nomor) => {
    if (confirm(`Hapus meja ${nomor}?`)) {
        tables = tables.filter(t => t.nomorMeja !== nomor);
        saveTables();
        renderDaftarMeja();
    }
};

// Inisialisasi
updateDashboardCards();
