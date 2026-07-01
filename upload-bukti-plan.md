# Implementation Plan: Upload Bukti Functionality

## Goal
Implement and ensure the complete end-to-end functionality for the "upload bukti" (upload evidence) feature in the Technician Dashboard.

## Current Status
The frontend implementation in `Dashboard/app/pages/teknisi-dashboard.vue` is already present and includes:
- File validation (size and type).
- Per-detail loading states.
- Supabase Storage upload logic.
- Database record insertion.
- UI refresh upon success.

However, the backend infrastructure (Storage and Database RLS) needs verification and configuration to support this.

## Implementation Steps

### Phase 1: Supabase Storage Infrastructure
1. **Bucket Verification**: Ensure a storage bucket named `maintenance-photos` exists.
2. **Public Access**: Set the `maintenance-photos` bucket to **Public** to allow the generated `publicUrl` to be viewed by users.
3. **Storage RLS Policies**:
   - **INSERT**: Create a policy to allow `authenticated` users to upload files to the `photos/` directory.
   - **SELECT**: Create a policy to allow `public` (or `authenticated`) access to read files in the `photos/` directory.

### Phase 2: Database Security (RLS)
1. **Table**: `maintenance_photos`.
2. **RLS Enablement**: Ensure Row Level Security is enabled on the `maintenance_photos` table.
3. **RLS Policies**:
   - **INSERT**: Create a policy allowing `authenticated` users to insert new records into `maintenance_photos`.
   - **SELECT**: Create a policy allowing `authenticated` users to select records, ideally filtered by their `teknisi_id` (via joining `maintenance_detail` -> `maintenance`).

### Phase 3: Frontend Verification & Refinement
1. **Verify File Upload**: Test the upload flow in the UI to ensure files are correctly stored in the bucket and the database record is created.
2. **Verify Image Display**: Confirm that the "Lihat Foto" (View Photo) links correctly open the stored image using the `publicUrl`.
3. **Refinement (Optional)**:
   - Improve error messaging for specific storage errors.
   - Implement a toast notification for successful uploads instead of just a silent refresh.

## Files Affected
- `Dashboard/app/pages/teknisi-dashboard.vue` (Verification/Refinement)
- Supabase Storage Configuration (Infrastructure)
- Supabase Database RLS (Security)
