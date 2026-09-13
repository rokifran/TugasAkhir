export type LevelPrioritas = 'Mendesak' | 'Tinggi' | 'Sedang' | 'Rendah'

export interface FaktaPrioritas {
  status: boolean
  terlambat: boolean
  dueHariIni: boolean
  dueBesok: boolean
  adaKerusakan: boolean
  kategoriTerparah: string | null
}

export interface AturanPrioritas {
  id: string
  kondisi: (f: FaktaPrioritas) => boolean
  hasil: LevelPrioritas
}

// Tingkat keparahan kategori perangkat (untuk agregasi job multi-perangkat)
const SEVERITAS_KATEGORI: Record<string, number> = {
  Network: 3,
  Komputer: 3,
  CCTV: 2,
  Printer: 2,
}

export const ATURAN_DEFAULT: LevelPrioritas = 'Rendah'

export function tambahHari(tanggal: string, selisih: number): string {
  const [tahun, bulan, hari] = tanggal.split('-').map(Number)
  const d = new Date(Date.UTC(tahun, bulan - 1, hari + selisih))
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${d.getUTCFullYear()}-${mm}-${dd}`
}

// Menurunkan fakta dari satu record maintenance (data dari Supabase)
export function deriveFakta(record: any, today: string): FaktaPrioritas {
  const status = record.status === true
  const tanggal: string | null = record.tanggal_maintenance || null
  const details: any[] = record.maintenance_detail || []
  const detailKorektif = details.filter(d => d.jenis_maintenance === 'Korektif')
  const adaKerusakan = detailKorektif.length > 0

  let kategoriTerparah: string | null = null
  for (const d of detailKorektif) {
    const kategori = d.kategori_perangkat?.kategori
    if (!kategori) continue
    if (
      kategoriTerparah === null ||
      (SEVERITAS_KATEGORI[kategori] ?? 1) > (SEVERITAS_KATEGORI[kategoriTerparah] ?? 1)
    ) {
      kategoriTerparah = kategori
    }
  }

  return {
    status,
    terlambat: !status && tanggal !== null && tanggal < today,
    dueHariIni: !status && tanggal === today,
    dueBesok: !status && tanggal === tambahHari(today, 1),
    adaKerusakan,
    kategoriTerparah,
  }
}

// Basis aturan IF-THEN — dievaluasi berurutan, aturan pertama yang cocok menang (first-match precedence)
export const aturanPrioritas: AturanPrioritas[] = [
  { id: 'R1', kondisi: f => f.terlambat, hasil: 'Mendesak' },
  { id: 'R2', kondisi: f => f.adaKerusakan && f.kategoriTerparah === 'Network', hasil: 'Tinggi' },
  { id: 'R3', kondisi: f => f.adaKerusakan && f.kategoriTerparah === 'Komputer', hasil: 'Tinggi' },
  { id: 'R4', kondisi: f => f.adaKerusakan && f.kategoriTerparah === 'CCTV', hasil: 'Sedang' },
  { id: 'R5', kondisi: f => f.adaKerusakan && f.kategoriTerparah === 'Printer', hasil: 'Sedang' },
  { id: 'R6', kondisi: f => f.dueHariIni, hasil: 'Tinggi' },
  { id: 'R7', kondisi: f => f.dueBesok, hasil: 'Sedang' },
]

// Evaluasi prioritas satu job maintenance (fungsi murni — pure function)
export function evaluasiPrioritas(
  record: any,
  today: string = new Date().toISOString().split('T')[0]
): LevelPrioritas {
  if (record.status === true) return ATURAN_DEFAULT
  const fakta = deriveFakta(record, today)
  for (const aturan of aturanPrioritas) {
    if (aturan.kondisi(fakta)) return aturan.hasil
  }
  return ATURAN_DEFAULT
}

// Gaya badge untuk UI (dashboard admin & teknisi)
export const STYLE_BADGE_PRIORITAS: Record<LevelPrioritas, { badge: string; dot: string }> = {
  Mendesak: { badge: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  Tinggi: { badge: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  Sedang: { badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  Rendah: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
}