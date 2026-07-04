# 🚀 MaintenApp - Dokumentasi Teknis

Dokumen ini memberikan gambaran teknis dari proyek **MaintenApp**, yang dirancang untuk membantu pengembang (terutama junior) dalam memahami arsitektur, model data, dan alur kerja sistem.

---

## 🛠 Tech Stack (Teknologi yang Digunakan)

Kami menggunakan kombinasi teknologi modern untuk memastikan aplikasi cepat, responsif, dan mudah dikelola:

- **Frontend Framework:** [Nuxt.js](https://nuxt.com/) (Vue.js) — Digunakan untuk membangun antarmuka pengguna (UI) yang cepat.
- **Backend-as-a-Service (BaaS):** [Supabase](https://supabase.com/) — Mengelola infrastruktur backend tanpa perlu membuat server manual.
  - **Database:** PostgreSQL (Database relasional untuk menyimpan data).
  - **Authentication:** Supabase Auth (Sistem login dan keamanan pengguna).
  - **Realtime:** Supabase Realtime (Sinkronisasi data otomatis secara langsung).
  - **Storage:** Supabase Storage (Tempat menyimpan foto bukti pemeliharaan).
- **Notifikasi:** WhatsApp API Integration (Melalui `WhatsappGateway`) — Mengirim pengingat otomatis ke teknisi dan klien.
- **Styling:** Tailwind CSS & Nuxt UI — Untuk desain antarmuka yang konsisten dan modern.

---

## 🏗 Arsitektur Sistem (Detailed)

Aplikasi ini menggunakan arsitektur terpisah (*decoupled*) dengan pembagian tanggung jawab yang jelas antara UI, Database, dan Background Service.

### Diagram Arsitektur Detail
```mermaid
graph TB
    subgraph "Client Side (Nuxt.js)"
        AdminUI[Admin Dashboard]
        TechUI[Technician Dashboard]
        AuthMiddleware[Auth Middleware]
    end

    subgraph "Backend Side (Supabase)"
        direction TB
        Auth[Supabase Auth]
        DB[(PostgreSQL Database)]
        Storage[Supabase Storage]
        Realtime[Realtime Engine]
        RLS[Row Level Security]
    end

    subgraph "Integration Side (Node.js)"
        WAGateway[WhatsApp Gateway Service]
        CronJob[Node-Cron Scheduler]
        WAPuppeteer[Puppeteer/WA-Web.js]
    end

    %% Flows
    AdminUI -->|1. Auth/Login| Auth
    TechUI -->|1. Auth/Login| Auth
    
    AdminUI -->|2. CRUD Tasks| RLS
    TechUI -->|2. Update Status| RLS
    RLS -->|3. Access Control| DB
    
    AdminUI -->|4. Upload Proof| Storage
    TechUI -->|4. Upload Proof| Storage
    
    DB -->|5. Change Events| Realtime
    Realtime -->|6. Push Update| AdminUI
    
    CronJob -->|7. Trigger Check| WAGateway
    WAGateway -->|8. Query Schedule| DB
    DB -->|9. Return Job List| WAGateway
    WAGateway -->|10. Send Message| WAPuppeteer
    WAPuppeteer -->|11. WhatsApp Message| TechUI
    WAPuppeteer -->|11. WhatsApp Message| ClientUser[Klien/Customer]
```

---

## 🔄 Alur Data (Detailed Data Flow)

Proses pengolahan data dalam MaintenApp terbagi menjadi dua aliran utama: Alur Pengelolaan Tugas dan Alur Notifikasi Otomatis.

### 1. Alur Pengelolaan Tugas (Task Management Flow)
Alur ini terjadi ketika Admin mengelola jadwal dan Teknisi mengupdate pengerjaan.

```mermaid
sequenceDiagram
    participant Admin as Admin (UI)
    participant Supa as Supabase (BaaS)
    participant Real as Realtime Engine
    participant Tech as Teknisi (UI)

    Admin->>Supa: Buat Jadwal Maintenance (Insert)
    Supa->>Supa: Simpan ke tabel `maintenance`
    Supa-->>Real: Trigger: Postgres Change (INSERT)
    Real-->>Admin: Notifikasi: "Tugas Baru Berhasil Dibuat"
    
    Tech->>Supa: Lihat Daftar Tugas (Select)
    Supa-->>Tech: Kirim data tugas assigned
    Tech->>Supa: Upload Foto & Update Status (UPDATE)
    Supa->>Supa: Simpan status `completed: true`
    Supa-->>Real: Trigger: Postgres Change (UPDATE)
    Real-->>Admin: Notifikasi: "Tugas Selesai" (Auto-update UI)
```

### 2. Alur Notifikasi Otomatis (Automatic Notification Flow)
Alur ini berjalan secara independen di latar belakang melalui Node.js.

```mermaid
sequenceDiagram
    participant Cron as Node-Cron
    participant Gateway as WhatsApp Gateway
    participant DB as Supabase DB
    participant WA as WhatsApp Web API
    participant User as Teknisi/Klien

    Cron->>Gateway: Trigger: Jam 03:00 / 08:00 AM
    Gateway->>DB: Query: maintenance where status=false
    DB-->>Gateway: Kirim data: [Job, Kontak Teknisi, Kontak Klien]
    Gateway->>Gateway: Format Nomor (62...) & Susun Pesan
    Gateway->>WA: Request: send_message(phone, message)
    WA->>User: Terima Notifikasi WhatsApp
```

---

## 🗄️ Skema Database (Detailed ERD)

Database dirancang secara relasional untuk menjamin integritas data (*Data Integrity*).

### Entity Relationship Diagram (ERD)
```mermaid
erDiagram
    users ||--|| teknisi : "memiliki profil"
    teknisi ||--o{ maintenance : "mengerjakan"
    client ||--o{ maintenance : "menerima"
    maintenance ||--|{ maintenance_detail : "berisi"
    kategori_perangkat ||--o{ maintenance_detail : "dikategorikan sebagai"

    users {
        uuid id PK "References auth.users"
        text email "Unique email"
        enum role "admin | teknisi"
    }
    teknisi {
        uuid id PK, FK "References users.id"
        text nama "Nama Lengkap"
        text kontak "Nomor WhatsApp"
        text kode_lokasi "Default Area"
    }
    client {
        uuid id PK
        text nama "Nama Perusahaan/Klien"
        text kontak "Nomor WhatsApp"
    }
    kategori_perangkat {
        uuid id PK
        text kategori "Contoh: Hardware"
        text nama_perangkat "Contoh: Printer"
    }
    maintenance {
        uuid id PK
        uuid teknisi FK "FK: teknisi.id"
        uuid client FK "FK: client.id"
        text kode_lokasi "Lokasi Pengerjaan"
        timestamp tanggal_maintenance "Jadwal"
        boolean status "false: Pending | true: Done"
    }
    maintenance_detail {
        uuid id PK
        uuid maintenance_id FK "FK: maintenance.id"
        uuid kategori_perangkat_id FK "FK: kategori_perangkat.id"
        text catatan_kerusakan "Detail masalah"
    }
```

### Relasi Kunci
- **One-to-One (`users` $\rightarrow$ `teknisi`):** Setiap pengguna dengan role 'teknisi' memiliki satu profil detail teknisi.
- **One-to-Many (`maintenance` $\rightarrow$ `maintenance_detail`):** Satu sesi maintenance bisa mencakup pemeriksaan banyak perangkat sekaligus.
- **One-to-Many (`teknisi` $\rightarrow$ `maintenance`):** Seorang teknisi bisa menangani banyak tugas pemeliharaan.

---

## 🔑 Catatan Implementasi untuk Junior

### 1. Real-time Subscriptions (Supabase)
Agar UI terupdate otomatis tanpa refresh, gunakan `channel`. Ini sangat krusial untuk aplikasi dashboard.
```javascript
// Contoh listener untuk perubahan status maintenance
supabase
  .channel('maintenance-updates')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'maintenance' }, payload => {
    console.log('Data berubah!', payload.new)
    refreshUI() // Fungsi untuk update data di layar
  })
  .subscribe()
```

### 2. Keamanan dengan RLS (Row Level Security)
Kita tidak hanya mengamankan frontend, tapi juga backend. Supabase RLS memastikan:
- **Teknisi:** `SELECT` hanya jika `teknisi_id == auth.uid()`.
- **Admin:** `ALL` access ke semua baris data.

### 3. WhatsApp Gateway (Headless Browser)
WhatsApp Gateway menggunakan Puppeteer yang menjalankan Chrome di latar belakang untuk mensimulasikan WhatsApp Web.
- **Kelebihan:** Gratis (tidak bayar API resmi).
- **Kekurangan:** Perlu menjaga sesi login tetap aktif (Session persistence).

---
*Dokumentasi ini diperbarui untuk Tim Pengembangan MaintenApp.*
