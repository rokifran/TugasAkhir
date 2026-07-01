# Rekomendasi Skema Database Baru (Di-Normalisasi)

Dokumen ini berisi usulan skema database baru untuk proyek **DSComputerProject** di Supabase. Skema ini dirancang untuk memperbaiki relasi yang sebelumnya terbalik pada tabel transaksi, sehingga mendukung pencatatan satu maintenance dengan banyak perangkat, serta satu perangkat dengan banyak foto bukti.

---

## Perbandingan Perubahan Utama

| Aspek | Skema Lama | Skema Baru (Direkomendasikan) | Alasan |
| :--- | :--- | :--- | :--- |
| **Relasi Detail** | `maintenance` menyimpan FK `maintenance_detail` | `maintenance_detail` menyimpan FK `maintenance_id` | Mengubah relasi dari One-to-One menjadi **One-to-Many**. Satu kali kunjungan maintenance sekarang bisa memeriksa banyak perangkat sekaligus. |
| **Relasi Foto** | `maintenance_detail` menyimpan FK `maintenance_photo` | `maintenance_photos` menyimpan FK `maintenance_detail_id` | Mengubah relasi dari One-to-One menjadi **One-to-Many**. Satu temuan kerusakan perangkat sekarang bisa didokumentasikan dengan banyak foto (sebelum/sesudah). |
| **Penamaan FK** | `teknisi`, `client`, `kategori_perangkat`, `maintenance_photo` | `teknisi_id`, `client_id`, `kategori_perangkat_id`, `maintenance_detail_id` | Mengikuti *best practice* penamaan database agar lebih eksplisit mana kolom data biasa dan mana kolom Foreign Key. |

---

## Ringkasan Relasi (ERD Sederhana)
- **`users`** (1) <--- (0..1) **`teknisi`** (`user_id` -> `id`)
- **`teknisi`** (1) <--- (0..*) **`maintenance`** (`teknisi_id` -> `id`)
- **`client`** (1) <--- (0..*) **`maintenance`** (`client_id` -> `id`)
- **`maintenance`** (1) <--- (0..*) **`maintenance_detail`** (`maintenance_id` -> `id`)
- **`kategori_perangkat`** (1) <--- (0..*) **`maintenance_detail`** (`kategori_perangkat_id` -> `id`)
- **`maintenance_detail`** (1) <--- (0..*) **`maintenance_photos`** (`maintenance_detail_id` -> `id`)

### Diagram ERD Baru

```mermaid
erDiagram
    users {
        uuid id PK
        text username
        text role
        timestamp created_at
        boolean is_active
    }
    teknisi {
        uuid id PK
        text nama
        text kontak
        text kode_lokasi
        uuid user_id FK
        timestamp created_at
    }
    client {
        uuid id PK
        text nama
        text kontak
        text kode_lokasi
        timestamp created_at
    }
    kategori_perangkat {
        bigint id PK
        text kategori
        text nama_perangkat
        timestamp created_at
    }
    maintenance {
        bigint id PK
        date tanggal_maintenance
        uuid teknisi_id FK
        uuid client_id FK
        boolean status
        text kode_lokasi
        timestamp created_at
    }
    maintenance_detail {
        uuid id PK
        bigint maintenance_id FK
        bigint kategori_perangkat_id FK
        text catatan_kerusakan
        timestamp created_at
    }
    maintenance_photos {
        uuid id PK
        uuid maintenance_detail_id FK
        text photo_url
        timestamp created_at
    }

    users ||--o| teknisi : "user_id"
    teknisi ||--o{ maintenance : "teknisi_id"
    client ||--o{ maintenance : "client_id"
    maintenance ||--o{ maintenance_detail : "maintenance_id"
    kategori_perangkat ||--o{ maintenance_detail : "kategori_perangkat_id"
    maintenance_detail ||--o{ maintenance_photos : "maintenance_detail_id"
```

---

## Detail Tabel Rekomendasi

### 1. `users`
Tabel untuk menyimpan data pengguna sistem dan kredensial/role dasar (tidak ada perubahan).

| Nama Kolom | Tipe Data | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **`id`** 🔑 | `uuid` | NO | | Primary Key |
| `username` | `text` | NO | | |
| `role` | `text` | NO | | |
| `created_at` | `timestamp with time zone` | YES | `now()` | |
| `is_active` | `boolean` | YES | `true` | |

---

### 2. `teknisi`
Tabel informasi data teknisi (tidak ada perubahan struktural).

| Nama Kolom | Tipe Data | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **`id`** 🔑 | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `nama` | `text` | NO | | |
| `kontak` | `text` | NO | | |
| `kode_lokasi` | `text` | YES | | |
| `user_id` 🔗 | `uuid` | YES | | Foreign Key -> `users.id` |
| `created_at` | `timestamp with time zone` | NO | `now()` | |

---

### 3. `client`
Tabel data pelanggan/klien (tidak ada perubahan struktural).

| Nama Kolom | Tipe Data | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **`id`** 🔑 | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `nama` | `text` | NO | | |
| `kontak` | `text` | NO | | |
| `kode_lokasi` | `text` | YES | | |
| `created_at` | `timestamp with time zone` | NO | `now()` | |

---

### 4. `kategori_perangkat`
Tabel referensi kategori dan nama perangkat keras/lunak (tidak ada perubahan struktural).

| Nama Kolom | Tipe Data | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **`id`** 🔑 | `bigint` | NO | | Primary Key |
| `kategori` | `text` | NO | | |
| `nama_perangkat` | `text` | NO | | |
| `created_at` | `timestamp with time zone` | YES | `now()` | |

---

### 5. `maintenance`
Tabel transaksi utama untuk jadwal dan status kegiatan maintenance.

> [!NOTE]
> Kolom `maintenance_detail` dihapus karena relasi diubah menjadi One-to-Many (diatur di tabel detail). Nama kolom FK diperjelas dengan akhiran `_id`.

| Nama Kolom | Tipe Data | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **`id`** 🔑 | `bigint` | NO | | Primary Key |
| `tanggal_maintenance` | `date` | NO | | |
| `teknisi_id` 🔗 | `uuid` | YES | | Foreign Key -> `teknisi.id` |
| `client_id` 🔗 | `uuid` | YES | | Foreign Key -> `client.id` |
| `status` | `boolean` | NO | `false` | Status pengerjaan (selesai/belum) |
| `kode_lokasi` | `text` | YES | | |
| `created_at` | `timestamp with time zone` | NO | `now()` | |

---

### 6. `maintenance_detail`
Detail teknis temuan kerusakan per perangkat saat maintenance.

> [!NOTE]
> Menambahkan kolom `maintenance_id` agar tabel ini berelasi Many-to-One dengan tabel `maintenance`. Kolom `maintenance_photo` dihapus dari tabel ini.

| Nama Kolom | Tipe Data | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **`id`** 🔑 | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `maintenance_id` 🔗 | `bigint` | NO | | Foreign Key -> `maintenance.id` |
| `kategori_perangkat_id` 🔗 | `bigint` | NO | | Foreign Key -> `kategori_perangkat.id` |
| `catatan_kerusakan` | `text` | YES | | Catatan temuan kerusakan |
| `created_at` | `timestamp with time zone` | YES | `now()` | |

---

### 7. `maintenance_photos`
Foto pendukung temuan kerusakan atau bukti pekerjaan maintenance.

> [!NOTE]
> Menambahkan kolom `maintenance_detail_id` agar tabel ini berelasi Many-to-One dengan tabel `maintenance_detail`, sehingga satu detail temuan bisa memiliki banyak foto.

| Nama Kolom | Tipe Data | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **`id`** 🔑 | `uuid` | NO | `gen_random_uuid()` | Primary Key |
| `maintenance_detail_id` 🔗 | `uuid` | NO | | Foreign Key -> `maintenance_detail.id` |
| `photo_url` | `text` | NO | | URL file foto di storage |
| `created_at` | `timestamp with time zone` | YES | `now()` | |
