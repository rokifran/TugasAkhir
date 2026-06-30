<script setup>
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const roleState = useState('user-role')

async function logout() {
  await supabase.auth.signOut()
  roleState.value = null
  navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6 relative overflow-hidden transition-colors duration-300">
    <!-- Ambient glow orbs in the background -->
    <div class="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-br from-primary-500 to-indigo-500 blur-[120px] opacity-15"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-br from-purple-500 to-primary-500 blur-[120px] opacity-15"></div>

    <div class="relative z-10 w-full max-w-md">
      <UCard :ui="{ ring: 'ring-1 ring-gray-200 dark:ring-gray-800', rounded: 'rounded-2xl', shadow: 'shadow-2xl' }" class="backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 text-center">
        <div class="flex flex-col items-center py-6">
          <div class="w-16 h-16 bg-gradient-to-br from-primary-500 to-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary-500/20 mb-6">
            <UIcon name="i-heroicons-wrench-screwdriver" class="w-8 h-8" />
          </div>
          <h2 class="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">Portal Teknisi</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs mx-auto">
            Selamat datang! Anda telah masuk sebagai <span class="font-semibold text-primary-500">Teknisi</span> ({{ user?.email }}). Halaman dashboard teknisi saat ini kosong.
          </p>
          <UButton
            @click="logout"
            color="neutral"
            variant="soft"
            size="lg"
            icon="i-heroicons-arrow-left-on-rectangle"
            class="font-semibold px-6 shadow-sm"
          >
            Logout
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>
