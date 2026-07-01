<script setup>
import { ref, onMounted, computed } from 'vue'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const roleState = useState('user-role')

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
const uploadLoading = ref(false)

async function logout() {
  await supabase.auth.signOut()
  roleState.value = null
  navigateTo('/login')
}

async function fetchMaintenanceData() {
  if (!user.value) return

  loading.value = true
  errorMsg.value = null
  try {
    const { data, error } = await supabase
      .from('maintenance')
      .select('*, client:client_id(*), maintenance_detail(*, kategori_perangkat:kategori_perangkat_id(*), maintenance_photos(*))')
      .eq('teknisi_id', user.value.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    maintenanceRecords.value = data || []
  } catch (error) {
    errorMsg.value = error.message
  } finally {
    loading.value = false
  }
}

async function handleFileUpload(maintenanceId, detailId, event) {
  const file = event.target.files[0]
  if (!file) return

  uploadLoading.value = true
  errorMsg.value = null

  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${maintenanceId}-${detailId}-${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
    const filePath = `photos/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('maintenance-photos')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('maintenance-photos')
      .getPublicUrl(filePath)

    const { error: updateError } = await supabase
      .from('maintenance_photos')
      .insert({ maintenance_detail_id: detailId, photo_url: publicUrl })

    if (updateError) throw updateError

    await fetchMaintenanceData()
  } catch (error) {
    errorMsg.value = error.message
  } finally {
    uploadLoading.value = false
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
                  <a 
                    v-for="photo in detail.maintenance_photos" 
                    :key="photo.id" 
                    :href="photo.photo_url" 
                    target="_blank" 
                    class="flex items-center gap-xs px-sm py-1 text-[11px] font-label-bold text-primary bg-primary-container/30 border border-primary/20 rounded hover:bg-primary-container/50 transition-colors w-full sm:w-auto justify-center"
                  >
                    <span class="material-symbols-outlined text-[14px]">image</span>
                    Lihat Foto
                  </a>
                  <div class="relative w-full sm:w-auto">
                    <input 
                      type="file" 
                      accept="image/*" 
                      @change="handleFileUpload(record.id, detail.id, $event)"
                      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      :disabled="uploadLoading"
                    />
                    <button :class="['flex items-center justify-center gap-xs px-sm py-1 text-[11px] font-label-bold border rounded transition-colors w-full', uploadLoading ? 'text-secondary bg-surface-variant border-outline-variant cursor-wait' : 'text-primary bg-primary-container/30 border-primary/20 hover:bg-primary-container/50']">
                      <span v-if="uploadLoading" class="material-symbols-outlined text-[14px] animate-spin">autorenew</span>
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
            <div class="flex justify-end pt-md border-t border-surface-variant">
              <button v-if="!record.status" @click="markAsCompleted(record)" class="flex items-center gap-sm px-lg py-sm bg-primary text-white rounded-lg font-label-bold hover:bg-primary/90 transition-all">
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
</template>
