# Database Schema Documentation

This document describes the database schema for the Maintenance Management System.

## Entity Relationship Overview

The system manages maintenance schedules, technician assignments, client information, and detailed records of device maintenance including photos.

## Tables

### 1. `users`
Stores system user accounts and their roles.
- **Columns**:
  - `id` (uuid, PK): Unique identifier for the user. Linked to `auth.users`.
  - `username` (text, Unique): User's unique username.
  - `role` (text): User role. Must be either `'Admin'` or `'Teknisi'`.
  - `created_at` (timestamptz): Account creation timestamp.
  - `is_active` (boolean): Status of the account.

### 2. `teknisi`
Contains detailed information about technicians.
- **Columns**:
  - `id` (uuid, PK): Unique identifier for the technician.
  - `created_at` (timestamptz): Record creation timestamp.
  - `nama` (text): Technician's name.
  - `kontak` (text): Contact information.
  - `kode_lokasi` (text): Location code associated with the technician.
  - `user_id` (uuid, FK): Link to the `users` table.

### 3. `client`
Stores client or customer information.
- **Columns**:
  - `id` (uuid, PK): Unique identifier for the client.
  - `created_at` (timestamptz): Record creation timestamp.
  - `nama` (text): Client's name.
  - `kontak` (text): Contact information.
  - `kode_lokasi` (text): Location code associated with the client.

### 4. `maintenance`
Tracks maintenance schedules and assignments.
- **Columns**:
  - `id` (bigint, PK): Unique identifier for the maintenance record.
  - `created_at` (timestamptz): Record creation timestamp.
  - `tanggal_maintenance` (date): Scheduled date for maintenance.
  - `teknisi_id` (uuid, FK): Technician assigned to this task. Links to `teknisi.id`.
  - `client_id` (uuid, FK): Client receiving the maintenance. Links to `client.id`.
  - `status` (boolean): Completion status of the maintenance.
  - `kode_lokasi` (text): Location code where maintenance occurs.

### 5. `kategori_perangkat`
Defines categories of devices that can be maintained.
- **Columns**:
  - `id` (bigint, PK): Unique identifier for the category.
  - `kategori` (text): Category name.
  - `nama_perangkat` (text): Name of the device.
  - `created_at` (timestamptz): Record creation timestamp.

### 6. `maintenance_detail`
Detailed logs for specific devices within a maintenance visit.
- **Columns**:
  - `id` (uuid, PK): Unique identifier for the detail record.
  - `maintenance_id` (bigint, FK): The parent maintenance visit. Links to `maintenance.id`.
  - `kategori_perangkat_id` (bigint, FK): The device category. Links to `kategori_perangkat.id`.
  - `catatan_kerusakan` (text): Description of the issue or damage found.
  - `created_at` (timestamptz): Record creation timestamp.

### 7. `maintenance_photos`
Stores photographic evidence/documentation for maintenance details.
- **Columns**:
  - `id` (uuid, PK): Unique identifier for the photo record.
  - `maintenance_detail_id` (uuid, FK): The specific maintenance detail this photo belongs to. Links to `maintenance_detail.id`.
  - `photo_url` (text): URL to the stored image.
  - `created_at` (timestamptz): Record creation timestamp.

## Relationships Summary

| Table | Column | Reference | Relationship |
| :--- | :--- | :--- | :--- |
| `teknisi` | `user_id` | `users.id` | Many-to-One |
| `maintenance` | `teknisi_id` | `teknisi.id` | Many-to-One |
| `maintenance` | `client_id` | `client.id` | Many-to-One |
| `maintenance_detail` | `maintenance_id` | `maintenance.id` | Many-to-One |
| `maintenance_detail` | `kategori_perangkat_id` | `kategori_perangkat.id` | Many-to-One |
| `maintenance_photos` | `maintenance_detail_id` | `maintenance_detail.id` | Many-to-One |
