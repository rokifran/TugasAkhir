# Refine Photo Upload Functionality in Teknisi Dashboard

## Context
The current photo upload implementation in `Dashboard/app/pages/teknisi-dashboard.vue` uses a global loading state and lacks file validation, leading to a poor user experience when uploading multiple photos and potential storage issues.

## Goals
- Implement per-item loading states for photo uploads.
- Add client-side file validation (size and type).
- Improve error handling and user feedback.

## Implementation Steps

### 1. State Management Changes
- Rename `uploadLoading` (boolean) to `uploadingDetails` (reactive object/ref) to track loading state per `detailId`.
  - `const uploadingDetails = ref({})`

### 2. Update `handleFileUpload` Logic
- Clear `errorMsg` at the start of the function.
- Add file validation:
  - Max size: 5MB.
  - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`.
  - If validation fails, set `errorMsg` and return early.
- Manage per-item loading state:
  - Set `uploadingDetails.value[detailId] = true` before starting the upload process.
  - Use a `finally` block to set `uploadingDetails.value[detailId] = false`.
- Keep existing Supabase Storage and Database insertion logic.

### 3. Template Updates
- Update the "Upload Bukti" button:
  - Change `:disabled="uploadLoading"` to `:disabled="uploadingDetails[detail.id]"`.
  - Change the spinner condition `v-if="uploadLoading"` to `v-if="uploadingDetails[detail.id]"`.

## Validation Plan
- Verify that clicking "Upload Bukti" only shows the loading spinner for that specific item.
- Test uploading a file larger than 5MB to ensure it's rejected with an error message.
- Test uploading non-image files (if possible via browser) to ensure they are rejected.
- Verify that successful uploads correctly update the UI and the `maintenance_photos` table.
- Ensure `errorMsg` is correctly displayed and cleared on subsequent attempts.
