'use strict';

const SEVERITAS_KATEGORI = {
  Network: 3,
  Komputer: 3,
  CCTV: 2,
  Printer: 2,
};

const ATURAN_DEFAULT = 'Rendah';

function tambahHari(tanggal, selisih) {
  const [tahun, bulan, hari] = tanggal.split('-').map(Number);
  const d = new Date(Date.UTC(tahun, bulan - 1, hari + selisih));
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

function deriveFakta(record, today) {
  const status = record.status === true;
  const tanggal = record.tanggal_maintenance || null;
  const details = record.maintenance_detail || [];
  const detailKorektif = details.filter(d => d.jenis_maintenance === 'Korektif');
  const adaKerusakan = detailKorektif.length > 0;

  let kategoriTerparah = null;
  for (const d of detailKorektif) {
    const kategori = d.kategori_perangkat && d.kategori_perangkat.kategori;
    if (!kategori) continue;
    if (
      kategoriTerparah === null ||
      (SEVERITAS_KATEGORI[kategori] || 1) > (SEVERITAS_KATEGORI[kategoriTerparah] || 1)
    ) {
      kategoriTerparah = kategori;
    }
  }

  return {
    status,
    terlambat: !status && tanggal !== null && tanggal < today,
    dueHariIni: !status && tanggal === today,
    dueBesok: !status && tanggal === tambahHari(today, 1),
    adaKerusakan,
    kategoriTerparah,
  };
}

// Basis aturan IF-THEN — dievaluasi berurutan, aturan pertama yang cocok menang (first-match precedence)
const aturanPrioritas = [
  { id: 'R1', kondisi: f => f.terlambat, hasil: 'Mendesak' },
  { id: 'R2', kondisi: f => f.adaKerusakan && f.kategoriTerparah === 'Network', hasil: 'Tinggi' },
  { id: 'R3', kondisi: f => f.adaKerusakan && f.kategoriTerparah === 'Komputer', hasil: 'Tinggi' },
  { id: 'R4', kondisi: f => f.adaKerusakan && f.kategoriTerparah === 'CCTV', hasil: 'Sedang' },
  { id: 'R5', kondisi: f => f.adaKerusakan && f.kategoriTerparah === 'Printer', hasil: 'Sedang' },
  { id: 'R6', kondisi: f => f.dueHariIni, hasil: 'Tinggi' },
  { id: 'R7', kondisi: f => f.dueBesok, hasil: 'Sedang' },
];

function evaluasiPrioritas(record, today) {
  if (record.status === true) return ATURAN_DEFAULT;
  const fakta = deriveFakta(record, today);
  for (const aturan of aturanPrioritas) {
    if (aturan.kondisi(fakta)) return aturan.hasil;
  }
  return ATURAN_DEFAULT;
}

module.exports = {
  evaluasiPrioritas,
  deriveFakta,
  aturanPrioritas,
  tambahHari,
  SEVERITAS_KATEGORI,
  ATURAN_DEFAULT,
};