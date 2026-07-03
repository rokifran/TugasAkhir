# WhatsApp Gateway Schema Sync & Personalization Plan

## Goal
Synchronize the `WhatsappGateway` and `WhatsappFonnte` services with the current Supabase database schema, introducing personalized, consistent, and professional Indonesian reminders.

## Context
- **Core Tables:** `maintenance`, `teknisi`, `client`, `maintenance_detail`, `kategori_perangkat`.
- **Key Relationships:** 
    - `maintenance` $\rightarrow$ `teknisi` (via `teknisi_id`)
    - `maintenance` $\rightarrow$ `client` (via `client_id`)
    - `maintenance` $\rightarrow$ `maintenance_detail` (via `maintenance_id`)
    - `maintenance_detail` $\rightarrow$ `kategori_perangkat` (via `kategori_perangkat_id`)

## Implementation Tasks

### 1. Refactor `WhatsappGateway/index.js`
- **`sendMaintenanceReminders` (Today):**
    - Update Supabase query to fetch `teknisi.nama` and the related `maintenance_detail` $\rightarrow$ `kategori_perangkat.nama_perangkat`.
    - Update message template to Indonesian: *"Halo [Nama Teknisi], jangan lupa ada maintenance hari ini di [Lokasi] untuk perangkat: [Daftar Perangkat]."*
- **`sendTomorrowMaintenanceReminders` (Tomorrow):**
    - Update Supabase query to fetch `teknisi.nama` and `client.nama`.
    - Update technician message: *"Halo [Nama Teknisi], jangan lupa ada maintenance besok di [Lokasi] untuk perangkat: [Daftar Perangkat]."*
    - Update client message: *"Halo [Nama Client], kami menginformasikan bahwa akan ada jadwal maintenance besok di lokasi Anda. Mohon kesediaannya."*

### 2. Restore & Sync `WhatsappFonnte`
- **`netlify/functions/remind-today.js`:**
    - Restore handler logic.
    - Implement the same query logic and personalized Indonesian templates used in `WhatsappGateway`.
- **`netlify/functions/remind-tomorrow.js`:**
    - Restore handler logic.
    - Implement the same query logic and personalized Indonesian templates used in `WhatsappGateway`.

## Validation Plan
- **Schema Verification:** Ensure all joins correctly reference the defined foreign keys in the `public` schema.
- **Message Audit:** Verify that `nama`, `kode_lokasi`, and `nama_perangkat` are correctly interpolated into the Indonesian strings.
- **Robustness Check:** Confirm that the code handles cases where `nama` or `kontak` might be missing without crashing.
- **Formatting Check:** Ensure `formatPhoneNumber` utility continues to produce valid WhatsApp IDs (`62... @c.us`).
