<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'

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
  <main class="flex-grow flex items-center justify-center px-md py-xl relative z-10 min-h-screen bg-surface text-on-background">
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
      <div class="bg-white rounded-2xl login-card-shadow overflow-hidden relative border border-outline-variant">
        <div class="status-strip"></div>
        <div class="px-xl py-xl">
          <div class="text-center mb-lg">
            <h1 class="font-headline-lg text-headline-lg text-on-surface mb-xs">Selamat Datang Kembali</h1>
            <p class="font-body-md text-body-md text-on-surface-variant">Silakan masuk ke akun Anda untuk melanjutkan</p>
          </div>
          <div class="flex justify-center mb-lg">
            <div class="inline-flex items-center gap-xs px-md py-xs bg-surface-container-low rounded-full border border-outline-variant">
              <span class="material-symbols-outlined text-secondary text-[16px]">info</span>
              <span class="font-label-md text-label-md text-on-secondary-container">Masuk sebagai Admin atau Teknisi</span>
            </div>
          </div>
          <form class="space-y-md" @submit.prevent="handleLogin">
            <!-- Email Input -->
            <div class="space-y-xs">
              <label class="font-label-bold text-label-bold text-on-surface-variant ml-xs" for="email">Email atau Username</label>
              <div class="relative group">
                <span class="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">person</span>
                <input class="w-full h-11 pl-[48px] pr-md bg-surface-container-low border-transparent focus:border-primary focus:bg-white focus:ring-0 rounded-xl transition-all duration-200 font-body-md text-on-surface"
                  id="email"
                  placeholder="contoh@maintenapp.com"
                  type="text"
                  v-model="email"
                  :disabled="loading"
                  required />
              </div>
            </div>
            <!-- Password Input -->
            <div class="space-y-xs">
              <div class="flex justify-between items-center px-xs">
                <label class="font-label-bold text-label-bold text-on-surface-variant" for="password">Kata Sandi</label>
              </div>
              <div class="relative group">
                <span class="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">lock</span>
                <input class="w-full h-11 pl-[48px] pr-[48px] bg-surface-container-low border-transparent focus:border-primary focus:bg-white focus:ring-0 rounded-xl transition-all duration-200 font-body-md text-on-surface"
                  id="password"
                  placeholder="••••••••"
                  :type="showPassword ? 'text' : 'password'"
                  v-model="password"
                  :disabled="loading"
                  required />
                <button type="button"
                  class="absolute right-md top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors focus:outline-none"
                  @click="showPassword = !showPassword">
                  <span class="material-symbols-outlined" id="password-toggle-icon">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
                </button>
              </div>
            </div>
            <!-- Utilities -->
            <div class="flex items-center justify-between pt-xs">
              <label class="flex items-center gap-sm cursor-pointer group">
                <div class="relative flex items-center">
                  <input class="peer h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary-container bg-surface-container-low"
                    type="checkbox">
                </div>
                <span class="font-label-md text-label-md text-on-surface-variant group-hover:text-on-surface transition-colors">Ingat Saya</span>
              </label>
              <a class="font-label-md text-label-md text-primary font-bold hover:underline" href="#">Lupa Kata Sandi?</a>
            </div>
            <!-- Login Button -->
            <button class="w-full h-[48px] bg-primary-container text-white font-headline-md text-headline-md rounded-xl hover:opacity-90 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-primary-container/20 mt-md flex items-center justify-center gap-sm"
              type="submit"
              :disabled="!email || !password || loading">
              <span v-if="loading" class="material-symbols-outlined spin-icon">progress_activity</span>
              <span v-else class="material-symbols-outlined btn-icon">login</span>
              <span>{{ loading ? 'Memproses...' : 'Masuk' }}</span>
            </button>
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
