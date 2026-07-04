<script setup>
import { ref, onMounted, computed } from 'vue'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const roleState = useState('user-role')
const toast = useToast()

const searchQuery = useState('search-query', () => '')
const maintenanceRecords = ref([])

const filteredMaintenanceRecords = computed(() => {
  if (!searchQuery.value.trim()) {
    return maintenanceRecords.value
  }
  const q = searchQuery.value.toLowerCase().trim()
  return maintenanceRecords.value.filter(record => {
    const orderIdMatches = String(record.id).toLowerCase().includes(q)
    const kodeLokasiMatches = record.kode_lokasi ? String(record.kode_lokasi).toLowerCase().includes(q) : false
    const clientMatches = record.client?.nama ? String(record.client.nama).toLowerCase().includes(q) : false
    return orderIdMatches || kodeLokasiMatches || clientMatches
  })
})

const loading = ref(false)
const errorMsg = ref(null)
const uploadingDetails = ref({})

// Evidence Modal state
const evidenceModalOpen = ref(false)
const evidenceLoading = ref(false)
const evidencePhotos = ref([])

async function logout() {
  await supabase.auth.signOut()
  roleState.value = null
  navigateTo('/login')
}

async function fetchMaintenanceData() {
  // Gunakan fallback ke .sub karena JWT mengembalikan user ID di field 'sub', bukan 'id'
  const userId = user.value?.id || user.value?.sub
  if (!userId) return

  loading.value = true
  errorMsg.value = null
  try {
    // Step 1: Cari teknisi.id berdasarkan user_id (auth UUID)
    // karena maintenance.teknisi_id menyimpan teknisi.id, bukan auth UUID
    const { data: teknisiData, error: teknisiError } = await supabase
      .from('teknisi')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (teknisiError) throw teknisiError
    if (!teknisiData) {
      errorMsg.value = 'Data teknisi tidak ditemukan untuk akun ini.'
      return
    }

    // Step 2: Query maintenance menggunakan teknisi.id yang benar
    const { data, error } = await supabase
      .from('maintenance')
      .select('*, client:client_id(*), maintenance_detail(*, kategori_perangkat:kategori_perangkat_id(*), maintenance_photos(*))')
      .eq('teknisi_id', teknisiData.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    maintenanceRecords.value = data || []
  } catch (error) {
    errorMsg.value = error.message
  } finally {
    loading.value = false
  }
}

async function compressImage(file, quality = 0.8) {
  const MAX_SIZE = 500 * 1024 // 500KB
  const MAX_WIDTH = 1920
  const MAX_HEIGHT = 1080

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = async () => {
        let width = img.width
        let height = img.height

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width > height) {
            height = Math.round((height * MAX_WIDTH) / width)
            width = MAX_WIDTH
          } else {
            width = Math.round((width * MAX_HEIGHT) / height)
            height = MAX_HEIGHT
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        const processBlob = (q) => {
          return new Promise((resolveBlob) => {
            canvas.toBlob((blob) => resolveBlob(blob), 'image/jpeg', q)
          })
        }

        let currentQuality = quality
        let blob = await processBlob(currentQuality)

        while (blob.size > MAX_SIZE && currentQuality > 0.1) {
          currentQuality -= 0.1
          blob = await processBlob(currentQuality)
        }

        resolve(blob)
      }
      img.onerror = () => reject(new Error('Gagal memuat gambar untuk kompresi'))
    }
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'))
  })
}

async function handleFileUpload(maintenanceId, detailId, event) {

  const files = Array.from(event.target.files)
  if (files.length === 0) return

  errorMsg.value = null
  uploadingDetails.value[detailId] = true

  const maxSize = 5 * 1024 * 1024 // 5MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  
  let successCount = 0
  let failureCount = 0

  try {
    for (const file of files) {
      try {
        // File Validation
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`File ${file.name} tipe tidak didukung`)
        }
        if (file.size > maxSize) {
          throw new Error(`File ${file.name} terlalu besar (Maks 5MB)`)
        }

        // Image Compression
        let uploadBlob = file
        try {
          uploadBlob = await compressImage(file)
        } catch (compError) {
          throw new Error(`Gagal mengompres gambar ${file.name}: ${compError.message}`)
        }

        const fileName = `${maintenanceId}-${detailId}-${Math.random().toString(36).substring(2)}-${Date.now()}-${successCount + failureCount}.jpg`
        const filePath = `photos/${fileName}`

        // Upload to Storage
        const { error: uploadError } = await supabase.storage
          .from('maintenance-photos')
          .upload(filePath, uploadBlob)

        if (uploadError) throw uploadError


        const { data: { publicUrl } } = supabase.storage
          .from('maintenance-photos')
          .getPublicUrl(filePath)

        // Insert to DB
        const { error: updateError } = await supabase
          .from('maintenance_photos')
          .insert({ maintenance_detail_id: detailId, photo_url: publicUrl })

        if (updateError) throw updateError
        
        successCount++
      } catch (fileError) {
        console.error(`Error uploading ${file.name}:`, fileError)
        failureCount++
        toast.add({
          title: 'Gagal Unggah',
          description: fileError.message,
          color: 'red'
        })
      }
    }

    if (successCount > 0) {
      toast.add({
        title: 'Berhasil',
        description: `${successCount} bukti foto berhasil diunggah`,
        color: 'green'
      })
      await fetchMaintenanceData()
    }
  } catch (globalError) {
    errorMsg.value = globalError.message
  } finally {
    uploadingDetails.value[detailId] = false
    // Reset input value so same files can be selected again if needed
    event.target.value = ''
  }
}

const totalTasksCount = computed(() => maintenanceRecords.value.length)
const pendingTasksCount = computed(() => maintenanceRecords.value.filter(r => !r.status).length)
const completedTasksCount = computed(() => maintenanceRecords.value.filter(r => r.status).length)

async function markAsCompleted(record) {
  loading.value = true
  try {
    const { error } = await supabase
      .from('maintenance')
      .update({ status: true })
      .eq('id', record.id)
    if (error) throw error
    await fetchMaintenanceData()
  } catch (error) {
    errorMsg.value = error.message
  } finally {
    loading.value = false
  }
}

async function openEvidenceModal(record) {
  evidencePhotos.value = []
  evidenceModalOpen.value = true
  evidenceLoading.value = true

  try {
    const detailIds = record.maintenance_detail?.map(d => d.id) || []
    if (detailIds.length === 0) {
      evidencePhotos.value = []
      return
    }

    const { data, error } = await supabase
      .from('maintenance_photos')
      .select('id, photo_url')
      .in('maintenance_detail_id', detailIds)

    if (error) throw error
    evidencePhotos.value = data || []
  } catch (error) {
    console.error('[openEvidenceModal] catch:', error)
    evidencePhotos.value = []
  } finally {
    evidenceLoading.value = false
  }
}

const fullscreenPhoto = ref(null)
const fullscreenOpen = ref(false)

function openFullscreen(photoUrl) {
  fullscreenPhoto.value = photoUrl
  fullscreenOpen.value = true
  // Tutup sementara modal bukti agar Focus Trap tidak mencegat event klik pada fullscreen preview
  evidenceModalOpen.value = false
}

function closeFullscreen() {
  fullscreenPhoto.value = null
  fullscreenOpen.value = false
  // Buka kembali modal bukti setelah menutup fullscreen preview
  evidenceModalOpen.value = true
}

async function deletePhoto(photoId, photoUrl) {
  if (!confirm('Apakah Anda yakin ingin menghapus foto ini?')) {
    return
  }
  
  try {
    // 1. Delete from database first, adding .select() to verify if it actually deleted a row
    const { data: deletedData, error: dbError } = await supabase
      .from('maintenance_photos')
      .delete()
      .eq('id', photoId)
      .select()
      
    if (dbError) throw dbError
    
    // Supabase silently returns success with 0 rows if RLS blocks the delete
    if (!deletedData || deletedData.length === 0) {
      throw new Error('Gagal menghapus data dari database. Pastikan RLS (Row Level Security) untuk DELETE diizinkan.')
    }
    
    // 2. Extract file path from URL (ignore query parameters and hash)
    const urlObj = new URL(photoUrl)
    const pathname = decodeURIComponent(urlObj.pathname) // e.g., /storage/v1/object/public/maintenance-photos/...
    
    // Find the part after the bucket name
    const pathParts = pathname.split('/')
    const bucketIndex = pathParts.indexOf('maintenance-photos')
    if (bucketIndex === -1) {
      throw new Error('Invalid photo URL: bucket not found')
    }
    const filePath = pathParts.slice(bucketIndex + 1).join('/')
    
    // 3. Delete from Supabase storage
    const { data: storageData, error: storageError } = await supabase.storage
      .from('maintenance-photos')
      .remove([filePath])
    
    if (storageError) throw storageError
    
    if (!storageData || storageData.length === 0) {
      console.warn('File storage mungkin sudah tidak ada atau terblokir RLS Storage')
    }
    
    // 4. Remove from local modal state
    evidencePhotos.value = evidencePhotos.value.filter(photo => photo.id !== photoId)
    
    // 5. Refresh main maintenance data to ensure dashboard state is synced
    await fetchMaintenanceData()
    
    toast.add({
      title: 'Berhasil',
      description: 'Foto dan data terkait berhasil dihapus',
      color: 'green'
    })
    
  } catch (error) {
    console.error('[deletePhoto] error:', error)
    toast.add({
      title: 'Gagal Menghapus',
      description: error.message || 'Terjadi kesalahan saat menghapus foto',
      color: 'red'
    })
  }
}

onMounted(() => {
  fetchMaintenanceData()
})
</script>

<template>
  <main class="flex-1 p-lg max-w-container-max mx-auto w-full bg-background font-body-md text-on-surface h-full">
    <!-- Dashboard Header Section -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-xl gap-md mt-6">
      <div>
        <h1 class="font-display text-display text-on-surface">Dashboard Teknisi</h1>
        <p class="text-secondary font-body-md mt-1">Kelola dan selesaikan tugas maintenance Anda hari ini.</p>
      </div>
      <div class="flex items-center gap-sm">
        <button @click="fetchMaintenanceData" class="flex items-center gap-sm px-lg py-sm bg-primary text-on-primary rounded-lg font-label-bold hover:brightness-105 transition-all shadow-sm active:scale-95">
          <span class="material-symbols-outlined text-[20px]">refresh</span>
          <span class="">Refresh Data</span>
        </button>
      </div>
    </div>

    <UAlert v-if="errorMsg" icon="i-heroicons-exclamation-triangle" color="red" variant="soft" :title="errorMsg" class="mb-6" />

    <!-- Stats Row -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-lg mb-xl">
      <div class="bg-surface-container-lowest p-lg rounded-2xl shadow-[0px_10px_32px_rgba(15,23,42,0.10)] border border-outline-variant relative overflow-hidden group">
        <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-primary-container"></div>
        <p class="text-secondary font-label-bold mb-base uppercase tracking-wider text-[10px]">Total Tugas</p>
        <div class="flex items-end gap-sm">
          <h3 class="text-3xl font-display font-bold text-on-surface">{{ totalTasksCount }}</h3>
        </div>
        <span class="material-symbols-outlined absolute -right-4 -bottom-4 text-7xl text-primary-container/10 group-hover:text-primary-container/20 transition-colors">task</span>
      </div>
      <div class="bg-surface-container-lowest p-lg rounded-2xl shadow-[0px_10px_32px_rgba(15,23,42,0.10)] border border-outline-variant relative overflow-hidden group">
        <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#EAB308]"></div>
        <p class="text-secondary font-label-bold mb-base uppercase tracking-wider text-[10px]">Tugas Pending</p>
        <div class="flex items-end gap-sm">
          <h3 class="text-3xl font-display font-bold text-on-surface">{{ pendingTasksCount }}</h3>
        </div>
        <span class="material-symbols-outlined absolute -right-4 -bottom-4 text-7xl text-[#EAB308]/10 group-hover:text-[#EAB308]/20 transition-colors">pending_actions</span>
      </div>
      <div class="bg-surface-container-lowest p-lg rounded-2xl shadow-[0px_10px_32px_rgba(15,23,42,0.10)] border border-outline-variant relative overflow-hidden group">
        <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-primary"></div>
        <p class="text-secondary font-label-bold mb-base uppercase tracking-wider text-[10px]">Selesai</p>
        <div class="flex items-end gap-sm">
          <h3 class="text-3xl font-display font-bold text-on-surface">{{ completedTasksCount }}</h3>
        </div>
        <span class="material-symbols-outlined absolute -right-4 -bottom-4 text-7xl text-primary/10 group-hover:text-primary/20 transition-colors">check_circle</span>
      </div>
    </div>

    <!-- Tasks Section -->
    <div class="space-y-md">
      <h3 class="font-headline-md text-[18px] text-on-surface mb-md">Tugas Aktif</h3>

      <div v-if="loading" class="flex flex-col items-center justify-center py-20 text-secondary">
        <span class="material-symbols-outlined text-[48px] animate-spin mb-4">autorenew</span>
        <p class="font-body-md">Memuat data tugas...</p>
      </div>

      <div v-else-if="maintenanceRecords.length === 0" class="text-center py-20 bg-surface-container-lowest rounded-2xl shadow-[0px_10px_32px_rgba(15,23,42,0.10)] border border-outline-variant">
        <span class="material-symbols-outlined text-[64px] text-surface-variant mb-4">assignment</span>
        <h2 class="text-xl font-bold text-on-surface mb-2">Tidak Ada Tugas</h2>
        <p class="text-secondary font-body-md">Anda belum memiliki tugas maintenance yang dijadwalkan.</p>
      </div>

      <div v-else-if="filteredMaintenanceRecords.length === 0" class="text-center py-20 bg-surface-container-lowest rounded-2xl shadow-[0px_10px_32px_rgba(15,23,42,0.10)] border border-outline-variant">
        <span class="material-symbols-outlined text-[64px] text-surface-variant mb-4">search_off</span>
        <h2 class="text-xl font-bold text-on-surface mb-2">Tugas Tidak Ditemukan</h2>
        <p class="text-secondary font-body-md">Tidak ada tugas maintenance yang cocok dengan pencarian Anda.</p>
      </div>

      <div v-else class="space-y-6">
        <div 
          v-for="record in filteredMaintenanceRecords" 
          :key="record.id"
          class="bg-surface-container-lowest rounded-2xl shadow-[0px_10px_32px_rgba(15,23,42,0.10)] border border-outline-variant overflow-hidden group hover:border-primary/50 transition-colors"
        >
          <!-- Card Header -->
          <div class="px-lg py-md border-b border-surface-variant flex flex-col md:flex-row md:items-center justify-between gap-md bg-surface-container-low/50">
            <div class="flex items-center gap-md">
              <div class="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-lg uppercase">
                {{ record.client?.nama?.substring(0, 2) || 'CL' }}
              </div>
              <div>
                <div class="flex items-center gap-sm mb-1">
                  <h4 class="font-headline-md text-[16px] text-on-surface">{{ record.client?.nama || 'Client Tidak Dikenal' }}</h4>
                  <span v-if="record.status" class="inline-flex items-center px-sm py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-label-bold border border-emerald-200 uppercase tracking-tighter">
                      <span class="w-1 h-1 rounded-full bg-emerald-500 mr-1.5"></span>
                      Completed
                    </span>
                    <span v-else class="inline-flex items-center px-sm py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-label-bold border border-amber-200 uppercase tracking-tighter">
                      <span class="w-1 h-1 rounded-full bg-amber-500 mr-1.5"></span>
                      Pending
                    </span>
                </div>
                <div class="flex flex-wrap items-center gap-md text-secondary text-[12px]">
                  <span class="flex items-center gap-xs">
                    <span class="material-symbols-outlined text-[14px]">tag</span>
                    #{{ record.id }}
                  </span>
                  <span class="flex items-center gap-xs">
                    <span class="material-symbols-outlined text-[14px]">location_on</span>
                    {{ record.kode_lokasi || '-' }}
                  </span>
                  <span class="flex items-center gap-xs">
                    <span class="material-symbols-outlined text-[14px]">calendar_today</span>
                    {{ record.tanggal_maintenance ? new Date(record.tanggal_maintenance).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Card Body -->
          <div class="p-lg">
            <h5 class="text-[11px] font-label-bold text-secondary uppercase tracking-widest mb-md">Detail Perangkat</h5>
            
            <div v-if="record.maintenance_detail && record.maintenance_detail.length > 0" class="space-y-sm mb-lg">
              <div 
                v-for="detail in record.maintenance_detail" 
                :key="detail.id"
                class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-md rounded-2xl border border-surface-variant bg-surface-container-lowest hover:bg-surface-container-low transition-colors gap-4 relative overflow-hidden"
              >
                <!-- Vertical Status Bar (Kiri) -->
                <div 
                  class="absolute left-0 top-0 bottom-0 w-2"
                  :class="detail.catatan_kerusakan ? 'bg-[#EAB308]' : 'bg-[#22C55E]'"
                ></div>
                
                <div class="pl-2">
                  <p class="font-label-bold text-on-surface text-[14px]">
                      {{ detail.kategori_perangkat?.kategori }} - {{ detail.kategori_perangkat?.nama_perangkat }}
                  </p>
                  <p v-if="detail.catatan_kerusakan" class="text-secondary text-[12px] italic mt-1">
                      "{{ detail.catatan_kerusakan }}"
                  </p>
                </div>
                <div class="flex flex-col sm:flex-row flex-wrap items-end justify-end gap-sm w-full sm:w-auto">
                <div class="relative w-full sm:w-auto">
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple
                  @change="handleFileUpload(record.id, detail.id, $event)"
                  class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    :disabled="uploadingDetails[detail.id]"
                />
                <button :class="['flex items-center justify-center gap-xs px-sm py-1 text-[11px] font-label-bold border rounded transition-colors w-full', uploadingDetails[detail.id] ? 'text-secondary bg-surface-variant border-outline-variant cursor-wait' : 'text-primary bg-primary-container/30 border-primary/20 hover:bg-primary-container/50']">
                    <span v-if="uploadingDetails[detail.id]" class="material-symbols-outlined text-[14px] animate-spin">autorenew</span>
                    <span v-else class="material-symbols-outlined text-[14px]">upload_file</span>
                  Upload Bukti
                </button>
                </div>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-6 text-secondary text-sm italic border border-dashed border-outline-variant rounded-lg mb-lg">
              Tidak ada perangkat terdaftar untuk tugas ini.
            </div>

            <!-- Action Footer -->
            <div class="flex justify-end pt-md border-t border-surface-variant gap-2">
            <UButton
            size="xs"
            color="neutral"
              variant="soft"
              icon="i-heroicons-photo"
            @click="openEvidenceModal(record)"
            >
              lihat bukti
              </UButton>
               <button v-if="!record.status" @click="markAsCompleted(record)" class="flex items-center gap-sm px-lg py-sm bg-primary text-white dark:text-black rounded-lg font-label-bold hover:bg-primary/90 transition-all">
                  <span class="material-symbols-outlined text-[18px]">check_circle</span>
                  Selesaikan Tugas
                </button>
                <button v-else disabled class="flex items-center gap-sm px-lg py-sm bg-surface-variant text-on-surface-variant rounded-lg font-label-bold opacity-70 cursor-not-allowed">
                  <span class="material-symbols-outlined text-[18px]">task_alt</span>
                  Tugas Selesai
                </button>
              </div>
           </div>
         </div>
       </div>
     </div>
   </main>

    <!-- Evidence Modal -->
    <UModal v-model:open="evidenceModalOpen" title="Bukti Maintenance" description="View all photos related to this maintenance record." :ui="{ content: 'sm:max-w-3xl w-full bg-surface dark:bg-[#1e2235]', width: 'sm:max-w-3xl w-full', overlay: 'bg-[#0f111a]/50 dark:bg-black/80', title: 'text-gray-900 dark:text-white', description: 'text-gray-500 dark:text-gray-300' }">
      <template #body>
        <div v-if="evidenceLoading" class="flex flex-col items-center justify-center py-12 text-secondary">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin mb-2" />
          <p class="text-sm">Loading images...</p>
        </div>
        <div v-else-if="evidencePhotos.length === 0" class="flex flex-col items-center justify-center py-12 text-secondary">
          <UIcon name="i-heroicons-photo" class="w-8 h-8 mb-2 opacity-50" />
          <p class="text-sm">Tidak ada bukti foto tersedia.</p>
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div v-for="(photo, index) in evidencePhotos" :key="index" class="aspect-square rounded-xl overflow-hidden border border-surface-variant group relative cursor-pointer">
            <img 
              :src="photo.photo_url" 
              class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              @click="openFullscreen(photo.photo_url)"
            />
            <!-- Delete Button Overlay -->
            <button 
              @click.stop="deletePhoto(photo.id, photo.photo_url)"
              class="absolute top-2 right-2 bg-red-500 bg-opacity-70 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
              aria-label="Hapus foto"
            >
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end w-full">
          <UButton label="Close" color="neutral" variant="soft" @click="evidenceModalOpen = false" />
        </div>
      </template>
    </UModal>

    <!-- Fullscreen Modal -->
    <!-- Fullscreen Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div 
          v-if="fullscreenOpen" 
          class="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[9999] cursor-zoom-out"
          @click="closeFullscreen"
        >
          <div class="relative w-[90vw] h-[90vh] max-w-[800px] max-h-[800px]" @click.stop>
            <img 
              :src="fullscreenPhoto" 
              class="w-full h-full object-contain cursor-zoom-out"
              @click="closeFullscreen"
            />
            <!-- Close Button -->
            <button 
              @click="closeFullscreen"
              class="absolute top-2 right-2 bg-white bg-opacity-80 rounded-full w-10 h-10 flex items-center justify-center text-black hover:bg-white transition-colors cursor-pointer z-50"
              aria-label="Tutup layar penuh"
            >
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
</template>
