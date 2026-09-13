const { evaluasiPrioritas, deriveFakta, tambahHari, aturanPrioritas, ATURAN_DEFAULT } = require('./prioritas');

const TODAY = '2026-07-04';

function buatRecord(overrides = {}) {
  return {
    status: false,
    tanggal_maintenance: '2026-07-10',
    maintenance_detail: [],
    ...overrides,
  };
}

function detail(kategori, jenis = 'Rutin', nama = 'Unit') {
  return { jenis_maintenance: jenis, kategori_perangkat: { kategori, nama_perangkat: nama } };
}

describe('tambahHari', () => {
  test('menambah hari normal', () => {
    expect(tambahHari('2026-07-04', 1)).toBe('2026-07-05');
  });

  test('melintasi akhir bulan', () => {
    expect(tambahHari('2026-07-31', 1)).toBe('2026-08-01');
  });
});

describe('deriveFakta', () => {
  test('mendeteksi keterlambatan', () => {
    const f = deriveFakta(buatRecord({ tanggal_maintenance: '2026-07-02' }), TODAY);
    expect(f.terlambat).toBe(true);
  });

  test('adaKerusakan true hanya untuk detail Korektif', () => {
    expect(deriveFakta(buatRecord({ maintenance_detail: [detail('Network', 'Korektif')] }), TODAY).adaKerusakan).toBe(true);
    expect(deriveFakta(buatRecord({ maintenance_detail: [detail('Network', 'Rutin')] }), TODAY).adaKerusakan).toBe(false);
  });
});

describe('evaluasiPrioritas — basis aturan IF-THEN', () => {
  test('R1: pending dan terlambat → Mendesak (mendahului semua)', () => {
    const record = buatRecord({
      tanggal_maintenance: '2026-07-01',
      maintenance_detail: [detail('Network', 'Korektif')],
    });
    expect(evaluasiPrioritas(record, TODAY)).toBe('Mendesak');
  });

  test('R2: kerusakan Network → Tinggi', () => {
    expect(evaluasiPrioritas(buatRecord({ maintenance_detail: [detail('Network', 'Korektif')] }), TODAY)).toBe('Tinggi');
  });

  test('R3: kerusakan Komputer → Tinggi', () => {
    expect(evaluasiPrioritas(buatRecord({ maintenance_detail: [detail('Komputer', 'Korektif')] }), TODAY)).toBe('Tinggi');
  });

  test('R4: kerusakan CCTV → Sedang', () => {
    expect(evaluasiPrioritas(buatRecord({ maintenance_detail: [detail('CCTV', 'Korektif')] }), TODAY)).toBe('Sedang');
  });

  test('R5: kerusakan Printer → Sedang', () => {
    expect(evaluasiPrioritas(buatRecord({ maintenance_detail: [detail('Printer', 'Korektif')] }), TODAY)).toBe('Sedang');
  });

  test('R6: jatuh tempo hari ini tanpa kerusakan → Tinggi', () => {
    expect(evaluasiPrioritas(buatRecord({ tanggal_maintenance: TODAY }), TODAY)).toBe('Tinggi');
  });

  test('R7: jatuh tempo besok tanpa kerusakan → Sedang', () => {
    expect(evaluasiPrioritas(buatRecord({ tanggal_maintenance: '2026-07-05' }), TODAY)).toBe('Sedang');
  });

  test('R8: job terjadwal jauh tanpa kerusakan → Rendah (default)', () => {
    expect(evaluasiPrioritas(buatRecord(), TODAY)).toBe(ATURAN_DEFAULT);
  });

  test('job selesai → selalu Rendah', () => {
    const record = buatRecord({
      status: true,
      tanggal_maintenance: '2026-07-01',
      maintenance_detail: [detail('Network', 'Korektif')],
    });
    expect(evaluasiPrioritas(record, TODAY)).toBe(ATURAN_DEFAULT);
  });

  test('campuran Rutin + Korektif — korektif menentukan prioritas', () => {
    const record = buatRecord({
      maintenance_detail: [detail('Network', 'Rutin', 'Switch'), detail('Network', 'Korektif', 'Router')],
    });
    expect(evaluasiPrioritas(record, TODAY)).toBe('Tinggi');
  });
});

describe('basis aturan', () => {
  test('terdiri dari aturan R1–R7 berurutan', () => {
    expect(aturanPrioritas.map(a => a.id)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7']);
  });
});