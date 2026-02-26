// State aplikasi
let currentPage = 'home';
let selectedDate = '';
let selectedReservationId = null; // untuk edit
let selectedMejaForReservasi = null; // untuk quick booking dari cek meja

// Referensi elemen
const contentEl = document.getElementById('content');
const backBtn = document.getElementById('backBtn');
const pageTitle = document.getElementById('pageTitle');

// Inisialisasi data meja
function initTables() {
    let tables = localStorage.getItem('tables');
    if (!tables) {
        // Buat 70 meja default
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

// Panggil inisialisasi
initTables();

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
        pageTitle.textContent = 'Cek Meja Kosong';
    } else if (page === 'kelolaMeja') {
        renderKelolaMeja();
        backBtn.style.display = 'block';
        pageTitle.textContent = 'Kelola Meja';
    }
}

// Render Home dengan dashboard
function renderHome() {
    const today = new Date().toISOString().split('T')[0];
    const reservationsToday = getReservations().filter(r => r.tanggal === today);
    const totalMeja = getTables().length;
    const mejaTerisi = new Set();
    reservationsToday.forEach(r => r.nomorMeja.forEach(m => mejaTerisi.add(m)));
    const mejaKosong = totalMeja - mejaTerisi.size;

    contentEl.innerHTML = `
        <div class="dashboard">
            <div style="display: flex; justify-content: space-around; margin-bottom: 20px;">
                <div style="text-align:center; background:#3498db; color:white; padding:10px; border-radius:5px; width:30%;">
                    <h3>${reservationsToday.length}</h3>
                    <p>Reservasi Hari Ini</p>
                </div>
                <div style="text-align:center; background:#2ecc71; color:white; padding:10px; border-radius:5px; width:30%;">
                    <h3>${mejaTerisi.size}</h3>
                    <p>Meja Terisi</p>
                </div>
                <div style="text-align:center; background:#e67e22; color:white; padding:10px; border-radius:5px; width:30%;">
                    <h3>${mejaKosong}</h3>
                    <p>Meja Kosong</p>
                </div>
            </div>
        </div>
        <div class="home-grid">
            <button class="home-btn btn-a" data-action="buatReservasi"><i class="fas fa-plus-circle"></i> Buat Reservasi Baru</button>
            <button class="home-btn btn-b" data-action="tambahMejaDp"><i class="fas fa-edit"></i> Tambah Meja / DP</button>
            <button class="home-btn btn-c" data-action="listReservasi"><i class="fas fa-list"></i> List Reservasi</button>
            <button class="home-btn btn-d" data-action="cekMeja"><i class="fas fa-chair"></i> Cek Meja Kosong</button>
        </div>
        <div style="margin-top: 20px; text-align: center;">
            <button class="btn-secondary" data-action="kelolaMeja"><i class="fas fa-cog"></i> Kelola Meja</button>
        </div>
    `;
    document.querySelectorAll('.home-btn, .btn-secondary[data-action="kelolaMeja"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.currentTarget.dataset.action;
            if (action === 'kelolaMeja') {
                loadPage('kelolaMeja');
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
            <button class="btn" id="nextBtn">Lanjut</button>
        </div>
    `;
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
    const reservations = getReservations().filter(r => r.tanggal === date);
    const occupiedTableNumbers = new Set();
    reservations.forEach(r => {
        if (r.nomorMeja && r.id !== excludeReservationId) {
            r.nomorMeja.forEach(no => occupiedTableNumbers.add(no));
        }
    });
    return tables.filter(t => !occupiedTableNumbers.has(t.nomorMeja));
}

// Helper: hitung urutan DP
function getNextDpUrutan(tanggal) {
    const reservations = getReservations().filter(r => r.tanggal === tanggal && r.statusAdaDP === 'Ya' && r.waktuInputDP);
    return reservations.length + 1;
}

// Render Buat Reservasi (dengan filter area)
function renderBuatReservasi(date) {
    let html = `
        <form id="reservasiForm">
            <input type="hidden" id="tanggal" value="${date}">
            <div class="form-group">
                <label>Nama Tamu</label>
                <input type="text" id="nama" required>
            </div>
            <div class="form-group">
                <label>Jumlah Tamu</label>
                <input type="number" id="jumlahTamu" required min="1">
            </div>
            <div class="form-group">
                <label>Nomor HP</label>
                <input type="tel" id="noHP" required>
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

    // Fungsi untuk memuat ulang pilihan meja berdasarkan area
    function loadMejaOptions() {
        const area = document.getElementById('area').value;
        const availableTables = getAvailableTables(date).filter(t => t.area === area);
        const select = document.getElementById('meja');
        select.innerHTML = availableTables.map(t => `<option value="${t.nomorMeja}">${t.nomorMeja} (${t.area})</option>`).join('');
    }

    // Initial load
    loadMejaOptions();

    // Jika ada selectedMejaForReservasi dari quick booking
    if (selectedMejaForReservasi) {
        // Set radio ke Ya
        document.querySelector('input[name="adaMeja"][value="Ya"]').checked = true;
        document.getElementById('mejaGroup').style.display = 'block';
        // Set area sesuai meja
        const tables = getTables();
        const mejaData = tables.find(t => t.nomorMeja === selectedMejaForReservasi);
        if (mejaData) {
            document.getElementById('area').value = mejaData.area;
            loadMejaOptions(); // reload options setelah area berubah
            // Pilih meja yang sesuai
            const select = document.getElementById('meja');
            for (let option of select.options) {
                if (option.value === selectedMejaForReservasi) {
                    option.selected = true;
                    break;
                }
            }
        }
        // Reset
        selectedMejaForReservasi = null;
    }

    // Event listener untuk area
    document.getElementById('area').addEventListener('change', loadMejaOptions);

    // Toggle tampilan meja berdasarkan pilihan
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

    // Submit form
    document.getElementById('reservasiForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const tanggal = document.getElementById('tanggal').value;
        const nama = document.getElementById('nama').value;
        const jumlahTamu = parseInt(document.getElementById('jumlahTamu').value);
        const noHP = document.getElementById('noHP').value;
        const area = document.getElementById('area').value;
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
            statusOrder,
            statusAdaDP,
            jenisPembayaran,
            nominalDP,
            waktuInputDP,
            urutanDP,
            statusKelengkapan: (nomorMeja.length > 0 && (statusAdaDP !== 'Ya' || nominalDP > 0)) ? 'Lengkap' : 'Belum Lengkap'
        };

        const reservations = getReservations();
        reservations.push(newReservation);
        saveReservations(reservations);

        showNotification('Reservasi Berhasil Disimpan');
        loadPage('listReservasi', { date: tanggal });
    });
}

// Render Tambah Meja/DP
function renderTambahMejaDp(date) {
    const reservations = getReservations().filter(r => r.tanggal === date && (r.nomorMeja.length === 0 || (r.statusAdaDP === 'Ya' && !r.nominalDP)));
    if (reservations.length === 0) {
        contentEl.innerHTML = '<p>Tidak ada reservasi yang perlu dilengkapi.</p><button class="btn" onclick="loadPage(\'datePicker\',{type:\'tambahMejaDp\'})">Kembali</button>';
        return;
    }

    let html = '<h3>Pilih reservasi untuk dilengkapi:</h3><div class="list-group">';
    reservations.forEach(r => {
        html += `
            <div style="border:1px solid #ddd; padding:10px; margin-bottom:10px; border-radius:5px;">
                <p><strong>${r.nama}</strong> (${r.jumlahTamu} org) - ${r.area}</p>
                <p>Meja: ${r.nomorMeja.length ? r.nomorMeja.join(', ') : 'Belum diisi'} | DP: ${r.statusAdaDP === 'Ya' ? (r.nominalDP ? 'Rp'+r.nominalDP : 'Belum diisi') : 'Tidak'}</p>
                <button class="btn btn-secondary" onclick="editReservasi('${r.id}')">Lengkapi</button>
            </div>
        `;
    });
    html += '</div>';
    contentEl.innerHTML = html;
}

// Fungsi global untuk dipanggil dari onclick
window.editReservasi = function(id) {
    const reservation = getReservations().find(r => r.id === id);
    if (!reservation) return;

    // Tentukan field mana yang belum lengkap
    const needMeja = reservation.nomorMeja.length === 0;
    const needDP = reservation.statusAdaDP === 'Ya' && !reservation.nominalDP;

    let html = `<form id="editForm">
        <input type="hidden" id="editId" value="${id}">
    `;
    if (needMeja) {
        html += `
            <div class="form-group">
                <label>Pilih Meja (bisa lebih dari satu)</label>
                <select id="editMeja" multiple size="5">
                    ${getAvailableTables(reservation.tanggal, id).map(t => `<option value="${t.nomorMeja}">${t.nomorMeja} (${t.area})</option>`).join('')}
                </select>
            </div>
        `;
    }
    if (needDP) {
        html += `
            <div class="form-group">
                <label>Jenis Pembayaran</label>
                <select id="editJenisPembayaran">
                    <option value="Cash">Cash</option>
                    <option value="Transfer">Transfer</option>
                </select>
            </div>
            <div class="form-group">
                <label>Nominal DP</label>
                <input type="number" id="editNominalDP" min="0">
            </div>
        `;
    }
    html += `<button type="submit" class="btn">Simpan</button></form>`;
    
    // Tampilkan modal sederhana
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `<div class="modal-content">${html}</div>`;
    document.body.appendChild(modal);

    document.getElementById('editForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const reservations = getReservations();
        const idx = reservations.findIndex(r => r.id === id);
        if (idx === -1) return;

        if (needMeja) {
            const selectedMeja = Array.from(document.getElementById('editMeja').selectedOptions).map(opt => opt.value);
            if (selectedMeja.length === 0) {
                alert('Pilih meja');
                return;
            }
            reservations[idx].nomorMeja = selectedMeja;
        }
        if (needDP) {
            const jenis = document.getElementById('editJenisPembayaran').value;
            const nominal = parseInt(document.getElementById('editNominalDP').value);
            if (!nominal || nominal <= 0) {
                alert('Isi nominal DP');
                return;
            }
            reservations[idx].jenisPembayaran = jenis;
            reservations[idx].nominalDP = nominal;
            reservations[idx].waktuInputDP = Date.now();
            reservations[idx].urutanDP = getNextDpUrutan(reservations[idx].tanggal);
        }
        // Update status kelengkapan
        reservations[idx].statusKelengkapan = (reservations[idx].nomorMeja.length > 0 && (reservations[idx].statusAdaDP !== 'Ya' || reservations[idx].nominalDP > 0)) ? 'Lengkap' : 'Belum Lengkap';
        saveReservations(reservations);

        document.body.removeChild(modal);
        showNotification('Data diperbarui');
        loadPage('tambahMejaDp', { date: reservations[idx].tanggal });
    });
};

// Render List Reservasi
function renderListReservasi(date) {
    let reservations = getReservations().filter(r => r.tanggal === date);
    const html = `
        <div class="filter-sort">
            <select id="sortBy">
                <option value="urutanDP">Urutan DP</option>
                <option value="nomorMeja">Nomor Meja</option>
                <option value="statusKelengkapan">Status Kelengkapan</option>
            </select>
            <button class="btn-secondary" id="applySort">Urutkan</button>
        </div>
        <div id="listContainer"></div>
    `;
    contentEl.innerHTML = html;

    function renderList(sortedRes) {
        let listHtml = '<div class="table-responsive"><table><tr><th>Nama</th><th>Jumlah</th><th>HP</th><th>Area</th><th>Meja</th><th>Order</th><th>DP</th><th>Nominal</th><th>Urutan DP</th><th>Status</th><th>Aksi</th></tr>';
        sortedRes.forEach(r => {
            listHtml += `<tr>
                <td>${r.nama}</td>
                <td>${r.jumlahTamu}</td>
                <td>${r.noHP}</td>
                <td>${r.area}</td>
                <td>${r.nomorMeja.join(', ') || '-'}</td>
                <td>${r.statusOrder}</td>
                <td>${r.statusAdaDP}</td>
                <td>${r.nominalDP ? 'Rp'+r.nominalDP : '-'}</td>
                <td>${r.urutanDP || '-'}</td>
                <td>${r.statusKelengkapan}</td>
                <td>
                    <button class="action-btn" onclick="editListReservasi('${r.id}')"><i class="fas fa-edit"></i></button>
                    <button class="action-btn" onclick="deleteReservasi('${r.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        });
        listHtml += '</table></div>';
        document.getElementById('listContainer').innerHTML = listHtml;
    }

    renderList(reservations);

    document.getElementById('applySort').addEventListener('click', () => {
        const sortBy = document.getElementById('sortBy').value;
        let sorted = [...reservations];
        if (sortBy === 'urutanDP') {
            sorted.sort((a, b) => (a.urutanDP || Infinity) - (b.urutanDP || Infinity));
        } else if (sortBy === 'nomorMeja') {
            sorted.sort((a, b) => {
                const aMeja = a.nomorMeja.length ? parseInt(a.nomorMeja[0]) : Infinity;
                const bMeja = b.nomorMeja.length ? parseInt(b.nomorMeja[0]) : Infinity;
                return aMeja - bMeja;
            });
        } else if (sortBy === 'statusKelengkapan') {
            sorted.sort((a, b) => (a.statusKelengkapan === 'Lengkap' ? -1 : 1));
        }
        renderList(sorted);
    });
}

// Fungsi edit dari list
window.editListReservasi = function(id) {
    const reservation = getReservations().find(r => r.id === id);
    if (!reservation) return;

    // Form edit sederhana untuk nama, jumlah tamu, meja, nominal DP
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

        reservations[idx].nama = document.getElementById('editNama').value;
        reservations[idx].jumlahTamu = parseInt(document.getElementById('editJumlahTamu').value);
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
            // Jika sebelumnya belum input DP, set waktu dan urutan
            reservations[idx].waktuInputDP = Date.now();
            reservations[idx].urutanDP = getNextDpUrutan(reservations[idx].tanggal);
        }
        reservations[idx].nominalDP = nominalDP || 0;
        reservations[idx].statusKelengkapan = (selectedMeja.length > 0 && (reservations[idx].statusAdaDP !== 'Ya' || nominalDP > 0)) ? 'Lengkap' : 'Belum Lengkap';
        saveReservations(reservations);
        document.body.removeChild(modal);
        showNotification('Data diupdate');
        loadPage('listReservasi', { date: reservations[idx].tanggal });
    });
};

window.deleteReservasi = function(id) {
    if (!confirm('Hapus reservasi ini?')) return;
    const reservations = getReservations();
    const idx = reservations.findIndex(r => r.id === id);
    if (idx !== -1) {
        const tanggal = reservations[idx].tanggal;
        reservations.splice(idx, 1);
        saveReservations(reservations);
        showNotification('Reservasi dihapus');
        loadPage('listReservasi', { date: tanggal });
    }
};

// Render Cek Meja Kosong dengan klik meja
function renderCekMeja(date) {
    const availableTables = getAvailableTables(date);
    const tablesByArea = {
        'Smoking': availableTables.filter(t => t.area === 'Smoking'),
        'Non Smoking': availableTables.filter(t => t.area === 'Non Smoking'),
        'Tambahan': availableTables.filter(t => t.area === 'Tambahan')
    };

    const html = `
        <div class="table-grid">
            <div class="area-section">
                <h3>Smoking (${tablesByArea.Smoking.length})</h3>
                <div class="tables" id="area-smoking">
                    ${tablesByArea.Smoking.map(t => `<div class="table-item" data-meja="${t.nomorMeja}">${t.nomorMeja}</div>`).join('')}
                </div>
            </div>
            <div class="area-section">
                <h3>Non Smoking (${tablesByArea['Non Smoking'].length})</h3>
                <div class="tables" id="area-nonsmoking">
                    ${tablesByArea['Non Smoking'].map(t => `<div class="table-item" data-meja="${t.nomorMeja}">${t.nomorMeja}</div>`).join('')}
                </div>
            </div>
            <div class="area-section">
                <h3>Tambahan (${tablesByArea.Tambahan.length})</h3>
                <div class="tables" id="area-tambahan">
                    ${tablesByArea.Tambahan.map(t => `<div class="table-item" data-meja="${t.nomorMeja}">${t.nomorMeja}</div>`).join('')}
                </div>
            </div>
        </div>
    `;
    contentEl.innerHTML = html;

    // Tambahkan event listener ke setiap kotak meja
    document.querySelectorAll('.table-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const meja = e.currentTarget.dataset.meja;
            if (confirm(`Buat reservasi baru dengan meja ${meja}?`)) {
                selectedMejaForReservasi = meja;
                loadPage('buatReservasi', { date: date });
            }
        });
    });
}

// Render Kelola Meja
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

// Fungsi global untuk edit/hapus meja
window.editMeja = function(nomorMeja) {
    const tables = getTables();
    const meja = tables.find(t => t.nomorMeja === nomorMeja);
    if (meja) showMejaModal(meja);
};

window.deleteMeja = function(nomorMeja) {
    if (!confirm('Hapus meja ini?')) return;
    let tables = getTables();
    // Cek apakah meja sedang digunakan di reservasi yang akan datang?
    const reservations = getReservations();
    const used = reservations.some(r => r.nomorMeja.includes(nomorMeja));
    if (used) {
        alert('Meja sedang digunakan di reservasi, tidak bisa dihapus.');
        return;
    }
    tables = tables.filter(t => t.nomorMeja !== nomorMeja);
    saveTables(tables);
    showNotification('Meja dihapus');
    loadPage('kelolaMeja');
};

function showMejaModal(meja = null) {
    const isEdit = !!meja;
    const html = `
        <form id="mejaForm">
            <div class="form-group">
                <label>Nomor Meja</label>
                <input type="text" id="nomorMeja" value="${meja ? meja.nomorMeja : ''}" ${isEdit ? 'readonly' : 'required'}>
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
            // Cek duplikat
            if (tables.some(t => t.nomorMeja === nomorMeja)) {
                alert('Nomor meja sudah ada');
                return;
            }
            tables.push({ nomorMeja, area, kapasitas });
        } else {
            const idx = tables.findIndex(t => t.nomorMeja === meja.nomorMeja);
            if (idx !== -1) {
                tables[idx] = { ...tables[idx], area, kapasitas };
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
