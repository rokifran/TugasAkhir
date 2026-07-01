<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'

definePageMeta({
  layout: false
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const email = ref('')
const password = ref('')
const errorMsg = ref(null)
const loading = ref(false)
const showPassword = ref(false)

const colorMode = useColorMode()
const isDark = computed({
  get () {
    return colorMode.value === 'dark'
  },
  set () {
    colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
  }
})

watch(user, (newUser) => {
  const userId = newUser?.id || newUser?.sub || newUser?.user?.id
  if (newUser && userId) {
    navigateTo('/')
  }
}, { immediate: true })

const handleLogin = async () => {
  loading.value = true
  errorMsg.value = null
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })
    if (error) throw error
  } catch (err) {
    errorMsg.value = err.message || 'An error occurred during login.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const card = document.querySelector('.login-card-shadow')
  const mouseMove = (e) => {
    if (window.innerWidth > 768) {
      const xAxis = (window.innerWidth / 2 - e.pageX) / 100
      const yAxis = (window.innerHeight / 2 - e.pageY) / 100
      card.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`
    }
  }
  const mouseLeave = () => {
    card.style.transform = `rotateY(0deg) rotateX(0deg)`
  }
  document.addEventListener('mousemove', mouseMove)
  document.addEventListener('mouseleave', mouseLeave)

  onBeforeUnmount(() => {
    document.removeEventListener('mousemove', mouseMove)
    document.removeEventListener('mouseleave', mouseLeave)
  })
})
</script>

<template>
  <main class="flex-grow flex items-center justify-center px-md py-xl relative z-10 min-h-screen bg-surface dark:bg-[#0f111a] text-on-background">
    <!-- Floating Theme Toggle -->
    <div class="absolute top-md right-md z-20">
      <ClientOnly>
        <UButton
          :icon="isDark ? 'i-heroicons-moon-20-solid' : 'i-heroicons-sun-20-solid'"
          color="gray"
          variant="ghost"
          aria-label="Theme"
          @click="isDark = !isDark"
        />
      </ClientOnly>
    </div>

    <div class="w-full max-w-[440px] animate-in fade-in slide-in-from-bottom-4 duration-700">
      <!-- Logo Section -->
      <div class="flex justify-center mb-xl">
        <div class="flex items-center gap-2">
          <div class="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center">
            <span class="material-symbols-outlined text-white" style="font-variation-settings: 'FILL' 1;">engineering</span>
          </div>
          <span class="font-display text-display font-bold text-primary">MaintenApp</span>
        </div>
      </div>
      <!-- Login Card -->
      <div class="login-card-shadow overflow-hidden relative shadow-xl rounded-2xl ring-1 ring-gray-200 dark:ring-gray-700 bg-white dark:bg-[#171a28]">
        <div class="status-strip"></div>
        <div class="px-xl py-xl">
          <div class="text-center mb-lg">
            <h1 class="font-headline-lg text-headline-lg text-on-surface mb-xs">Selamat Datang Kembali</h1>
            <p class="font-body-md text-body-md text-on-surface-variant">Silakan masuk ke akun Anda untuk melanjutkan</p>
          </div>
          <div class="flex justify-center mb-lg">
            <div class="inline-flex items-center gap-xs px-md py-xs bg-surface-container-low dark:bg-[#1e2235] rounded-full border border-outline-variant dark:border-[#334155]">
              <span class="material-symbols-outlined text-secondary text-[16px]">info</span>
              <span class="font-label-md text-label-md text-on-secondary-container dark:text-[#c8d6e8]">Masuk sebagai Admin atau Teknisi</span>
            </div>
          </div>
          <form class="space-y-md" @submit.prevent="handleLogin">
            <!-- Email Input -->
            <div class="space-y-xs">
              <label class="font-label-bold text-label-bold text-on-surface-variant ml-xs" for="email">Email atau Username</label>
              <UInput
                id="email"
                v-model="email"
                type="text"
                placeholder="contoh@maintenapp.com"
                icon="i-heroicons-user"
                size="lg"
                class="w-full"
                :ui="{ base: 'bg-surface-container-low dark:bg-[#1e2235] border border-outline-variant dark:border-[#334155] text-on-surface dark:text-[#c8d6e8] placeholder:text-on-surface-variant dark:placeholder:text-[#94a3b8]' }"
                :disabled="loading"
                required
              />
            </div>
            <!-- Password Input -->
            <div class="space-y-xs">
              <div class="flex justify-between items-center px-xs">
                <label class="font-label-bold text-label-bold text-on-surface-variant" for="password">Kata Sandi</label>
              </div>
              <UInput
                id="password"
                v-model="password"
                placeholder="••••••••"
                :type="showPassword ? 'text' : 'password'"
                icon="i-heroicons-lock-closed"
                size="lg"
                class="w-full"
                :ui="{ base: 'bg-surface-container-low dark:bg-[#1e2235] border border-outline-variant dark:border-[#334155] text-on-surface dark:text-[#c8d6e8] placeholder:text-on-surface-variant dark:placeholder:text-[#94a3b8]' }"
                :disabled="loading"
                required
              >
                <template #trailing>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    :icon="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
                    class="focus:outline-none text-on-surface-variant dark:text-[#94a3b8] hover:text-on-surface dark:hover:text-[#c8d6e8]"
                    @click="showPassword = !showPassword"
                  />
                </template>
              </UInput>
            </div>
            <!-- Utilities -->
            <div class="flex items-center justify-between pt-xs">
              <label class="flex items-center gap-sm cursor-pointer group">
                <div class="relative flex items-center">
                  <input class="peer h-5 w-5 rounded border-outline-variant dark:border-[#334155] text-primary focus:ring-primary-container bg-surface-container-low dark:bg-[#1e2235] dark:checked:bg-primary"
                    type="checkbox">
                </div>
                <span class="font-label-md text-label-md text-on-surface-variant group-hover:text-on-surface transition-colors">Ingat Saya</span>
              </label>
            </div>
            <!-- Login Button -->
            <UButton
              type="submit"
              size="lg"
              color="primary"
              :loading="loading"
              :disabled="!email || !password || loading"
              class="w-full h-[48px] justify-center mt-md"
              :ui="{ base: 'bg-primary-container dark:bg-[#006e2f] hover:bg-primary dark:hover:bg-[#4ae176] text-on-primary dark:text-[#003914] font-semibold transition-colors duration-200' }"
            >
              <template #leading v-if="!loading">
                <UIcon name="i-heroicons-arrow-right-end-on-rectangle" class="w-5 h-5" />
              </template>
              <span>{{ loading ? 'Memproses...' : 'Masuk' }}</span>
            </UButton>
            <UAlert v-if="errorMsg"
              icon="i-heroicons-exclamation-circle"
              color="error"
              variant="soft"
              :title="errorMsg"
              class="error-alert" />
          </form>
        </div>
      </div>
      <div class="h-1 w-full bg-gradient-to-r from-transparent via-primary-container/20 to-transparent"></div>
      <p class="text-center mt-lg font-label-md text-label-md text-outline">
        Versi Sistem 2.4.0 • Dukungan Teknis Tersedia
      </p>
    </div>
  </main>
</template>

<style scoped>
.status-strip {
  width: 4px;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  background-color: #22c55e;
  border-top-left-radius: 12px;
  border-bottom-left-radius: 12px;
}
</style>
