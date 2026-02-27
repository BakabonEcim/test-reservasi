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

// Navigasi
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action === 'buat') showPage('buat-page');
        else if (action === 'tambah') showPage('tambah-page');
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
    } else if (pageId === 'buat-page') {
        document.getElementById('buat-tanggal').value = getToday();
        resetBuatForm();
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

document.querySelector('#buat-page .btn-ganti-tanggal').addEventListener('click', () => {
    document.getElementById('form-reservasi').style.display = 'none';
    document.getElementById('step-container').innerHTML = '';
    step = 0;
    dataSementara = { tanggal: document.getElementById('buat-tanggal').value };
    tampilkanFormAwal();
});

function resetBuatForm() {
    step = 0;
    dataSementara = { tanggal: document.getElementById('buat-tanggal').value };
    document.getElementById('form-reservasi').style.display = 'none';
    document.getElementById('step-container').innerHTML = '';
    tampilkanFormAwal();
}

function tampilkanFormAwal() {
    const container = document.getElementById('step-container');
    container.innerHTML = `
        <div class="form-group">
            <label>Nama Tamu</label>
            <input type="text" id="nama" required>
        </div>
        <div class="form-group">
            <label>Jumlah Tamu</label>
            <input type="number" id="jumlah" min="1" required>
        </div>
        <div class="form-group">
            <label>Nomor HP</label>
            <input type="tel" id="hp" required>
        </div>
        <div class="form-group">
            <label>Preferensi Area</label>
            <select id="area">
                <option value="Smoking">Smoking</option>
                <option value="Non Smoking">Non Smoking</option>
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

function tampilkanPilihMeja() {
    const tanggal = dataSementara.tanggal;
    const semuaMeja = tables.map(t => t.nomorMeja);
    const mejaTerpakai = reservations.filter(r => r.tanggal === tanggal).flatMap(r => r.nomorMeja || []);
    const mejaTersedia = semuaMeja.filter(m => !mejaTerpakai.includes(m));
    const container = document.getElementById('step-container');
    let html = '<p>Pilih satu atau lebih meja (Ctrl+klik untuk multi):</p><select id="pilih-meja" multiple size="10">';
    mejaTersedia.forEach(m => html += `<option value="${m}">${m}</option>`);
    html += '</select><button class="btn" id="simpan-meja">Simpan</button>';
    container.innerHTML = html;
    document.getElementById('simpan-meja').addEventListener('click', () => {
        const selected = Array.from(document.getElementById('pilih-meja').selectedOptions).map(o => o.value);
        if (selected.length === 0) {
            alert('Pilih minimal satu meja');
            return;
        }
        dataSementara.nomorMeja = selected;
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
                <option value="Cash">Cash</option>
                <option value="Transfer">Transfer</option>
            </select>
        </div>
        <div class="form-group">
            <label>Nominal DP</label>
            <input type="number" id="nominal" min="0" required>
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
    dataSementara.id = Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    
    // Jika ada DP, hitung urutan
    if (dataSementara.statusDP === 'Ya') {
        dataSementara.urutanDP = hitungUrutanDP(dataSementara.tanggal, dataSementara.waktuInputDP);
    } else {
        dataSementara.urutanDP = null;
    }
    
    reservations.push(dataSementara);
    saveReservations();
    alert('Reservasi Berhasil Disimpan');
    // Arahkan ke List Reservasi tanggal yang sama
    document.getElementById('list-tanggal').value = dataSementara.tanggal;
    showPage('list-page');
    loadListReservasi();
}

function hitungUrutanDP(tanggal, waktu) {
    const dpReservations = reservations.filter(r => r.tanggal === tanggal && r.statusDP === 'Ya');
    dpReservations.sort((a, b) => new Date(a.waktuInputDP) - new Date(b.waktuInputDP));
    // Cari posisi untuk waktu baru
    let pos = 1;
    for (let r of dpReservations) {
        if (new Date(r.waktuInputDP) < new Date(waktu)) pos++;
    }
    return pos;
}

// ================== FITUR B: TAMBAH MEJA / DP ==================
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
        html += `<div class="card-item" data-id="${r.id}">
            <div><strong>${r.nama}</strong> - ${r.jumlahTamu} org</div>
            <div>HP: ${r.noHp} | Area: ${r.area}</div>
            <div>Meja: ${r.nomorMeja ? r.nomorMeja.join(', ') : '-'} | DP: ${r.statusDP} ${r.nominalDP ? r.nominalDP : ''}</div>
            <button class="btn-pilih-lengkapi" data-id="${r.id}">Pilih</button>
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
    let html = '<h3>Lengkapi Data</h3>';
    
    if (!reservasi.nomorMeja || reservasi.nomorMeja.length === 0) {
        // Tampilkan pilihan meja
        const semuaMeja = tables.map(t => t.nomorMeja);
        const mejaTerpakai = reservations.filter(r => r.tanggal === reservasi.tanggal && r.id !== id).flatMap(r => r.nomorMeja || []);
        const mejaTersedia = semuaMeja.filter(m => !mejaTerpakai.includes(m));
        html += '<div class="form-group"><label>Pilih Meja</label><select id="lengkapi-meja" multiple size="5">';
        mejaTersedia.forEach(m => html += `<option value="${m}">${m}</option>`);
        html += '</select></div>';
    }
    
    if (reservasi.statusDP === 'Ya' && (!reservasi.nominalDP || reservasi.nominalDP <= 0)) {
        html += `
            <div class="form-group"><label>Jenis Pembayaran</label>
                <select id="lengkapi-jenis"><option value="Cash">Cash</option><option value="Transfer">Transfer</option></select>
            </div>
            <div class="form-group"><label>Nominal DP</label><input type="number" id="lengkapi-nominal" min="0"></div>
        `;
    }
    
    html += '<button class="btn" id="simpan-lengkapi">Simpan</button>';
    container.innerHTML = html;
    
    document.getElementById('simpan-lengkapi').addEventListener('click', () => {
        if (!reservasi.nomorMeja || reservasi.nomorMeja.length === 0) {
            const selected = Array.from(document.getElementById('lengkapi-meja').selectedOptions).map(o => o.value);
            if (selected.length === 0) { alert('Pilih meja'); return; }
            reservasi.nomorMeja = selected;
        }
        if (reservasi.statusDP === 'Ya' && (!reservasi.nominalDP || reservasi.nominalDP <= 0)) {
            const jenis = document.getElementById('lengkapi-jenis').value;
            const nominal = document.getElementById('lengkapi-nominal').value;
            if (!nominal || nominal <= 0) { alert('Isi nominal'); return; }
            reservasi.jenisPembayaran = jenis;
            reservasi.nominalDP = nominal;
            reservasi.waktuInputDP = new Date().toISOString();
            // Update urutan DP
            reservasi.urutanDP = hitungUrutanDP(reservasi.tanggal, reservasi.waktuInputDP);
        }
        // Update kelengkapan
        reservasi.statusKelengkapan = (reservasi.nomorMeja && reservasi.nomorMeja.length > 0) &&
            (reservasi.statusDP !== 'Ya' || (reservasi.nominalDP && reservasi.nominalDP > 0)) ? 'Lengkap' : 'Belum Lengkap';
        
        saveReservations();
        alert('Data diperbarui');
        container.style.display = 'none';
        loadReservasiBelumLengkap(); // refresh daftar
    });
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
                <div>DP: ${r.statusDP === 'Ya' ? 'Rp '+r.nominalDP : '-'}</div>
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

function editReservasi(id) {
    const r = reservations.find(r => r.id === id);
    // Sederhana: prompt untuk edit beberapa field (nama, jumlah, no meja, nominal dp)
    const newNama = prompt('Nama Tamu:', r.nama);
    if (newNama) r.nama = newNama;
    const newJumlah = prompt('Jumlah Tamu:', r.jumlahTamu);
    if (newJumlah) r.jumlahTamu = newJumlah;
    const newMeja = prompt('Nomor Meja (pisahkan koma):', r.nomorMeja ? r.nomorMeja.join(',') : '');
    if (newMeja !== null) r.nomorMeja = newMeja.split(',').map(s => s.trim()).filter(s => s);
    if (r.statusDP === 'Ya') {
        const newNominal = prompt('Nominal DP:', r.nominalDP);
        if (newNominal) r.nominalDP = newNominal;
    }
    // Update kelengkapan
    r.statusKelengkapan = (r.nomorMeja && r.nomorMeja.length > 0) &&
        (r.statusDP !== 'Ya' || (r.nominalDP && r.nominalDP > 0)) ? 'Lengkap' : 'Belum Lengkap';
    saveReservations();
    loadListReservasi();
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
    const mejaTerpakai = reservations.filter(r => r.tanggal === tanggal).flatMap(r => r.nomorMeja || []);
    const semuaMeja = tables;
    
    const smoking = semuaMeja.filter(m => m.area === 'Smoking' && !mejaTerpakai.includes(m.nomorMeja));
    const nonSmoking = semuaMeja.filter(m => m.area === 'Non Smoking' && !mejaTerpakai.includes(m.nomorMeja));
    const tambahan = semuaMeja.filter(m => m.area === 'Tambahan' && !mejaTerpakai.includes(m.nomorMeja));
    
    const container = document.getElementById('meja-kosong-container');
    let html = '<div class="meja-grid">';
    
    if (smoking.length) {
        html += '<div class="meja-area">🚬 Smoking</div>';
        smoking.forEach(m => html += `<div class="meja-item smoking">${m.nomorMeja}</div>`);
    }
    if (nonSmoking.length) {
        html += '<div class="meja-area">🚭 Non Smoking</div>';
        nonSmoking.forEach(m => html += `<div class="meja-item non-smoking">${m.nomorMeja}</div>`);
    }
    if (tambahan.length) {
        html += '<div class="meja-area">➕ Tambahan</div>';
        tambahan.forEach(m => html += `<div class="meja-item tambahan">${m.nomorMeja}</div>`);
    }
    html += '</div>';
    container.innerHTML = html;
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
