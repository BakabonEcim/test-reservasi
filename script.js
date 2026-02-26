// State aplikasi
let currentPage = 'home';
let selectedDate = '';
let selectedReservationId = null;
let selectedMejaForReservasi = null;
let currentUser = 'Staf'; // Bisa diganti dengan login sederhana nanti

// Referensi elemen
const contentEl = document.getElementById('content');
const backBtn = document.getElementById('backBtn');
const pageTitle = document.getElementById('pageTitle');

// Inisialisasi data meja
function initTables() {
    let tables = localStorage.getItem('tables');
    if (!tables) {
        tables = [];
        for (let i = 1; i <= 70; i++) {
            let area = '';
            if (i <= 30) area = 'Smoking';
            else if (i <= 60) area = 'Non Smoking';
            else area = 'Tambahan';
            tables.push({
                nomorMeja: i.toString().padStart(2, '0'),
                area: area,
                kapasitas: 4
            });
        }
        localStorage.setItem('tables', JSON.stringify(tables));
    }
    return JSON.parse(localStorage.getItem('tables'));
}

function getTables() {
    return JSON.parse(localStorage.getItem('tables')) || initTables();
}

function saveTables(tables) {
    localStorage.setItem('tables', JSON.stringify(tables));
}

// Inisialisasi log aktivitas
function initLogs() {
    if (!localStorage.getItem('activityLogs')) {
        localStorage.setItem('activityLogs', JSON.stringify([]));
    }
}

function getLogs() {
    return JSON.parse(localStorage.getItem('activityLogs')) || [];
}

function addLog(action, details, reservationId = null) {
    const logs = getLogs();
    logs.push({
        id: generateId(),
        timestamp: Date.now(),
        user: currentUser,
        action: action,
        details: details,
        reservationId: reservationId
    });
    // Simpan maksimal 1000 log
    if (logs.length > 1000) logs.shift();
    localStorage.setItem('activityLogs', JSON.stringify(logs));
}

initLogs();

document.addEventListener('DOMContentLoaded', () => {
    loadPage('home');
});

backBtn.addEventListener('click', () => {
    if (currentPage === 'datePicker') {
        loadPage('home');
    } else {
        loadPage('datePicker', { type: currentPage });
    }
});

// Navigasi
function loadPage(page, params = {}) {
    currentPage = page;
    if (page === 'home') {
        renderHome();
        backBtn.style.display = 'none';
        pageTitle.textContent = 'Sistem Reservasi';
    } else if (page === 'datePicker') {
        renderDatePicker(params.type);
        backBtn.style.display = 'block';
        pageTitle.textContent = 'Pilih Tanggal';
    } else if (page === 'buatReservasi') {
        renderBuatReservasi(params.date);
        backBtn.style.display = 'block';
        pageTitle.textContent = 'Buat Reservasi';
    } else if (page === 'tambahMejaDp') {
        renderTambahMejaDp(params.date);
        backBtn.style.display = 'block';
        pageTitle.textContent = 'Tambah Meja/DP';
    } else if (page === 'listReservasi') {
        renderListReservasi(params.date);
        backBtn.style.display = 'block';
        pageTitle.textContent = 'Daftar Reservasi';
    } else if (page === 'cekMeja') {
        renderCekMeja(params.date);
        backBtn.style.display = 'block';
        pageTitle.textContent = 'Cek Meja';
    } else if (page === 'kelolaMeja') {
        renderKelolaMeja();
        backBtn.style.display = 'block';
        pageTitle.textContent = 'Kelola Meja';
    } else if (page === 'activityLog') {
        renderActivityLog();
        backBtn.style.display = 'block';
        pageTitle.textContent = 'Riwayat Aktivitas';
    }
}

// Render Home dengan dashboard dan notifikasi
function renderHome() {
    const today = new Date().toISOString().split('T')[0];
    const reservationsToday = getReservations().filter(r => r.tanggal === today);
    const incompleteToday = reservationsToday.filter(r => r.statusKelengkapan === 'Belum Lengkap');
    const totalMeja = getTables().length;
    const mejaTerisi = new Set();
    reservationsToday.forEach(r => r.nomorMeja.forEach(m => mejaTerisi.add(m)));
    const mejaKosong = totalMeja - mejaTerisi.size;

    contentEl.innerHTML = `
        <div class="dashboard">
            <div style="display: flex; justify-content: space-around; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                <div style="text-align:center; background:#3498db; color:white; padding:15px; border-radius:5px; width:45%;">
                    <h3>${reservationsToday.length}</h3>
                    <p>Reservasi Hari Ini</p>
                </div>
                <div style="text-align:center; background:#2ecc71; color:white; padding:15px; border-radius:5px; width:45%;">
                    <h3>${mejaTerisi.size}</h3>
                    <p>Meja Terisi</p>
                </div>
                <div style="text-align:center; background:#e67e22; color:white; padding:15px; border-radius:5px; width:45%;">
                    <h3>${mejaKosong}</h3>
                    <p>Meja Kosong</p>
                </div>
                <div style="text-align:center; background:#e74c3c; color:white; padding:15px; border-radius:5px; width:45%; position:relative;">
                    <h3>${incompleteToday.length}</h3>
                    <p>Belum Lengkap</p>
                    ${incompleteToday.length > 0 ? '<span style="position:absolute; top:-5px; right:-5px; background:#f1c40f; color:#333; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-weight:bold;">!</span>' : ''}
                </div>
            </div>
        </div>
        <div class="home-grid">
            <button class="home-btn btn-a" data-action="buatReservasi"><i class="fas fa-plus-circle"></i> Buat Reservasi Baru</button>
            <button class="home-btn btn-b" data-action="tambahMejaDp">
                <i class="fas fa-edit"></i> Tambah Meja / DP
                ${incompleteToday.length > 0 ? `<span style="background:#f1c40f; color:#333; border-radius:50%; padding:2px 8px; margin-left:5px; font-size:14px;">${incompleteToday.length}</span>` : ''}
            </button>
            <button class="home-btn btn-c" data-action="listReservasi"><i class="fas fa-list"></i> List Reservasi</button>
            <button class="home-btn btn-d" data-action="cekMeja"><i class="fas fa-chair"></i> Cek Meja</button>
        </div>
        <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center;">
            <button class="btn-secondary" data-action="kelolaMeja"><i class="fas fa-cog"></i> Kelola Meja</button>
            <button class="btn-secondary" data-action="activityLog"><i class="fas fa-history"></i> Riwayat</button>
        </div>
    `;
    
    document.querySelectorAll('.home-btn, .btn-secondary').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.currentTarget.dataset.action;
            if (action === 'kelolaMeja' || action === 'activityLog') {
                loadPage(action);
            } else {
                loadPage('datePicker', { type: action });
            }
        });
    });
}

// Render Date Picker
function renderDatePicker(type) {
    contentEl.innerHTML = `
        <div class="date-picker-container">
            <input type="date" id="datePicker" value="${new Date().toISOString().split('T')[0]}">
            <div style="display: flex; gap: 10px; margin-top: 10px;">
                <button class="btn" id="todayBtn">Hari Ini</button>
                <button class="btn" id="nextBtn">Lanjut</button>
            </div>
        </div>
    `;
    
    document.getElementById('todayBtn').addEventListener('click', () => {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('datePicker').value = today;
    });
    
    document.getElementById('nextBtn').addEventListener('click', () => {
        const date = document.getElementById('datePicker').value;
        if (!date) {
            alert('Pilih tanggal terlebih dahulu');
            return;
        }
        selectedDate = date;
        loadPage(type, { date });
    });
}

// Simpan data reservasi
function getReservations() {
    return JSON.parse(localStorage.getItem('reservations')) || [];
}

function saveReservations(reservations) {
    localStorage.setItem('reservations', JSON.stringify(reservations));
}

// Helper: generate ID
function generateId() {
    return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Helper: dapatkan meja tersedia per tanggal
function getAvailableTables(date, excludeReservationId = null) {
    const tables = getTables();
    const reservations = getReservations().filter(r => r.tanggal === date && r.status !== 'Batal' && r.status !== 'Tidak Hadir');
    const occupiedTableNumbers = new Set();
    reservations.forEach(r => {
        if (r.nomorMeja && r.id !== excludeReservationId) {
            r.nomorMeja.forEach(no => occupiedTableNumbers.add(no));
        }
    });
    return tables.filter(t => !occupiedTableNumbers.has(t.nomorMeja));
}

// Helper: dapatkan semua meja dengan status per tanggal
function getAllTablesWithStatus(date) {
    const tables = getTables();
    const reservations = getReservations().filter(r => r.tanggal === date && r.status !== 'Batal');
    const occupiedMap = new Map();
    
    reservations.forEach(r => {
        r.nomorMeja.forEach(no => {
            occupiedMap.set(no, {
                nama: r.nama,
                id: r.id,
                status: r.status
            });
        });
    });
    
    return tables.map(t => ({
        ...t,
        isOccupied: occupiedMap.has(t.nomorMeja),
        occupant: occupiedMap.get(t.nomorMeja)
    }));
}

// Helper: hitung urutan DP
function getNextDpUrutan(tanggal) {
    const reservations = getReservations().filter(r => r.tanggal === tanggal && r.statusAdaDP === 'Ya' && r.waktuInputDP);
    return reservations.length + 1;
}

// Render Buat Reservasi (dengan catatan)
function renderBuatReservasi(date) {
    let html = `
        <form id="reservasiForm">
            <input type="hidden" id="tanggal" value="${date}">
            <div class="form-group">
                <label>Nama Tamu</label>
                <input type="text" id="nama" required autocomplete="off" autocapitalize="words">
            </div>
            <div class="form-group">
                <label>Jumlah Tamu</label>
                <input type="number" id="jumlahTamu" required min="1">
            </div>
            <div class="form-group">
                <label>Nomor HP</label>
                <input type="tel" id="noHP" required pattern="[0-9]{10,13}" title="Minimal 10 angka">
            </div>
            <div class="form-group">
                <label>Preferensi Area</label>
                <select id="area">
                    <option value="Smoking">Smoking</option>
                    <option value="Non Smoking">Non Smoking</option>
                    <option value="Tambahan">Tambahan</option>
                </select>
            </div>
            <div class="form-group">
                <label>Catatan / Permintaan Khusus</label>
                <textarea id="notes" rows="2" placeholder="Contoh: meja dekat jendela, kursi bayi, dll"></textarea>
            </div>
            <div class="form-group">
                <label>Sudah Ada Nomor Meja?</label>
                <div class="radio-group">
                    <label><input type="radio" name="adaMeja" value="Ya" checked> Ya</label>
                    <label><input type="radio" name="adaMeja" value="Tidak"> Tidak</label>
                </div>
            </div>
            <div class="form-group" id="mejaGroup">
                <label>Pilih Meja (bisa lebih dari satu)</label>
                <select id="meja" multiple size="5">
                    <!-- akan diisi javascript -->
                </select>
                <small>Tekan Ctrl/Cmd untuk memilih lebih dari satu</small>
            </div>
            <div class="form-group">
                <label>Sudah Ada Orderan?</label>
                <div class="radio-group">
                    <label><input type="radio" name="adaOrder" value="Ya" checked> Ya</label>
                    <label><input type="radio" name="adaOrder" value="Tidak"> Tidak</label>
                </div>
            </div>
            <div class="form-group">
                <label>Apakah Ada Pembayaran DP?</label>
                <div class="radio-group">
                    <label><input type="radio" name="adaDP" value="Ya"> Ya</label>
                    <label><input type="radio" name="adaDP" value="Tidak" checked> Tidak</label>
                </div>
            </div>
            <div class="form-group hidden" id="dpGroup">
                <label>Jenis Pembayaran</label>
                <select id="jenisPembayaran">
                    <option value="Cash">Cash</option>
                    <option value="Transfer">Transfer</option>
                </select>
                <label style="margin-top:10px;">Nominal DP</label>
                <input type="number" id="nominalDP" min="0">
            </div>
            <button type="submit" class="btn">Simpan Reservasi</button>
        </form>
    `;
    contentEl.innerHTML = html;

    function loadMejaOptions() {
        const area = document.getElementById('area').value;
        const availableTables = getAvailableTables(date).filter(t => t.area === area);
        const select = document.getElementById('meja');
        select.innerHTML = availableTables.map(t => `<option value="${t.nomorMeja}">${t.nomorMeja} (${t.area})</option>`).join('');
    }

    loadMejaOptions();

    if (selectedMejaForReservasi) {
        document.querySelector('input[name="adaMeja"][value="Ya"]').checked = true;
        document.getElementById('mejaGroup').style.display = 'block';
        const tables = getTables();
        const mejaData = tables.find(t => t.nomorMeja === selectedMejaForReservasi);
        if (mejaData) {
            document.getElementById('area').value = mejaData.area;
            loadMejaOptions();
            const select = document.getElementById('meja');
            for (let option of select.options) {
                if (option.value === selectedMejaForReservasi) {
                    option.selected = true;
                    break;
                }
            }
        }
        selectedMejaForReservasi = null;
    }

    document.getElementById('area').addEventListener('change', loadMejaOptions);

    document.querySelectorAll('input[name="adaMeja"]').forEach(r => {
        r.addEventListener('change', (e) => {
            document.getElementById('mejaGroup').style.display = e.target.value === 'Ya' ? 'block' : 'none';
        });
    });
    
    document.querySelectorAll('input[name="adaDP"]').forEach(r => {
        r.addEventListener('change', (e) => {
            document.getElementById('dpGroup').classList.toggle('hidden', e.target.value !== 'Ya');
        });
    });

    document.getElementById('reservasiForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const tanggal = document.getElementById('tanggal').value;
        const nama = document.getElementById('nama').value;
        const jumlahTamu = parseInt(document.getElementById('jumlahTamu').value);
        const noHP = document.getElementById('noHP').value;
        const area = document.getElementById('area').value;
        const notes = document.getElementById('notes').value;
        const adaMeja = document.querySelector('input[name="adaMeja"]:checked').value;
        let nomorMeja = [];
        
        if (adaMeja === 'Ya') {
            nomorMeja = Array.from(document.getElementById('meja').selectedOptions).map(opt => opt.value);
            if (nomorMeja.length === 0) {
                alert('Pilih minimal satu meja');
                return;
            }
        }
        
        const statusOrder = document.querySelector('input[name="adaOrder"]:checked').value;
        const statusAdaDP = document.querySelector('input[name="adaDP"]:checked').value;
        let jenisPembayaran = '', nominalDP = 0, waktuInputDP = null, urutanDP = null;

        if (statusAdaDP === 'Ya') {
            jenisPembayaran = document.getElementById('jenisPembayaran').value;
            nominalDP = parseInt(document.getElementById('nominalDP').value) || 0;
            if (nominalDP <= 0) {
                alert('Isi nominal DP');
                return;
            }
            waktuInputDP = Date.now();
            urutanDP = getNextDpUrutan(tanggal);
        }

        const newReservation = {
            id: generateId(),
            tanggal,
            nama,
            jumlahTamu,
            noHP,
            area,
            nomorMeja,
            notes,
            statusOrder,
            statusAdaDP,
            jenisPembayaran,
            nominalDP,
            waktuInputDP,
            urutanDP,
            status: 'Aktif', // Aktif, Batal, Tidak Hadir
            statusKelengkapan: (nomorMeja.length > 0 && (statusAdaDP !== 'Ya' || nominalDP > 0)) ? 'Lengkap' : 'Belum Lengkap'
        };

        const reservations = getReservations();
        reservations.push(newReservation);
        saveReservations(reservations);
        
        addLog('TAMBAH RESERVASI', `Reservasi untuk ${nama} (${tanggal})`, newReservation.id);

        showNotification('Reservasi Berhasil Disimpan');
        loadPage('listReservasi', { date: tanggal });
    });
}

// Render Tambah Meja/DP (dengan notifikasi)
function renderTambahMejaDp(date) {
    const reservations = getReservations().filter(r => r.tanggal === date && r.status === 'Aktif' && (r.nomorMeja.length === 0 || (r.statusAdaDP === 'Ya' && !r.nominalDP)));
    
    if (reservations.length === 0) {
        contentEl.innerHTML = '<p style="text-align:center; padding:20px;">✅ Semua reservasi sudah lengkap untuk tanggal ini.</p><button class="btn" onclick="loadPage(\'datePicker\',{type:\'tambahMejaDp\'})">Kembali</button>';
        return;
    }

    let html = '<h3>Reservasi yang perlu dilengkapi:</h3><div class="list-group">';
    reservations.forEach(r => {
        const needMeja = r.nomorMeja.length === 0;
        const needDP = r.statusAdaDP === 'Ya' && !r.nominalDP;
        html += `
            <div style="border-left:5px solid ${needMeja ? '#e74c3c' : '#f39c12'}; background:#f9f9f9; padding:15px; margin-bottom:10px; border-radius:5px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="font-size:16px;">${r.nama}</strong> (${r.jumlahTamu} org)<br>
                        <small>HP: ${r.noHP} | Area: ${r.area}</small><br>
                        ${needMeja ? '<span style="color:#e74c3c;">⛔ Belum pilih meja</span>' : ''}
                        ${needDP ? '<span style="color:#f39c12;">💰 Belum input DP</span>' : ''}
                        ${r.notes ? '<br><small><i class="fas fa-sticky-note"></i> ' + r.notes + '</small>' : ''}
                    </div>
                    <button class="btn btn-secondary" style="width:auto;" onclick="editReservasi(\'${r.id}\')">Lengkapi</button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    contentEl.innerHTML = html;
}

// Render List Reservasi dengan filter dan pencarian
function renderListReservasi(date) {
    let reservations = getReservations().filter(r => r.tanggal === date);
    
    const html = `
        <div style="margin-bottom:15px;">
            <input type="text" id="searchInput" placeholder="🔍 Cari nama atau no HP..." style="width:100%; padding:12px; border:1px solid #ddd; border-radius:5px;">
        </div>
        <div class="filter-sort" style="flex-wrap:wrap;">
            <select id="statusFilter">
                <option value="all">Semua Status</option>
                <option value="Aktif">Aktif</option>
                <option value="Batal">Batal</option>
                <option value="Tidak Hadir">Tidak Hadir</option>
            </select>
            <select id="kelengkapanFilter">
                <option value="all">Semua Kelengkapan</option>
                <option value="Lengkap">Lengkap</option>
                <option value="Belum Lengkap">Belum Lengkap</option>
            </select>
            <select id="sortBy">
                <option value="urutanDP">Urutan DP</option>
                <option value="nomorMeja">Nomor Meja</option>
                <option value="statusKelengkapan">Status Kelengkapan</option>
                <option value="nama">Nama</option>
            </select>
            <button class="btn-secondary" id="applyFilter">Terapkan</button>
        </div>
        <div style="margin:10px 0; display:flex; gap:5px;">
            <button class="btn-secondary" id="prevDayBtn"><i class="fas fa-chevron-left"></i> Sebelumnya</button>
            <span style="flex:1; text-align:center; padding:10px; background:#ecf0f1; border-radius:5px;">
                ${new Date(date).toLocaleDateString('id-ID', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
            </span>
            <button class="btn-secondary" id="nextDayBtn">Berikutnya <i class="fas fa-chevron-right"></i></button>
        </div>
        <div id="listContainer"></div>
    `;
    contentEl.innerHTML = html;

    function formatDateString(dateStr, offset) {
        const d = new Date(dateStr);
        d.setDate(d.getDate() + offset);
        return d.toISOString().split('T')[0];
    }

    document.getElementById('prevDayBtn').addEventListener('click', () => {
        loadPage('listReservasi', { date: formatDateString(date, -1) });
    });

    document.getElementById('nextDayBtn').addEventListener('click', () => {
        loadPage('listReservasi', { date: formatDateString(date, 1) });
    });

    function renderFilteredList() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const statusFilter = document.getElementById('statusFilter').value;
        const kelengkapanFilter = document.getElementById('kelengkapanFilter').value;
        const sortBy = document.getElementById('sortBy').value;

        let filtered = reservations.filter(r => {
            const matchSearch = r.nama.toLowerCase().includes(searchTerm) || 
                               (r.noHP && r.noHP.includes(searchTerm));
            const matchStatus = statusFilter === 'all' || r.status === statusFilter;
            const matchKelengkapan = kelengkapanFilter === 'all' || r.statusKelengkapan === kelengkapanFilter;
            return matchSearch && matchStatus && matchKelengkapan;
        });

        // Sorting
        if (sortBy === 'urutanDP') {
            filtered.sort((a, b) => (a.urutanDP || Infinity) - (b.urutanDP || Infinity));
        } else if (sortBy === 'nomorMeja') {
            filtered.sort((a, b) => {
                const aMeja = a.nomorMeja.length ? parseInt(a.nomorMeja[0]) : Infinity;
                const bMeja = b.nomorMeja.length ? parseInt(b.nomorMeja[0]) : Infinity;
                return aMeja - bMeja;
            });
        } else if (sortBy === 'statusKelengkapan') {
            filtered.sort((a, b) => (a.statusKelengkapan === 'Lengkap' ? -1 : 1));
        } else if (sortBy === 'nama') {
            filtered.sort((a, b) => a.nama.localeCompare(b.nama));
        }

        let listHtml = '<div class="table-responsive"><table><tr>' +
            '<th>Status</th><th>Nama</th><th>Jml</th><th>HP</th><th>Area</th><th>Meja</th><th>Order</th><th>DP</th><th>Urutan</th><th>Catatan</th><th>Aksi</th></tr>';
        
        filtered.forEach(r => {
            const statusColor = r.status === 'Aktif' ? '#2ecc71' : (r.status === 'Batal' ? '#e74c3c' : '#95a5a6');
            listHtml += `<tr style="background:${r.statusKelengkapan === 'Lengkap' ? '#f0fff0' : '#fff0f0'}">
                <td><span style="background:${statusColor}; color:white; padding:3px 8px; border-radius:3px; font-size:12px;">${r.status || 'Aktif'}</span></td>
                <td><strong>${r.nama}</strong></td>
                <td>${r.jumlahTamu}</td>
                <td>${r.noHP}</td>
                <td>${r.area}</td>
                <td>${r.nomorMeja.join(', ') || '-'}</td>
                <td>${r.statusOrder}</td>
                <td>${r.statusAdaDP} ${r.nominalDP ? 'Rp'+r.nominalDP.toLocaleString() : ''}</td>
                <td>${r.urutanDP || '-'}</td>
                <td>${r.notes ? '<i class="fas fa-sticky-note" style="color:#3498db;" title="'+r.notes+'"></i>' : '-'}</td>
                <td>
                    <button class="action-btn" onclick="editListReservasi('${r.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn" onclick="ubahStatusReservasi('${r.id}')" title="Ubah Status"><i class="fas fa-tag"></i></button>
                    <button class="action-btn" onclick="deleteReservasi('${r.id}')" title="Hapus"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });
        listHtml += '</table></div>';
        
        if (filtered.length === 0) {
            listHtml = '<p style="text-align:center; padding:20px;">Tidak ada reservasi yang cocok</p>';
        }
        
        document.getElementById('listContainer').innerHTML = listHtml;
    }

    renderFilteredList();

    document.getElementById('applyFilter').addEventListener('click', renderFilteredList);
    document.getElementById('searchInput').addEventListener('keyup', renderFilteredList);
}

// Fungsi ubah status reservasi (No Show / Batal)
window.ubahStatusReservasi = function(id) {
    const reservation = getReservations().find(r => r.id === id);
    if (!reservation) return;

    const html = `
        <div class="modal-content">
            <h3>Ubah Status Reservasi</h3>
            <p><strong>${reservation.nama}</strong> - ${reservation.tanggal}</p>
            <div style="margin:20px 0;">
                <button class="btn" onclick="setStatusReservasi('${id}', 'Aktif')" style="background:#2ecc71;">Aktif</button>
                <button class="btn" onclick="setStatusReservasi('${id}', 'Tidak Hadir')" style="background:#95a5a6;">Tidak Hadir</button>
                <button class="btn" onclick="setStatusReservasi('${id}', 'Batal')" style="background:#e74c3c;">Batal</button>
            </div>
            <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Tutup</button>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = html;
    document.body.appendChild(modal);
};

window.setStatusReservasi = function(id, newStatus) {
    const reservations = getReservations();
    const idx = reservations.findIndex(r => r.id === id);
    if (idx === -1) return;
    
    const oldStatus = reservations[idx].status || 'Aktif';
    reservations[idx].status = newStatus;
    saveReservations(reservations);
    
    addLog('UBAH STATUS', `Reservasi ${reservations[idx].nama} dari ${oldStatus} ke ${newStatus}`, id);
    
    document.querySelector('.modal').remove();
    showNotification(`Status diubah ke ${newStatus}`);
    loadPage('listReservasi', { date: reservations[idx].tanggal });
};

// Fungsi edit dari list
window.editListReservasi = function(id) {
    const reservation = getReservations().find(r => r.id === id);
    if (!reservation) return;

    let html = `
        <form id="editFullForm">
            <input type="hidden" id="editId" value="${id}">
            <div class="form-group">
                <label>Nama Tamu</label>
                <input type="text" id="editNama" value="${reservation.nama}" required>
            </div>
            <div class="form-group">
                <label>Jumlah Tamu</label>
                <input type="number" id="editJumlahTamu" value="${reservation.jumlahTamu}" required>
            </div>
            <div class="form-group">
                <label>Nomor HP</label>
                <input type="tel" id="editNoHP" value="${reservation.noHP}" required>
            </div>
            <div class="form-group">
                <label>Catatan</label>
                <textarea id="editNotes" rows="2">${reservation.notes || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Nomor Meja (bisa lebih dari satu)</label>
                <select id="editMeja" multiple size="5">
                    ${getTables().map(t => {
                        const selected = reservation.nomorMeja.includes(t.nomorMeja) ? 'selected' : '';
                        return `<option value="${t.nomorMeja}" ${selected}>${t.nomorMeja} (${t.area})</option>`;
                    }).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Nominal DP</label>
                <input type="number" id="editNominalDP" value="${reservation.nominalDP || ''}">
            </div>
            <button type="submit" class="btn">Simpan</button>
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Batal</button>
        </form>
    `;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `<div class="modal-content">${html}</div>`;
    document.body.appendChild(modal);

    document.getElementById('editFullForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const reservations = getReservations();
        const idx = reservations.findIndex(r => r.id === id);
        if (idx === -1) return;

        const oldData = {...reservations[idx]};
        
        reservations[idx].nama = document.getElementById('editNama').value;
        reservations[idx].jumlahTamu = parseInt(document.getElementById('editJumlahTamu').value);
        reservations[idx].noHP = document.getElementById('editNoHP').value;
        reservations[idx].notes = document.getElementById('editNotes').value;
        
        const selectedMeja = Array.from(document.getElementById('editMeja').selectedOptions).map(opt => opt.value);
        
        // Cek double booking
        const otherReservations = reservations.filter(r => r.tanggal === reservations[idx].tanggal && r.id !== id && r.status !== 'Batal' && r.status !== 'Tidak Hadir');
        const occupied = new Set();
        otherReservations.forEach(r => r.nomorMeja.forEach(m => occupied.add(m)));
        
        if (selectedMeja.some(m => occupied.has(m))) {
            alert('Beberapa meja sudah dipesan di reservasi lain');
            return;
        }
        
        reservations[idx].nomorMeja = selectedMeja;
        
        const nominalDP = parseInt(document.getElementById('editNominalDP').value);
        if (reservations[idx].statusAdaDP === 'Ya' && nominalDP > 0 && !reservations[idx].waktuInputDP) {
            reservations[idx].waktuInputDP = Date.now();
            reservations[idx].urutanDP = getNextDpUrutan(reservations[idx].tanggal);
        }
        reservations[idx].nominalDP = nominalDP || 0;
        reservations[idx].statusKelengkapan = (selectedMeja.length > 0 && (reservations[idx].statusAdaDP !== 'Ya' || nominalDP > 0)) ? 'Lengkap' : 'Belum Lengkap';
        
        saveReservations(reservations);
        
        addLog('EDIT RESERVASI', `Data reservasi ${reservations[idx].nama} diubah`, id);
        
        document.body.removeChild(modal);
        showNotification('Data diupdate');
        loadPage('listReservasi', { date: reservations[idx].tanggal });
    });
};

window.deleteReservasi = function(id) {
    const reservation = getReservations().find(r => r.id === id);
    if (!reservation) return;
    
    // Modal konfirmasi kustom
    const html = `
        <div class="modal-content">
            <h3>Hapus Reservasi</h3>
            <p>Yakin ingin menghapus reservasi <strong>${reservation.nama}</strong> untuk tanggal ${reservation.tanggal}?</p>
            <p style="color:#e74c3c;">Tindakan ini tidak dapat dibatalkan!</p>
            <div style="display:flex; gap:10px; margin-top:20px;">
                <button class="btn btn-danger" id="confirmDelete">Ya, Hapus</button>
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Batal</button>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = html;
    document.body.appendChild(modal);
    
    document.getElementById('confirmDelete').addEventListener('click', () => {
        const reservations = getReservations();
        const idx = reservations.findIndex(r => r.id === id);
        if (idx !== -1) {
            const tanggal = reservations[idx].tanggal;
            const nama = reservations[idx].nama;
            reservations.splice(idx, 1);
            saveReservations(reservations);
            addLog('HAPUS RESERVASI', `Reservasi ${nama} dihapus`, id);
            showNotification('Reservasi dihapus');
            loadPage('listReservasi', { date: tanggal });
        }
        modal.remove();
    });
};

// Render Cek Meja dengan informasi lengkap
function renderCekMeja(date) {
    const tablesWithStatus = getAllTablesWithStatus(date);
    const areas = ['Smoking', 'Non Smoking', 'Tambahan'];
    
    let html = `<h3 style="margin-bottom:15px;">Meja - ${new Date(date).toLocaleDateString('id-ID')}</h3>`;
    
    areas.forEach(area => {
        const areaTables = tablesWithStatus.filter(t => t.area === area);
        html += `
            <div class="area-section" style="margin-bottom:20px;">
                <h4>${area} (${areaTables.length})</h4>
                <div style="display:flex; flex-wrap:wrap; gap:8px;">
        `;
        
        areaTables.sort((a,b) => parseInt(a.nomorMeja) - parseInt(b.nomorMeja)).forEach(t => {
            const statusClass = t.isOccupied ? 'occupied' : '';
            const title = t.isOccupied ? `Dipesan oleh: ${t.occupant.nama}` : 'Meja kosong';
            
            html += `
                <div class="table-item ${statusClass}" 
                     data-meja="${t.nomorMeja}" 
                     data-occupied="${t.isOccupied}"
                     data-occupant='${JSON.stringify(t.occupant)}'
                     style="position:relative; cursor:pointer; ${t.isOccupied ? 'background:#e74c3c;' : ''}"
                     title="${title}">
                    ${t.nomorMeja}
                    ${t.isOccupied ? '<i class="fas fa-user" style="position:absolute; bottom:2px; right:2px; font-size:8px;"></i>' : ''}
                </div>
            `;
        });
        
        html += '</div></div>';
    });
    
    contentEl.innerHTML = html;
    
    // Event listener untuk semua meja
    document.querySelectorAll('.table-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const meja = e.currentTarget.dataset.meja;
            const isOccupied = e.currentTarget.dataset.occupied === 'true';
            
            if (isOccupied) {
                const occupant = JSON.parse(e.currentTarget.dataset.occupant);
                showTableDetail(meja, occupant);
            } else {
                if (confirm(`Buat reservasi baru dengan meja ${meja}?`)) {
                    selectedMejaForReservasi = meja;
                    loadPage('buatReservasi', { date: date });
                }
            }
        });
    });
}

// Detail meja terisi
function showTableDetail(meja, occupant) {
    const html = `
        <div class="modal-content">
            <h3>Detail Meja ${meja}</h3>
            <p><strong>Dipesan oleh:</strong> ${occupant.nama}</p>
            <p><strong>ID Reservasi:</strong> ${occupant.id}</p>
            <p><strong>Status:</strong> ${occupant.status || 'Aktif'}</p>
            <div style="display:flex; gap:10px; margin-top:20px;">
                <button class="btn" onclick="loadPage('listReservasi', {date:'${selectedDate}'}); this.closest('.modal').remove();">Lihat Reservasi</button>
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Tutup</button>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = html;
    document.body.appendChild(modal);
}

// Render Kelola Meja (tetap sama seperti sebelumnya)
function renderKelolaMeja() {
    const tables = getTables();
    let html = `
        <button class="btn" id="tambahMejaBtn"><i class="fas fa-plus"></i> Tambah Meja</button>
        <div class="table-responsive">
            <table>
                <tr><th>Nomor Meja</th><th>Area</th><th>Kapasitas</th><th>Aksi</th></tr>
    `;
    tables.sort((a,b) => a.nomorMeja.localeCompare(b.nomorMeja, undefined, {numeric: true})).forEach(t => {
        html += `<tr>
            <td>${t.nomorMeja}</td>
            <td>${t.area}</td>
            <td>${t.kapasitas}</td>
            <td>
                <button class="action-btn" onclick="editMeja('${t.nomorMeja}')"><i class="fas fa-edit"></i></button>
                <button class="action-btn" onclick="deleteMeja('${t.nomorMeja}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    });
    html += '</table></div>';
    contentEl.innerHTML = html;

    document.getElementById('tambahMejaBtn').addEventListener('click', () => {
        showMejaModal();
    });
}

// Render Activity Log
function renderActivityLog() {
    const logs = getLogs().reverse(); // Tampilkan yang terbaru dulu
    
    let html = `
        <div style="margin-bottom:15px;">
            <button class="btn btn-secondary" onclick="exportLogs()"><i class="fas fa-download"></i> Ekspor Log</button>
        </div>
        <div class="activity-log" style="max-height:70vh; overflow-y:auto;">
    `;
    
    logs.slice(0, 200).forEach(log => {
        const date = new Date(log.timestamp).toLocaleString('id-ID');
        html += `
            <div style="border-left:3px solid #3498db; padding:10px; margin-bottom:10px; background:#f9f9f9;">
                <small style="color:#7f8c8d;">${date}</small>
                <div><strong>${log.user}</strong> - ${log.action}</div>
                <div style="color:#34495e;">${log.details}</div>
            </div>
        `;
    });
    
    html += '</div>';
    contentEl.innerHTML = html;
}

// Ekspor log
window.exportLogs = function() {
    const logs = getLogs();
    const dataStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

// Fungsi CRUD meja
window.editMeja = function(nomorMeja) {
    const tables = getTables();
    const meja = tables.find(t => t.nomorMeja === nomorMeja);
    if (meja) showMejaModal(meja);
};

window.deleteMeja = function(nomorMeja) {
    const tables = getTables();
    const reservations = getReservations();
    const used = reservations.some(r => r.nomorMeja.includes(nomorMeja) && r.status === 'Aktif');
    
    if (used) {
        alert('Meja sedang digunakan di reservasi aktif, tidak bisa dihapus.');
        return;
    }
    
    const html = `
        <div class="modal-content">
            <h3>Hapus Meja</h3>
            <p>Yakin ingin menghapus meja nomor <strong>${nomorMeja}</strong>?</p>
            <div style="display:flex; gap:10px; margin-top:20px;">
                <button class="btn btn-danger" id="confirmDeleteMeja">Ya, Hapus</button>
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Batal</button>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = html;
    document.body.appendChild(modal);
    
    document.getElementById('confirmDeleteMeja').addEventListener('click', () => {
        let tables = getTables();
        tables = tables.filter(t => t.nomorMeja !== nomorMeja);
        saveTables(tables);
        addLog('HAPUS MEJA', `Meja ${nomorMeja} dihapus`);
        showNotification('Meja dihapus');
        modal.remove();
        loadPage('kelolaMeja');
    });
};

function showMejaModal(meja = null) {
    const isEdit = !!meja;
    const html = `
        <form id="mejaForm">
            <div class="form-group">
                <label>Nomor Meja</label>
                <input type="text" id="nomorMeja" value="${meja ? meja.nomorMeja : ''}" ${isEdit ? 'readonly' : 'required'} placeholder="Contoh: 01, 02, ...">
            </div>
            <div class="form-group">
                <label>Area</label>
                <select id="area">
                    <option value="Smoking" ${meja && meja.area === 'Smoking' ? 'selected' : ''}>Smoking</option>
                    <option value="Non Smoking" ${meja && meja.area === 'Non Smoking' ? 'selected' : ''}>Non Smoking</option>
                    <option value="Tambahan" ${meja && meja.area === 'Tambahan' ? 'selected' : ''}>Tambahan</option>
                </select>
            </div>
            <div class="form-group">
                <label>Kapasitas</label>
                <input type="number" id="kapasitas" value="${meja ? meja.kapasitas : 4}" min="1" required>
            </div>
            <button type="submit" class="btn">Simpan</button>
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Batal</button>
        </form>
    `;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `<div class="modal-content">${html}</div>`;
    document.body.appendChild(modal);

    document.getElementById('mejaForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const nomorMeja = document.getElementById('nomorMeja').value.trim();
        const area = document.getElementById('area').value;
        const kapasitas = parseInt(document.getElementById('kapasitas').value);
        
        if (!nomorMeja) {
            alert('Nomor meja harus diisi');
            return;
        }
        
        let tables = getTables();
        
        if (!isEdit) {
            if (tables.some(t => t.nomorMeja === nomorMeja)) {
                alert('Nomor meja sudah ada');
                return;
            }
            tables.push({ nomorMeja, area, kapasitas });
            addLog('TAMBAH MEJA', `Meja ${nomorMeja} (${area}) ditambahkan`);
        } else {
            const idx = tables.findIndex(t => t.nomorMeja === meja.nomorMeja);
            if (idx !== -1) {
                tables[idx] = { ...tables[idx], area, kapasitas };
                addLog('EDIT MEJA', `Meja ${nomorMeja} diubah menjadi ${area}, kap.${kapasitas}`);
            }
        }
        
        saveTables(tables);
        document.body.removeChild(modal);
        showNotification('Data meja disimpan');
        loadPage('kelolaMeja');
    });
}

// Notifikasi
function showNotification(msg) {
    const notif = document.createElement('div');
    notif.className = 'notification';
    notif.textContent = msg;
    document.body.appendChild(notif);
    setTimeout(() => {
        notif.remove();
    }, 2000);
}

// Panggil inisialisasi
initTables();
