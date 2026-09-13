import { describe, it, expect } from 'vitest'
import { evaluasiPrioritas, deriveFakta, tambahHari, aturanPrioritas, ATURAN_DEFAULT } from '../app/utils/prioritas'

const TODAY = '2026-07-04'

function buatRecord(overrides: any = {}) {
  return {
    status: false,
    tanggal_maintenance: '2026-07-10',
    maintenance_detail: [],
    ...overrides,
  }
}

function detail(kategori: string, jenis: 'Rutin' | 'Korektif' = 'Rutin', nama = 'Unit') {
  return { jenis_maintenance: jenis, kategori_perangkat: { kategori, nama_perangkat: nama } }
}

describe('tambahHari', () => {
  it('menambah hari normal', () => {
    expect(tambahHari('2026-07-04', 1)).toBe('2026-07-05')
  })

  it('melintasi akhir bulan', () => {
    expect(tambahHari('2026-07-31', 1)).toBe('2026-08-01')
  })

  it('melintasi akhir tahun', () => {
    expect(tambahHari('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('deriveFakta', () => {
  it('mendeteksi keterlambatan', () => {
    const f = deriveFakta(buatRecord({ tanggal_maintenance: '2026-07-02' }), TODAY)
    expect(f.terlambat).toBe(true)
    expect(f.dueHariIni).toBe(false)
    expect(f.dueBesok).toBe(false)
  })

  it('mendeteksi jatuh tempo hari ini dan besok', () => {
    expect(deriveFakta(buatRecord({ tanggal_maintenance: TODAY }), TODAY).dueHariIni).toBe(true)
    expect(deriveFakta(buatRecord({ tanggal_maintenance: '2026-07-05' }), TODAY).dueBesok).toBe(true)
  })

  it('adaKerusakan true jika ada detail Korektif', () => {
    const f = deriveFakta(buatRecord({ maintenance_detail: [detail('Network', 'Korektif')] }), TODAY)
    expect(f.adaKerusakan).toBe(true)
    expect(f.kategoriTerparah).toBe('Network')
  })

  it('mengambil kategori terparah di antara detail Korektif', () => {
    const f = deriveFakta(
      buatRecord({ maintenance_detail: [detail('Printer', 'Korektif'), detail('Komputer', 'Korektif')] }),
      TODAY
    )
    expect(f.kategoriTerparah).toBe('Komputer')
  })

  it('mengabaikan detail Rutin untuk adaKerusakan', () => {
    const f = deriveFakta(buatRecord({ maintenance_detail: [detail('Network', 'Rutin')] }), TODAY)
    expect(f.adaKerusakan).toBe(false)
    expect(f.kategoriTerparah).toBeNull()
  })
})

describe('evaluasiPrioritas — basis aturan IF-THEN', () => {
  it('R1: pending dan terlambat → Mendesak (mendahului aturan lain)', () => {
    const record = buatRecord({
      tanggal_maintenance: '2026-07-01',
      maintenance_detail: [detail('Network', 'Korektif')],
    })
    expect(evaluasiPrioritas(record, TODAY)).toBe('Mendesak')
  })

  it('R2: kerusakan Network → Tinggi', () => {
    expect(evaluasiPrioritas(buatRecord({ maintenance_detail: [detail('Network', 'Korektif')] }), TODAY)).toBe('Tinggi')
  })

  it('R3: kerusakan Komputer → Tinggi', () => {
    expect(evaluasiPrioritas(buatRecord({ maintenance_detail: [detail('Komputer', 'Korektif')] }), TODAY)).toBe('Tinggi')
  })

  it('R4: kerusakan CCTV → Sedang', () => {
    expect(evaluasiPrioritas(buatRecord({ maintenance_detail: [detail('CCTV', 'Korektif')] }), TODAY)).toBe('Sedang')
  })

  it('R5: kerusakan Printer → Sedang', () => {
    expect(evaluasiPrioritas(buatRecord({ maintenance_detail: [detail('Printer', 'Korektif')] }), TODAY)).toBe('Sedang')
  })

  it('R6: jatuh tempo hari ini tanpa kerusakan → Tinggi', () => {
    expect(evaluasiPrioritas(buatRecord({ tanggal_maintenance: TODAY }), TODAY)).toBe('Tinggi')
  })

  it('R7: jatuh tempo besok tanpa kerusakan → Sedang', () => {
    expect(evaluasiPrioritas(buatRecord({ tanggal_maintenance: '2026-07-05' }), TODAY)).toBe('Sedang')
  })

  it('R8: job terjadwal jauh tanpa kerusakan → Rendah (default)', () => {
    expect(evaluasiPrioritas(buatRecord(), TODAY)).toBe(ATURAN_DEFAULT)
  })

  it('job selesai → selalu Rendah meskipun terlambat/kerusakan', () => {
    const record = buatRecord({
      status: true,
      tanggal_maintenance: '2026-07-01',
      maintenance_detail: [detail('Network', 'Korektif')],
    })
    expect(evaluasiPrioritas(record, TODAY)).toBe(ATURAN_DEFAULT)
  })
})

describe('evaluasiPrioritas — kasus campuran', () => {
  it('campuran Rutin + Korektif: korektif menentukan prioritas', () => {
    const record = buatRecord({
      maintenance_detail: [detail('Network', 'Rutin', 'Switch'), detail('Network', 'Korektif', 'Router')],
    })
    expect(evaluasiPrioritas(record, TODAY)).toBe('Tinggi')
  })

  it('kerusakan CCTV pada job jatuh tempo hari ini → Sedang (R4 mendahului R6)', () => {
    const record = buatRecord({ tanggal_maintenance: TODAY, maintenance_detail: [detail('CCTV', 'Korektif')] })
    expect(evaluasiPrioritas(record, TODAY)).toBe('Sedang')
  })

  it('detail tanpa kategori tidak merusak evaluasi (kembali ke aturan tanggal/default)', () => {
    const record = buatRecord({
      maintenance_detail: [{ jenis_maintenance: 'Korektif', kategori_perangkat: null }],
    })
    expect(evaluasiPrioritas(record, TODAY)).toBe(ATURAN_DEFAULT)
  })
})

describe('basis aturan', () => {
  it('terdiri dari aturan R1–R7 berurutan', () => {
    expect(aturanPrioritas.map(a => a.id)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'])
  })
})