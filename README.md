# MaintenApp — Panduan Operasional

> **Versi:** 2.4.0 | **Stack:** Nuxt 4 + Supabase + WhatsApp Integration

Panduan ini mencakup instalasi, konfigurasi, dan deployment **MaintenApp** — sistem manajemen maintenance dengan notifikasi WhatsApp otomatis.

---

## Daftar Isi

- [Prasyarat Sistem](#prasyarat-sistem)
- [Struktur Proyek](#struktur-proyek)
- [Konfigurasi Environment Variables](#konfigurasi-environment-variables)
- [Menjalankan Dashboard (Nuxt)](#menjalankan-dashboard-nuxt)
- [Menjalankan WhatsApp Gateway](#menjalankan-whatsapp-gateway)
- [Deploy WhatsApp Fonnte (Netlify)](#deploy-whatsapp-fonnte-netlify)
- [Deploy Dashboard ke Production](#deploy-dashboard-ke-production)
- [Pembuatan User Awal](#pembuatan-user-awal)
- [Referensi Dokumentasi](#referensi-dokumentasi)

---

## Prasyarat Sistem

### Persyaratan Minimum

| Komponen | Spesifikasi |
|----------|-------------|
| **Node.js** | ≥ 18.x (direkomendasikan 22.x) |
| **npm** | ≥ 9.x |
| **OS** | Linux / macOS / WSL2 (Windows) |
| **RAM** | ≥ 2 GB (untuk Puppeteer/WhatsApp Gateway) |
| **Akun Supabase** | Gratis di [supabase.com](https://supabase.com) |

### Catatan untuk WSL (Windows Subsystem for Linux)

Jika menjalankan di WSL dengan working directory di `/mnt/...`:

```bash
# Hindari Exec format error (exit 126) akibat CRLF atau drvfs:
# Gunakan --ignore-scripts untuk instalasi, lalu fix line endings
npm install --ignore-scripts
sed -i 's/\r$//' node_modules/.bin/*
npm rebuild
```

> **Rekomendasi:** Salin project ke filesystem Linux native (`~/project/`) untuk performa terbaik.

---

## Struktur Proyek

```
TugasAkhir/
├── @Docs/                          # Dokumentasi lengkap (lihat referensi)
├── Dashboard/                      # Aplikasi Nuxt.js utama
│   ├── app/                        # Source code Vue/Nuxt
│   │   ├── pages/                  # Halaman aplikasi
│   │   ├── layouts/                # Layout (sidebar + navbar)
│   │   ├── middleware/              # Auth middleware
│   │   └── app.vue                 # Root component
│   ├── server/api/teknisi/         # Server routes (backend API)
│   ├── nuxt.config.ts              # Konfigurasi Nuxt
│   └── package.json                # Dependencies
├── WhatsappGateway/                # Service notifikasi (Puppeteer)
│   ├── index.js                    # Entry point + cron jobs
│   └── package.json
└── WhatsappFonnte/                 # Service notifikasi (Netlify)
    ├── netlify/functions/          # Scheduled functions
    └── package.json
```

---

## Konfigurasi Environment Variables

### 1. Dashboard (`.env` di folder `Dashboard/`)

Buat file `Dashboard/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIs...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...your-service-role-key
```

Cara mendapatkan kunci dari Supabase Dashboard:

| Key | Lokasi di Supabase |
|-----|--------------------|
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_KEY` | Project Settings → API → `anon` / `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` key (**rahasia, jangan bocor ke client!**) |

### 2. WhatsApp Gateway (`.env` di folder `WhatsappGateway/`)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIs...your-anon-key
```

### 3. WhatsApp Fonnte (Environment Variables di Netlify)

Set melalui Netlify Dashboard → Site settings → Environment variables:

| Variable | Nilai |
|----------|-------|
| `SUPABASE_URL` | URL Supabase project |
| `SUPABASE_KEY` | Anon key Supabase |
| `FONNTE_TOKEN` | Token API dari [Fonnte.com](https://fonnte.com) |

---

## Database Setup

1. Buka **Supabase Dashboard** → **SQL Editor**
2. Jalankan perintah DDL dari [`@Docs/03-Skema-Database.md`](./@Docs/03-Skema-Database.md#34-sql-ddl-ringkasan) untuk membuat tabel
3. Aktifkan **Row Level Security** di setiap tabel
4. Buat bucket storage `maintenance-photos` di Supabase Storage

---

## Menjalankan Dashboard (Nuxt)

### Development

```bash
cd Dashboard

# Install dependencies
npm install

# Jalankan dev server (http://localhost:3000)
npm run dev
```

### Testing

```bash
# Jalankan test suite
npx vitest

# Atau dengan coverage
npx vitest --coverage
```

### Build & Preview

```bash
# Build untuk production
npm run build

# Preview hasil build
npm run preview
```

---

## Menjalankan WhatsApp Gateway

Service ini menggunakan **Puppeteer/Chrome** untuk mengontrol WhatsApp Web.

> **Catatan:** Di lingkungan server/headless, pastikan Chromium terinstall. Puppeteer biasanya mengunduh Chromium sendiri saat `npm install`.

```bash
cd WhatsappGateway

# Install dependencies
npm install

# Jalankan service
npm start
```

### Proses Initial Setup

1. Jalankan `npm start`
2. Akan muncul **QR Code** di terminal
3. Buka WhatsApp di ponsel → **Settings** → **Linked Devices** → **Link a Device**
4. Scan QR Code yang muncul di terminal
5. Session akan tersimpan di folder `.wwebjs_auth/session/` (persistent)

### Cron Schedule

| Jadwal (WITA) | Fungsi | Keterangan |
|---------------|--------|------------|
| 03:00 (daily) | Reminder H+0 | Maintenance hari ini → Teknisi |
| 08:00 (daily) | Reminder H+1 | Maintenance besok → Teknisi + Klien |

---

## Deploy WhatsApp Fonnte (Netlify)

Fungsi ini berjalan sebagai **Netlify Scheduled Functions** (serverless).

### Langkah-langkah:

1. **Push ke GitHub** (atau Git provider lain)
2. Buka [Netlify Dashboard](https://app.netlify.com) → **Add new site** → **Import from Git**
3. Pilih repository, set:
   - **Base directory:** `WhatsappFonnte`
   - **Build command:** (kosongkan)
   - **Publish directory:** (kosongkan)
4. Set **Environment Variables** di Netlify:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `FONNTE_TOKEN`
5. Deploy

### Verifikasi

Fungsi akan berjalan otomatis sesuai jadwal:
- `remind-today`: 19:00 UTC (03:00 WITA) — Maintenance hari ini
- `remind-tomorrow`: 00:00 UTC (08:00 WITA) — Maintenance besok

Cek log di Netlify Dashboard → Functions → Function name → Logs.

---

## Deploy Dashboard ke Production

### Opsi 1: Node.js Server (VPS/Cloud)

```bash
cd Dashboard

# Build
npm run build

# Jalankan dengan PM2 (recommended)
npm install -g pm2
pm2 start .output/server/index.mjs --name maintenapp
pm2 save
pm2 startup
```

Aplikasi akan berjalan di port **3000** secara default. Gunakan reverse proxy (Nginx/Caddy) untuk production:

```nginx
# Contoh Nginx reverse proxy
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Opsi 2: Docker

Buat `Dashboard/Dockerfile`:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

Build dan jalankan:

```bash
docker build -t maintenapp Dashboard/
docker run -d -p 3000:3000 --env-file Dashboard/.env maintenapp
```

### Opsi 3: Platform as a Service (PaaS)

**Vercel / Netlify / Railway / Render:**

- Set build command: `npm run build`
- Set publish directory: `.output/public`
- Set environment variables di dashboard platform
- Untuk Node.js render: entry point `.output/server/index.mjs`

---

## Pembuatan User Awal

Sebelum aplikasi bisa digunakan, Anda perlu membuat user Admin dan Teknisi.

### Metode 1: Script CLI

```bash
cd Dashboard

# Edit file create_user.js — ganti email/password sesuai kebutuhan
# Jalankan script
node create_user.js
```

Script akan membuat user di Supabase Auth + tabel `users`.

### Metode 2: Supabase Dashboard

1. Buka **Supabase Dashboard** → **Authentication** → **Users** → **Invite user**
2. Masukkan email, password akan dikirim via email
3. Setelah user login, insert role ke tabel `users`:
   - Buka **SQL Editor** → jalankan:
   ```sql
   INSERT INTO public.users (id, username, role)
   VALUES ('user-uuid-from-auth', 'admin', 'Admin');
   ```

### Metode 3: Via Server Route

Buat request POST ke endpoint admin (jika sudah ada):

```bash
curl -X POST http://localhost:3000/api/teknisi/create \
  -H "Content-Type: application/json" \
  -d '{
    "nama": "Admin Utama",
    "email": "admin@example.com",
    "password": "password123",
    "kontak": "081234567890",
    "kode_lokasi": "LOK-001"
  }'
```

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `Exec format error` (exit 126) | WSL drvfs issue. Gunakan `--ignore-scripts` + `sed` fix, atau pindah ke Linux native. |
| `Cannot find module @supabase/supabase-js` | Jalankan `npm install` di folder yang benar. |
| QR Code tidak muncul di WhatsApp Gateway | Hapus folder `.wwebjs_auth/session/` lalu restart. |
| `FONNTE_TOKEN is not set` | Set environment variable `FONNTE_TOKEN` di Netlify. |
| Foto gagal upload | Cek bucket `maintenance-photos` di Supabase Storage, pastikan ada dan RLS diizinkan. |
| Login gagal "Invalid login credentials" | Pastikan user sudah dibuat di Supabase Auth dan `email_confirm: true`. |
| Nuxt dev server error `Supabase is not defined` | Pastikan `.env` file ada dan berisi `SUPABASE_URL` dan `SUPABASE_KEY`. |

---

## Referensi Dokumentasi

Dokumentasi teknis lengkap tersedia di folder [`@Docs/`](./@Docs/):

| File | Isi |
|------|-----|
| [`@Docs/01-Arsitektur-Sistem.md`](./@Docs/01-Arsitektur-Sistem.md) | Arsitektur sistem, diagram komponen, teknologi, struktur direktori |
| [`@Docs/02-Cara-Kerja-Sistem.md`](./@Docs/02-Cara-Kerja-Sistem.md) | Alur bisnis: login, CRUD maintenance, dashboard teknisi, notifikasi |
| [`@Docs/03-Skema-Database.md`](./@Docs/03-Skema-Database.md) | ERD, detail tabel, tipe data, indeks, SQL DDL lengkap |
| [`@Docs/04-API-Endpoint-Dokumentasi.md`](./@Docs/04-API-Endpoint-Dokumentasi.md) | Server routes, client-side query patterns, integrasi eksternal |
| [`@Docs/05-Keamanan-Manajemen-State.md`](./@Docs/05-Keamanan-Manajemen-State.md) | Autentikasi, RLS, state management, error handling, checklist keamanan |
| [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) | Skema database (referensi awal — konten sudah diintegrasikan ke `@Docs/03`) |

---

*Dokumen ini diperbarui untuk Tim Pengembangan MaintenApp — 2026*