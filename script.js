import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const db = window.db;

const content = document.getElementById("content");

function today() {
  return new Date().toISOString().split("T")[0];
}

/* =========================
   DASHBOARD
========================= */

async function loadToday() {
  const q = query(collection(db, "reservations"),
    where("tanggal", "==", today()));
  const snap = await getDocs(q);

  document.getElementById("todayInfo").innerHTML =
    "Total Reservasi Hari Ini: " + snap.size;
}
loadToday();

/* =========================
   CREATE RESERVATION
========================= */

window.goCreate = function () {
  content.innerHTML = `
    <h3>Buat Reservasi</h3>
    <input type="date" id="tgl" value="${today()}"/>
    <input placeholder="Nama Tamu" id="nama"/>
    <input type="number" placeholder="Jumlah Tamu" id="jumlah"/>
    <input placeholder="Nomor HP" id="hp"/>
    <select id="area">
      <option>Smoking</option>
      <option>Non Smoking</option>
    </select>
    <button onclick="saveReservation()">Simpan</button>
  `;
};

window.saveReservation = async function () {
  const tanggal = tgl.value;

  await addDoc(collection(db, "reservations"), {
    tanggal,
    nama: nama.value,
    jumlah: parseInt(jumlah.value),
    hp: hp.value,
    area: area.value,
    meja: [],
    statusOrder: false,
    adaDP: false,
    jenisPembayaran: "",
    nominalDP: 0,
    waktuDP: null,
    urutanDP: null
  });

  alert("Reservasi Berhasil Disimpan");
  goList();
};

/* =========================
   LIST RESERVASI
========================= */

window.goList = async function () {
  content.innerHTML = `
    <h3>List Reservasi</h3>
    <input type="date" id="tglList" value="${today()}"/>
    <button onclick="loadList()">Load</button>
    <button onclick="toggleView()">Toggle Card/Table</button>
    <div id="listData"></div>
  `;
};

let cardMode = false;

window.toggleView = function () {
  cardMode = !cardMode;
  loadList();
};

window.loadList = async function () {
  const q = query(collection(db, "reservations"),
    where("tanggal", "==", tglList.value));

  const snap = await getDocs(q);

  let html = "";

  snap.forEach(docu => {
    const r = docu.data();

    if (cardMode) {
      html += `
        <div class="card">
          <b>${r.nama}</b><br>
          Tamu: ${r.jumlah}<br>
          Meja: ${r.meja.join(",")}<br>
          DP: ${r.nominalDP}
        </div>
      `;
    } else {
      html += `
        <div class="card">
          ${r.nama} | ${r.jumlah} org |
          Meja: ${r.meja.join(",")} |
          DP: ${r.nominalDP} |
          Urutan DP: ${r.urutanDP ?? "-"}
        </div>
      `;
    }
  });

  listData.innerHTML = html;
};

/* =========================
   CEK MEJA KOSONG
========================= */

window.goCheck = async function () {
  content.innerHTML = `
    <h3>Cek Meja Kosong</h3>
    <input type="date" id="tglCheck" value="${today()}"/>
    <button onclick="loadEmpty()">Cek</button>
    <div id="emptyData"></div>
  `;
};

window.loadEmpty = async function () {
  const q = query(collection(db, "reservations"),
    where("tanggal", "==", tglCheck.value));

  const snap = await getDocs(q);

  let used = [];

  snap.forEach(docu => {
    used = used.concat(docu.data().meja);
  });

  let html = `<div class="table-grid">`;

  for (let i = 1; i <= 70; i++) {
    if (!used.includes(i.toString())) {
      html += `<div class="table-box">${i}</div>`;
    }
  }

  html += `</div>`;

  emptyData.innerHTML = html;
};

/* =========================
   COMPLETE (Tambah Meja / DP)
========================= */

window.goComplete = async function () {
  content.innerHTML = `
    <h3>Tambah Meja / DP</h3>
    <input type="date" id="tglComp" value="${today()}"/>
    <button onclick="loadIncomplete()">Load</button>
    <div id="compData"></div>
  `;
};

window.loadIncomplete = async function () {
  const q = query(collection(db, "reservations"),
    where("tanggal", "==", tglComp.value));

  const snap = await getDocs(q);

  let html = "";

  snap.forEach(docu => {
    const r = docu.data();
    if (r.meja.length === 0 || !r.adaDP) {
      html += `
        <div class="card">
          ${r.nama}
          <button onclick="addDP('${docu.id}')">Tambah DP</button>
        </div>
      `;
    }
  });

  compData.innerHTML = html;
};

window.addDP = async function (id) {
  const nominal = prompt("Masukkan Nominal DP:");
  if (!nominal) return;

  const waktu = new Date();

  const q = query(collection(db, "reservations"),
    where("tanggal", "==", tglComp.value),
    where("adaDP", "==", true));

  const snap = await getDocs(q);

  let urutan = snap.size + 1;

  await updateDoc(doc(db, "reservations", id), {
    adaDP: true,
    nominalDP: parseInt(nominal),
    waktuDP: waktu,
    urutanDP: urutan
  });

  alert("DP berhasil ditambahkan");
  loadIncomplete();
};
