<template>
  <div class="h-screen flex overflow-hidden bg-white dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-300">
    <!-- Sidebar -->
    <aside class="w-64 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full bg-gray-50/30 dark:bg-gray-900/30">
      <div class="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-800 gap-3 shrink-0">
        <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-500/10 text-primary-500">
          <UIcon name="i-heroicons-cube-transparent" class="w-5 h-5" />
        </div>
        <span class="font-bold text-lg tracking-tight flex-1">Mainten<span class="text-primary-500">App</span></span>
        
        <ClientOnly>
          <UButton
            :icon="isDark ? 'i-heroicons-moon-20-solid' : 'i-heroicons-sun-20-solid'"
            color="gray"
            variant="ghost"
            aria-label="Theme"
            @click="isDark = !isDark"
          />
          <template #fallback>
            <div class="w-8 h-8" />
          </template>
        </ClientOnly>
      </div>
      
      <!-- Navigation -->
      <div class="flex-1 overflow-y-auto p-4">
        <UNavigationMenu :items="links" orientation="vertical" class="w-full" />
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col h-full overflow-y-auto">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const colorMode = useColorMode()
const isDark = computed({
  get () {
    return colorMode.value === 'dark'
  },
  set () {
    colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
  }
})

const links = computed(() => [
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
])
</script>
