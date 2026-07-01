<script setup>
import { ref, onMounted, watch } from 'vue'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const clientRecords = ref([])
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
const PAGE_SIZE = 10
const currentPage = ref(1)

const columns = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'created_at', header: 'Created At' },
  { accessorKey: 'nama', header: 'Nama' },
  { accessorKey: 'kontak', header: 'Kontak' },
  { accessorKey: 'kode_lokasi', header: 'Kode Lokasi' },
  { accessorKey: 'actions', header: 'Actions' }
]

async function getClientData() {
  if (!user.value) return;

  loading.value = true;
  errorMsg.value = null;
  try {
    const { data, error } = await supabase.from('client').select().order('created_at', { ascending: false })
    if (error) throw error
    clientRecords.value = data || []
    currentPage.value = 1
  } catch (error) {
    errorMsg.value = error.message
  } finally {
    loading.value = false;
  }
}

const searchQuery = useState('search-query', () => '')

const filteredClientRecords = computed(() => {
  if (!searchQuery.value.trim()) {
    return clientRecords.value
  }
  const q = searchQuery.value.toLowerCase().trim()
  return clientRecords.value.filter(record => {
    const namaMatches = record.nama ? record.nama.toLowerCase().includes(q) : false
    const kodeLokasiMatches = record.kode_lokasi ? record.kode_lokasi.toLowerCase().includes(q) : false
    const idMatches = record.id ? record.id.toLowerCase().includes(q) : false
    return namaMatches || kodeLokasiMatches || idMatches
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredClientRecords.value.length / PAGE_SIZE)))

const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredClientRecords.value.slice(start, start + PAGE_SIZE)
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

async function insertClient() {
  if (!formNama.value.trim() || !formKontak.value.trim() || !formKodeLokasi.value.trim()) {
    insertError.value = 'All fields are required.'
    return
  }

  insertLoading.value = true
  insertError.value = null
  insertSuccess.value = false

  try {
    const { error } = await supabase
      .from('client')
      .insert({
        nama: formNama.value.trim(),
        kontak: formKontak.value.trim(),
        kode_lokasi: formKodeLokasi.value.trim()
      })
    if (error) throw error

    insertSuccess.value = true
    await getClientData()
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

async function updateClient() {
  if (!formNama.value.trim() || !formKontak.value.trim() || !formKodeLokasi.value.trim()) {
    editError.value = 'All fields are required.'
    return
  }

  editLoading.value = true
  editError.value = null
  editSuccess.value = false

  try {
    const { error } = await supabase
      .from('client')
      .update({
        nama: formNama.value.trim(),
        kontak: formKontak.value.trim(),
        kode_lokasi: formKodeLokasi.value.trim()
      })
      .eq('id', editRecordId.value)
    if (error) throw error

    editSuccess.value = true
    await getClientData()
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

async function deleteClient() {
  deleteLoading.value = true
  deleteError.value = null

  try {
    const { error } = await supabase
      .from('client')
      .delete()
      .eq('id', deleteRecordId.value)
    if (error) throw error

    await getClientData()
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
    getClientData()
  }
})

// Refetch data when user logs in successfully
watch(user, (newUser) => {
  if (newUser) {
    getClientData()
  } else {
    clientRecords.value = []
  }
})

watch(searchQuery, () => {
  currentPage.value = 1
})
</script>

<template>
  <main class="flex-1 p-lg max-w-container-max mx-auto w-full bg-background font-body-md text-on-surface h-full">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-xl gap-md mt-6">
        <div>
          <h1 class="font-display text-display text-on-surface">Client Data</h1>
          <p class="text-secondary font-body-md mt-1">Manage your clients here.</p>
        </div>
      <div class="flex items-center gap-sm">
        <button
          v-if="user"
          @click="openInsertModal"
          class="flex items-center gap-sm px-lg py-sm bg-primary-container text-white rounded-lg font-label-bold hover:brightness-105 transition-all shadow-sm active:scale-95"
        >
          <span class="material-symbols-outlined text-[20px]">add</span>
          <span>Add Client</span>
        </button>
      </div>
      </div>

      <UAlert v-if="errorMsg" icon="i-heroicons-exclamation-triangle" color="red" variant="soft" :title="errorMsg" class="w-full mb-8" />
      
    <div v-if="!user" class="py-12 flex flex-col items-center justify-center text-secondary">
      <span class="material-symbols-outlined text-[48px] mb-4 opacity-50">lock</span>
      <p class="text-lg font-medium mb-3 text-on-surface">Access Restricted</p>
      <p class="text-sm mb-6">Please log in to view the client records.</p>
      <UButton to="/login" color="primary">Go to Login</UButton>
    </div>

    <div v-else class="bg-surface-container-lowest rounded-2xl shadow-[0px_10px_32px_rgba(15,23,42,0.10)] border border-outline-variant overflow-hidden mb-xl">
      <div class="px-lg py-md border-b border-surface-variant flex items-center justify-between">
        <h3 class="font-headline-md text-on-surface text-[18px]">Client Records</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr class="bg-surface-container-low">
              <th class="px-lg py-md text-secondary font-label-bold uppercase text-[11px] tracking-widest border-b border-surface-variant">ID</th>
              <th class="px-lg py-md text-secondary font-label-bold uppercase text-[11px] tracking-widest border-b border-surface-variant">Created At</th>
              <th class="px-lg py-md text-secondary font-label-bold uppercase text-[11px] tracking-widest border-b border-surface-variant">Nama</th>
              <th class="px-lg py-md text-secondary font-label-bold uppercase text-[11px] tracking-widest border-b border-surface-variant">Kontak</th>
              <th class="px-lg py-md text-secondary font-label-bold uppercase text-[11px] tracking-widest border-b border-surface-variant">Kode Lokasi</th>
              <th class="px-lg py-md text-secondary font-label-bold uppercase text-[11px] tracking-widest border-b border-surface-variant text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-surface-variant">
            <tr v-if="loading" class="bg-surface-container-lowest">
              <td colspan="6" class="px-lg py-xl text-center text-secondary">Loading...</td>
            </tr>
            <tr v-else-if="paginatedRecords.length === 0" class="bg-surface-container-lowest">
              <td colspan="6" class="px-lg py-xl text-center text-secondary">No Data Found.</td>
            </tr>
            <tr v-else v-for="record in paginatedRecords" :key="record.id" class="hover:bg-surface-container-low/30 transition-colors group">
              <td class="px-lg py-md font-label-bold text-on-surface">{{ record.id ? record.id.substring(0,8) + '...' : '-' }}</td>
              <td class="px-lg py-md text-secondary text-sm">{{ record.created_at ? new Date(record.created_at).toLocaleString() : 'N/A' }}</td>
              <td class="px-lg py-md font-bold text-on-surface">{{ record.nama || '-' }}</td>
              <td class="px-lg py-md">
                <div class="flex items-center gap-2">
                  <span class="text-secondary">{{ record.kontak || '-' }}</span>
                  <UButton
                    v-if="record.kontak"
                    size="xs"
                    color="primary"
                    variant="soft"
                    icon="i-heroicons-chat-bubble-oval-left-ellipsis"
                    @click="openWhatsApp(record.kontak)"
                    title="Message on WhatsApp"
                  />
                </div>
              </td>
              <td class="px-lg py-md text-on-surface font-bold text-sm">{{ record.kode_lokasi || '-' }}</td>
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
      <!-- Pagination -->
      <div v-if="totalPages > 1" class="px-lg py-md bg-surface-container-low border-t border-surface-variant flex items-center justify-between">
        <p class="text-[11px] text-secondary font-label-md">
          Showing {{ (currentPage - 1) * PAGE_SIZE + 1 }}–{{ Math.min(currentPage * PAGE_SIZE, filteredClientRecords.length) }} of {{ filteredClientRecords.length }} records
        </p>
        <UPagination
          v-model:page="currentPage"
          :total="filteredClientRecords.length"
          :items-per-page="PAGE_SIZE"
          show-edges
        />
      </div>
    </div>

    <!-- Insert Client Modal -->
    <UModal v-model:open="insertModalOpen" title="Add Client" description="Fill in the details to add a new client." :ui="{ content: 'sm:max-w-2xl w-full bg-surface dark:bg-[#1e2235]', width: 'sm:max-w-2xl w-full', overlay: 'bg-[#0f111a]/50 dark:bg-black/80', title: 'text-gray-900 dark:text-white', description: 'text-gray-500 dark:text-gray-300' }">
      <template #body>
        <div class="space-y-5">
          <UAlert v-if="insertError" icon="i-heroicons-exclamation-triangle" color="error" variant="soft" :title="insertError" />
          <UAlert v-if="insertSuccess" icon="i-heroicons-check-circle" color="success" variant="soft" title="Client added successfully!" />

          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nama</label>
            <UInput
              v-model="formNama"
              placeholder="e.g. PT. Maju Bersama"
              icon="i-heroicons-building-office"
              size="lg"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Kontak</label>
            <UInput
              v-model="formKontak"
              placeholder="e.g. 021-12345678"
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
          <UButton label="Insert" color="primary" icon="i-heroicons-plus" @click="insertClient" :loading="insertLoading" :disabled="insertLoading" />
        </div>
      </template>
    </UModal>

    <!-- Edit Client Modal -->
    <UModal v-model:open="editModalOpen" title="Edit Client" description="Update the client details." :ui="{ content: 'sm:max-w-2xl w-full bg-surface dark:bg-[#1e2235]', width: 'sm:max-w-2xl w-full', overlay: 'bg-[#0f111a]/50 dark:bg-black/80', title: 'text-gray-900 dark:text-white', description: 'text-gray-500 dark:text-gray-300' }">
      <template #body>
        <div class="space-y-5">
          <UAlert v-if="editError" icon="i-heroicons-exclamation-triangle" color="error" variant="soft" :title="editError" />
          <UAlert v-if="editSuccess" icon="i-heroicons-check-circle" color="success" variant="soft" title="Client updated successfully!" />

          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nama</label>
            <UInput
              v-model="formNama"
              placeholder="e.g. PT. Maju Bersama"
              icon="i-heroicons-building-office"
              size="lg"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Kontak</label>
            <UInput
              v-model="formKontak"
              placeholder="e.g. 021-12345678"
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
          <UButton label="Save Changes" color="primary" icon="i-heroicons-check" @click="updateClient" :loading="editLoading" :disabled="editLoading" />
        </div>
      </template>
    </UModal>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="deleteModalOpen" title="Delete Client" description="This action cannot be undone." :ui="{ content: 'sm:max-w-2xl w-full bg-surface dark:bg-[#1e2235]', width: 'sm:max-w-2xl w-full', overlay: 'bg-[#0f111a]/50 dark:bg-black/80', title: 'text-gray-900 dark:text-white', description: 'text-gray-500 dark:text-gray-300' }">
      <template #body>
        <div class="space-y-5">
          <UAlert v-if="deleteError" icon="i-heroicons-exclamation-triangle" color="error" variant="soft" :title="deleteError" />
          <div class="flex items-start gap-4 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p class="text-sm font-semibold text-red-800 dark:text-red-300">
                Are you sure you want to delete "{{ deleteRecordLabel }}"?
              </p>
              <p class="text-xs text-red-600 dark:text-red-400 mt-1">
                This will permanently remove this client from the database.
              </p>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton label="Cancel" color="neutral" variant="soft" @click="deleteModalOpen = false" :disabled="deleteLoading" />
          <UButton label="Delete" color="error" icon="i-heroicons-trash" @click="deleteClient" :loading="deleteLoading" :disabled="deleteLoading" />
        </div>
      </template>
    </UModal>
  </main>
</template>