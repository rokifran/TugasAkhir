<script setup>
import { ref, onMounted } from 'vue'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const roleState = useState('user-role')

const maintenanceRecords = ref([])
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
      .select('*, client(*), maintenance_detail(*, kategori_perangkat(*))')
      .eq('teknisi', user.value.id)
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
      .from('maintenance_detail')
      .update({ foto_bukti: publicUrl })
      .eq('id', detailId)

    if (updateError) throw updateError

    await fetchMaintenanceData()
  } catch (error) {
    errorMsg.value = error.message
  } finally {
    uploadLoading.value = false
  }
}

onMounted(() => {
  fetchMaintenanceData()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 sm:p-8 relative overflow-hidden transition-colors duration-300">
    <!-- Ambient glow orbs in the background -->
    <div class="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-br from-primary-500 to-indigo-500 blur-[120px] opacity-15"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-br from-purple-500 to-primary-500 blur-[120px] opacity-15"></div>

    <UContainer class="relative z-10">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">Dashboard Teknisi</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">Selamat datang kembali, {{ user?.email }}</p>
        </div>
        <UButton
          @click="logout"
          color="neutral"
          variant="soft"
          size="lg"
          icon="i-heroicons-arrow-left-on-rectangle"
          class="font-semibold shadow-sm"
        >
          Logout
        </UButton>
      </div>

      <UAlert v-if="errorMsg" icon="i-heroicons-exclamation-triangle" color="red" variant="soft" :title="errorMsg" class="mb-6" />

      <div v-if="loading" class="flex flex-col items-center justify-center py-20">
        <UIcon name="i-heroicons-arrow-path" class="w-12 h-12 text-primary-500 animate-spin mb-4" />
        <p class="text-gray-500 dark:text-gray-400">Memuat data tugas...</p>
      </div>

      <div v-else-if="maintenanceRecords.length === 0" class="text-center py-20 bg-white dark:bg-gray-900 rounded-2xl shadow-xl ring-1 ring-gray-200 dark:ring-gray-800">
        <UIcon name="i-heroicons-clipboard-document-list" class="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Tidak Ada Tugas</h2>
        <p class="text-gray-500 dark:text-gray-400">Anda belum memiliki tugas maintenance yang dijadwalkan.</p>
      </div>

      <div v-else class="space-y-6">
        <div 
          v-for="record in maintenanceRecords" 
          :key="record.id"
          class="bg-white dark:bg-gray-900 rounded-2xl shadow-lg ring-1 ring-gray-200 dark:ring-gray-800 overflow-hidden"
        >
          <div class="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <UBadge :color="record.status ? 'success' : 'warning'" variant="subtle">
                  {{ record.status ? 'Completed' : 'Pending' }}
                </UBadge>
                <span class="text-xs font-mono text-gray-400">#{{ record.id }}</span>
              </div>
              <h3 class="text-lg font-bold text-gray-900 dark:text-white">
                {{ record.client?.nama || 'Client Tidak Dikenal' }}
              </h3>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-map-pin" class="w-4 h-4" />
                  {{ record.kode_lokasi }}
                </span>
                <span class="flex items-center gap-1">
                  <UIcon name="i-heroicons-calendar" class="w-4 h-4" />
                  {{ record.tanggal_maintenance ? new Date(record.tanggal_maintenance).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-' }}
                </span>
              </div>
            </div>
          </div>

          <div class="p-5 sm:p-6 bg-gray-50/50 dark:bg-gray-800/30">
            <h4 class="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">Detail Perangkat</h4>
            
            <div v-if="record.maintenance_detail && record.maintenance_detail.length > 0" class="space-y-3">
              <div 
                v-for="detail in record.maintenance_detail" 
                :key="detail.id"
                class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
              >
                <div class="space-y-1">
                  <p class="text-sm font-bold text-gray-900 dark:text-white">
                    {{ detail.kategori_perangkat?.kategori }} - {{ detail.kategori_perangkat?.nama_perangkat }}
                  </p>
                  <p v-if="detail.catatan_kerusakan" class="text-xs text-gray-500 dark:text-gray-400 italic">
                    "{{ detail.catatan_kerusakan }}"
                  </p>
                  <div v-if="detail.foto_bukti" class="mt-2">
                    <a :href="detail.foto_bukti" target="_blank" class="text-xs text-primary-500 hover:underline flex items-center gap-1">
                      <UIcon name="i-heroicons-camera" class="w-3 h-3" />
                      Lihat Foto Bukti
                    </a>
                  </div>
                </div>

                <div class="flex items-center">
                  <template v-if="detail.foto_bukti">
                    <UBadge color="success" variant="subtle" size="sm">
                      Foto Terunggah
                    </UBadge>
                  </template>
                  <template v-else>
                    <div class="relative">
                      <input 
                        type="file" 
                        accept="image/*" 
                        @change="handleFileUpload(record.id, detail.id, $event)"
                        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        :disabled="uploadLoading"
                      />
                      <UButton 
                        size="sm" 
                        color="primary" 
                        variant="soft" 
                        icon="i-heroicons-camera"
                        :loading="uploadLoading"
                      >
                        Upload Foto
                      </UButton>
                    </div>
                  </template>
                </div>
              </div>
            </div>

            <div v-else class="text-center py-6 text-gray-400 text-sm italic">
              Tidak ada perangkat terdaftar untuk tugas ini.
            </div>
          </div>
        </div>
      </div>
    </UContainer>
  </div>
</template>
