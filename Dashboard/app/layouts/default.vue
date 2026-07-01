<template>
  <div class="font-body-md text-body-md overflow-x-hidden bg-background text-on-surface min-h-screen">
    <!-- Sidebar Component -->
    <aside 
      class="hidden md:flex flex-col h-full fixed left-0 top-0 bg-surface-container-low dark:bg-inverse-surface border-r border-outline-variant z-50 transition-all duration-300"
      :class="isCollapsed ? 'w-[80px]' : 'w-[260px]'"
    >
      <!-- Brand Header -->
      <div 
        class="p-lg flex items-center transition-all duration-300"
        :class="isCollapsed ? 'justify-center' : 'gap-md'"
      >
        <div class="flex items-center gap-md" :class="isCollapsed ? 'flex-col' : ''">
          <div class="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center text-white shrink-0">
            <span class="material-symbols-outlined">engineering</span>
          </div>
          <div v-if="!isCollapsed" class="transition-opacity duration-300">
            <h2 class="font-headline-md text-[18px] font-bold text-primary whitespace-nowrap">MaintenApp</h2>
            <p class="text-[10px] font-label-bold text-secondary tracking-widest uppercase">{{ roleState === 'Teknisi' ? 'Portal Teknisi' : 'Admin Central' }}</p>
          </div>
        </div>
      </div>

      <!-- Navigation Menu -->
      <nav class="flex-1 px-md py-md space-y-1">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-md px-lg py-md transition-all cursor-pointer group"
          :class="[
            route.path === link.to
              ? 'bg-secondary-container/50 text-primary border-l-4 border-primary rounded-r-lg'
              : 'text-secondary hover:bg-surface-variant/40 rounded-lg active:translate-x-1',
            isCollapsed ? 'justify-center px-0' : ''
          ]"
          :title="isCollapsed ? link.label : ''"
        >
          <UIcon :name="link.icon" class="w-5 h-5 transition-transform group-hover:scale-110 shrink-0" />
          <span v-if="!isCollapsed" :class="[route.path === link.to ? 'font-label-bold' : 'font-body-md']" class="whitespace-nowrap">{{ link.label }}</span>
        </NuxtLink>
      </nav>

      <!-- Bottom Actions -->
      <div class="px-md pb-xl space-y-1">
        <a 
          class="flex items-center gap-md px-lg py-md text-secondary hover:bg-surface-variant transition-all rounded-lg group" 
          :class="isCollapsed ? 'justify-center px-0' : ''"
          href="#"
          :title="isCollapsed ? 'Help Center' : ''"
        >
          <span class="material-symbols-outlined transition-transform group-hover:scale-110 shrink-0">help</span>
          <span v-if="!isCollapsed" class="font-body-md whitespace-nowrap">Help Center</span>
        </a>
        <button 
          @click="logout" 
          class="w-full flex items-center gap-md px-lg py-md text-error hover:bg-error-container/20 transition-all rounded-lg group"
          :class="isCollapsed ? 'justify-center px-0' : ''"
          :title="isCollapsed ? 'Logout' : ''"
        >
          <span class="material-symbols-outlined transition-transform group-hover:scale-110 shrink-0">logout</span>
          <span v-if="!isCollapsed" class="font-body-md whitespace-nowrap">Logout</span>
        </button>
      </div>
    </aside>

    <div 
      class="min-h-screen flex flex-col relative transition-all duration-300"
      :class="isCollapsed ? 'md:ml-[80px]' : 'md:ml-[260px]'"
    >
      <!-- TopAppBar Component -->
      <header class="flex items-center justify-between px-lg w-full sticky top-0 z-40 bg-surface-container-lowest dark:bg-inverse-surface h-16 border-b border-surface-variant shadow-sm">
        <div class="flex items-center gap-lg">
          <button 
            @click="isCollapsed = !isCollapsed" 
            class="hidden md:flex p-1.5 rounded-lg hover:bg-surface-variant text-secondary transition-colors items-center justify-center"
            :title="isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
          >
            <span class="material-symbols-outlined">{{ isCollapsed ? 'menu_open' : 'menu' }}</span>
          </button>
          <div class="md:hidden font-headline-lg text-headline-md font-bold text-primary">MaintenApp</div>
          <div class="hidden md:flex items-center bg-surface-container-low px-md py-sm rounded-full w-80 border border-outline-variant">
            <span class="material-symbols-outlined text-secondary mr-sm text-[20px]">search</span>
            <input v-model="localSearch" class="bg-transparent border-none focus:ring-0 text-body-md w-full placeholder:text-secondary/60 py-0 outline-none" placeholder="Cari teknisi, client, lokasi, atau ID order..." type="text">
          </div>
        </div>
        
        <div class="flex items-center gap-sm">
          <ClientOnly>
            <UButton
              :icon="isDark ? 'i-heroicons-moon-20-solid' : 'i-heroicons-sun-20-solid'"
              color="gray"
              variant="ghost"
              aria-label="Theme"
              @click="isDark = !isDark"
            />
          </ClientOnly>
          
          <button class="md:hidden p-2 text-secondary" @click="mobileMenuOpen = !mobileMenuOpen">
            <span class="material-symbols-outlined">menu</span>
          </button>
        </div>
      </header>
      
      <!-- Mobile Sidebar -->
      <USlideover v-model="mobileMenuOpen" side="left" class="md:hidden">
        <div class="flex flex-col h-full bg-surface-container-low dark:bg-inverse-surface text-on-surface">
           <div class="p-lg flex items-center gap-md border-b border-outline-variant/30">
            <div class="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center text-white">
              <span class="material-symbols-outlined">engineering</span>
            </div>
            <div>
              <h2 class="font-headline-md text-[18px] font-bold text-primary">MaintenApp</h2>
              <p class="text-[10px] font-label-bold text-secondary tracking-widest uppercase">{{ roleState === 'Teknisi' ? 'Portal Teknisi' : 'Admin Central' }}</p>
            </div>
          </div>
          <nav class="flex-1 px-md py-md space-y-1">
            <NuxtLink
              v-for="link in links"
              :key="link.to"
              :to="link.to"
              @click="mobileMenuOpen = false"
              class="flex items-center gap-md px-lg py-md transition-all cursor-pointer group"
              :class="[
                route.path === link.to
                  ? 'bg-secondary-container/50 text-primary border-l-4 border-primary rounded-r-lg'
                  : 'text-secondary hover:bg-surface-variant/40 rounded-lg active:translate-x-1'
              ]"
            >
              <UIcon :name="link.icon" class="w-5 h-5 transition-transform group-hover:scale-110" />
              <span :class="[route.path === link.to ? 'font-label-bold' : 'font-body-md']">{{ link.label }}</span>
            </NuxtLink>
          </nav>
          
          <div class="px-md pb-xl space-y-1 mt-auto">
            <a class="flex items-center gap-md px-lg py-md text-secondary hover:bg-surface-variant transition-all rounded-lg group" href="#">
              <span class="material-symbols-outlined transition-transform group-hover:scale-110">help</span>
              <span class="font-body-md">Help Center</span>
            </a>
            <button @click="logout" class="w-full flex items-center gap-md px-lg py-md text-error hover:bg-error-container/20 transition-all rounded-lg group">
              <span class="material-symbols-outlined transition-transform group-hover:scale-110">logout</span>
              <span class="font-body-md">Logout</span>
            </button>
          </div>
        </div>
      </USlideover>

      <!-- Main Content -->
      <slot />
      
      <!-- Footer -->
      <footer class="px-lg py-md text-center text-secondary text-[11px] font-label-md border-t border-surface-variant/30 mt-auto">
        © 2026 MaintenApp Enterprise. System Status: <span class="text-primary font-bold">Operational</span>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const route = useRoute()
const supabase = useSupabaseClient()
const mobileMenuOpen = ref(false)
const isCollapsed = useState('sidebar-collapsed', () => false)
const searchQuery = useState('search-query', () => '')

// Debounced search logic to prevent overloading the database
const localSearch = ref(searchQuery.value)
let debounceTimeout = null

watch(localSearch, (newVal) => {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    const trimmed = newVal.trim()
    if (trimmed.length >= 3) {
      searchQuery.value = newVal
    } else {
      // Clear search query if it's less than 3 characters, so it returns to default view
      if (searchQuery.value !== '') {
        searchQuery.value = ''
      }
    }
  }, 500) // 500ms debounce
})

watch(searchQuery, (newVal) => {
  if (newVal !== localSearch.value) {
    localSearch.value = newVal
  }
})

const colorMode = useColorMode()
const isDark = computed({
  get () {
    return colorMode.value === 'dark'
  },
  set () {
    colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
  }
})

const roleState = useState('user-role')

async function logout() {
  await supabase.auth.signOut()
  roleState.value = null
  navigateTo('/login')
}

const links = computed(() => {
  if (roleState.value === 'Teknisi') {
    return [
      {
        label: 'Portal Teknisi',
        icon: 'i-heroicons-wrench-screwdriver',
        to: '/teknisi-dashboard'
      }
    ]
  }
  return [
    {
      label: 'Dashboard',
      icon: 'i-heroicons-home',
      to: '/'
    },
    {
      label: 'Teknisi',
      icon: 'i-heroicons-wrench-screwdriver',
      to: '/teknisi'
    },
    {
      label: 'Client',
      icon: 'i-heroicons-building-office-2',
      to: '/client'
    }
  ]
})
</script>
