# Bab 5: Keamanan & Manajemen State/Data

## 5.1 Arsitektur Keamanan

Sistem menerapkan **defense-in-depth** dengan tiga lapisan keamanan:

```
┌──────────────────────────────────────┐
│  LAPISAN 1: Autentikasi (Auth)        │
│  - Supabase Auth (email/password)     │
│  - JWT Token validation               │
│  - Session management                 │
├──────────────────────────────────────┤
│  LAPISAN 2: Otorisasi (Route)         │
│  - Global Auth Middleware             │
│  - Role-based routing (Admin/Teknisi) │
│  - Halaman unauthorized              │
├──────────────────────────────────────┤
│  LAPISAN 3: Otorisasi (Data)          │
│  - Row Level Security (RLS)          │
│  - Service Role (server-side only)   │
│  - Anon Key (client-side, terbatas)  │
└──────────────────────────────────────┘
```

---

## 5.2 Autentikasi (Lapisan 1)

### 5.2.1 Supabase Auth

Sistem menggunakan **Supabase Auth** dengan metode **email/password**.

```typescript
// Login — terjadi di client
const { error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'userPassword'
})
// Output: Session + JWT Access Token
```

### 5.2.2 JWT Token

Setelah login sukses, Supabase mengembalikan:
- **Access Token** (JWT) — Digunakan untuk setiap request ke Supabase
- **Refresh Token** — Untuk memperpanjang session tanpa re-login

JWT token berisi **claims** standar termasuk `sub` (user ID) dan `role`. Token ini:
- Divalidasi otomatis oleh Supabase client SDK
- Memiliki masa berlaku terbatas (default 1 jam, auto-refresh)
- Ditandatangani oleh Supabase (tidak bisa dipalsukan)

### 5.2.3 Session Management

Session dikelola oleh Supabase client SDK melalui:
- **Cookies** (dengan opsi `secure: true` di production) — untuk persistensi session
- **Local storage** (fallback) — untuk menyimpan refresh token
- Nuxt module `@nuxtjs/supabase` mengelola ini secara otomatis

```typescript
// nuxt.config.ts
supabase: {
  redirect: false,  // Kami handle redirect manual via middleware
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production'
  }
}
```

### 5.2.4 Environment Variables

| Variable | Lokasi | Fungsi |
|----------|--------|--------|
| `SUPABASE_URL` | Dashboard `.env`, Gateway `.env` | URL project Supabase |
| `SUPABASE_KEY` | Dashboard `.env`, Gateway `.env` | Anon/public key (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard `runtimeConfig` | Service role key (server-side only) |
| `FONNTE_TOKEN` | (opsional, via Netlify env) | Token API Fonnte |

---

## 5.3 Otorisasi Route (Lapisan 2)

### 5.3.1 Global Auth Middleware

File: `app/middleware/auth.global.ts`

Middleware ini berjalan pada **setiap navigasi** dan melakukan:

```
1. Cek apakah user terautentikasi (user.value exists)
2. Jika tidak → redirect ke /login
3. Jika ya → fetch role dari tabel users (cache 1x via useState)
4. Route protection:
   - role === 'Admin'   → akses /, /teknisi, /client
   - role === 'Teknisi' → hanya /teknisi-dashboard
   - role unknown       → redirect ke /unauthorized
```

### 5.3.2 Role-based UI

Layout (`default.vue`) menyesuaikan navigasi sidebar berdasarkan role:

```typescript
const links = computed(() => {
  if (roleState.value === 'Teknisi') {
    // Hanya menampilkan link ke Portal Teknisi
    return [{ label: 'Portal Teknisi', icon: '...', to: '/teknisi-dashboard' }]
  }
  // Admin: Dashboard, Teknisi, Client
  return [
    { label: 'Dashboard', icon: '...', to: '/' },
    { label: 'Teknisi', icon: '...', to: '/teknisi' },
    { label: 'Client', icon: '...', to: '/client' }
  ]
})
```

### 5.3.3 State Persistence

Role disimpan di **`useState('user-role')`** — state reaktif global Nuxt yang bertahan selama session. Ini menghindari fetch role berulang pada setiap navigasi.

```typescript
const roleState = useState<string | null>('user-role', () => null)
// Diisi sekali saat middleware pertama kali dijalankan
// Dikosongkan saat logout
```

---

## 5.4 Row Level Security (Lapisan 3)

### 5.4.1 Konsep RLS

**Row Level Security (RLS)** adalah fitur PostgreSQL yang membatasi baris mana yang bisa diakses user berdasarkan policy. Ini adalah **lapisan keamanan paling kritis** karena berjalan di sisi database.

```sql
-- Contoh policy (harus dibuat di Supabase Dashboard > SQL Editor)
-- Policy untuk teknisi: hanya bisa melihat maintenance miliknya
CREATE POLICY "Teknisi hanya bisa melihat tugas sendiri"
ON public.maintenance
FOR SELECT
USING (
  teknisi_id IN (
    SELECT id FROM public.teknisi WHERE user_id = auth.uid()
  )
);

-- Policy untuk admin: bisa melihat semua
CREATE POLICY "Admin bisa melihat semua maintenance"
ON public.maintenance
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'Admin'
  )
);
```

### 5.4.2 Dua Mode Akses Database

| Mode | Key | Penggunaan | Kemampuan |
|------|-----|-----------|-----------|
| **Client (anon)** | `SUPABASE_KEY` (anon) | Browser → query langsung | Terbatas oleh RLS |
| **Server (admin)** | `SUPABASE_SERVICE_ROLE_KEY` | Server routes `/api/*` | Bypass RLS, full akses |

### 5.4.3 Praktik Keamanan RLS

1. **Anon key aman di client** — Key ini bersifat public dan hanya berguna jika RLS dikonfigurasi dengan benar
2. **Service Role Key RAHASIA** — Hanya digunakan di server-side, tidak pernah bocor ke client
3. **Setiap tabel harus punya RLS policy** — Jangan ada tabel tanpa RLS di environment production
4. **Gunakan `auth.uid()`** — Function PostgreSQL yang mengembalikan user ID dari JWT token

### 5.4.4 Contoh RLS Policies yang Disarankan

```sql
-- 1. USERS: User hanya bisa melihat dirinya sendiri; Admin bisa lihat semua
CREATE POLICY "Users select"
ON public.users FOR SELECT
USING (
  id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin')
);

-- 2. MAINTENANCE: Teknisi lihat tugas sendiri; Admin lihat semua
CREATE POLICY "Maintenance select"
ON public.maintenance FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin')
  OR
  teknisi_id IN (SELECT id FROM public.teknisi WHERE user_id = auth.uid())
);

-- 3. TEKNISI: Hanya Admin yang bisa mengubah data teknisi
CREATE POLICY "Teknisi insert/update/delete"
ON public.teknisi FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'Admin')
);
```

> **Catatan:** Karena operasi INSERT/UPDATE/DELETE teknisi dilakukan via Server Routes dengan Service Role Key (bypass RLS), policy untuk operasi write bisa lebih ketat atau bahkan disabled untuk anon key.

---

## 5.5 Manajemen State (Nuxt)

### 5.5.1 State Global (useState)

| State | Tipe | Inisialisasi | Lokasi Penggunaan |
|-------|------|-------------|-------------------|
| `user-role` | `string \| null` | `null` | Middleware, Layout, Halaman |
| `sidebar-collapsed` | `boolean` | `false` | Layout (sidebar toggle) |
| `search-query` | `string` | `''` | Layout (search bar), Index, Client, Teknisi |

### 5.5.2 State Lokal per Halaman

Setiap halaman memiliki state lokal untuk:

**Halaman Index (admin dashboard):**
| State | Tipe | Fungsi |
|-------|------|--------|
| `maintenanceRecords` | `ref([])` | Data maintenance yang ditampilkan |
| `totalCount` | `ref(0)` | Total record (dari server) |
| `currentPage` | `ref(1)` | Halaman aktif |
| `searchQuery` | `useState` (shared) | Pencarian |
| `teknisiList`, `clientList`, `kategoriPerangkatList` | `ref([])` | Dropdown options (cached) |
| `insertModalOpen`, `editModalOpen`, `deleteModalOpen`, etc. | `ref(false)` | Modal states |

**Halaman Client & Teknisi:**
| State | Tipe | Fungsi |
|-------|------|--------|
| `clientRecords` / `teknisiRecords` | `ref([])` | Data record |
| `filteredRecords` | `computed` | Data setelah filter search |
| `paginatedRecords` | `computed` | Data per halaman |

**Halaman Teknisi Dashboard:**
| State | Tipe | Fungsi |
|-------|------|--------|
| `maintenanceRecords` | `ref([])` | Tugas teknisi |
| `uploadingDetails` | `ref({})` | Tracking upload per detail ID |
| `evidencePhotos` | `ref([])` | Foto bukti di modal |
| `fullscreenOpen` | `ref(false)` | Fullscreen preview |

### 5.5.3 Runtime Config (Server-side)

Didefinisikan di `nuxt.config.ts` dan hanya bisa diakses di server-side (kecuali yang `public`):

```typescript
runtimeConfig: {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,  // Server-only
  public: {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY,
  }
}
```

---

## 5.6 Penanganan Data Sensitif

### 5.6.1 Nomor Telepon

Nomor telepon dikirim ke client browser dalam bentuk asli (plain text). Proteksi:
- **RLS** membatasi akses ke tabel yang berisi nomor kontak
- Hanya user terautentikasi yang bisa melihat kontak

### 5.6.2 Password

Password pengguna **tidak pernah disimpan** di tabel database. Semua password dikelola sepenuhnya oleh Supabase Auth (hash bcrypt, tidak bisa dibaca).

### 5.6.3 File Upload (Foto)

1. File divalidasi di client sebelum upload (tipe: jpeg/png/webp, ukuran ≤ 5MB)
2. File dikompresi client-side sebelum dikirim (maks 500KB, resolusi ≤ 1920×1080)
3. File disimpan di Supabase Storage bucket `maintenance-photos` dengan akses public URL
4. Hapus file dari storage saat record foto dihapus dari database

### 5.6.4 Environment Variables

- `.env` di **Dashboard** dan **WhatsappGateway** berisi Supabase URL + anon key
- `.env` **tidak boleh di-commit** ke git (sudah di `.gitignore`)
- Service Role Key hanya ada di runtime config Nuxt (environment variable server)
- Fonnte token disimpan sebagai environment variable Netlify

---

## 5.7 Error Handling Patterns

### 5.7.1 Client-side Error Handling

```typescript
// Pattern: try-catch dengan state error
try {
  const { data, error } = await supabase.from('maintenance').select()
  if (error) throw error
  // Proses data...
} catch (error) {
  errorMsg.value = error.message  // Ditampilkan ke user via UAlert
} finally {
  loading.value = false
}
```

### 5.7.2 Server-side Error Handling (Server Routes)

```typescript
// Pattern: throw createError untuk standard error response
try {
  // Operasi database...
} catch (error: any) {
  throw createError({
    statusCode: 500,
    statusMessage: error.message || 'Internal Server Error',
  })
}
```

### 5.7.3 WhatsApp Gateway Error Handling

```typescript
// Pattern: logging + graceful fallback (tidak throw)
async function safeSendMessage(chatId, message, contactLabel) {
  try {
    if (!client.info || !client.info.wid) {
      console.error(`Client not ready. Skip: ${contactLabel}`)
      return false  // Return boolean, tidak throw
    }
    const isRegistered = await client.isRegisteredUser(chatId)
    if (!isRegistered) {
      console.warn(`Number not registered: ${contactLabel}`)
      return false
    }
    await client.sendMessage(chatId, message)
    return true
  } catch (error) {
    console.error(`Error: ${error.message}`)
    return false
  }
}
```

### 5.7.4 Rollback Pattern (Server Routes)

**Pembuatan teknisi** menggunakan pola rollback untuk menjaga konsistensi data:

```typescript
let newUserAuthId = null
try {
  // Step 1: Buat user Auth
  const { data: authData } = await supabaseAdmin.auth.admin.createUser(...)
  newUserAuthId = authData.user.id

  // Step 2: Insert ke public.users
  await supabaseAdmin.from('users').insert(...)

  // Step 3: Insert ke public.teknisi
  await supabaseAdmin.from('teknisi').insert(...)

  return { success: true }
} catch (error) {
  // ROLLBACK: Hapus user Auth jika insert DB gagal
  if (newUserAuthId) {
    await supabaseAdmin.auth.admin.deleteUser(newUserAuthId)
  }
  throw createError({ statusCode: 500, statusMessage: error.message })
}
```

---

## 5.8 Checklist Keamanan untuk Production

- [ ] **RLS diaktifkan** di semua tabel (Supabase Dashboard > Authentication > Policies)
- [ ] **Service Role Key** tidak pernah bocor ke client (hanya di server env)
- [ ] **HTTPS** diaktifkan untuk semua komunikasi
- [ ] **Cookie secure** diatur `true` untuk production
- [ ] **Supabase Auth** dikonfigurasi dengan password strength policy
- [ ] **Storage bucket** `maintenance-photos` memiliki RLS yang sesuai
- [ ] **Fonnte Token** disimpan sebagai environment variable Netlify, bukan hardcoded
- [ ] **CORS** dikonfigurasi di Supabase (jika perlu)
- [ ] **Rate limiting** dipertimbangkan untuk endpoint sensitif