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
    updateDashboardCards(); // Update dashboard setiap kali data berubah
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

// Update Dashboard Cards
function updateDashboardCards() {
    const today = getToday();
    const reservasiHariIni = reservations.filter(r => r.tanggal === today);
    const mejaTerpakai = reservasiHariIni.flatMap(r => r.nomorMeja || []);
    const mejaAvailable = tables.length - mejaTerpakai.length;
    const belumLengkap = reservasiHariIni.filter(r => {
        // Reservasi belum lengkap jika: tidak punya meja ATAU (status DP Ya tapi belum input nominal)
        return !r.nomorMeja || r.nomorMeja.length === 0 || (r.statusDP === 'Ya' && (!r.nominalDP || r.nominalDP <= 0));
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
            resetBuatForm();
        } else if (action === 'tambah') showPage('tambah-page');
        else if (action === 'list') showPage('list-page');
        else if (action === 'cek') showPage('cek-page');
        else if (action === 'atur-meja') showPage('atur-meja-page');
    });
});

document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => showPage('dashboard-page'));
});

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    if (pageId === 'dashboard-page') {
        document.getElementById('current-date').innerText = getToday();
        updateDashboardCards();
    } else if (pageId === 'buat-page') {
        document.getElementById('buat-tanggal').value = getToday();
        // Hanya reset jika tidak dalam mode edit
        if (!window.editMode) {
            resetBuatForm();
        }
    } else if (pageId === 'tambah-page') {
        document.getElementById('tambah-tanggal').value = getToday();
        loadReservasiBelumLengkap();
    } else if (pageId === 'list-page') {
        document.getElementById('list-tanggal').value = getToday();
        loadListReservasi();
    } else if (pageId === 'cek-page') {
        document.getElementById('cek-tanggal').value = getToday();
        loadMejaKosong();
    } else if (pageId === 'atur-meja-page') {
        renderDaftarMeja();
    }
}

// ================== FITUR A: BUAT RESERVASI ==================
let step = 0;
let dataSementara = {};
let editId = null; // Untuk mode edit

// Perbaikan: Tombol ganti tanggal sekarang berfungsi
document.querySelector('#buat-page .btn-ganti-tanggal').addEventListener('click', () => {
    const newDate = document.getElementById('buat-tanggal').value;
    dataSementara.tanggal = newDate;
    // Tampilkan notifikasi bahwa tanggal berubah
    alert(`Tanggal diubah menjadi: ${formatTanggal(newDate)}`);
});

function resetBuatForm() {
    step = 0;
    editId = null;
    window.editMode = false;
    dataSementara = { 
        tanggal: document.getElementById('buat-tanggal').value,
        nomorMeja: [] 
    };
    document.getElementById('form-reservasi').style.display = 'none';
    document.getElementById('step-container').innerHTML = '';
    tampilkanFormAwal();
}

function tampilkanFormAwal() {
    const container = document.getElementById('step-container');
    container.innerHTML = `
        <div class="form-group">
            <label>Nama Tamu</label>
            <input type="text" id="nama" value="${dataSementara.nama || ''}" required>
        </div>
        <div class="form-group">
            <label>Jumlah Tamu</label>
            <input type="number" id="jumlah" min="1" value="${dataSementara.jumlahTamu || ''}" required>
        </div>
        <div class="form-group">
            <label>Nomor HP</label>
            <input type="tel" id="hp" value="${dataSementara.noHp || ''}" required>
        </div>
        <div class="form-group">
            <label>Preferensi Area</label>
            <select id="area">
                <option value="Smoking" ${dataSementara.area === 'Smoking' ? 'selected' : ''}>Smoking</option>
                <option value="Non Smoking" ${dataSementara.area === 'Non Smoking' ? 'selected' : ''}>Non Smoking</option>
            </select>
        </div>
        <button class="btn" id="lanjut-step1">Lanjut</button>
    `;
    document.getElementById('lanjut-step1').addEventListener('click', () => {
        dataSementara.nama = document.getElementById('nama').value;
        dataSementara.jumlahTamu = document.getElementById('jumlah').value;
        dataSementara.noHp = document.getElementById('hp').value;
        dataSementara.area = document.getElementById('area').value;
        if (!dataSementara.nama || !dataSementara.jumlahTamu || !dataSementara.noHp) {
            alert('Harap isi semua field');
            return;
        }
        step = 1;
        tampilkanPertanyaanMeja();
    });
}

function tampilkanPertanyaanMeja() {
    const container = document.getElementById('step-container');
    container.innerHTML = `
        <p>Apakah sudah ada nomor meja?</p>
        <button class="btn" id="meja-ya">Ya, pilih meja</button>
        <button class="btn btn-secondary" id="meja-tidak">Tidak, nanti</button>
    `;
    document.getElementById('meja-ya').addEventListener('click', () => {
        step = 2;
        tampilkanPilihMeja();
    });
    document.getElementById('meja-tidak').addEventListener('click', () => {
        dataSementara.nomorMeja = [];
        step = 3;
        tampilkanPertanyaanOrder();
    });
}

function tampilkanPilihMeja(selectedMeja = null) {
    const tanggal = dataSementara.tanggal;
    const semuaMeja = tables;
    
    // Jika mode edit, exclude reservasi ini sendiri dari pengecekan meja terpakai
    let mejaTerpakai;
    if (editId) {
        mejaTerpakai = reservations.filter(r => r.tanggal === tanggal && r.id !== editId).flatMap(r => r.nomorMeja || []);
    } else {
        mejaTerpakai = reservations.filter(r => r.tanggal === tanggal).flatMap(r => r.nomorMeja || []);
    }
    
    const container = document.getElementById('step-container');
    let html = '<p>Klik meja untuk memilih (bisa lebih dari satu):</p>';
    html += '<div class="meja-pilih-grid" id="grid-pilih-meja">';
    
    // Kelompokkan berdasarkan area
    const smoking = semuaMeja.filter(m => m.area === 'Smoking');
    const nonSmoking = semuaMeja.filter(m => m.area === 'Non Smoking');
    const tambahan = semuaMeja.filter(m => m.area === 'Tambahan');
    
    if (smoking.length) {
        html += '<div class="meja-area">🚬 Smoking</div>';
        smoking.forEach(m => {
            const tersedia = !mejaTerpakai.includes(m.nomorMeja);
            const isSelected = dataSementara.nomorMeja && dataSementara.nomorMeja.includes(m.nomorMeja);
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
            const isSelected = dataSementara.nomorMeja && dataSementara.nomorMeja.includes(m.nomorMeja);
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
            const isSelected = dataSementara.nomorMeja && dataSementara.nomorMeja.includes(m.nomorMeja);
            html += `<div class="meja-pilih-item ${tersedia ? 'tersedia' : ''} ${isSelected ? 'selected' : ''}" 
                         data-meja="${m.nomorMeja}" 
                         data-tersedia="${tersedia}"
                         style="${!tersedia ? 'opacity:0.3; pointer-events:none;' : ''}">
                         ${m.nomorMeja}
                    </div>`;
        });
    }
    
    html += '</div>';
    html += '<button class="btn" id="simpan-pilih-meja">Simpan Pilihan</button>';
    container.innerHTML = html;
    
    let selectedMejas = dataSementara.nomorMeja ? [...dataSementara.nomorMeja] : [];
    
    // Event klik pada meja
    document.querySelectorAll('.meja-pilih-item.tersedia').forEach(item => {
        item.addEventListener('click', () => {
            const meja = item.dataset.meja;
            if (selectedMejas.includes(meja)) {
                selectedMejas = selectedMejas.filter(m => m !== meja);
                item.classList.remove('selected');
            } else {
                selectedMejas.push(meja);
                item.classList.add('selected');
            }
        });
    });
    
    document.getElementById('simpan-pilih-meja').addEventListener('click', () => {
        if (selectedMejas.length === 0) {
            alert('Pilih minimal satu meja');
            return;
        }
        dataSementara.nomorMeja = selectedMejas;
        step = 3;
        tampilkanPertanyaanOrder();
    });
}

function tampilkanPertanyaanOrder() {
    const container = document.getElementById('step-container');
    container.innerHTML = `
        <p>Apakah sudah ada orderan?</p>
        <button class="btn" id="order-ya">Ya</button>
        <button class="btn btn-secondary" id="order-tidak">Tidak</button>
    `;
    document.getElementById('order-ya').addEventListener('click', () => {
        dataSementara.statusOrder = 'Ya';
        step = 4;
        tampilkanPertanyaanDP();
    });
    document.getElementById('order-tidak').addEventListener('click', () => {
        dataSementara.statusOrder = 'Tidak';
        step = 4;
        tampilkanPertanyaanDP();
    });
}

function tampilkanPertanyaanDP() {
    const container = document.getElementById('step-container');
    container.innerHTML = `
        <p>Apakah ada pembayaran DP?</p>
        <button class="btn" id="dp-ya">Ya</button>
        <button class="btn btn-secondary" id="dp-tidak">Tidak</button>
    `;
    document.getElementById('dp-ya').addEventListener('click', () => {
        step = 5;
        tampilkanFormDP();
    });
    document.getElementById('dp-tidak').addEventListener('click', () => {
        dataSementara.statusDP = 'Tidak';
        simpanReservasi();
    });
}

function tampilkanFormDP() {
    const container = document.getElementById('step-container');
    container.innerHTML = `
        <div class="form-group">
            <label>Jenis Pembayaran</label>
            <select id="jenis">
                <option value="Cash" ${dataSementara.jenisPembayaran === 'Cash' ? 'selected' : ''}>Cash</option>
                <option value="Transfer" ${dataSementara.jenisPembayaran === 'Transfer' ? 'selected' : ''}>Transfer</option>
            </select>
        </div>
        <div class="form-group">
            <label>Nominal DP</label>
            <input type="number" id="nominal" min="0" value="${dataSementara.nominalDP || ''}" required>
        </div>
        <button class="btn" id="simpan-dp">Simpan</button>
    `;
    document.getElementById('simpan-dp').addEventListener('click', () => {
        const jenis = document.getElementById('jenis').value;
        const nominal = document.getElementById('nominal').value;
        if (!nominal || nominal <= 0) {
            alert('Isi nominal DP');
            return;
        }
        dataSementara.statusDP = 'Ya';
        dataSementara.jenisPembayaran = jenis;
        dataSementara.nominalDP = nominal;
        dataSementara.waktuInputDP = new Date().toISOString();
        simpanReservasi();
    });
}

function simpanReservasi() {
    // Hitung status kelengkapan
    const lengkap = (dataSementara.nomorMeja && dataSementara.nomorMeja.length > 0) &&
                    (dataSementara.statusDP !== 'Ya' || (dataSementara.nominalDP && dataSementara.nominalDP > 0));
    dataSementara.statusKelengkapan = lengkap ? 'Lengkap' : 'Belum Lengkap';
    
    if (!editId) {
        // Mode tambah baru
        dataSementara.id = Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    } else {
        // Mode edit - pertahankan ID
        dataSementara.id = editId;
    }
    
    // Jika ada DP, hitung urutan
    if (dataSementara.statusDP === 'Ya' && dataSementara.nominalDP && dataSementara.nominalDP > 0) {
        // Hanya hitung ulang urutan jika ini DP baru atau berubah
        if (!dataSementara.waktuInputDP) {
            dataSementara.waktuInputDP = new Date().toISOString();
        }
        dataSementara.urutanDP = hitungUrutanDP(dataSementara.tanggal, dataSementara.waktuInputDP, editId);
    } else {
        dataSementara.urutanDP = null;
    }
    
    if (editId) {
        // Update reservasi yang ada
        const index = reservations.findIndex(r => r.id === editId);
        if (index !== -1) {
            reservations[index] = dataSementara;
        }
    } else {
        // Tambah baru
        reservations.push(dataSementara);
    }
    
    saveReservations();
    alert('Reservasi Berhasil Disimpan');
    
    // Reset mode edit
    window.editMode = false;
    editId = null;
    
    // Arahkan ke List Reservasi tanggal yang sama
    document.getElementById('list-tanggal').value = dataSementara.tanggal;
    showPage('list-page');
    loadListReservasi();
}

function hitungUrutanDP(tanggal, waktu, excludeId = null) {
    let dpReservations = reservations.filter(r => 
        r.tanggal === tanggal && 
        r.statusDP === 'Ya' && 
        r.nominalDP && 
        r.nominalDP > 0 &&
        r.id !== excludeId // Exclude diri sendiri saat edit
    );
    dpReservations.sort((a, b) => new Date(a.waktuInputDP) - new Date(b.waktuInputDP));
    
    // Cari posisi untuk waktu baru
    let pos = 1;
    for (let r of dpReservations) {
        if (new Date(r.waktuInputDP) < new Date(waktu)) pos++;
    }
    return pos;
}

// ================== FITUR B: TAMBAH MEJA / DP (PERBAIKAN) ==================
document.querySelector('#tambah-page .btn-load-tanggal').addEventListener('click', loadReservasiBelumLengkap);

function loadReservasiBelumLengkap() {
    const tanggal = document.getElementById('tambah-tanggal').value;
    const belumLengkap = reservations.filter(r => r.tanggal === tanggal && 
        ( !r.nomorMeja || r.nomorMeja.length === 0 || (r.statusDP === 'Ya' && (!r.nominalDP || r.nominalDP <= 0)) ));
    
    const container = document.getElementById('daftar-reservasi-belum-lengkap');
    if (belumLengkap.length === 0) {
        container.innerHTML = '<p>Tidak ada reservasi belum lengkap</p>';
        return;
    }
    let html = '<h3>Pilih reservasi untuk dilengkapi:</h3>';
    belumLengkap.forEach(r => {
        const kekurangan = [];
        if (!r.nomorMeja || r.nomorMeja.length === 0) kekurangan.push('Meja');
        if (r.statusDP === 'Ya' && (!r.nominalDP || r.nominalDP <= 0)) kekurangan.push('DP');
        
        html += `<div class="card-item" data-id="${r.id}">
            <div><strong>${r.nama}</strong> - ${r.jumlahTamu} org</div>
            <div>HP: ${r.noHp} | Area: ${r.area}</div>
            <div>Meja: ${r.nomorMeja ? r.nomorMeja.join(', ') : '-'}</div>
            <div>DP: ${r.statusDP === 'Ya' ? (r.nominalDP ? 'Rp '+r.nominalDP : 'Belum input') : 'Tidak'}</div>
            <div style="color: #dc3545; margin: 5px 0;">Kekurangan: ${kekurangan.join(', ')}</div>
            <button class="btn-pilih-lengkapi" data-id="${r.id}">Pilih untuk Dilengkapi</button>
        </div>`;
    });
    container.innerHTML = html;
    
    document.querySelectorAll('.btn-pilih-lengkapi').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            tampilkanFormLengkapi(id);
        });
    });
}

function tampilkanFormLengkapi(id) {
    const reservasi = reservations.find(r => r.id === id);
    const container = document.getElementById('form-lengkapi');
    container.style.display = 'block';
    
    let html = '<h3>Lengkapi Data Reservasi</h3>';
    html += `<p><strong>Nama:</strong> ${reservasi.nama}</p>`;
    
    // Cek apa saja yang perlu dilengkapi
    const perluMeja = !reservasi.nomorMeja || reservasi.nomorMeja.length === 0;
    const perluDP = reservasi.statusDP === 'Ya' && (!reservasi.nominalDP || reservasi.nominalDP <= 0);
    
    if (perluMeja) {
        html += '<h4>Pilih Meja:</h4><div class="meja-pilih-grid" id="grid-lengkapi-meja">';
        const semuaMeja = tables;
        const mejaTerpakai = reservations.filter(r => r.tanggal === reservasi.tanggal && r.id !== id).flatMap(r => r.nomorMeja || []);
        
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
    }
    
    if (perluDP) {
        html += `
            <div class="form-group">
                <label>Jenis Pembayaran</label>
                <select id="lengkapi-jenis">
                    <option value="Cash">Cash</option>
                    <option value="Transfer">Transfer</option>
                </select>
            </div>
            <div class="form-group">
                <label>Nominal DP</label>
                <input type="number" id="lengkapi-nominal" min="0" placeholder="Masukkan nominal DP">
            </div>
        `;
    }
    
    if (!perluMeja && !perluDP) {
        html += '<p>Tidak ada data yang perlu dilengkapi</p>';
    } else {
        html += '<button class="btn" id="simpan-lengkapi">Simpan Perubahan</button>';
    }
    
    container.innerHTML = html;
    
    if (perluMeja) {
        let selectedMejas = [];
        
        document.querySelectorAll('#grid-lengkapi-meja .meja-pilih-item.tersedia').forEach(item => {
            item.addEventListener('click', () => {
                const meja = item.dataset.meja;
                if (selectedMejas.includes(meja)) {
                    selectedMejas = selectedMejas.filter(m => m !== meja);
                    item.classList.remove('selected');
                } else {
                    selectedMejas.push(meja);
                    item.classList.add('selected');
                }
            });
        });
        
        document.getElementById('simpan-lengkapi').addEventListener('click', () => {
            if (selectedMejas.length === 0) {
                alert('Pilih minimal satu meja');
                return;
            }
            reservasi.nomorMeja = selectedMejas;
            
            if (perluDP) {
                const jenis = document.getElementById('lengkapi-jenis').value;
                const nominal = document.getElementById('lengkapi-nominal').value;
                if (!nominal || nominal <= 0) {
                    alert('Isi nominal DP');
                    return;
                }
                reservasi.jenisPembayaran = jenis;
                reservasi.nominalDP = nominal;
                reservasi.waktuInputDP = new Date().toISOString();
                reservasi.urutanDP = hitungUrutanDP(reservasi.tanggal, reservasi.waktuInputDP, reservasi.id);
            }
            
            // Update kelengkapan
            reservasi.statusKelengkapan = (reservasi.nomorMeja && reservasi.nomorMeja.length > 0) &&
                (reservasi.statusDP !== 'Ya' || (reservasi.nominalDP && reservasi.nominalDP > 0)) ? 'Lengkap' : 'Belum Lengkap';
            
            saveReservations();
            alert('Data berhasil diperbarui');
            container.style.display = 'none';
            loadReservasiBelumLengkap();
        });
    } else if (perluDP) {
        document.getElementById('simpan-lengkapi').addEventListener('click', () => {
            const jenis = document.getElementById('lengkapi-jenis').value;
            const nominal = document.getElementById('lengkapi-nominal').value;
            if (!nominal || nominal <= 0) {
                alert('Isi nominal DP');
                return;
            }
            reservasi.jenisPembayaran = jenis;
            reservasi.nominalDP = nominal;
            reservasi.waktuInputDP = new Date().toISOString();
            reservasi.urutanDP = hitungUrutanDP(reservasi.tanggal, reservasi.waktuInputDP, reservasi.id);
            
            // Update kelengkapan
            reservasi.statusKelengkapan = (reservasi.nomorMeja && reservasi.nomorMeja.length > 0) &&
                (reservasi.statusDP !== 'Ya' || (reservasi.nominalDP && reservasi.nominalDP > 0)) ? 'Lengkap' : 'Belum Lengkap';
            
            saveReservations();
            alert('Data berhasil diperbarui');
            container.style.display = 'none';
            loadReservasiBelumLengkap();
        });
    }
}

// ================== FITUR C: LIST RESERVASI ==================
let currentView = 'table'; // table or card

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
        list.sort((a, b) => (a.statusKelengkapan === 'Lengkap' ? -1 : 1));
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
            html += `<div class="card-item" data-id="${r.id}">
                <div><strong>${r.nama}</strong> (${r.jumlahTamu} org)</div>
                <div>Meja: ${r.nomorMeja ? r.nomorMeja.join(', ') : '-'}</div>
                <div>DP: ${r.statusDP === 'Ya' && r.nominalDP ? 'Rp '+r.nominalDP : '-'}</div>
                <div>Status: ${r.statusKelengkapan}</div>
                <div>
                    <button class="edit-btn" data-id="${r.id}">✏️ Edit</button>
                    <button class="hapus-btn" data-id="${r.id}">🗑️ Hapus</button>
                </div>
            </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    }
    
    // Tambahkan event edit/hapus
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
    return r[k] || '-';
}

// PERBAIKAN: Fungsi editReservasi sekarang mengarahkan ke form
function editReservasi(id) {
    const reservasi = reservations.find(r => r.id === id);
    if (!reservasi) return;
    
    // Set mode edit
    window.editMode = true;
    editId = id;
    
    // Salin data reservasi ke dataSementara
    dataSementara = { ...reservasi };
    
    // Pastikan tanggal di date picker sesuai
    document.getElementById('buat-tanggal').value = dataSementara.tanggal;
    
    // Arahkan ke halaman buat reservasi
    showPage('buat-page');
    
    // Mulai dari awal form dengan data terisi
    step = 0;
    tampilkanFormAwal();
}

// Atur kolom
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
    
    // Event naik/turun
    list.querySelectorAll('.naik').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const i = parseInt(e.target.dataset.index);
            if (i > 0) {
                [kolomSetting.urutan[i-1], kolomSetting.urutan[i]] = [kolomSetting.urutan[i], kolomSetting.urutan[i-1]];
                localStorage.setItem('kolomSetting', JSON.stringify(kolomSetting));
                document.getElementById('atur-kolom').click(); // refresh modal
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
    
    // Kelompokkan meja berdasarkan status terisi/kosong
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
    
    // Smoking area
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
    
    // Non Smoking area
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
    
    // Tambahan area
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
    
    // Tambahkan event klik pada meja
    document.querySelectorAll('.meja-item').forEach(item => {
        item.addEventListener('click', () => {
            const meja = item.dataset.meja;
            const terisi = item.dataset.terisi === 'true';
            const tanggal = document.getElementById('cek-tanggal').value;
            
            if (!terisi) {
                // PERBAIKAN: Meja kosong - tanya buat reservasi baru, mulai dari awal
                if (confirm(`Buat reservasi baru untuk meja ${meja}?`)) {
                    // Reset mode edit
                    window.editMode = false;
                    editId = null;
                    
                    // Arahkan ke halaman buat reservasi
                    showPage('buat-page');
                    document.getElementById('buat-tanggal').value = tanggal;
                    
                    // Reset form dan set meja terpilih setelah form awal
                    resetBuatForm();
                    
                    // Set dataSementara dengan meja terpilih dan tanggal yang benar
                    setTimeout(() => {
                        dataSementara.tanggal = tanggal;
                        dataSementara.nomorMeja = [meja];
                        
                        // Isi form awal dengan data yang sudah ada (jika ada)
                        if (document.getElementById('nama')) {
                            document.getElementById('nama').value = dataSementara.nama || '';
                        }
                        if (document.getElementById('jumlah')) {
                            document.getElementById('jumlah').value = dataSementara.jumlahTamu || '';
                        }
                        if (document.getElementById('hp')) {
                            document.getElementById('hp').value = dataSementara.noHp || '';
                        }
                        if (document.getElementById('area')) {
                            document.getElementById('area').value = dataSementara.area || 'Non Smoking';
                        }
                        
                        // Tampilkan pesan bahwa meja sudah dipilih
                        alert(`Meja ${meja} akan dipesan. Silakan lengkapi data reservasi.`);
                    }, 100);
                }
            } else {
                // Meja terisi - tampilkan detail reservasi
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
        <p><strong>Status:</strong> ${reservasi.statusKelengkapan}</p>
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

// Helper format tanggal
function formatTanggal(tanggal) {
    const [tahun, bulan, hari] = tanggal.split('-');
    return `${hari}-${bulan}-${tahun}`;
}

// Inisialisasi
updateDashboardCards();
