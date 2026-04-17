<script setup>
import { ref, computed, onMounted, watch } from 'vue'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const maintenanceRecords = ref([])
const errorMsg = ref(null)
const loading = ref(false)

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

// Dropdown options (fetched from DB)
const teknisiList = ref([])
const clientList = ref([])

// Sorting state: null = no sort, 'asc', 'desc'
const statusSort = ref(null)
const dateSort = ref(null)

// Pagination state
const PAGE_SIZE = 10
const currentPage = ref(1)

function toggleStatusSort() {
  // Cycle: null -> asc (pending first) -> desc (completed first) -> null
  if (statusSort.value === null) statusSort.value = 'asc'
  else if (statusSort.value === 'asc') statusSort.value = 'desc'
  else statusSort.value = null
  currentPage.value = 1
}

function toggleDateSort() {
  // Cycle: null -> desc (newest first) -> asc (oldest first) -> null
  if (dateSort.value === null) dateSort.value = 'desc'
  else if (dateSort.value === 'desc') dateSort.value = 'asc'
  else dateSort.value = null
  currentPage.value = 1
}

function sortIcon(direction) {
  if (direction === 'asc') return 'i-heroicons-bars-arrow-up'
  if (direction === 'desc') return 'i-heroicons-bars-arrow-down'
  return 'i-heroicons-arrows-up-down'
}

const sortedRecords = computed(() => {
  let records = [...maintenanceRecords.value]

  // Apply status sort
  if (statusSort.value) {
    records.sort((a, b) => {
      const aVal = a.status ? 1 : 0
      const bVal = b.status ? 1 : 0
      return statusSort.value === 'asc' ? aVal - bVal : bVal - aVal
    })
  }

  // Apply date sort (overrides status sort if both active — last applied wins as secondary)
  if (dateSort.value) {
    records.sort((a, b) => {
      const aDate = a.tanggal_maintenance ? new Date(a.tanggal_maintenance).getTime() : 0
      const bDate = b.tanggal_maintenance ? new Date(b.tanggal_maintenance).getTime() : 0
      return dateSort.value === 'desc' ? bDate - aDate : aDate - bDate
    })
  }

  return records
})

const totalPages = computed(() => Math.max(1, Math.ceil(sortedRecords.value.length / PAGE_SIZE)))

const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return sortedRecords.value.slice(start, start + PAGE_SIZE)
})

const columns = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'created_at', header: 'Created At' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'teknisi', header: 'Teknisi' },
  { accessorKey: 'client', header: 'Client' },
  { accessorKey: 'kode_lokasi', header: 'Kode Lokasi' },
  { accessorKey: 'tanggal_maintenance', header: 'Tanggal Maintenance' },
  { accessorKey: 'actions', header: 'Actions' }
]

async function getMaintenanceData() {
  if (!user.value) return;

  loading.value = true;
  errorMsg.value = null;
  try {
    // Use Supabase foreign key joins to fetch related teknisi and client data
    const { data, error } = await supabase
      .from('maintenance')
      .select('*, teknisi(*), client(*)')
      .order('created_at', { ascending: false })
    if (error) throw error
    maintenanceRecords.value = data || []
  } catch (error) {
    errorMsg.value = error.message
  } finally {
    loading.value = false;
  }
}

async function fetchDropdownData() {
  try {
    const [teknisiRes, clientRes] = await Promise.all([
      supabase.from('teknisi').select('id, nama'),
      supabase.from('client').select('id, nama')
    ])
    if (teknisiRes.error) throw teknisiRes.error
    if (clientRes.error) throw clientRes.error
    teknisiList.value = teknisiRes.data || []
    clientList.value = clientRes.data || []
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
  insertError.value = null
  insertSuccess.value = false
  insertModalOpen.value = true
  fetchDropdownData()
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
    const { error } = await supabase
      .from('maintenance')
      .insert({
        teknisi: formTeknisi.value,
        client: formClient.value,
        kode_lokasi: formKodeLokasi.value.trim(),
        tanggal_maintenance: formTanggalMaintenance.value
      })
    if (error) throw error

    insertSuccess.value = true
    await getMaintenanceData()
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
  // Extract the FK id — if joined object, use its id; otherwise use the raw value
  formTeknisi.value = record.teknisi && typeof record.teknisi === 'object' ? record.teknisi.id : record.teknisi
  formClient.value = record.client && typeof record.client === 'object' ? record.client.id : record.client
  formKodeLokasi.value = record.kode_lokasi || ''
  formTanggalMaintenance.value = record.tanggal_maintenance || ''
  formStatus.value = !!record.status
  editError.value = null
  editSuccess.value = false
  editModalOpen.value = true
  fetchDropdownData()
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
        teknisi: formTeknisi.value,
        client: formClient.value,
        kode_lokasi: formKodeLokasi.value.trim(),
        tanggal_maintenance: formTanggalMaintenance.value,
        status: formStatus.value
      })
      .eq('id', editRecordId.value)
    if (error) throw error

    editSuccess.value = true
    await getMaintenanceData()
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

    await getMaintenanceData()
    deleteModalOpen.value = false
  } catch (error) {
    deleteError.value = error.message
  } finally {
    deleteLoading.value = false
  }
}

// Computed options for selects
const teknisiOptions = computed(() =>
  teknisiList.value.map(t => ({ label: t.nama, value: t.id }))
)
const clientOptions = computed(() =>
  clientList.value.map(c => ({ label: c.nama, value: c.id }))
)

function showDetail(type, data) {
  if (!data) return
  detailModalTitle.value = type === 'teknisi' ? 'Teknisi Detail' : 'Client Detail'
  detailModalData.value = data
  detailModalOpen.value = true
}

function formatLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
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

async function logout() {
  await supabase.auth.signOut()
}

onMounted(() => {
  if (user.value) {
    getMaintenanceData()
  }
})

// Refetch data when user logs in successfully
watch(user, (newUser) => {
  if (newUser) {
    getMaintenanceData()
  } else {
    maintenanceRecords.value = []
  }
})
</script>

<template>
  <div class="h-full bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
    <UContainer class="py-6 sm:py-8 lg:py-12 flex flex-col items-center">
      <div class="w-full max-w-5xl flex flex-col md:flex-row justify-between items-start md:items-center mb-6 sm:mb-8 gap-4">
        <h1 class="text-2xl sm:text-3xl font-extrabold">
          Maintenance Dashboard
        </h1>
        <div class="flex flex-wrap items-center gap-2 sm:gap-3">
          <template v-if="!user">
            <UButton to="/login" color="primary" variant="solid" size="lg" icon="i-heroicons-arrow-right-on-rectangle">
              Login to View Data
            </UButton>
          </template>
          <template v-else>
            <UButton @click="openInsertModal" color="primary" variant="solid" size="lg" icon="i-heroicons-plus-circle">
              Add Record
            </UButton>
            <UButton @click="logout" color="neutral" variant="soft" size="lg" icon="i-heroicons-arrow-left-on-rectangle">
              Logout ({{ user.email }})
            </UButton>
          </template>
        </div>
      </div>
      
      <UAlert v-if="errorMsg" icon="i-heroicons-exclamation-triangle" color="red" variant="soft" :title="errorMsg" class="w-full max-w-5xl mb-8" />
      
      <UCard class="w-full max-w-5xl shadow-xl ring-1 ring-gray-200 dark:ring-gray-800" :ui="{ rounded: 'rounded-2xl' }">
        <div v-if="!user" class="flex flex-col items-center justify-center min-h-[400px] text-gray-500 dark:text-gray-400">
          <UIcon name="i-heroicons-lock-closed" class="w-20 h-20 mb-6 opacity-70 text-primary-500" />
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">Access Restricted</h2>
          <p class="text-lg">Please log in to view the maintenance records.</p>
          <UButton to="/login" color="primary" size="lg" class="mt-6">
            Go to Login
          </UButton>
        </div>
        
        <div v-else class="w-full overflow-x-auto pb-4">
          <UTable 
            :data="paginatedRecords" 
            :columns="columns" 
            :loading="loading"
            class="w-full min-w-[900px]"
          >
            <template #status-header>
              <button
                @click="toggleStatusSort"
                class="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider hover:text-primary-500 dark:hover:text-primary-400 transition-colors duration-150 cursor-pointer select-none"
              >
                Status
                <UIcon :name="sortIcon(statusSort)" class="w-4 h-4" />
              </button>
            </template>
            <template #tanggal_maintenance-header>
              <button
                @click="toggleDateSort"
                class="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider hover:text-primary-500 dark:hover:text-primary-400 transition-colors duration-150 cursor-pointer select-none"
              >
                Tanggal Maintenance
                <UIcon :name="sortIcon(dateSort)" class="w-4 h-4" />
              </button>
            </template>
            <template #empty>
              <div class="py-12 text-center text-gray-500">
                <UIcon name="i-heroicons-circle-stack-solid" class="w-12 h-12 mb-4 mx-auto" />
                <p>No Data Found.</p>
              </div>
            </template>
            <template #id-cell="{ row }">
               <span class="font-mono text-gray-500 dark:text-gray-400">#{{ row.original.id }}</span>
            </template>
            <template #created_at-cell="{ row }">
              <span class="text-sm">{{ row.original.created_at ? new Date(row.original.created_at).toLocaleString() : 'N/A' }}</span>
            </template>
            <template #status-cell="{ row }">
              <UBadge :color="row.original.status ? 'success' : 'warning'" variant="subtle" size="md">
                {{ row.original.status ? 'Completed' : 'Pending' }}
              </UBadge>
            </template>
            <template #teknisi-cell="{ row }">
              <button
                v-if="row.original.teknisi && typeof row.original.teknisi === 'object'"
                @click="showDetail('teknisi', row.original.teknisi)"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-sm text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/50 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors duration-150 cursor-pointer border border-primary-200 dark:border-primary-800"
              >
                <UIcon name="i-heroicons-wrench-screwdriver" class="w-4 h-4" />
                {{ row.original.teknisi.nama }}
              </button>
              <span v-else class="text-gray-400">-</span>
            </template>
            <template #client-cell="{ row }">
              <button
                v-if="row.original.client && typeof row.original.client === 'object'"
                @click="showDetail('client', row.original.client)"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors duration-150 cursor-pointer border border-emerald-200 dark:border-emerald-800"
              >
                <UIcon name="i-heroicons-building-office" class="w-4 h-4" />
                {{ row.original.client.nama }}
              </button>
              <span v-else class="text-gray-400">-</span>
            </template>
            <template #kode_lokasi-cell="{ row }">
               <span class="font-bold text-gray-900 dark:text-white">{{ row.original.kode_lokasi || '-' }}</span>
            </template>
            <template #tanggal_maintenance-cell="{ row }">
               <span class="text-sm text-gray-700 dark:text-gray-300">
                 {{ row.original.tanggal_maintenance ? new Date(row.original.tanggal_maintenance).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-' }}
               </span>
            </template>
            <template #actions-cell="{ row }">
              <div class="flex items-center gap-2">
                <UButton
                  size="xs"
                  color="primary"
                  variant="soft"
                  icon="i-heroicons-pencil-square"
                  @click="openEditModal(row.original)"
                >
                  Edit
                </UButton>
                <UButton
                  size="xs"
                  color="error"
                  variant="soft"
                  icon="i-heroicons-trash"
                  @click="openDeleteModal(row.original)"
                >
                  Delete
                </UButton>
              </div>
            </template>
          </UTable>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="flex items-center justify-between px-4 py-4 border-t border-gray-200 dark:border-gray-800">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Showing {{ (currentPage - 1) * PAGE_SIZE + 1 }}–{{ Math.min(currentPage * PAGE_SIZE, sortedRecords.length) }} of {{ sortedRecords.length }} records
            </p>
            <UPagination
              v-model:page="currentPage"
              :total="sortedRecords.length"
              :items-per-page="PAGE_SIZE"
              show-edges
            />
          </div>
        </div>
      </UCard>
    </UContainer>

    <!-- Detail Modal for Teknisi / Client -->
    <UModal v-model:open="detailModalOpen" :title="detailModalTitle" :description="'Full record details'">
      <template #body>
        <div v-if="detailModalData" class="space-y-3">
          <div 
            v-for="(value, key) in detailModalData" 
            :key="key"
            class="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0"
          >
            <span class="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 sm:w-36 shrink-0">
              {{ formatLabel(String(key)) }}
            </span>
            <span class="text-sm text-gray-900 dark:text-white break-all font-mono">
              {{ value ?? '-' }}
            </span>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-between items-center w-full">
          <UButton
            v-if="detailModalData && detailModalData.kontak"
            label="WhatsApp"
            color="success"
            variant="solid"
            icon="i-heroicons-chat-bubble-left-ellipsis"
            @click="openWhatsApp(detailModalData.kontak)"
          />
          <div v-else />
          <UButton label="Close" color="neutral" variant="soft" @click="detailModalOpen = false" />
        </div>
      </template>
    </UModal>

    <!-- Insert Maintenance Record Modal -->
    <UModal v-model:open="insertModalOpen" title="Add Maintenance Record" description="Fill in the details to create a new maintenance record.">
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
    <UModal v-model:open="editModalOpen" title="Edit Maintenance Record" description="Update the maintenance record details.">
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

          <div class="flex items-center gap-3">
            <label class="text-sm font-semibold text-gray-700 dark:text-gray-300">Status</label>
            <USwitch v-model="formStatus" />
            <UBadge :color="formStatus ? 'success' : 'warning'" variant="subtle" size="md">
              {{ formStatus ? 'Completed' : 'Pending' }}
            </UBadge>
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
    <UModal v-model:open="deleteModalOpen" title="Delete Maintenance Record" description="This action cannot be undone.">
      <template #body>
        <div class="space-y-4">
          <UAlert v-if="deleteError" icon="i-heroicons-exclamation-triangle" color="error" variant="soft" :title="deleteError" />
          <div class="flex items-start gap-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p class="text-sm font-semibold text-red-800 dark:text-red-300">
                Are you sure you want to delete record {{ deleteRecordLabel }}?
              </p>
              <p class="text-xs text-red-600 dark:text-red-400 mt-1">
                This will permanently remove this maintenance record from the database.
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
  </div>
</template>
