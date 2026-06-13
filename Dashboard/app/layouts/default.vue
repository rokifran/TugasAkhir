<template>
  <div class="h-screen flex flex-col overflow-hidden bg-white dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-300">
    <UHeader toggle-side="left" :ui="{ container: 'px-4!' }">
      <template #toggle>
        <UButton
          :icon="open ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left'"
          color="gray"
          variant="ghost"
          aria-label="Toggle sidebar"
          @click="open = !open"
        />
      </template>

      <template #left>
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-500/10 text-primary-500">
            <UIcon name="i-heroicons-cube-transparent" class="w-5 h-5" />
          </div>
          <span class="font-bold text-lg tracking-tight flex-1">Mainten<span class="text-primary-500">App</span></span>
        </div>
      </template>

      <template #right>
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
      </template>
    </UHeader>

    <div class="flex flex-1 min-h-0 relative">
      <USidebar
        v-model:open="open"
        collapsible="icon"
        :ui="{
          gap: 'h-[calc(100%-var(--ui-header-height))]',
          container:
            'absolute top-(--ui-header-height) bottom-0 h-[calc(100%-var(--ui-header-height))]'
        }"
      >
        <UNavigationMenu
          :items="links"
          orientation="vertical"
          :ui="{ link: 'p-1.5 overflow-hidden' }"
        />
      </USidebar>

      <main class="flex-1 flex flex-col h-full overflow-y-auto">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const open = ref(true)

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
