// State aplikasi
let currentPage = 'home';
let selectedDate = '';
let selectedReservationId = null;
let selectedMejaForReservasi = null;
let currentUser = 'Admin'; // Bisa diganti dengan login sederhana

// Data staf (untuk fitur multi-user sederhana)
const STAFF = ['Admin', 'Kasir', 'Waiter'];
let loggedInStaff = 'Admin';

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
function getActivityLogs() {
    return JSON.parse(localStorage.getItem('activityLogs')) || [];
}

function addActivityLog(action, details, reservationId = null) {
    const logs = getActivityLogs();
    logs.unshift({
        id: generateId(),
        timestamp: Date.now(),
        user: loggedInStaff,
        action: action,
        details: details,
        reservationId: reservationId
    });
    // Simpan maksimal 500 log
    if (logs.length > 500) logs.pop();
    localStorage.setItem('activityLogs', JSON.stringify(logs));
}

// Panggil inisialisasi
initTables();

document.addEventListener('DOMContentLoaded', () => {
    // Cek apakah perlu login
    checkLogin();
});

function checkLogin() {
    // Login sederhana - bisa dikembangkan
    const staff = prompt('Pilih staf yang bertugas:', STAFF.join(', '));
    if (staff && STAFF.includes(staff)) {
        loggedInStaff = staff;
        loadPage('home');
    } else {
        alert('Staf tidak valid');
        checkLogin();
    }
}

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
        pageTitle.textContent = 'Cek Meja Kosong';
    } else if (page === 'kelolaMeja') {
        renderKelolaMeja();
        backBtn.style.display = 'block';
        pageTitle.textContent = 'Kelola Meja';
    } else if (page === 'laporan') {
        renderLaporan();
        backBtn.style.display = 'block';
        pageTitle.textContent = 'Laporan & Statistik';
    } else if (page === 'activityLog') {
        renderActivityLog();
        backBtn.style.display = 'block';
        pageTitle.textContent = 'Riwayat Aktivitas';
    }
}

// Render Home dengan dashboard interaktif
function renderHome() {
    const today = new Date().toISOString().split('T')[0];
    const reservations = getReservations();
    const reservationsToday = reservations.filter(r => r.tanggal === today);
    
    // Data untuk grafik 7 hari terakhir
    const last7Days = [];
    const todayDate = new Date();
    for (let i = 6; i >= 0; i--) {
        const date = new Date(todayDate);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const count = reservations.filter(r => r.tanggal === dateStr).length;
        last7Days.push({ date: dateStr, count });
    }
    
    const totalMeja = getTables().length;
    const mejaTerisi = new Set();
    reservationsToday.forEach(r => r.nomorMeja.forEach(m => mejaTerisi.add(m)));
    const mejaKosong = totalMeja - mejaTerisi.size;
    
    // Cek reservasi belum lengkap untuk notifikasi
    const incompleteToday = reservationsToday.filter(r => 
        r.nomorMeja.length === 0 || (r.statusAdaDP === 'Ya' && !r.nominalDP)
    ).length;

    contentEl.innerHTML = `
        <div class="dashboard">
            <div class="stats-grid">
                <div class="stat-card" style="background: linear-gradient(135deg, #3498db, #2980b9);">
                    <i class="fas fa-calendar-check fa-2x"></i>
                    <div class="stat-value">${reservationsToday.length}</div>
                    <div class="stat-label">Reservasi Hari Ini</div>
                </div>
                <div class="stat-card" style="background: linear-gradient(135deg, #2ecc71, #27ae60);">
                    <i class="fas fa-chair fa-2x"></i>
                    <div class="stat-value">${mejaTerisi.size}</div>
                    <div class="stat-label">Meja Terisi</div>
                </div>
                <div class="stat-card" style="background: linear-gradient(135deg, #e67e22, #d35400);">
                    <i class="fas fa-door-open fa-2x"></i>
                    <div class="stat-value">${mejaKosong}</div>
                    <div class="stat-label">Meja Kosong</div>
                </div>
            </div>
            
            ${incompleteToday > 0 ? `
                <div class="notification-banner" onclick="loadPage('datePicker', {type: 'tambahMejaDp'})">
                    <i class="fas fa-exclamation-circle"></i>
                    Ada ${incompleteToday} reservasi belum lengkap hari ini. Klik untuk lengkapi.
                </div>
            ` : ''}
            
            <div class="chart-container">
                <h3>Trend Reservasi 7 Hari Terakhir <i class="fas fa-chart-line"></i></h3>
                <div class="mini-chart">
                    ${last7Days.map(day => `
                        <div class="chart-bar" style="height: ${Math.max(5, day.count * 10)}px;">
                            <span class="bar-label">${day.count}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="chart-dates">
                    ${last7Days.map(day => {
                        const d = new Date(day.date);
                        return `<span>${d.getDate()}/${d.getMonth()+1}</span>`;
                    }).join('')}
                </div>
            </div>
            
            <div class="quick-actions">
                <h3>Aksi Cepat</h3>
                <div class="action-buttons">
                    <button class="quick-btn" data-action="buatReservasi">
                        <i class="fas fa-plus-circle"></i> Reservasi Baru
                    </button>
                    <button class="quick-btn" data-action="cekMeja">
                        <i class="fas fa-search"></i> Cek Meja
                    </button>
                    <button class="quick-btn" data-action="laporan">
                        <i class="fas fa-chart-bar"></i> Laporan
                    </button>
                </div>
            </div>
        </div>
        
        <div class="home-grid">
            <button class="home-btn btn-a" data-action="buatReservasi">
                <i class="fas fa-plus-circle"></i> Buat Reservasi Baru
            </button>
            <button class="home-btn btn-b" data-action="tambahMejaDp">
                <i class="fas fa-edit"></i> Tambah Meja / DP
            </button>
            <button class="home-btn btn-c" data-action="listReservasi">
                <i class="fas fa-list"></i> List Reservasi
            </button>
            <button class="home-btn btn-d" data-action="cekMeja">
                <i class="fas fa-chair"></i> Cek Meja Kosong
            </button>
        </div>
        
        <div class="admin-panel">
            <button class="btn-secondary" data-action="kelolaMeja">
                <i class="fas fa-cog"></i> Kelola Meja
            </button>
            <button class="btn-secondary" data-action="activityLog">
                <i class="fas fa-history"></i> Riwayat Aktivitas
            </button>
            <button class="btn-secondary" data-action="laporan">
                <i class="fas fa-file-alt"></i> Laporan
            </button>
        </div>
        
        <div class="user-info">
            <i class="fas fa-user"></i> ${loggedInStaff} | 
            <span class="date-display">${formatDateIndonesia(new Date())}</span>
        </div>
    `;
    
    // Event listeners
    document.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.currentTarget.dataset.action;
            if (action === 'kelolaMeja' || action === 'activityLog' || action === 'laporan') {
                loadPage(action);
            } else {
                loadPage('datePicker', { type: action });
            }
        });
    });
}

// Format tanggal Indonesia
function formatDateIndonesia(date) {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// Render Laporan
function renderLaporan() {
    const reservations = getReservations();
    const today = new Date().toISOString().split('T')[0];
    
    // Hitung statistik
    const totalReservasi = reservations.length;
    const totalDP = reservations.reduce((sum, r) => sum + (r.nominalDP || 0), 0);
    const reservasiHariIni = reservations.filter(r => r.tanggal === today).length;
    
    // Okupansi rata-rata 7 hari
    const last7Days = [];
    const todayDate = new Date();
    for (let i = 6; i >= 0; i--) {
        const date = new Date(todayDate);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayReservations = reservations.filter(r => r.tanggal === dateStr);
        const mejaTerisi = new Set();
        dayReservations.forEach(r => r.nomorMeja.forEach(m => mejaTerisi.add(m)));
        last7Days.push({
            date: dateStr,
            count: dayReservations.length,
            mejaTerisi: mejaTerisi.size
        });
    }
    
    // Reservasi per area
    const areaStats = {
        'Smoking': reservations.filter(r => r.area === 'Smoking').length,
        'Non Smoking': reservations.filter(r => r.area === 'Non Smoking').length,
        'Tambahan': reservations.filter(r => r.area === 'Tambahan').length
    };
    
    // Status pembayaran
    const dpStats = {
        'Dengan DP': reservations.filter(r => r.statusAdaDP === 'Ya' && r.nominalDP > 0).length,
        'Tanpa DP': reservations.filter(r => r.statusAdaDP === 'Tidak').length
    };
    
    const html = `
        <div class="report-container">
            <div class="report-header">
                <button class="btn-secondary" onclick="exportToCSV()">
                    <i class="fas fa-download"></i> Ekspor CSV
                </button>
                <button class="btn-secondary" onclick="backupData()">
                    <i class="fas fa-database"></i> Backup Data
                </button>
                <button class="btn-secondary" onclick="restoreData()">
                    <i class="fas fa-upload"></i> Restore Data
                </button>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card small">
                    <div class="stat-value">${totalReservasi}</div>
                    <div class="stat-label">Total Reservasi</div>
                </div>
                <div class="stat-card small">
                    <div class="stat-value">Rp ${totalDP.toLocaleString()}</div>
                    <div class="stat-label">Total DP</div>
                </div>
                <div class="stat-card small">
                    <div class="stat-value">${reservasiHariIni}</div>
                    <div class="stat-label">Hari Ini</div>
                </div>
            </div>
            
            <div class="chart-section">
                <h3>Okupansi 7 Hari Terakhir</h3>
                <table class="report-table">
                    <tr>
                        <th>Tanggal</th>
                        <th>Reservasi</th>
                        <th>Meja Terisi</th>
                        <th>Okupansi</th>
                    </tr>
                    ${last7Days.map(day => {
                        const okupansi = ((day.mejaTerisi / 70) * 100).toFixed(1);
                        return `
                            <tr>
                                <td>${day.date}</td>
                                <td>${day.count}</td>
                                <td>${day.mejaTerisi}</td>
                                <td>${okupansi}%</td>
                            </tr>
                        `;
                    }).join('')}
                </table>
            </div>
            
            <div class="stats-row">
                <div class="stat-box">
                    <h4>Reservasi per Area</h4>
                    <ul>
                        <li>Smoking: ${areaStats.Smoking}</li>
                        <li>Non Smoking: ${areaStats['Non Smoking']}</li>
                        <li>Tambahan: ${areaStats.Tambahan}</li>
                    </ul>
                </div>
                <div class="stat-box">
                    <h4>Status DP</h4>
                    <ul>
                        <li>Dengan DP: ${dpStats['Dengan DP']}</li>
                        <li>Tanpa DP: ${dpStats['Tanpa DP']}</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    contentEl.innerHTML = html;
}

// Ekspor ke CSV
window.exportToCSV = function() {
    const reservations = getReservations();
    const tables = getTables();
    
    let csv = "Tanggal,Nama,Jumlah Tamu,No HP,Area,Meja,Status Order,Ada DP,Nominal DP,Urutan DP,Status Kelengkapan\n";
    
    reservations.forEach(r => {
        csv += `${r.tanggal},${r.nama},${r.jumlahTamu},${r.noHP},${r.area},"${r.nomorMeja.join(';')}",${r.statusOrder},${r.statusAdaDP},${r.nominalDP || 0},${r.urutanDP || ''},${r.statusKelengkapan}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reservasi_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    addActivityLog('Ekspor Data', 'Mengekspor data reservasi ke CSV');
    showNotification('Data diekspor');
};

// Backup data
window.backupData = function() {
    const data = {
        reservations: getReservations(),
        tables: getTables(),
        activityLogs: getActivityLogs(),
        backupDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_resto_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    addActivityLog('Backup Data', 'Melakukan backup seluruh data');
    showNotification('Backup berhasil');
};

// Restore data
window.restoreData = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.reservations && data.tables) {
                    if (confirm('Yakin akan merestore data? Data yang ada sekarang akan tergantikan.')) {
                        localStorage.setItem('reservations', JSON.stringify(data.reservations));
                        localStorage.setItem('tables', JSON.stringify(data.tables));
                        if (data.activityLogs) localStorage.setItem('activityLogs', JSON.stringify(data.activityLogs));
                        
                        addActivityLog('Restore Data', 'Merestore data dari file backup');
                        showNotification('Data direstore');
                        loadPage('home');
                    }
                } else {
                    alert('File backup tidak valid');
                }
            } catch (err) {
                alert('Error membaca file');
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

// Render Riwayat Aktivitas
function renderActivityLog() {
    const logs = getActivityLogs();
    
    const html = `
        <div class="log-container">
            <button class="btn-secondary" onclick="clearLogs()">
                <i class="fas fa-trash"></i> Hapus Semua Log
            </button>
            
            <div class="log-filters">
                <input type="text" id="logSearch" placeholder="Cari aktivitas..." onkeyup="filterLogs()">
                <select id="logUser" onchange="filterLogs()">
                    <option value="">Semua Staff</option>
                    ${STAFF.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
            </div>
            
            <div id="logList" class="log-list">
                ${renderLogsList(logs)}
            </div>
        </div>
    `;
    contentEl.innerHTML = html;
}

function renderLogsList(logs) {
    if (logs.length === 0) return '<p class="no-data">Belum ada aktivitas</p>';
    
    return logs.map(log => `
        <div class="log-entry" data-user="${log.user}" data-search="${log.action} ${log.details}">
            <div class="log-time">${new Date(log.timestamp).toLocaleString('id-ID')}</div>
            <div class="log-user">${log.user}</div>
            <div class="log-action">${log.action}</div>
            <div class="log-details">${log.details}</div>
        </div>
    `).join('');
}

window.filterLogs = function() {
    const search = document.getElementById('logSearch').value.toLowerCase();
    const user = document.getElementById('logUser').value;
    
    document.querySelectorAll('.log-entry').forEach(entry => {
        const matchesSearch = search === '' || entry.dataset.search.toLowerCase().includes(search);
        const matchesUser = user === '' || entry.dataset.user === user;
        entry.style.display = matchesSearch && matchesUser ? 'block' : 'none';
    });
};

window.clearLogs = function() {
    if (confirm('Hapus semua riwayat aktivitas?')) {
        localStorage.setItem('activityLogs', '[]');
        addActivityLog('Hapus Log', 'Menghapus semua riwayat aktivitas');
        renderActivityLog();
    }
};

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
    const reservations = getReservations().filter(r => r.tanggal === date);
    const occupiedTableNumbers = new Set();
    reservations.forEach(r => {
        if (r.nomorMeja && r.id !== excludeReservationId) {
            r.nomorMeja.forEach(no => occupiedTableNumbers.add(no));
        }
    });
    return tables.filter(t => !occupiedTableNumbers.has(t.nomorMeja));
}

// Helper: dapatkan semua meja dengan status
function getAllTablesWithStatus(date) {
    const tables = getTables();
    const reservations = getReservations().filter(r => r.tanggal === date);
    const occupiedMap = new Map();
    
    reservations.forEach(r => {
        r.nomorMeja.forEach(no => {
            occupiedMap.set(no, {
                nama: r.nama,
                id: r.id,
                statusDP: r.statusAdaDP === 'Ya' ? 'DP' : 'No DP'
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

// Render Buat Reservasi
function renderBuatReservasi(date) {
    let html = `
        <form id="reservasiForm">
            <input type="hidden" id="tanggal" value="${date}">
            <div class="form-group">
                <label>Nama Tamu</label>
                <input type="text" id="nama" required placeholder="Contoh: Budi Santoso" autocapitalize="words">
            </div>
            <div class="form-group">
                <label>Jumlah Tamu</label>
                <input type="number" id="jumlahTamu" required min="1" value="2">
            </div>
            <div class="form-group">
                <label>Nomor HP</label>
                <input type="tel" id="noHP" required pattern="[0-9]{10,13}" placeholder="081234567890">
                <small>Minimal 10 digit</small>
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
                <label for="catatan">Catatan Khusus</label>
                <textarea id="catatan" placeholder="Contoh: Meja dekat jendela, request kursi bayi, dll"></textarea>
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
                <input type="number" id="nominalDP" min="0" placeholder="Masukkan nominal">
            </div>
            <button type="submit" class="btn">Simpan Reservasi</button>
        </form>
    `;
    contentEl.innerHTML = html;

    // Fungsi untuk memuat ulang pilihan meja berdasarkan area
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

    // Validasi No HP
    document.getElementById('noHP').addEventListener('input', function(e) {
        this.value = this.value.replace(/[^0-9]/g, '');
    });

    document.getElementById('reservasiForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Validasi No HP
        const noHP = document.getElementById('noHP').value;
        if (noHP.length < 10 || noHP.length > 13) {
            alert('Nomor HP harus 10-13 digit');
            return;
        }
        
        const tanggal = document.getElementById('tanggal').value;
        const nama = document.getElementById('nama').value;
        const jumlahTamu = parseInt(document.getElementById('jumlahTamu').value);
        const area = document.getElementById('area').value;
        const catatan = document.getElementById('catatan').value;
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
            catatan: catatan || '',
            statusOrder,
            statusAdaDP,
            jenisPembayaran,
            nominalDP,
            waktuInputDP,
            urutanDP,
            statusKelengkapan: (nomorMeja.length > 0 && (statusAdaDP !== 'Ya' || nominalDP > 0)) ? 'Lengkap' : 'Belum Lengkap',
            statusKehadiran: 'Direncanakan' // Direncanakan, Hadir, Tidak Hadir, Batal
        };

        const reservations = getReservations();
        reservations.push(newReservation);
        saveReservations(reservations);
        
        addActivityLog('Tambah Reservasi', `Reservasi untuk ${nama} (${noHP})`, newReservation.id);

        showNotification('Reservasi Berhasil Disimpan');
        loadPage('listReservasi', { date: tanggal });
    });
}

// Render Tambah Meja/DP
function renderTambahMejaDp(date) {
    const reservations = getReservations().filter(r => r.tanggal === date && (r.nomorMeja.length === 0 || (r.statusAdaDP === 'Ya' && !r.nominalDP)));
    if (reservations.length === 0) {
        contentEl.innerHTML = '<p class="no-data">Tidak ada reservasi yang perlu dilengkapi.</p><button class="btn" onclick="loadPage(\'datePicker\',{type:\'tambahMejaDp\'})">Kembali</button>';
        return;
    }

    let html = '<h3>Pilih reservasi untuk dilengkapi:</h3><div class="list-group">';
    reservations.forEach(r => {
        const statusIcon = r.nomorMeja.length === 0 ? '🪑' : '💰';
        html += `
            <div class="reservasi-card incomplete" onclick="editReservasi('${r.id}')">
                <div class="card-header">
                    <strong>${r.nama}</strong> <span class="status-badge">${statusIcon} Perlu Dilengkapi</span>
                </div>
                <div class="card-body">
                    <p>👥 ${r.jumlahTamu} org | 📞 ${r.noHP} | 📍 ${r.area}</p>
                    <p>Meja: ${r.nomorMeja.length ? r.nomorMeja.join(', ') : '<span class="warning">Belum diisi</span>'} | DP: ${r.statusAdaDP === 'Ya' ? (r.nominalDP ? 'Rp'+r.nominalDP : '<span class="warning">Belum diisi</span>') : 'Tidak'}</p>
                </div>
            </div>
        `;
    });
    html += '</div>';
    contentEl.innerHTML = html;
}

// Render List Reservasi dengan fitur lengkap
function renderListReservasi(date) {
    let reservations = getReservations().filter(r => r.tanggal === date);
    const formattedDate = formatDateIndonesia(new Date(date + 'T00:00:00'));
    
    const html = `
        <div class="list-header">
            <h3>${formattedDate}</h3>
            <div class="date-nav">
                <button class="nav-btn" onclick="changeDate('prev')"><i class="fas fa-chevron-left"></i></button>
                <span class="current-date">${date}</span>
                <button class="nav-btn" onclick="changeDate('next')"><i class="fas fa-chevron-right"></i></button>
                <button class="nav-btn" onclick="loadPage('datePicker', {type: 'listReservasi'})"><i class="fas fa-calendar"></i></button>
            </div>
        </div>
        
        <div class="filter-section">
            <div class="search-box">
                <i class="fas fa-search"></i>
                <input type="text" id="searchReservasi" placeholder="Cari nama atau no HP..." onkeyup="filterReservasiList()">
            </div>
            
            <div class="filter-buttons">
                <button class="filter-btn active" data-filter="all" onclick="filterByStatus('all')">Semua</button>
                <button class="filter-btn" data-filter="Lengkap" onclick="filterByStatus('Lengkap')">Lengkap</button>
                <button class="filter-btn" data-filter="Belum Lengkap" onclick="filterByStatus('Belum Lengkap')">Belum Lengkap</button>
                <button class="filter-btn" data-filter="Dengan DP" onclick="filterByStatus('Dengan DP')">Dengan DP</button>
            </div>
            
            <div class="sort-options">
                <select id="sortReservasi" onchange="sortReservasiList()">
                    <option value="urutanDP">Urut: Urutan DP</option>
                    <option value="nomorMeja">Urut: Nomor Meja</option>
                    <option value="statusKelengkapan">Urut: Status Kelengkapan</option>
                    <option value="nama">Urut: Nama A-Z</option>
                    <option value="waktuInput">Urut: Waktu Input</option>
                </select>
            </div>
        </div>
        
        <div class="status-summary">
            <span class="summary-item">Total: <strong>${reservations.length}</strong></span>
            <span class="summary-item">Lengkap: <strong>${reservations.filter(r => r.statusKelengkapan === 'Lengkap').length}</strong></span>
            <span class="summary-item">Belum Lengkap: <strong>${reservations.filter(r => r.statusKelengkapan === 'Belum Lengkap').length}</strong></span>
            <span class="summary-item">Total DP: <strong>Rp ${reservations.reduce((sum, r) => sum + (r.nominalDP || 0), 0).toLocaleString()}</strong></span>
        </div>
        
        <div id="listContainer" class="reservasi-list"></div>
    `;
    contentEl.innerHTML = html;
    
    renderReservasiList(reservations);
}

let currentFilter = 'all';
let currentSearch = '';

function renderReservasiList(reservations) {
    let filtered = reservations;
    
    // Apply filter
    if (currentFilter === 'Lengkap') {
        filtered = filtered.filter(r => r.statusKelengkapan === 'Lengkap');
    } else if (currentFilter === 'Belum Lengkap') {
        filtered = filtered.filter(r => r.statusKelengkapan === 'Belum Lengkap');
    } else if (currentFilter === 'Dengan DP') {
        filtered = filtered.filter(r => r.statusAdaDP === 'Ya' && r.nominalDP > 0);
    }
    
    // Apply search
    if (currentSearch) {
        const searchLower = currentSearch.toLowerCase();
        filtered = filtered.filter(r => 
            r.nama.toLowerCase().includes(searchLower) || 
            r.noHP.includes(searchLower)
        );
    }
    
    if (filtered.length === 0) {
        document.getElementById('listContainer').innerHTML = '<p class="no-data">Tidak ada reservasi</p>';
        return;
    }
    
    let listHtml = '';
    filtered.forEach(r => {
        const statusClass = r.statusKelengkapan === 'Lengkap' ? 'status-lengkap' : 'status-belum';
        const kehadiranIcon = {
            'Hadir': '✅',
            'Tidak Hadir': '❌',
            'Batal': '🚫',
            'Direncanakan': '⏳'
        }[r.statusKehadiran || 'Direncanakan'];
        
        listHtml += `
            <div class="reservasi-card ${statusClass}" data-id="${r.id}">
                <div class="card-header">
                    <div class="card-title">
                        <strong>${r.nama}</strong> (${r.jumlahTamu} org)
                        <span class="kehadiran-badge">${kehadiranIcon} ${r.statusKehadiran || 'Direncanakan'}</span>
                    </div>
                    <div class="card-actions">
                        <button class="icon-btn" onclick="editListReservasi('${r.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="icon-btn" onclick="deleteReservasi('${r.id}')" title="Hapus"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="card-body">
                    <p>📞 ${r.noHP} | 📍 ${r.area}</p>
                    <p>🪑 Meja: ${r.nomorMeja.join(', ') || '-'} | ${r.statusOrder === 'Ya' ? '📋 Ada Order' : '📋 No Order'}</p>
                    <p>💰 DP: ${r.statusAdaDP === 'Ya' ? `Rp ${r.nominalDP?.toLocaleString()} (${r.jenisPembayaran})` : 'Tidak'} ${r.urutanDP ? ` | Urutan: ${r.urutanDP}` : ''}</p>
                    ${r.catatan ? `<p class="catatan">📝 Catatan: ${r.catatan}</p>` : ''}
                    <p class="status-info">
                        <span class="badge ${r.statusKelengkapan === 'Lengkap' ? 'badge-success' : 'badge-warning'}">${r.statusKelengkapan}</span>
                        <select class="kehadiran-select" onchange="updateKehadiran('${r.id}', this.value)">
                            <option value="Direncanakan" ${r.statusKehadiran === 'Direncanakan' ? 'selected' : ''}>⏳ Direncanakan</option>
                            <option value="Hadir" ${r.statusKehadiran === 'Hadir' ? 'selected' : ''}>✅ Hadir</option>
                            <option value="Tidak Hadir" ${r.statusKehadiran === 'Tidak Hadir' ? 'selected' : ''}>❌ Tidak Hadir</option>
                            <option value="Batal" ${r.statusKehadiran === 'Batal' ? 'selected' : ''}>🚫 Batal</option>
                        </select>
                    </p>
                </div>
            </div>
        `;
    });
    
    document.getElementById('listContainer').innerHTML = listHtml;
}

window.filterReservasiList = function() {
    currentSearch = document.getElementById('searchReservasi').value;
    const date = selectedDate;
    const reservations = getReservations().filter(r => r.tanggal === date);
    renderReservasiList(reservations);
};

window.filterByStatus = function(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filter) btn.classList.add('active');
    });
    filterReservasiList();
};

window.sortReservasiList = function() {
    const sortBy = document.getElementById('sortReservasi').value;
    const date = selectedDate;
    let reservations = getReservations().filter(r => r.tanggal === date);
    
    if (sortBy === 'urutanDP') {
        reservations.sort((a, b) => (a.urutanDP || Infinity) - (b.urutanDP || Infinity));
    } else if (sortBy === 'nomorMeja') {
        reservations.sort((a, b) => {
            const aMeja = a.nomorMeja.length ? parseInt(a.nomorMeja[0]) : Infinity;
            const bMeja = b.nomorMeja.length ? parseInt(b.nomorMeja[0]) : Infinity;
            return aMeja - bMeja;
        });
    } else if (sortBy === 'statusKelengkapan') {
        reservations.sort((a, b) => (a.statusKelengkapan === 'Lengkap' ? -1 : 1));
    } else if (sortBy === 'nama') {
        reservations.sort((a, b) => a.nama.localeCompare(b.nama));
    } else if (sortBy === 'waktuInput') {
        reservations.sort((a, b) => (b.waktuInputDP || 0) - (a.waktuInputDP || 0));
    }
    
    renderReservasiList(reservations);
};

window.changeDate = function(direction) {
    const current = new Date(selectedDate + 'T00:00:00');
    if (direction === 'prev') {
        current.setDate(current.getDate() - 1);
    } else {
        current.setDate(current.getDate() + 1);
    }
    const newDate = current.toISOString().split('T')[0];
    selectedDate = newDate;
    loadPage('listReservasi', { date: newDate });
};

window.updateKehadiran = function(id, status) {
    const reservations = getReservations();
    const idx = reservations.findIndex(r => r.id === id);
    if (idx !== -1) {
        reservations[idx].statusKehadiran = status;
        saveReservations(reservations);
        addActivityLog('Update Kehadiran', `Reservasi ${reservations[idx].nama} menjadi ${status}`, id);
        showNotification(`Status kehadiran diupdate menjadi ${status}`);
        
        // Refresh tampilan jika masih di halaman list
        if (currentPage === 'listReservasi') {
            renderReservasiList(reservations.filter(r => r.tanggal === selectedDate));
        }
    }
};

// Render Cek Meja Kosong dengan informasi lengkap
function renderCekMeja(date) {
    const tablesWithStatus = getAllTablesWithStatus(date);
    const areas = ['Smoking', 'Non Smoking', 'Tambahan'];
    
    const html = `
        <div class="meja-container">
            <h3>Status Meja - ${formatDateIndonesia(new Date(date + 'T00:00:00'))}</h3>
            
            <div class="legend">
                <span class="legend-item available"><i class="fas fa-square"></i> Tersedia</span>
                <span class="legend-item occupied"><i class="fas fa-square"></i> Terisi</span>
            </div>
            
            ${areas.map(area => {
                const areaTables = tablesWithStatus.filter(t => t.area === area);
                return `
                    <div class="area-section">
                        <h4>${area} (${areaTables.length} meja)</h4>
                        <div class="meja-grid">
                            ${areaTables.map(t => `
                                <div class="meja-card ${t.isOccupied ? 'occupied' : 'available'}" 
                                     onclick="${t.isOccupied ? `showMejaDetail('${t.nomorMeja}', '${t.occupant?.nama}', '${t.occupant?.id}')` : `quickReservasi('${date}', '${t.nomorMeja}')`}">
                                    <div class="meja-number">${t.nomorMeja}</div>
                                    ${t.isOccupied ? `
                                        <div class="meja-occupant" title="${t.occupant?.nama}">
                                            <i class="fas fa-user"></i> ${t.occupant?.nama.substring(0, 10)}...
                                        </div>
                                        <div class="meja-dp">${t.occupant?.statusDP}</div>
                                    ` : '<div class="meja-available">Tersedia</div>'}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    contentEl.innerHTML = html;
}

window.quickReservasi = function(date, meja) {
    if (confirm(`Buat reservasi baru dengan meja ${meja}?`)) {
        selectedMejaForReservasi = meja;
        loadPage('buatReservasi', { date: date });
    }
};

window.showMejaDetail = function(nomorMeja, nama, id) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Detail Meja ${nomorMeja}</h3>
            <p><strong>Dipesan oleh:</strong> ${nama}</p>
            <div class="modal-actions">
                <button class="btn" onclick="loadPage('listReservasi', {date: '${selectedDate}'}); document.querySelector('.modal').remove(); window.scrollToReservasi('${id}')">
                    Lihat Detail Reservasi
                </button>
                <button class="btn-secondary" onclick="document.querySelector('.modal').remove()">Tutup</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.scrollToReservasi = function(id) {
    setTimeout(() => {
        const element = document.querySelector(`[data-id="${id}"]`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            element.style.backgroundColor = '#fff3cd';
            setTimeout(() => element.style.backgroundColor = '', 2000);
        }
    }, 500);
};

// Fungsi edit dari list
window.editListReservasi = function(id) {
    const reservation = getReservations().find(r => r.id === id);
    if (!reservation) return;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Edit Reservasi</h3>
            <form id="editFullForm">
                <input type="hidden" id="editId" value="${id}">
                <div class="form-group">
                    <label>Nama Tamu</label>
                    <input type="text" id="editNama" value="${reservation.nama}" required>
                </div>
                <div class="form-group">
                    <label>Jumlah Tamu</label>
                    <input type="number" id="editJumlahTamu" value="${reservation.jumlahTamu}" required min="1">
                </div>
                <div class="form-group">
                    <label>Catatan</label>
                    <textarea id="editCatatan">${reservation.catatan || ''}</textarea>
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
                    <input type="number" id="editNominalDP" value="${reservation.nominalDP || ''}" min="0">
                </div>
                <button type="submit" class="btn">Simpan Perubahan</button>
                <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Batal</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('editFullForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const reservations = getReservations();
        const idx = reservations.findIndex(r => r.id === id);
        if (idx === -1) return;

        const oldData = { ...reservations[idx] };
        
        reservations[idx].nama = document.getElementById('editNama').value;
        reservations[idx].jumlahTamu = parseInt(document.getElementById('editJumlahTamu').value);
        reservations[idx].catatan = document.getElementById('editCatatan').value;
        
        const selectedMeja = Array.from(document.getElementById('editMeja').selectedOptions).map(opt => opt.value);
        
        // Cek double booking
        const otherReservations = reservations.filter(r => r.tanggal === reservations[idx].tanggal && r.id !== id);
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
        
        addActivityLog('Edit Reservasi', `Mengedit reservasi ${reservations[idx].nama}`, id);
        
        document.querySelector('.modal').remove();
        showNotification('Data diupdate');
        
        if (currentPage === 'listReservasi') {
            renderReservasiList(reservations.filter(r => r.tanggal === selectedDate));
        }
    });
};

window.deleteReservasi = function(id) {
    const reservation = getReservations().find(r => r.id === id);
    if (!reservation) return;
    
    // Modal konfirmasi kustom
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content confirm-modal">
            <i class="fas fa-exclamation-triangle" style="color: #e74c3c; font-size: 48px; margin-bottom: 20px;"></i>
            <h3>Hapus Reservasi?</h3>
            <p>Yakin ingin menghapus reservasi <strong>${reservation.nama}</strong>?</p>
            <p class="warning-text">Tindakan ini tidak dapat dibatalkan.</p>
            <div class="modal-actions">
                <button class="btn-danger" onclick="confirmDelete('${id}')">Ya, Hapus</button>
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Batal</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.confirmDelete = function(id) {
    const reservations = getReservations();
    const idx = reservations.findIndex(r => r.id === id);
    if (idx !== -1) {
        const nama = reservations[idx].nama;
        const tanggal = reservations[idx].tanggal;
        
        addActivityLog('Hapus Reservasi', `Menghapus reservasi ${nama}`, id);
        
        reservations.splice(idx, 1);
        saveReservations(reservations);
        
        document.querySelector('.modal').remove();
        showNotification('Reservasi dihapus');
        
        if (currentPage === 'listReservasi') {
            loadPage('listReservasi', { date: tanggal });
        } else {
            loadPage('home');
        }
    }
};

// Render Kelola Meja
function renderKelolaMeja() {
    const tables = getTables();
    let html = `
        <button class="btn" id="tambahMejaBtn"><i class="fas fa-plus"></i> Tambah Meja</button>
        <div class="table-responsive">
            <table>
                <tr>
                    <th>Nomor Meja</th>
                    <th>Area</th>
                    <th>Kapasitas</th>
                    <th>Aksi</th>
                </tr>
    `;
    tables.sort((a,b) => a.nomorMeja.localeCompare(b.nomorMeja, undefined, {numeric: true})).forEach(t => {
        html += `<tr>
            <td>${t.nomorMeja}</td>
            <td><span class="area-badge area-${t.area.toLowerCase().replace(' ', '')}">${t.area}</span></td>
            <td>${t.kapasitas} orang</td>
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

// Fungsi global untuk edit/hapus meja
window.editMeja = function(nomorMeja) {
    const tables = getTables();
    const meja = tables.find(t => t.nomorMeja === nomorMeja);
    if (meja) showMejaModal(meja);
};

window.deleteMeja = function(nomorMeja) {
    const tables = getTables();
    const meja = tables.find(t => t.nomorMeja === nomorMeja);
    
    // Cek apakah meja sedang digunakan
    const reservations = getReservations();
    const used = reservations.some(r => r.nomorMeja.includes(nomorMeja));
    
    if (used) {
        showNotification('Meja sedang digunakan di reservasi', 'error');
        return;
    }
    
    // Modal konfirmasi
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content confirm-modal">
            <i class="fas fa-exclamation-triangle" style="color: #e74c3c; font-size: 48px; margin-bottom: 20px;"></i>
            <h3>Hapus Meja ${nomorMeja}?</h3>
            <p>Yakin ingin menghapus meja ini?</p>
            <div class="modal-actions">
                <button class="btn-danger" onclick="confirmDeleteMeja('${nomorMeja}')">Ya, Hapus</button>
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Batal</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.confirmDeleteMeja = function(nomorMeja) {
    let tables = getTables();
    tables = tables.filter(t => t.nomorMeja !== nomorMeja);
    saveTables(tables);
    
    addActivityLog('Hapus Meja', `Menghapus meja ${nomorMeja}`);
    
    document.querySelector('.modal').remove();
    showNotification('Meja dihapus');
    loadPage('kelolaMeja');
};

function showMejaModal(meja = null) {
    const isEdit = !!meja;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>${isEdit ? 'Edit Meja' : 'Tambah Meja Baru'}</h3>
            <form id="mejaForm">
                <div class="form-group">
                    <label>Nomor Meja</label>
                    <input type="text" id="nomorMeja" value="${meja ? meja.nomorMeja : ''}" ${isEdit ? 'readonly' : 'required'} placeholder="Contoh: 01">
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
                <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Batal</button>
            </form>
        </div>
    `;
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
            addActivityLog('Tambah Meja', `Menambah meja ${nomorMeja} (${area})`);
        } else {
            const idx = tables.findIndex(t => t.nomorMeja === meja.nomorMeja);
            if (idx !== -1) {
                const oldArea = tables[idx].area;
                tables[idx] = { ...tables[idx], area, kapasitas };
                addActivityLog('Edit Meja', `Mengedit meja ${nomorMeja} dari ${oldArea} ke ${area}`);
            }
        }
        
        saveTables(tables);
        document.querySelector('.modal').remove();
        showNotification('Data meja disimpan');
        loadPage('kelolaMeja');
    });
}

// Notifikasi dengan tipe
function showNotification(msg, type = 'success') {
    const notif = document.createElement('div');
    notif.className = `notification notification-${type}`;
    notif.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        ${msg}
    `;
    document.body.appendChild(notif);
    setTimeout(() => {
        notif.classList.add('fade-out');
        setTimeout(() => notif.remove(), 300);
    }, 3000);
                                }
