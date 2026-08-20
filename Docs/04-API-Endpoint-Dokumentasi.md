# Bab 4: API / Endpoint Documentation & Integrasi

## 4.1 Kategori Endpoint

Sistem ini memiliki dua kategori endpoint:

1. **Nuxt Server Routes** — Endpoint API backend yang dijalankan oleh server Nuxt (menggunakan Service Role Key untuk bypass RLS)
2. **Supabase Client Direct Access** — Akses database langsung dari client browser (menggunakan anon key + RLS)

---

## 4.2 Nuxt Server Routes (Server API)

Semua server route berada di `Dashboard/server/api/teknisi/` dan menggunakan **Supabase Admin Client** (Service Role Key) untuk operasi yang membutuhkan akses istimewa.

### 4.2.1 POST `/api/teknisi/create`

Membuat teknisi baru (user Auth + data profil).

**File:** `server/api/teknisi/create.post.ts`

**Request Body:**
```json
{
  "nama": "Ahmad Rizki",
  "email": "ahmad@example.com",
  "password": "securePassword123",
  "kontak": "081234567890",
  "kode_lokasi": "LOK-001"
}
```

**Response Sukses (200):**
```json
{
  "success": true,
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response Error (400):**
```json
{
  "statusCode": 400,
  "statusMessage": "Missing required fields"
}
```

**Response Error (500):**
```json
{
  "statusCode": 500,
  "statusMessage": "Error message details"
}
```

**Flow Eksekusi:**
1. Validasi input (semua field required)
2. Inisialisasi Supabase Admin Client dengan `service_role` key
3. Buat user di Supabase Auth (`auth.admin.createUser`)
4. Insert ke `public.users` (id, username, role='Teknisi')
5. Insert ke `public.teknisi` (user_id, nama, kontak, kode_lokasi)
6. Jika gagal di step 4 atau 5, lakukan rollback dengan menghapus user Auth

### 4.2.2 POST `/api/teknisi/update`

Memperbarui data teknisi.

**File:** `server/api/teknisi/update.post.ts`

**Request Body:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "nama": "Ahmad Rizki Updated",
  "kontak": "081234567891",
  "kode_lokasi": "LOK-002"
}
```

**Response Sukses (200):**
```json
{
  "success": true
}
```

**Catatan:** Jika field `nama` disertakan, tabel `users` juga diupdate (kolom `username`).

### 4.2.3 POST `/api/teknisi/activate`

Mengaktifkan akun teknisi.

**File:** `server/api/teknisi/activate.post.ts`

**Request Body:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response Sukses (200):**
```json
{
  "success": true
}
```

**Fungsi:** `UPDATE users SET is_active = true WHERE id = :id`

### 4.2.4 POST `/api/teknisi/deactivate`

Menonaktifkan akun teknisi.

**File:** `server/api/teknisi/deactivate.post.ts`

**Request Body:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response Sukses (200):**
```json
{
  "success": true
}
```

**Fungsi:** `UPDATE users SET is_active = false WHERE id = :id`

### 4.2.5 DELETE `/api/teknisi/delete`

Menghapus teknisi secara permanen (Auth + data).

**File:** `server/api/teknisi/delete.delete.ts`

**Request Body:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response Sukses (200):**
```json
{
  "success": true
}
```

**Flow Eksekusi:**
1. DELETE dari `public.teknisi` WHERE user_id = :id
2. DELETE dari `public.users` WHERE id = :id
3. DELETE dari `auth.users` via `auth.admin.deleteUser(id)`

---

## 4.3 Client-Side Supabase Access (Frontend → Database)

Akses dari browser menggunakan **Supabase anon key** dengan proteksi **Row Level Security (RLS)**.

### 4.3.1 Autentikasi

**Method:** `supabase.auth.signInWithPassword()`

```typescript
const { error } = await supabase.auth.signInWithPassword({
  email: 'admin@example.com',
  password: 'password123',
})
```

**Sign Out:**
```typescript
await supabase.auth.signOut()
```

### 4.3.2 Maintenance CRUD (Halaman Admin)

#### READ (List + Pagination)

**Endpoint:** `supabase.from('maintenance').select()`

```typescript
// Query lengkap dengan relasi dan pagination
const query = supabase
  .from('maintenance')
  .select(`
    id, created_at, status, kode_lokasi, tanggal_maintenance,
    teknisi:teknisi_id(id, nama, kontak, users(is_active)),
    client:client_id(id, nama, kontak),
    maintenance_detail(id, catatan_kerusakan, 
      kategori_perangkat:kategori_perangkat_id(id, kategori, nama_perangkat))
  `, { count: 'exact' })
  .range(from, to)            // Pagination
  .order('created_at', { ascending: false })
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "created_at": "2026-08-20T...",
      "status": false,
      "kode_lokasi": "LOK-001",
      "tanggal_maintenance": "2026-08-21",
      "teknisi": { "id": "uuid", "nama": "Ahmad", "kontak": "081234567890", "users": { "is_active": true } },
      "client": { "id": "uuid", "nama": "PT Maju", "kontak": "021-123456" },
      "maintenance_detail": [
        { "id": "uuid", "catatan_kerusakan": "Tidak bisa nyala", "kategori_perangkat": { "id": 1, "kategori": "Hardware", "nama_perangkat": "Printer" } }
      ]
    }
  ],
  "count": 50
}
```

#### INSERT

```typescript
// Insert maintenance
const { data: newRecord } = await supabase
  .from('maintenance')
  .insert({
    teknisi_id: "uuid",
    client_id: "uuid",
    kode_lokasi: "LOK-001",
    tanggal_maintenance: "2026-08-21"
  })
  .select()
  .single()

// Insert detail (batch)
await supabase
  .from('maintenance_detail')
  .insert([
    { maintenance_id: newRecord.id, kategori_perangkat_id: 1, catatan_kerusakan: "Rusak" },
    { maintenance_id: newRecord.id, kategori_perangkat_id: 2, catatan_kerusakan: "Error" }
  ])
```

#### UPDATE

```typescript
// Update maintenance
await supabase
  .from('maintenance')
  .update({ teknisi_id, client_id, kode_lokasi, tanggal_maintenance, status })
  .eq('id', recordId)

// Delete existing details (then re-insert)
await supabase
  .from('maintenance_detail')
  .delete()
  .eq('maintenance_id', recordId)
```

#### DELETE

```typescript
await supabase
  .from('maintenance')
  .delete()
  .eq('id', recordId)
```

### 4.3.3 Client CRUD (Halaman Client)

```typescript
// READ
const { data } = await supabase.from('client').select().order('created_at', { ascending: false })

// INSERT
await supabase.from('client').insert({ nama, kontak, kode_lokasi })

// UPDATE
await supabase.from('client').update({ nama, kontak, kode_lokasi }).eq('id', id)

// DELETE
await supabase.from('client').delete().eq('id', id)
```

### 4.3.4 Teknisi CRUD (Halaman Teknisi — Read Only via Client)

```typescript
// READ (termasuk status user)
const { data } = await supabase
  .from('teknisi')
  .select('*, users(is_active)')
  .order('created_at', { ascending: false })
```

> **Catatan:** INSERT, UPDATE, DELETE untuk teknisi dilakukan melalui Server Routes (`/api/teknisi/*`) karena membutuhkan Service Role Key.

### 4.3.5 Dashboard Teknisi (Client-Side)

#### Lookup Teknisi ID

```typescript
// Step 1: Cari teknisi.id berdasarkan auth user_id
const { data: teknisiData } = await supabase
  .from('teknisi')
  .select('id')
  .eq('user_id', userId)  // userId dari auth user
  .single()
```

#### Fetch Tugas

```typescript
// Step 2: Ambil tugas maintenance untuk teknisi tersebut
const { data } = await supabase
  .from('maintenance')
  .select('*, client:client_id(*), maintenance_detail(*, kategori_perangkat:kategori_perangkat_id(*), maintenance_photos(*))')
  .eq('teknisi_id', teknisiData.id)
  .order('created_at', { ascending: false })
```

#### Update Status → Completed

```typescript
await supabase
  .from('maintenance')
  .update({ status: true })
  .eq('id', record.id)
```

### 4.3.6 Upload & Hapus Foto

#### Upload ke Storage

```typescript
// Upload file
const { error } = await supabase.storage
  .from('maintenance-photos')
  .upload(filePath, blob)

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('maintenance-photos')
  .getPublicUrl(filePath)

// Insert record ke DB
await supabase
  .from('maintenance_photos')
  .insert({ maintenance_detail_id: detailId, photo_url: publicUrl })
```

#### Hapus Foto

```typescript
// 1. Hapus record database
const { data: deletedData } = await supabase
  .from('maintenance_photos')
  .delete()
  .eq('id', photoId)
  .select()

// 2. Ekstrak file path dari URL
const urlObj = new URL(photoUrl)
const pathname = decodeURIComponent(urlObj.pathname)
const filePath = pathname.split('/').slice(bucketIndex + 1).join('/')

// 3. Hapus dari Storage
const { error } = await supabase.storage
  .from('maintenance-photos')
  .remove([filePath])
```

#### View Photos

```typescript
const { data } = await supabase
  .from('maintenance_photos')
  .select('photo_url')
  .in('maintenance_detail_id', detailIds)
```

---

## 4.4 External Integrations

### 4.4.1 WhatsApp Gateway (Puppeteer)

**File:** `WhatsappGateway/index.js`

Service ini **tidak memiliki REST API** — berjalan sebagai background service mandiri dengan koneksi langsung ke:
- **Supabase** — Membaca data maintenance (read-only via anon key)
- **WhatsApp Web** — Mengirim pesan via whatsapp-web.js (Puppeteer)

**Cron Schedule:**
| Waktu | Fungsi | Tujuan |
|-------|--------|--------|
| 03:00 WITA (19:00 UTC) | `sendMaintenanceReminders()` | Kirim pengingat maintenance HARI INI ke teknisi |
| 08:00 WITA (00:00 UTC) | `sendTomorrowMaintenanceReminders()` | Kirim pengingat maintenance BESOK ke teknisi + klien |

**Format Pesan:**
- **Ke Teknisi (H+0):** `Halo [nama], jangan lupa ada maintenance hari ini di [lokasi] untuk perangkat: [daftar].`
- **Ke Teknisi (H+1):** `Halo [nama], jangan lupa ada maintenance besok di [lokasi] untuk perangkat: [daftar].`
- **Ke Klien (H+1):** `Halo [nama], kami menginformasikan bahwa akan ada jadwal maintenance besok di lokasi Anda. Mohon kesediaannya.`

### 4.4.2 Fonnte API

**File:** `WhatsappFonnte/utils/fonnte.js`

**Endpoint Eksternal:** `POST https://api.fonnte.com/send`

**Headers:**
```
Authorization: <FONNTE_TOKEN>
Content-Type: application/x-www-form-urlencoded
```

**Request Body:**
```
target=6281234567890&message=Halo ..., jangan lupa ada maintenance ...
```

**Response:**
```json
{
  "status": true,
  "reason": "optional error message"
}
```

**Netlify Scheduled Functions:**
| Cron (UTC) | Waktu WITA | Fungsi |
|------------|-----------|--------|
| `0 19 * * *` | 03:00 | `remind-today` — Maintenance hari ini |
| `0 0 * * *` | 08:00 | `remind-tomorrow` — Maintenance besok |

---

## 4.5 Daftar Lengkap Endpoint

| No | Method | Endpoint | Akses | Fungsi | Sumber |
|----|--------|----------|-------|--------|--------|
| 1 | POST | `/api/teknisi/create` | Service Role | Buat teknisi baru | Server Route |
| 2 | POST | `/api/teknisi/update` | Service Role | Update data teknisi | Server Route |
| 3 | POST | `/api/teknisi/activate` | Service Role | Aktifkan teknisi | Server Route |
| 4 | POST | `/api/teknisi/deactivate` | Service Role | Nonaktifkan teknisi | Server Route |
| 5 | DELETE | `/api/teknisi/delete` | Service Role | Hapus teknisi | Server Route |
| 6 | SELECT | `maintenance` (client) | Anon + RLS | Read + pagination | Supabase Client |
| 7 | INSERT | `maintenance` (client) | Anon + RLS | Buat maintenance | Supabase Client |
| 8 | UPDATE | `maintenance` (client) | Anon + RLS | Edit maintenance | Supabase Client |
| 9 | DELETE | `maintenance` (client) | Anon + RLS | Hapus maintenance | Supabase Client |
| 10 | SELECT | `client` (client) | Anon + RLS | CRUD client | Supabase Client |
| 11 | SELECT | `teknisi` (client) | Anon + RLS | Read teknisi | Supabase Client |
| 12 | INSERT | `maintenance_photos` (client) | Anon + RLS | Insert foto | Supabase Client |
| 13 | DELETE | `maintenance_photos` (client) | Anon + RLS | Hapus foto | Supabase Client |
| 14 | Upload | Storage `maintenance-photos` | Anon + RLS | Upload foto | Supabase Storage |
| 15 | - | `sendMaintenanceReminders()` | Local | Cron H+0 via WA | WhatsApp Gateway |
| 16 | - | `sendTomorrowMaintenanceReminders()` | Local | Cron H+1 via WA | WhatsApp Gateway |
| 17 | - | `remind-today` (Netlify) | Scheduled | Cron H+0 via Fonnte | WhatsApp Fonnte |
| 18 | - | `remind-tomorrow` (Netlify) | Scheduled | Cron H+1 via Fonnte | WhatsApp Fonnte |