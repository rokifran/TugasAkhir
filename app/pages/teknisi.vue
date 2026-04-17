<script setup>
import { ref, onMounted, watch } from 'vue'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const teknisiRecords = ref([])
const errorMsg = ref(null)
const loading = ref(false)

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
const formNama = ref('')
const formKontak = ref('')
const formKodeLokasi = ref('')

// Pagination state
const PAGE_SIZE = 15
const currentPage = ref(1)

const columns = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'created_at', header: 'Created At' },
  { accessorKey: 'nama', header: 'Nama' },
  { accessorKey: 'kontak', header: 'Kontak' },
  { accessorKey: 'kode_lokasi', header: 'Kode Lokasi' },
  { accessorKey: 'actions', header: 'Actions' }
]

async function getTeknisiData() {
  if (!user.value) return;

  loading.value = true;
  errorMsg.value = null;
  try {
    const { data, error } = await supabase.from('teknisi').select()
    if (error) throw error
    teknisiRecords.value = data || []
    currentPage.value = 1
  } catch (error) {
    errorMsg.value = error.message
  } finally {
    loading.value = false;
  }
}

const totalPages = computed(() => Math.max(1, Math.ceil(teknisiRecords.value.length / PAGE_SIZE)))

const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return teknisiRecords.value.slice(start, start + PAGE_SIZE)
})

// ── INSERT ──────────────────────────────────
function openInsertModal() {
  formNama.value = ''
  formKontak.value = ''
  formKodeLokasi.value = ''
  insertError.value = null
  insertSuccess.value = false
  insertModalOpen.value = true
}

async function insertTeknisi() {
  if (!formNama.value.trim() || !formKontak.value.trim() || !formKodeLokasi.value.trim()) {
    insertError.value = 'All fields are required.'
    return
  }

  insertLoading.value = true
  insertError.value = null
  insertSuccess.value = false

  try {
    const { error } = await supabase
      .from('teknisi')
      .insert({
        nama: formNama.value.trim(),
        kontak: formKontak.value.trim(),
        kode_lokasi: formKodeLokasi.value.trim()
      })
    if (error) throw error

    insertSuccess.value = true
    await getTeknisiData()
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
  formNama.value = record.nama || ''
  formKontak.value = record.kontak || ''
  formKodeLokasi.value = record.kode_lokasi || ''
  editError.value = null
  editSuccess.value = false
  editModalOpen.value = true
}

async function updateTeknisi() {
  if (!formNama.value.trim() || !formKontak.value.trim() || !formKodeLokasi.value.trim()) {
    editError.value = 'All fields are required.'
    return
  }

  editLoading.value = true
  editError.value = null
  editSuccess.value = false

  try {
    const { error } = await supabase
      .from('teknisi')
      .update({
        nama: formNama.value.trim(),
        kontak: formKontak.value.trim(),
        kode_lokasi: formKodeLokasi.value.trim()
      })
      .eq('id', editRecordId.value)
    if (error) throw error

    editSuccess.value = true
    await getTeknisiData()
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
  deleteRecordLabel.value = record.nama || record.id
  deleteError.value = null
  deleteModalOpen.value = true
}

async function deleteTeknisi() {
  deleteLoading.value = true
  deleteError.value = null

  try {
    const { error } = await supabase
      .from('teknisi')
      .delete()
      .eq('id', deleteRecordId.value)
    if (error) throw error

    await getTeknisiData()
    deleteModalOpen.value = false
  } catch (error) {
    deleteError.value = error.message
  } finally {
    deleteLoading.value = false
  }
}

// Format Indonesian phone number to WhatsApp URL
function openWhatsApp(kontak) {
  if (!kontak) return
  let phone = String(kontak).replace(/\D/g, '')
  if (phone.startsWith('0')) {
    phone = '62' + phone.slice(1)
  } else if (!phone.startsWith('62')) {
    phone = '62' + phone
  }
  window.open(`https://wa.me/${phone}`, '_blank')
}

onMounted(() => {
  if (user.value) {
    getTeknisiData()
  }
})

// Refetch data when user logs in successfully
watch(user, (newUser) => {
  if (newUser) {
    getTeknisiData()
  } else {
    teknisiRecords.value = []
  }
})
</script>

<template>
  <div class="h-full flex flex-col p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
    <UContainer class="w-full max-w-5xl">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 sm:mb-8 gap-4">
        <div>
          <h1 class="text-2xl sm:text-3xl font-extrabold mb-2">Teknisi Data</h1>
          <p class="text-gray-500 dark:text-gray-400">Manage your technicians here.</p>
        </div>
        <UButton
          v-if="user"
          @click="openInsertModal"
          color="primary"
          variant="solid"
          size="lg"
          icon="i-heroicons-plus-circle"
        >
          Add Teknisi
        </UButton>
      </div>

      <UAlert v-if="errorMsg" icon="i-heroicons-exclamation-triangle" color="red" variant="soft" :title="errorMsg" class="w-full mb-8" />
      
      <UCard :ui="{ rounded: 'rounded-2xl' }" class="shadow-xl ring-1 ring-gray-200 dark:ring-gray-800">
        <div v-if="!user" class="py-12 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
          <UIcon name="i-heroicons-lock-closed" class="w-16 h-16 mb-4 opacity-50" />
          <p class="text-lg font-medium mb-3">Access Restricted</p>
          <p class="text-sm mb-6">Please log in to view the technician records.</p>
          <UButton to="/login" color="primary">Go to Login</UButton>
        </div>
        
        <div v-else class="w-full overflow-x-auto">
          <UTable 
            :data="paginatedRecords" 
            :columns="columns" 
            :loading="loading"
            class="w-full min-w-[600px]"
          >
            <template #empty>
              <div class="py-12 text-center text-gray-500">
                <UIcon name="i-heroicons-circle-stack-solid" class="w-12 h-12 mb-4 mx-auto" />
                <p>No Data Found.</p>
              </div>
            </template>
            <template #id-cell="{ row }">
               <span class="font-mono text-gray-500 dark:text-gray-400" :title="row.original.id">
                 {{ row.original.id ? row.original.id.substring(0,8) + '...' : '-' }}
               </span>
            </template>
            <template #created_at-cell="{ row }">
              <span class="text-sm">{{ row.original.created_at ? new Date(row.original.created_at).toLocaleString() : 'N/A' }}</span>
            </template>
            <template #nama-cell="{ row }">
               <span class="font-bold text-gray-900 dark:text-white">{{ row.original.nama || '-' }}</span>
            </template>
            <template #kontak-cell="{ row }">
              <div class="flex items-center gap-2">
                <span class="text-gray-700 dark:text-gray-300">{{ row.original.kontak || '-' }}</span>
                <UButton
                  v-if="row.original.kontak"
                  size="xs"
                  color="success"
                  variant="ghost"
                  icon="i-heroicons-chat-bubble-oval-left-ellipsis"
                  @click="openWhatsApp(row.original.kontak)"
                  title="Message on WhatsApp"
                />
              </div>
            </template>
            <template #kode_lokasi-cell="{ row }">
               <span class="text-gray-900 dark:text-gray-300 font-mono">{{ row.original.kode_lokasi || '-' }}</span>
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
              Showing {{ (currentPage - 1) * PAGE_SIZE + 1 }}–{{ Math.min(currentPage * PAGE_SIZE, teknisiRecords.length) }} of {{ teknisiRecords.length }} records
            </p>
            <UPagination
              v-model:page="currentPage"
              :total="teknisiRecords.length"
              :items-per-page="PAGE_SIZE"
              show-edges
            />
          </div>
        </div>
      </UCard>
    </UContainer>

    <!-- Insert Teknisi Modal -->
    <UModal v-model:open="insertModalOpen" title="Add Teknisi" description="Fill in the details to add a new technician.">
      <template #body>
        <div class="space-y-5">
          <UAlert v-if="insertError" icon="i-heroicons-exclamation-triangle" color="error" variant="soft" :title="insertError" />
          <UAlert v-if="insertSuccess" icon="i-heroicons-check-circle" color="success" variant="soft" title="Teknisi added successfully!" />

          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nama</label>
            <UInput
              v-model="formNama"
              placeholder="e.g. Ahmad Rizki"
              icon="i-heroicons-user"
              size="lg"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Kontak</label>
            <UInput
              v-model="formKontak"
              placeholder="e.g. 081234567890"
              icon="i-heroicons-phone"
              size="lg"
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
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton label="Cancel" color="neutral" variant="soft" @click="insertModalOpen = false" :disabled="insertLoading" />
          <UButton label="Insert" color="primary" icon="i-heroicons-plus" @click="insertTeknisi" :loading="insertLoading" :disabled="insertLoading" />
        </div>
      </template>
    </UModal>

    <!-- Edit Teknisi Modal -->
    <UModal v-model:open="editModalOpen" title="Edit Teknisi" description="Update the technician details.">
      <template #body>
        <div class="space-y-5">
          <UAlert v-if="editError" icon="i-heroicons-exclamation-triangle" color="error" variant="soft" :title="editError" />
          <UAlert v-if="editSuccess" icon="i-heroicons-check-circle" color="success" variant="soft" title="Teknisi updated successfully!" />

          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nama</label>
            <UInput
              v-model="formNama"
              placeholder="e.g. Ahmad Rizki"
              icon="i-heroicons-user"
              size="lg"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Kontak</label>
            <UInput
              v-model="formKontak"
              placeholder="e.g. 081234567890"
              icon="i-heroicons-phone"
              size="lg"
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
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton label="Cancel" color="neutral" variant="soft" @click="editModalOpen = false" :disabled="editLoading" />
          <UButton label="Save Changes" color="primary" icon="i-heroicons-check" @click="updateTeknisi" :loading="editLoading" :disabled="editLoading" />
        </div>
      </template>
    </UModal>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="deleteModalOpen" title="Delete Teknisi" description="This action cannot be undone.">
      <template #body>
        <div class="space-y-4">
          <UAlert v-if="deleteError" icon="i-heroicons-exclamation-triangle" color="error" variant="soft" :title="deleteError" />
          <div class="flex items-start gap-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p class="text-sm font-semibold text-red-800 dark:text-red-300">
                Are you sure you want to delete "{{ deleteRecordLabel }}"?
              </p>
              <p class="text-xs text-red-600 dark:text-red-400 mt-1">
                This will permanently remove this technician from the database.
              </p>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton label="Cancel" color="neutral" variant="soft" @click="deleteModalOpen = false" :disabled="deleteLoading" />
          <UButton label="Delete" color="error" icon="i-heroicons-trash" @click="deleteTeknisi" :loading="deleteLoading" :disabled="deleteLoading" />
        </div>
      </template>
    </UModal>
  </div>
</template>