# MaintenApp - Sistem Informasi Penjadwalan & Pengingat Maintenance Berbasis WhatsApp

MaintenApp adalah sistem manajemen penjadwalan pemeliharaan (*maintenance*) dan penugasan teknisi yang dilengkapi dengan fitur pengingat (*reminder*) otomatis melalui WhatsApp kepada teknisi dan klien. 

Proyek ini dibangun untuk kebutuhan **Tugas Akhir** dan dirancang dengan arsitektur terpisah (modular) yang terdiri dari Dashboard Web, Serverless Whatsapp Gateway (Fonnte), dan Self-Hosted Whatsapp Gateway.

---

## 🏗️ Struktur Arsitektur Proyek

Proyek ini dibagi menjadi 3 direktori utama:

1. **`Dashboard/`**: Web Panel interaktif untuk admin yang berfungsi melakukan manajemen data (CRUD) teknisi, klien, serta jadwal pemeliharaan secara mudah.
2. **`WhatsappFonnte/`**: Layanan pengingat berbasis *Serverless Functions* (di-deploy ke Netlify) yang menggunakan API gateway berbayar dari **Fonnte** untuk pengiriman WhatsApp.
3. **`WhatsappGateway/`**: Layanan pengingat berbasis *Self-Hosted* (menggunakan library **whatsapp-web.js** / Puppeteer) yang dapat dijalankan secara lokal atau di VPS untuk mengirim pesan WhatsApp secara gratis tanpa biaya API.

---

## 🗄️ Skema Database (Supabase)

Sistem ini menggunakan **Supabase** sebagai database utama dengan relasi antar tabel sebagai berikut:

### 1. Tabel `teknisi`
Menyimpan informasi data teknisi yang bertugas melakukan maintenance.
*   `id` (int8, Primary Key)
*   `created_at` (timestamptz)
*   `nama` (text)
*   `kontak` (text) - Nomor telepon/WhatsApp teknisi (format lokal seperti `08xxx` atau internasional).

### 2. Tabel `client`
Menyimpan informasi data klien/pelanggan yang lokasinya akan dilakukan maintenance.
*   `id` (int8, Primary Key)
*   `created_at` (timestamptz)
*   `nama` (text)
*   `kontak` (text) - Nomor telepon/WhatsApp klien.

### 3. Tabel `maintenance`
Tabel utama penjadwalan maintenance yang berelasi dengan tabel teknisi dan client.
*   `id` (int8, Primary Key)
*   `created_at` (timestamptz)
*   `status` (boolean) - Status penyelesaian (Pending = `false`, Completed = `true`).
*   `teknisi` (int8, Foreign Key ke `teknisi.id`)
*   `client` (int8, Foreign Key ke `client.id`)
*   `kode_lokasi` (text) - Kode atau alamat lokasi dilaksanakannya maintenance.
*   `tanggal_maintenance` (date) - Tanggal pelaksanaan maintenance.

---

## 📱 Logika Sistem Notifikasi Pengingat (Reminder)

Notifikasi WhatsApp dikirim secara terjadwal menggunakan zona waktu **WITA (Asia/Makassar / UTC+8)** dengan ketentuan sebagai berikut:

### 1. Pengingat H-1 (Maintenance Besok)
*   **Waktu Eksekusi**: Setiap hari pada pukul **08.00 WITA** (00:00 UTC).
*   **Penerima**: Teknisi & Client.
*   **Pesan untuk Teknisi**: `Dont forget there is a maintenance tomorow on [kode_lokasi]`
*   **Pesan untuk Client**: `Dont forget there is a maintenance tomorow`

### 2. Pengingat Hari H (Maintenance Hari Ini)
*   **Waktu Eksekusi**: Setiap hari pada pukul **03.00 WITA** (19:00 UTC hari sebelumnya).
*   **Penerima**: Hanya Teknisi.
*   **Pesan untuk Teknisi**: `Dont forget there is a maintenance today on [kode_lokasi]`

---

## 🛠️ Penjelasan Modul & Teknologi

### 1. Dashboard Web (`Dashboard/`)
Aplikasi web responsif bergaya modern dengan fitur Dark Mode.
*   **Teknologi**: Nuxt 4, Nuxt UI, TailwindCSS, `@nuxtjs/supabase` (Auth & Database).
*   **Fitur**:
    *   Autentikasi (Sign In / Sign Out) bagi admin.
    *   Tabel interaktif data Maintenance, Teknisi, dan Client.
    *   Modal form untuk menambah, mengubah (Edit), dan menghapus (Delete) data.
    *   Integrasi klik langsung untuk chat ke WhatsApp teknisi/client menggunakan link `wa.me`.
    *   Pagination & Sorting berdasarkan status dan tanggal maintenance.

### 2. Whatsapp Fonnte (`WhatsappFonnte/`)
Solusi pengingat otomatis serverless yang andal.
*   **Teknologi**: Node.js, `@netlify/functions` (Netlify Background Functions/Scheduled Jobs), Axios.
*   **Keunggulan**: Mudah di-deploy ke Netlify tanpa perlu server aktif 24 jam. Cron scheduler diatur langsung lewat Netlify.
*   **Kebutuhan**: Memerlukan akun dan token Fonnte aktif.

### 3. Whatsapp Gateway (`WhatsappGateway/`)
Solusi gateway WhatsApp independen yang hemat biaya.
*   **Teknologi**: Node.js, `whatsapp-web.js`, Puppeteer (Headless Browser), `node-cron`.
*   **Cara Kerja**: Menjalankan instansi Google Chrome di latar belakang, memindai QR code via terminal untuk login ke akun WhatsApp fisik, dan berjalan terus-menerus (*daemon*) di server/lokal.
*   **Kebutuhan**: Server lokal atau VPS (Ubuntu/Linux) yang selalu menyala.

---

## 🚀 Panduan Instalasi & Penggunaan

### Prasyarat
*   Node.js versi 18+ terinstal.
*   Akun Supabase (untuk database & autentikasi).
*   Akun Fonnte (opsional, jika menggunakan modul `WhatsappFonnte`).
*   Nomor WhatsApp aktif untuk discan (jika menggunakan modul `WhatsappGateway`).

### 1. Jalankan Dashboard Web
1. Masuk ke direktori `Dashboard`:
   ```bash
   cd Dashboard
   ```
2. Instal dependensi:
   ```bash
   npm install
   ```
3. Konfigurasi file `.env` di dalam folder `Dashboard/`:
   ```env
   SUPABASE_URL=https://<project-id>.supabase.co
   SUPABASE_KEY=<your-anon-or-service-role-key>
   ```
4. Jalankan development server:
   ```bash
   npm run dev
   ```
5. Buka `http://localhost:3000` pada browser Anda.

### 2. Jalankan Whatsapp Gateway (Self-Hosted)
1. Masuk ke direktori `WhatsappGateway`:
   ```bash
   cd WhatsappGateway
   ```
2. Instal dependensi:
   ```bash
   npm install
   ```
3. Konfigurasi file `.env` di dalam folder `WhatsappGateway/`:
   ```env
   SUPABASE_URL=https://<project-id>.supabase.co
   SUPABASE_KEY=<your-service-role-key>
   ```
4. Jalankan aplikasi:
   ```bash
   node index.js
   ```
5. Scan QR code yang muncul di terminal menggunakan aplikasi WhatsApp di ponsel Anda (Settings -> Linked Devices -> Link a Device).

### 3. Deploy Whatsapp Fonnte (Netlify Serverless)
1. Masuk ke direktori `WhatsappFonnte`:
   ```bash
   cd WhatsappFonnte
   ```
2. Instal dependensi:
   ```bash
   npm install
   ```
3. Konfigurasi file `.env` untuk pengujian lokal:
   ```env
   SUPABASE_URL=https://<project-id>.supabase.co
   SUPABASE_KEY=<your-service-role-key>
   FONNTE_TOKEN=<your-fonnte-token>
   ```
4. Untuk mendeploy ke Netlify, instal Netlify CLI (`npm install -g netlify-cli`), jalankan `netlify login`, lalu deploy dengan `netlify deploy --prod`.
5. Pastikan Environment Variables di atas diatur di dashboard Netlify Settings agar fungsi cron dapat berjalan dengan sukses.

---

## 🔒 Catatan Keamanan
*   Pastikan `SUPABASE_KEY` yang digunakan pada `WhatsappGateway` dan `WhatsappFonnte` menggunakan kunci `service_role` agar memiliki akses memotong kebijakan RLS (*Row Level Security*) saat membaca database secara backend. **Jangan pernah membagikan atau mempublikasikan kunci `service_role` Anda.**
*   Dashboard menggunakan kunci publik anonim (`anon` key) yang aman untuk diekspos di sisi client.

---
*Dibuat untuk kebutuhan Dokumentasi Tugas Akhir.*
