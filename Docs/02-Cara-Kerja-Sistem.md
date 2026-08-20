# Bab 2: Cara Kerja Sistem (Flow & Logic)

## 2.1 Alur Autentikasi

### 2.1.1 Diagram Alur Login

```mermaid
sequenceDiagram
    actor User as Pengguna
    participant Login as Login Page
    participant MW as Auth Middleware
    participant Supa as Supabase Auth
    participant DB as Database
    participant Dashboard as Admin/Teknisi Page

    User->>Login: Masukkan Email & Password
    Login->>Supa: signInWithPassword(email, password)
    Supa-->>Login: JWT Token + User Session
    Login-->>User: Redirect ke halaman utama

    Note over MW: Global middleware berjalan<br/>setiap navigasi
    
    User->>MW: Navigasi ke route manapun
    MW->>Supa: Validasi session (user.value)
    MW->>DB: SELECT role FROM users WHERE id = userId
    DB-->>MW: Role: 'Admin' | 'Teknisi'
    
    alt Role = Admin
        MW-->>User: Allow: /, /teknisi, /client
        MW-->>User: Redirect: /teknisi-dashboard → /
    else Role = Teknisi
        MW-->>User: Allow: /teknisi-dashboard
        MW-->>User: Redirect: /, /teknisi, /client → /teknisi-dashboard
    else Role tidak dikenal
        MW-->>User: Redirect: /unauthorized?role=none
    end
```

### 2.1.2 Detail Auth Middleware

File: `app/middleware/auth.global.ts`

Middleware ini berjalan **global** (setiap navigasi) dan melakukan:

1. **Cek Session** — Memeriksa apakah `useSupabaseUser()` memiliki nilai valid (`id` atau `sub`)
2. **Fetch Role** — Jika role belum di-cache di `useState('user-role')`, query tabel `users` untuk mendapatkan role
3. **Route Protection** — Berdasarkan role yang ditemukan:
   - **Admin**: Akses ke `/`, `/teknisi`, `/client`; dilarang ke `/teknisi-dashboard`
   - **Teknisi**: Hanya akses ke `/teknisi-dashboard`; semua route lain dialihkan
   - **Unknown**: Dialihkan ke `/unauthorized`

**Catatan penting:** Role di-cache di `useState('user-role')` selama session, sehingga hanya perlu 1 kali query database.

---

## 2.2 Alur Manajemen Maintenance (Admin)

### 2.2.1 CRUD Maintenance

```mermaid
sequenceDiagram
    actor Admin as Admin
    participant UI as Dashboard Page
    participant API as Supabase Client
    
    Note over Admin,API: CREATE
    
    Admin->>UI: Klik "Add Record"
    UI->>UI: Buka Insert Modal
    Admin->>UI: Pilih Teknisi, Client, Lokasi, Tanggal, Perangkat
    Admin->>UI: Klik "Insert"
    UI->>API: INSERT INTO maintenance
    API-->>UI: Return new record
    
    alt Ada perangkat
        UI->>API: INSERT INTO maintenance_detail (batch)
        API-->>UI: Success
    end
    
    UI->>UI: Refresh table + stats
    
    Note over Admin,API: READ
    
    Admin->>UI: Buka halaman Dashboard
    UI->>API: SELECT maintenance + relasi (range 10)
    API-->>UI: Data records
    UI->>UI: Render tabel + pagination
    
    Note over Admin,API: UPDATE
    
    Admin->>UI: Klik "Edit" pada record
    UI->>UI: Buka Edit Modal (pre-filled)
    Admin->>UI: Ubah data
    Admin->>UI: Klik "Save Changes"
    UI->>API: UPDATE maintenance SET ...
    UI->>API: DELETE maintenance_detail WHERE maintenance_id = ...
    UI->>API: INSERT INTO maintenance_detail (batch)
    API-->>UI: Success
    UI->>UI: Refresh table + stats
    
    Note over Admin,API: DELETE
    
    Admin->>UI: Klik "Delete"
    UI->>UI: Buka Delete Confirmation Modal
    Admin->>UI: Konfirmasi
    UI->>API: DELETE FROM maintenance WHERE id = ...
    API-->>UI: Success
    UI->>UI: Refresh table
```

### 2.2.2 Optimasi Query yang Diterapkan

Berdasarkan analisis kode `index.vue`, beberapa optimasi telah diterapkan:

1. **Server-side Pagination** — Data difetch per halaman (10 record) dengan `.range()` untuk menghindari *overfetching*
2. **Dropdown Data Caching** — Data teknisi, client, kategori_perangkat di-cache setelah fetch pertama (`dropdownDataLoaded` flag)
3. **Parallel Fetching** — `getMaintenanceData()` dan `fetchStats()` dijalankan paralel dengan `Promise.all()`
4. **Exact Count** — Statistik menggunakan `{ count: 'exact', head: true }` untuk menghindari *full-table scan* yang mahal
5. **Client-side Search Fallback** — Pencarian dilakukan client-side jika data sudah di-fetch (cocok untuk dataset kecil)

---

## 2.3 Alur Dashboard Teknisi

```mermaid
sequenceDiagram
    actor Teknisi as Teknisi
    participant UI as Teknisi Dashboard
    participant API as Supabase Client
    participant Storage as Supabase Storage

    Teknisi->>UI: Buka /teknisi-dashboard
    UI->>API: SELECT teknisi.id WHERE user_id = auth.uid()
    API-->>UI: teknisi.id
    
    UI->>API: SELECT maintenance WHERE teknisi_id = ...
    API-->>UI: Daftar tugas maintenance
    
    UI->>UI: Render cards per tugas
    
    Note over Teknisi,Storage: Upload Bukti Foto
    
    Teknisi->>UI: Klik "Upload Bukti" (pilih file)
    UI->>UI: Kompres gambar (canvas resize + quality reduction)
    UI->>Storage: Upload file ke bucket "maintenance-photos"
    Storage-->>UI: Public URL
    UI->>API: INSERT INTO maintenance_photos
    API-->>UI: Success
    
    Note over Teknisi,API: Selesaikan Tugas
    
    Teknisi->>UI: Klik "Selesaikan Tugas"
    UI->>API: UPDATE maintenance SET status = true
    API-->>UI: Success
    UI->>UI: Update status card ke "Completed"
```

### 2.3.1 Kompresi Gambar (Client-side)

File: `teknisi-dashboard.vue` — Fungsi `compressImage()`

Untuk menghemat bandwidth dan storage, gambar dikompresi langsung di browser sebelum diunggah:

1. **Resize** — Maksimum dimensi 1920×1080 (mempertahankan aspek rasio)
2. **Kualitas** — Dimulai dari 80%, diturunkan bertahap hingga gambar ≤ 500KB
3. **Format** — Output selalu JPEG (`image/jpeg`)
4. **Validasi** — Tipe file: `image/jpeg`, `image/png`, `image/webp`; Maksimum 5MB sebelum kompresi

---

## 2.4 Alur Notifikasi Otomatis

Sistem memiliki **dua service notifikasi independen** yang berjalan secara paralel.

### 2.4.1 Service A: WhatsApp Gateway (Node.js + Puppeteer)

```mermaid
sequenceDiagram
    participant Cron as node-cron
    participant GW as WhatsApp Gateway
    participant DB as Supabase DB
    participant WA as WhatsApp Web
    participant Tech as Teknisi
    participant Client as Klien

    Note over Cron: Jadwal 1: 03:00 WITA (Hari Ini)
    Cron->>GW: Trigger cron '0 3 * * *'
    GW->>DB: SELECT maintenance<br/>WHERE tanggal = today<br/>AND status = false
    DB-->>GW: [job1, job2, ...]
    
    loop Setiap job
        GW->>GW: Format nomor: 08xxx → 628xxx@c.us
        GW->>WA: isRegisteredUser(chatId)
        WA-->>GW: true/false
        alt Terdaftar
            GW->>WA: sendMessage(chatId, pesan)
            WA-->>Tech: "Halo [nama], jangan lupa maintenance hari ini..."
        else Tidak terdaftar
            GW->>GW: Log warning, skip
        end
    end

    Note over Cron: Jadwal 2: 08:00 WITA (Besok)
    Cron->>GW: Trigger cron '0 8 * * *'
    GW->>DB: SELECT maintenance<br/>WHERE tanggal = tomorrow<br/>AND status = false
    DB-->>GW: [job1, job2, ...]
    
    loop Setiap job
        GW->>WA: sendMessage(techChatId, pesan teknisi)
        WA-->>Tech: Pesan pengingat besok
        GW->>WA: sendMessage(clientChatId, pesan klien)
        WA-->>Client: "Halo [klien], akan ada maintenance besok..."
    end
```

### 2.4.2 Service B: WhatsApp Fonnte (Netlify Scheduled Functions)

```mermaid
sequenceDiagram
    participant Netlify as Netlify Scheduler
    participant Fn as remind-today.js
    participant Fn2 as remind-tomorrow.js
    participant DB as Supabase DB
    participant Fonnte as Fonnte API
    participant Tech as Teknisi
    participant Client as Klien

    Note over Netlify: Cron: 19:00 UTC = 03:00 WITA
    Netlify->>Fn: Trigger schedule '0 19 * * *'
    Fn->>DB: SELECT maintenance WHERE tanggal = today AND status = false
    DB-->>Fn: Data jobs
    Loop Setiap job
        Fn->>Fonnte: POST /send (target, message)
        Fonnte-->>Tech: Pesan WhatsApp
    end

    Note over Netlify: Cron: 00:00 UTC = 08:00 WITA
    Netlify->>Fn2: Trigger schedule '0 0 * * *'
    Fn2->>DB: SELECT maintenance WHERE tanggal = tomorrow AND status = false
    DB-->>Fn2: Data jobs
    Loop Setiap job
        Fn2->>Fonnte: POST /send (target teknisi)
        Fn2->>Fonnte: POST /send (target client)
        Fonnte-->>Tech: Pesan teknisi
        Fonnte-->>Client: Pesan klien
    end
```

### 2.4.3 Perbandingan Service Notifikasi

| Aspek | WhatsApp Gateway | WhatsApp Fonnte |
|-------|-----------------|-----------------|
| **Metode** | whatsapp-web.js (Puppeteer) | API Fonnte (third-party) |
| **Keunggulan** | Gratis, tidak perlu API key | Lebih stabil, tidak tergantung browser |
| **Kelemahan** | Perlu maintain session WA, berat (Chrome) | Bergantung pada service eksternal |
| **Hosting** | VPS / VM dengan Chrome | Netlify (serverless) |
| **Validasi Nomor** | `isRegisteredUser()` | Tidak ada (Fonnte handle) |
| **Autentikasi** | QR Code scan | Token API (`FONNTE_TOKEN`) |

---

## 2.5 Alur Manajemen Teknisi (Admin)

### 2.5.1 Pembuatan Teknisi Baru

File: `server/api/teknisi/create.post.ts`

Pembuatan teknisi membutuhkan **Service Role Key** karena harus membuat user di Supabase Auth (operasi admin).

```mermaid
sequenceDiagram
    actor Admin as Admin
    participant UI as Teknisi Page
    participant API as Server Route
    participant SB as Supabase Admin Client
    participant Auth as Supabase Auth
    participant DB as Database

    Admin->>UI: Isi form: Email, Password, Nama, Kontak, Kode Lokasi
    Admin->>UI: Klik "Insert"
    UI->>API: POST /api/teknisi/create { body }
    
    API->>SB: Inisialisasi admin client (service_role key)
    SB->>Auth: auth.admin.createUser(email, password)
    Auth-->>SB: authData.user.id
    
    alt Gagal create user
        SB-->>API: Error
        API-->>UI: 500 Server Error
    end
    
    SB->>DB: INSERT INTO users (id, username, role='Teknisi')
    SB->>DB: INSERT INTO teknisi (user_id, nama, kontak, kode_lokasi)
    
    alt Gagal insert DB
        SB->>Auth: ROLLBACK: admin.deleteUser(userId)
        SB-->>API: Error
        API-->>UI: 500 Server Error
    end
    
    SB-->>API: { success: true, userId }
    API-->>UI: Response sukses
    UI->>DB: Refresh data teknisi
    UI-->>Admin: Data teknisi baru muncul di tabel
```

### 2.5.2 Aktivasi / Deaktivasi Teknisi

Fungsi aktivasi/deaktivasi hanya mengubah kolom `is_active` di tabel `users`. Teknisi yang dinonaktifkan tetap bisa login, tetapi statusnya akan terlihat di dashboard admin.

```
Deaktivasi: UPDATE users SET is_active = false WHERE id = :userId
Aktivasi:   UPDATE users SET is_active = true WHERE id = :userId
Penghapusan: DELETE user dari Auth, users, dan teknisi (cascade)
```

---

## 2.6 Alur Pencarian (Search)

Pencarian di sidebar bekerja dengan **debounce 500ms** dan **shared state**:

```mermaid
flowchart LR
    Input[User mengetik di search bar] -->|500ms debounce| Trigger{length >= 3?}
    Trigger -->|Ya| Update[set searchQuery di useState]
    Trigger -->|Tidak| Clear[set searchQuery = '']
    Update --> Filter[Halaman menyaring data lokal]
    Clear --> Reset[Kembali ke data lengkap]
```

Search query menggunakan `useState('search-query')` sehingga state dibagikan antar halaman. Setiap halaman (index, client, teknisi) melakukan filtering client-side pada data yang sudah di-fetch.