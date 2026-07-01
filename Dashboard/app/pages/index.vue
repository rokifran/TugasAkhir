<script setup>
import { ref, computed, onMounted, watch } from 'vue'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const maintenanceRecords = ref([])
const errorMsg = ref(null)
const loading = ref(false)
// FIX 2: Track total record count from server for correct pagination
const totalCount = ref(0)

// Detail Modal state
const detailModalOpen = ref(false)
const detailModalTitle = ref('')
const detailModalData = ref(null)

// Insert Modal state
const insertModalOpen = ref(false)
const insertLoading = ref(false)
const insertError = ref(null)
const insertSuccess = ref(false)

// Edit Modal state
const editModalOpen = ref(false)
const editLoading = ref(false)
const editError = ref(null)
const editSuccess = ref(false)
const editRecordId = ref(null)

// Delete Modal state
const deleteModalOpen = ref(false)
const deleteLoading = ref(false)
const deleteError = ref(null)
const deleteRecordId = ref(null)
const deleteRecordLabel = ref('')

// Form fields (shared between insert & edit)
const formTeknisi = ref(null)
const formClient = ref(null)
const formKodeLokasi = ref('')
const formTanggalMaintenance = ref('')
const formStatus = ref(false)
const formDevices = ref([])

// FIX 4: Dropdown options — cached after first load, never re-fetched unnecessarily
const teknisiList = ref([])
const clientList = ref([])
const kategoriPerangkatList = ref([])
const dropdownDataLoaded = ref(false)

// Sorting state: null = no sort, 'asc', 'desc'
const statusSort = ref(null)
const dateSort = ref(null)

// Pagination state
const PAGE_SIZE = 10
const currentPage = ref(1)
const searchQuery = useState('search-query', () => '')

// FIX 3: Sort toggles now trigger a server-side re-fetch instead of client-side sort
function toggleStatusSort() {
  if (statusSort.value === null) statusSort.value = 'asc'
  else if (statusSort.value === 'asc') statusSort.value = 'desc'
  else statusSort.value = null
  currentPage.value = 1
  getMaintenanceData()
}

function toggleDateSort() {
  if (dateSort.value === null) dateSort.value = 'desc'
  else if (dateSort.value === 'desc') dateSort.value = 'asc'
  else dateSort.value = null
  currentPage.value = 1
  getMaintenanceData()
}

// FIX 2: totalPages now driven by server-returned count, not local array length
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / PAGE_SIZE)))

const columns = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'created_at', header: 'Created At' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'teknisi', header: 'Teknisi' },
  { accessorKey: 'client', header: 'Client' },
  { accessorKey: 'devices', header: 'Perangkat' },
  { accessorKey: 'kode_lokasi', header: 'Kode Lokasi' },
  { accessorKey: 'tanggal_maintenance', header: 'Tanggal Maintenance' },
  { accessorKey: 'actions', header: 'Actions' }
]

async function getMaintenanceData() {
  if (!user.value) return;

  loading.value = true;
  errorMsg.value = null;
  try {
    const q = searchQuery.value?.trim().toLowerCase()
    const hasSearch = !!q

    let query = supabase
      .from('maintenance')
      .select(`
        id, created_at, status, kode_lokasi, tanggal_maintenance,
        teknisi:teknisi_id(id, nama, kontak, users(is_active)),
        client:client_id(id, nama, kontak),
        maintenance_detail(id, catatan_kerusakan, kategori_perangkat:kategori_perangkat_id(id, kategori, nama_perangkat))
      `, hasSearch ? {} : { count: 'exact' })

    if (!hasSearch) {
      const from = (currentPage.value - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      query = query.range(from, to)
    }

    if (statusSort.value) {
      query = query.order('status', { ascending: statusSort.value === 'asc' })
    }
    if (dateSort.value) {
      query = query.order('created_at', { ascending: dateSort.value === 'asc' })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    const { data, error, count } = await query
    if (error) {
      console.error('[getMaintenanceData] Supabase error:', error)
      throw error
    }

    if (hasSearch) {
      const allFiltered = (data || []).filter(record => {
        const orderIdMatches = String(record.id).toLowerCase().includes(q)
        const kodeLokasiMatches = record.kode_lokasi ? String(record.kode_lokasi).toLowerCase().includes(q) : false
        const teknisiMatches = record.teknisi?.nama ? String(record.teknisi.nama).toLowerCase().includes(q) : false
        const clientMatches = record.client?.nama ? String(record.client.nama).toLowerCase().includes(q) : false
        return orderIdMatches || kodeLokasiMatches || teknisiMatches || clientMatches
      })
      totalCount.value = allFiltered.length
      const start = (currentPage.value - 1) * PAGE_SIZE
      maintenanceRecords.value = allFiltered.slice(start, start + PAGE_SIZE)
    } else {
      maintenanceRecords.value = data || []
      totalCount.value = count || 0
    }
  } catch (error) {
    console.error('[getMaintenanceData] catch:', error)
    errorMsg.value = error.message
  } finally {
    loading.value = false;
  }
}

// FIX 4: Dropdown data cached — only fetches once per session
async function fetchDropdownData() {
  if (dropdownDataLoaded.value) return
  try {
    const [teknisiRes, clientRes, kategoriRes] = await Promise.all([
      supabase.from('teknisi').select('id, nama'),
      supabase.from('client').select('id, nama'),
      supabase.from('kategori_perangkat').select('id, kategori, nama_perangkat')
    ])
    if (teknisiRes.error) throw teknisiRes.error
    if (clientRes.error) throw clientRes.error
    if (kategoriRes.error) throw kategoriRes.error
    
    teknisiList.value = teknisiRes.data || []
    clientList.value = clientRes.data || []
    kategoriPerangkatList.value = kategoriRes.data || []
    dropdownDataLoaded.value = true
  } catch (error) {
    errorMsg.value = error.message
  }
}

// ── INSERT ──────────────────────────────────
function openInsertModal() {
  formTeknisi.value = null
  formClient.value = null
  formKodeLokasi.value = ''
  formTanggalMaintenance.value = ''
  formStatus.value = false
  formDevices.value = []
  insertError.value = null
  insertSuccess.value = false
  insertModalOpen.value = true
  fetchDropdownData()  // Uses cache after first load — no extra network call
}

async function insertMaintenance() {
  if (!formTeknisi.value || !formClient.value || !formKodeLokasi.value.trim() || !formTanggalMaintenance.value) {
    insertError.value = 'All fields are required.'
    return
  }

  insertLoading.value = true
  insertError.value = null
  insertSuccess.value = false

  try {
    const { data: newRecord, error } = await supabase
      .from('maintenance')
      .insert({
        teknisi_id: formTeknisi.value,
        client_id: formClient.value,
        kode_lokasi: formKodeLokasi.value.trim(),
        tanggal_maintenance: formTanggalMaintenance.value
      })
      .select()
      .single()
    if (error) throw error

    // Insert maintenance details if any devices are specified
    const validDevices = formDevices.value.filter(d => d.kategori_perangkat_id)
    if (validDevices.length > 0) {
      const details = validDevices.map(d => ({
        maintenance_id: newRecord.id,
        kategori_perangkat_id: d.kategori_perangkat_id,
        catatan_kerusakan: d.catatan_kerusakan.trim()
      }))
      const { error: detailError } = await supabase
        .from('maintenance_detail')
        .insert(details)
      if (detailError) throw detailError
    }

    insertSuccess.value = true
    // Go to page 1 so the user sees the new record (ordered by created_at desc)
    currentPage.value = 1
    // Re-fetch is now fast: only loads 10 rows with minimal columns
    await Promise.all([getMaintenanceData(), fetchStats()])
    setTimeout(() => {
      insertModalOpen.value = false
    }, 800)
  } catch (error) {
    insertError.value = error.message
  } finally {
    insertLoading.value = false
  }
}

// ── EDIT ────────────────────────────────────
function openEditModal(record) {
  editRecordId.value = record.id
  formTeknisi.value = record.teknisi && typeof record.teknisi === 'object' ? record.teknisi.id : (record.teknisi_id || record.teknisi)
  formClient.value = record.client && typeof record.client === 'object' ? record.client.id : (record.client_id || record.client)
  formKodeLokasi.value = record.kode_lokasi || ''
  formTanggalMaintenance.value = record.tanggal_maintenance || ''
  formStatus.value = !!record.status
  formDevices.value = record.maintenance_detail
    ? record.maintenance_detail.map(d => ({
        kategori_perangkat_id: d.kategori_perangkat_id,
        catatan_kerusakan: d.catatan_kerusakan || ''
      }))
    : []
  editError.value = null
  editSuccess.value = false
  editModalOpen.value = true
  fetchDropdownData()  // Uses cache after first load — no extra network call
}

async function updateMaintenance() {
  if (!formTeknisi.value || !formClient.value || !formKodeLokasi.value.trim() || !formTanggalMaintenance.value) {
    editError.value = 'All fields are required.'
    return
  }

  editLoading.value = true
  editError.value = null
  editSuccess.value = false

  try {
    const { error } = await supabase
      .from('maintenance')
      .update({
        teknisi_id: formTeknisi.value,
        client_id: formClient.value,
        kode_lokasi: formKodeLokasi.value.trim(),
        tanggal_maintenance: formTanggalMaintenance.value,
        status: formStatus.value
      })
      .eq('id', editRecordId.value)
    if (error) throw error

    // Delete existing details for this maintenance
    const { error: deleteError } = await supabase
      .from('maintenance_detail')
      .delete()
      .eq('maintenance_id', editRecordId.value)
    if (deleteError) throw deleteError

    // Insert new details
    const validDevices = formDevices.value.filter(d => d.kategori_perangkat_id)
    if (validDevices.length > 0) {
      const details = validDevices.map(d => ({
        maintenance_id: editRecordId.value,
        kategori_perangkat_id: d.kategori_perangkat_id,
        catatan_kerusakan: d.catatan_kerusakan.trim()
      }))
      const { error: detailError } = await supabase
        .from('maintenance_detail')
        .insert(details)
      if (detailError) throw detailError
    }

    editSuccess.value = true
    // Re-fetch is now fast: only loads current page's 10 rows
    await Promise.all([getMaintenanceData(), fetchStats()])
    setTimeout(() => {
      editModalOpen.value = false
    }, 800)
  } catch (error) {
    editError.value = error.message
  } finally {
    editLoading.value = false
  }
}

// ── DELETE ──────────────────────────────────
function openDeleteModal(record) {
  deleteRecordId.value = record.id
  deleteRecordLabel.value = `#${record.id}`
  deleteError.value = null
  deleteModalOpen.value = true
}

async function deleteMaintenance() {
  deleteLoading.value = true
  deleteError.value = null

  try {
    const { error } = await supabase
      .from('maintenance')
      .delete()
      .eq('id', deleteRecordId.value)
    if (error) throw error

    // Re-fetch is now fast: only loads current page's 10 rows
    await Promise.all([getMaintenanceData(), fetchStats()])
    deleteModalOpen.value = false
  } catch (error) {
    deleteError.value = error.message
  } finally {
    deleteLoading.value = false
  }
}

// Helper methods for devices form
function addDeviceField() {
  formDevices.value.push({ kategori_perangkat_id: null, catatan_kerusakan: '' })
}

function removeDeviceField(index) {
  formDevices.value.splice(index, 1)
}

// Computed options for selects
const teknisiOptions = computed(() =>
  teknisiList.value.map(t => ({ label: t.nama, value: t.id }))
)
const clientOptions = computed(() =>
  clientList.value.map(c => ({ label: c.nama, value: c.id }))
)
const kategoriPerangkatOptions = computed(() =>
  kategoriPerangkatList.value.map(k => ({
    label: `${k.kategori} - ${k.nama_perangkat}`,
    value: k.id
  }))
)

function showDetail(type, data) {
  if (!data) return
  detailModalTitle.value = type === 'teknisi' ? 'Teknisi Detail' : 'Client Detail'
  detailModalData.value = data
  detailModalOpen.value = true
}

function formatLabel(key) {
  if (key === 'users') return 'Status'
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function getIconForKey(key) {
  if (key === 'id') return 'i-heroicons-fingerprint'
  if (key === 'nama') return 'i-heroicons-user'
  if (key === 'kontak') return 'i-heroicons-phone'
  if (key === 'users') return 'i-heroicons-shield-check'
  return 'i-heroicons-information-circle'
}

// Format Indonesian phone number to WhatsApp URL
function openWhatsApp(kontak) {
  if (!kontak) return
  // Strip all non-digit characters
  let phone = String(kontak).replace(/\D/g, '')
  // Convert leading 0 to country code 62 (Indonesia)
  if (phone.startsWith('0')) {
    phone = '62' + phone.slice(1)
  } else if (!phone.startsWith('62')) {
    phone = '62' + phone
  }
  window.open(`https://wa.me/${phone}`, '_blank')
}

const totalTeknisiCount = ref(0)
const activeTeknisiCount = ref(0)
// FIX: Accurate whole-dataset counts via server count queries, not local array
const pendingTasksCount = ref(0)
const completedTasksCount = ref(0)

async function fetchStats() {
  const [teknisiRes, pendingRes, completedRes] = await Promise.all([
    supabase.from('teknisi').select('id, users(is_active)'),
    supabase.from('maintenance').select('id', { count: 'exact', head: true }).eq('status', false),
    supabase.from('maintenance').select('id', { count: 'exact', head: true }).eq('status', true),
  ])
  if (!teknisiRes.error && teknisiRes.data) {
    totalTeknisiCount.value = teknisiRes.data.length
    activeTeknisiCount.value = teknisiRes.data.filter(t => t.users?.is_active).length
  }
  if (!pendingRes.error) pendingTasksCount.value = pendingRes.count || 0
  if (!completedRes.error) completedTasksCount.value = completedRes.count || 0
}

async function logout() {
  await supabase.auth.signOut()
}

onMounted(() => {
  if (user.value) {
    // FIX 5: Run both fetch calls in parallel — cuts sequential wait time in half
    Promise.all([getMaintenanceData(), fetchStats()])
  }
})

// FIX 2: Re-fetch on page navigation (server-side pagination)
watch(currentPage, () => {
  getMaintenanceData()
})

watch(searchQuery, () => {
  if (currentPage.value === 1) {
    getMaintenanceData()
  } else {
    currentPage.value = 1
  }
})

// Refetch data when user logs in successfully
watch(user, (newUser) => {
  if (newUser) {
    Promise.all([getMaintenanceData(), fetchStats()])
  } else {
    maintenanceRecords.value = []
    totalCount.value = 0
    pendingTasksCount.value = 0
    completedTasksCount.value = 0
  }
})
</script>

<template>
  <main class="flex-1 p-lg max-w-container-max mx-auto w-full bg-background font-body-md text-on-surface h-full">
    <!-- Dashboard Header Section -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-xl gap-md mt-6">
      <div>
        <h1 class="font-display text-display text-on-surface">Maintenance Dashboard</h1>
        <p class="text-secondary font-body-md mt-1">Real-time overview of current service requests and technical operations.</p>
      </div>
      <div class="flex items-center gap-sm">
        <template v-if="!user">
          <UButton to="/login" color="primary" variant="solid" size="lg" icon="i-heroicons-arrow-right-on-rectangle">
            Login to View Data
          </UButton>
        </template>
        <template v-else>
          <button @click="openInsertModal" class="flex items-center gap-sm px-lg py-sm bg-primary-container text-white rounded-lg font-label-bold hover:brightness-105 transition-all shadow-sm active:scale-95">
            <span class="material-symbols-outlined text-[20px]">add</span>
            <span class="">Add Record</span>
          </button>
        </template>
      </div>
    </div>
    
    <UAlert v-if="errorMsg" icon="i-heroicons-exclamation-triangle" color="red" variant="soft" :title="errorMsg" class="w-full mb-8" />
    
    <div v-if="!user" class="py-12 flex flex-col items-center justify-center text-secondary">
      <span class="material-symbols-outlined text-[48px] mb-4 opacity-50">lock</span>
      <p class="text-lg font-medium mb-3 text-on-surface">Access Restricted</p>
      <p class="text-sm mb-6">Please log in to view the maintenance records.</p>
      <UButton to="/login" color="primary">Go to Login</UButton>
    </div>
    
    <template v-else>
      <!-- Dashboard Stats Grid (Bento Style) -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-lg mb-xl">
        <div class="bg-surface-container-lowest p-lg rounded-xl shadow-[0px_10px_32px_rgba(15,23,42,0.10)] border border-outline-variant relative overflow-hidden group">
          <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#EAB308]"></div>
          <p class="text-secondary font-label-bold mb-base uppercase tracking-wider text-[10px]">Pending Task</p>
          <div class="flex items-end gap-sm">
            <h3 class="text-3xl font-display font-bold text-on-surface">{{ pendingTasksCount }}</h3>
          </div>
          <span class="material-symbols-outlined absolute -right-4 -bottom-4 text-7xl text-[#EAB308]/10 group-hover:text-[#EAB308]/20 transition-colors">pending_actions</span>
        </div>
        <div class="bg-surface-container-lowest p-lg rounded-xl shadow-[0px_10px_32px_rgba(15,23,42,0.10)] border border-outline-variant relative overflow-hidden group">
          <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-primary"></div>
          <p class="text-secondary font-label-bold mb-base uppercase tracking-wider text-[10px]">Completed Task</p>
          <div class="flex items-end gap-sm">
            <h3 class="text-3xl font-display font-bold text-on-surface">{{ completedTasksCount }}</h3>
          </div>
          <span class="material-symbols-outlined absolute -right-4 -bottom-4 text-7xl text-primary/10 group-hover:text-primary/20 transition-colors">assignment_turned_in</span>
        </div>
        <div class="bg-surface-container-lowest p-lg rounded-xl shadow-[0px_10px_32px_rgba(15,23,42,0.10)] border border-outline-variant relative overflow-hidden group">
          <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-secondary"></div>
          <p class="text-secondary font-label-bold mb-base uppercase tracking-wider text-[10px]">Teknisi Aktif</p>
          <div class="flex items-end gap-sm">
            <h3 class="text-3xl font-display font-bold text-on-surface">{{ activeTeknisiCount }}</h3>
          </div>
          <span class="material-symbols-outlined absolute -right-4 -bottom-4 text-7xl text-secondary/10 group-hover:text-secondary/20 transition-colors">engineering</span>
        </div>
        <div class="bg-surface-container-lowest p-lg rounded-xl shadow-[0px_10px_32px_rgba(15,23,42,0.10)] border border-outline-variant relative overflow-hidden group">
          <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-primary-container"></div>
          <p class="text-secondary font-label-bold mb-base uppercase tracking-wider text-[10px]">TOTAL Teknisi</p>
          <div class="flex items-end gap-sm">
            <h3 class="text-3xl font-display font-bold text-on-surface">{{ totalTeknisiCount }}</h3>
          </div>
          <span class="material-symbols-outlined absolute -right-4 -bottom-4 text-7xl text-primary-container/10 group-hover:text-primary-container/20 transition-colors">badge</span>
        </div>
      </div>

      <!-- Table Section -->
      <div class="bg-surface-container-lowest rounded-xl shadow-[0px_10px_32px_rgba(15,23,42,0.10)] border border-outline-variant overflow-hidden mb-xl">
        <div class="px-lg py-md border-b border-surface-variant flex items-center justify-between">
          <h3 class="font-headline-md text-on-surface text-[18px]">Recent Activity</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr class="bg-surface-container-low">
                <th class="px-lg py-md text-secondary font-label-bold uppercase text-[11px] tracking-widest border-b border-surface-variant">ID</th>
                <th class="px-lg py-md text-secondary font-label-bold uppercase text-[11px] tracking-widest border-b border-surface-variant flex items-center gap-xs cursor-pointer select-none hover:text-primary transition-colors" @click="toggleDateSort">
                  Created At <span class="material-symbols-outlined text-[12px]">{{ dateSort === 'asc' ? 'arrow_upward' : dateSort === 'desc' ? 'arrow_downward' : 'swap_vert' }}</span>
                </th>
                <th class="px-lg py-md text-secondary font-label-bold uppercase text-[11px] tracking-widest border-b border-surface-variant cursor-pointer select-none hover:text-primary transition-colors" @click="toggleStatusSort">
                  <div class="flex items-center gap-xs">
                    Status <span class="material-symbols-outlined text-[12px]">{{ statusSort === 'asc' ? 'arrow_upward' : statusSort === 'desc' ? 'arrow_downward' : 'swap_vert' }}</span>
                  </div>
                </th>
                <th class="px-lg py-md text-secondary font-label-bold uppercase text-[11px] tracking-widest border-b border-surface-variant">Teknisi</th>
                <th class="px-lg py-md text-secondary font-label-bold uppercase text-[11px] tracking-widest border-b border-surface-variant">Client</th>
                <th class="px-lg py-md text-secondary font-label-bold uppercase text-[11px] tracking-widest border-b border-surface-variant">Perangkat</th>
                <th class="px-lg py-md text-secondary font-label-bold uppercase text-[11px] tracking-widest border-b border-surface-variant">Kode Lokasi</th>
                <th class="px-lg py-md text-secondary font-label-bold uppercase text-[11px] tracking-widest border-b border-surface-variant">Tgl. Maintenance</th>
                <th class="px-lg py-md text-secondary font-label-bold uppercase text-[11px] tracking-widest border-b border-surface-variant text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-variant">
              <tr v-if="loading" class="bg-surface-container-lowest">
                <td colspan="9" class="px-lg py-xl text-center text-secondary">Loading...</td>
              </tr>
              <tr v-else-if="maintenanceRecords.length === 0" class="bg-surface-container-lowest">
                <td colspan="9" class="px-lg py-xl text-center text-secondary">No Data Found.</td>
              </tr>
              <tr v-else v-for="record in maintenanceRecords" :key="record.id" class="hover:bg-surface-container-low/30 transition-colors group">
                <td class="px-lg py-md font-label-bold text-on-surface">#{{ record.id ?? '-' }}</td>
                <td class="px-lg py-md text-secondary text-sm">{{ record.created_at ? new Date(record.created_at).toLocaleString() : 'N/A' }}</td>
                <td class="px-lg py-md">
                  <span v-if="record.status" class="inline-flex items-center px-sm py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-label-bold border border-emerald-200 uppercase tracking-tighter">
                    <span class="w-1 h-1 rounded-full bg-emerald-500 mr-1.5"></span>
                    Completed
                  </span>
                  <span v-else class="inline-flex items-center px-sm py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-label-bold border border-amber-200 uppercase tracking-tighter">
                    <span class="w-1 h-1 rounded-full bg-amber-500 mr-1.5"></span>
                    Pending
                  </span>
                </td>
                <td class="px-lg py-md">
                  <button
                    v-if="record.teknisi && typeof record.teknisi === 'object'"
                    @click="showDetail('teknisi', record.teknisi)"
                    class="flex items-center gap-sm px-2 py-1 rounded-lg border w-fit transition-colors"
                    :class="record.teknisi.users?.is_active !== false 
                      ? 'bg-primary/5 border-primary/10 hover:bg-primary/10 text-primary' 
                      : 'bg-amber-500/5 border-amber-500/10 hover:bg-amber-500/10 text-amber-600 dark:text-amber-500'"
                  >
                    <span 
                      class="material-symbols-outlined text-[16px]"
                      :class="record.teknisi.users?.is_active !== false ? 'text-primary' : 'text-amber-600 dark:text-amber-500'"
                    >
                      engineering
                    </span>
                    <span class="font-medium text-sm">{{ record.teknisi.nama }}</span>
                  </button>
                  <span v-else class="text-secondary">-</span>
                </td>
                <td class="px-lg py-md">
                  <button
                    v-if="record.client && typeof record.client === 'object'"
                    @click="showDetail('client', record.client)"
                    class="flex items-center gap-sm px-2 py-1 bg-secondary-container/30 rounded-lg border border-secondary-container/50 w-fit hover:bg-secondary-container/50 transition-colors"
                  >
                    <span class="material-symbols-outlined text-[16px] text-secondary">business</span>
                    <span class="font-medium text-sm text-on-secondary-container">{{ record.client.nama }}</span>
                  </button>
                  <span v-else class="text-secondary">-</span>
                </td>
                <td class="px-lg py-md">
                  <div class="flex flex-col gap-1">
                    <div 
                      v-for="detail in record.maintenance_detail" 
                      :key="detail.id"
                      class="text-sm flex flex-col"
                    >
                      <span class="font-medium text-on-surface">
                        {{ detail.kategori_perangkat?.kategori }} - {{ detail.kategori_perangkat?.nama_perangkat }}
                      </span>
                      <span class="text-[11px] text-secondary italic" v-if="detail.catatan_kerusakan">
                        "{{ detail.catatan_kerusakan }}"
                      </span>
                    </div>
                    <span v-if="!record.maintenance_detail || record.maintenance_detail.length === 0" class="text-secondary text-[11px] italic">
                      Tidak ada perangkat
                    </span>
                  </div>
                </td>
                <td class="px-lg py-md font-bold text-on-surface text-sm">{{ record.kode_lokasi || '-' }}</td>
                <td class="px-lg py-md text-secondary text-sm">
                  {{ record.tanggal_maintenance ? new Date(record.tanggal_maintenance).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-' }}
                </td>
                <td class="px-lg py-md text-right">
                  <div class="flex items-center justify-end gap-2">
                    <UButton
                      size="xs"
                      color="primary"
                      variant="soft"
                      icon="i-heroicons-pencil-square"
                      @click="openEditModal(record)"
                    >
                      Edit
                    </UButton>
                    <UButton
                      size="xs"
                      color="error"
                      variant="soft"
                      icon="i-heroicons-trash"
                      @click="openDeleteModal(record)"
                    >
                      Delete
                    </UButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Pagination Footer -->
        <div v-if="totalPages > 1" class="px-lg py-md bg-surface-container-low border-t border-surface-variant flex items-center justify-between">
          <p class="text-[11px] text-secondary font-label-md">
            Showing {{ (currentPage - 1) * PAGE_SIZE + 1 }}–{{ Math.min(currentPage * PAGE_SIZE, totalCount) }} of {{ totalCount }} records
          </p>
          <UPagination
            v-model:page="currentPage"
            :total="totalCount"
            :items-per-page="PAGE_SIZE"
            show-edges
          />
        </div>
      </div>
    </template>

    <!-- Detail Modal for Teknisi / Client -->
    <UModal v-model:open="detailModalOpen" :title="detailModalTitle" :description="'Full record details'" :ui="{ content: 'sm:max-w-2xl w-full', width: 'sm:max-w-2xl w-full' }">
      <template #body>
        <div v-if="detailModalData" class="space-y-4">
          <div v-for="(value, key) in detailModalData" :key="key" class="space-y-1.5">
            <span class="block text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {{ formatLabel(String(key)) }}
            </span>
            <div class="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-150 dark:border-gray-800">
              <UIcon :name="getIconForKey(key)" class="w-5 h-5 text-gray-400 dark:text-gray-500 shrink-0" />
              <span class="text-sm text-gray-900 dark:text-white break-all font-mono font-medium">
                <template v-if="key === 'users'">
                  <span v-if="value?.is_active" class="inline-flex items-center px-sm py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-label-bold border border-emerald-200 uppercase tracking-tighter">
                    <span class="w-1 h-1 rounded-full bg-emerald-500 mr-1.5"></span>
                    Active
                  </span>
                  <span v-else class="inline-flex items-center px-sm py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-label-bold border border-amber-200 uppercase tracking-tighter">
                    <span class="w-1 h-1 rounded-full bg-amber-500 mr-1.5"></span>
                    Inactive
                  </span>
                </template>
                <template v-else>
                  {{ value ?? '-' }}
                </template>
              </span>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-between items-center w-full">
          <UButton
            v-if="detailModalData && detailModalData.kontak"
            label="WhatsApp"
            color="primary"
            variant="soft"
            icon="i-heroicons-chat-bubble-oval-left-ellipsis"
            @click="openWhatsApp(detailModalData.kontak)"
          />
          <div v-else />
          <UButton label="Close" color="neutral" variant="soft" @click="detailModalOpen = false" />
        </div>
      </template>
    </UModal>

    <!-- Insert Maintenance Record Modal -->
    <UModal v-model:open="insertModalOpen" title="Add Maintenance Record" description="Fill in the details to create a new maintenance record." :ui="{ content: 'sm:max-w-3xl w-full', width: 'sm:max-w-3xl w-full' }">
      <template #body>
        <div class="space-y-5">
          <UAlert v-if="insertError" icon="i-heroicons-exclamation-triangle" color="error" variant="soft" :title="insertError" />
          <UAlert v-if="insertSuccess" icon="i-heroicons-check-circle" color="success" variant="soft" title="Record inserted successfully!" />

          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Teknisi</label>
            <USelectMenu
              v-model="formTeknisi"
              :items="teknisiOptions"
              placeholder="Select a technician..."
              value-key="value"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Client</label>
            <USelectMenu
              v-model="formClient"
              :items="clientOptions"
              placeholder="Select a client..."
              value-key="value"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Kode Lokasi</label>
            <UInput
              v-model="formKodeLokasi"
              placeholder="e.g. LOK-001"
              icon="i-heroicons-map-pin"
              size="lg"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tanggal Maintenance</label>
            <UInput
              v-model="formTanggalMaintenance"
              type="date"
              icon="i-heroicons-calendar-days"
              size="lg"
              class="w-full"
            />
          </div>

          <div class="border-t border-gray-100 dark:border-gray-800 pt-4">
            <div class="flex items-center justify-between mb-3">
              <label class="text-sm font-semibold text-gray-900 dark:text-white">Perangkat Bermasalah</label>
              <UButton
                label="Tambah Perangkat"
                icon="i-heroicons-plus-circle"
                size="xs"
                color="primary"
                variant="subtle"
                @click="addDeviceField"
              />
            </div>
            
            <div v-if="formDevices.length === 0" class="text-center py-6 border border-dashed border-gray-200 dark:border-gray-850 rounded-xl bg-gray-50/50 dark:bg-gray-900/30">
              <UIcon name="i-heroicons-wrench" class="w-6 h-6 text-gray-400 mx-auto mb-1.5 opacity-60" />
              <p class="text-xs text-gray-500 dark:text-gray-400">Belum ada perangkat yang dipilih.</p>
            </div>
            
            <div class="space-y-3 max-h-52 overflow-y-auto pr-1" v-else>
              <div 
                v-for="(device, index) in formDevices" 
                :key="index"
                class="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-150 dark:border-gray-800"
              >
                <div class="flex-1 space-y-2">
                  <USelectMenu
                    v-model="device.kategori_perangkat_id"
                    :items="kategoriPerangkatOptions"
                    placeholder="Pilih perangkat..."
                    value-key="value"
                    class="w-full"
                  />
                  <UInput
                    v-model="device.catatan_kerusakan"
                    placeholder="Catatan kerusakan (opsional)..."
                    size="sm"
                    class="w-full"
                  />
                </div>
                <UButton
                  icon="i-heroicons-trash"
                  color="red"
                  variant="ghost"
                  size="sm"
                  class="mt-1"
                  @click="removeDeviceField(index)"
                />
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton label="Cancel" color="neutral" variant="soft" @click="insertModalOpen = false" :disabled="insertLoading" />
          <UButton label="Insert" color="primary" icon="i-heroicons-plus" @click="insertMaintenance" :loading="insertLoading" :disabled="insertLoading" />
        </div>
      </template>
    </UModal>

    <!-- Edit Maintenance Record Modal -->
    <UModal v-model:open="editModalOpen" title="Edit Maintenance Record" description="Update the maintenance record details." :ui="{ content: 'sm:max-w-3xl w-full', width: 'sm:max-w-3xl w-full' }">
      <template #body>
        <div class="space-y-5">
          <UAlert v-if="editError" icon="i-heroicons-exclamation-triangle" color="error" variant="soft" :title="editError" />
          <UAlert v-if="editSuccess" icon="i-heroicons-check-circle" color="success" variant="soft" title="Record updated successfully!" />

          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Teknisi</label>
            <USelectMenu
              v-model="formTeknisi"
              :items="teknisiOptions"
              placeholder="Select a technician..."
              value-key="value"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Client</label>
            <USelectMenu
              v-model="formClient"
              :items="clientOptions"
              placeholder="Select a client..."
              value-key="value"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Kode Lokasi</label>
            <UInput
              v-model="formKodeLokasi"
              placeholder="e.g. LOK-001"
              icon="i-heroicons-map-pin"
              size="lg"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tanggal Maintenance</label>
            <UInput
              v-model="formTanggalMaintenance"
              type="date"
              icon="i-heroicons-calendar-days"
              size="lg"
              class="w-full"
            />
          </div>

          <div class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
            <div>
              <p class="text-sm font-semibold text-gray-900 dark:text-white">Status Penyelesaian</p>
              <p class="text-xs text-gray-500">Tandai jika tugas ini sudah selesai.</p>
            </div>
            <UToggle v-model="formStatus" size="lg" color="success" />
          </div>

          <div class="border-t border-gray-100 dark:border-gray-800 pt-4">
            <div class="flex items-center justify-between mb-3">
              <label class="text-sm font-semibold text-gray-900 dark:text-white">Perangkat Bermasalah</label>
              <UButton
                label="Tambah Perangkat"
                icon="i-heroicons-plus-circle"
                size="xs"
                color="primary"
                variant="subtle"
                @click="addDeviceField"
              />
            </div>
            
            <div v-if="formDevices.length === 0" class="text-center py-6 border border-dashed border-gray-200 dark:border-gray-850 rounded-xl bg-gray-50/50 dark:bg-gray-900/30">
              <UIcon name="i-heroicons-wrench" class="w-6 h-6 text-gray-400 mx-auto mb-1.5 opacity-60" />
              <p class="text-xs text-gray-500 dark:text-gray-400">Belum ada perangkat yang dipilih.</p>
            </div>
            
            <div class="space-y-3 max-h-52 overflow-y-auto pr-1" v-else>
              <div 
                v-for="(device, index) in formDevices" 
                :key="index"
                class="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-150 dark:border-gray-800"
              >
                <div class="flex-1 space-y-2">
                  <USelectMenu
                    v-model="device.kategori_perangkat_id"
                    :items="kategoriPerangkatOptions"
                    placeholder="Pilih perangkat..."
                    value-key="value"
                    class="w-full"
                  />
                  <UInput
                    v-model="device.catatan_kerusakan"
                    placeholder="Catatan kerusakan (opsional)..."
                    size="sm"
                    class="w-full"
                  />
                </div>
                <UButton
                  icon="i-heroicons-trash"
                  color="red"
                  variant="ghost"
                  size="sm"
                  class="mt-1"
                  @click="removeDeviceField(index)"
                />
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton label="Cancel" color="neutral" variant="soft" @click="editModalOpen = false" :disabled="editLoading" />
          <UButton label="Save Changes" color="primary" icon="i-heroicons-check" @click="updateMaintenance" :loading="editLoading" :disabled="editLoading" />
        </div>
      </template>
    </UModal>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="deleteModalOpen" title="Delete Record" description="This action cannot be undone." :ui="{ content: 'sm:max-w-2xl w-full', width: 'sm:max-w-2xl w-full' }">
      <template #body>
        <div class="space-y-5">
          <UAlert v-if="deleteError" icon="i-heroicons-exclamation-triangle" color="error" variant="soft" :title="deleteError" />
          <div class="flex items-start gap-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p class="text-sm font-semibold text-red-800 dark:text-red-300">
                Are you sure you want to delete record {{ deleteRecordLabel }}?
              </p>
              <p class="text-xs text-red-600 dark:text-red-400 mt-1">
                This will permanently remove this maintenance task from the database.
              </p>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton label="Cancel" color="neutral" variant="soft" @click="deleteModalOpen = false" :disabled="deleteLoading" />
          <UButton label="Delete" color="error" icon="i-heroicons-trash" @click="deleteMaintenance" :loading="deleteLoading" :disabled="deleteLoading" />
        </div>
      </template>
    </UModal>
  </main>
</template>
