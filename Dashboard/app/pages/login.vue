<script setup>
import { ref, watch } from 'vue'

definePageMeta({
  layout: false
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const email = ref('')
const password = ref('')
const errorMsg = ref(null)
const loading = ref(false)

// Watch for the user to be fully hydrated before navigating
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
    
    // Navigation is handled by the watcher above once the user state updates
  } catch (err) {
    errorMsg.value = err.message || 'An error occurred during login.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 relative overflow-hidden transition-colors duration-300">
    <!-- Ambient glow orbs in the background -->
    <div class="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-br from-primary-500 to-purple-500 blur-[100px] opacity-20 animate-[float_10s_infinite_ease-in-out_alternate]"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-br from-emerald-500 to-primary-500 blur-[100px] opacity-20 animate-[float_10s_infinite_ease-in-out_alternate-reverse]"></div>
    
    <div class="relative z-10 w-full max-w-md px-4">
      <UCard :ui="{ ring: 'ring-1 ring-gray-200 dark:ring-gray-800', rounded: 'rounded-2xl', shadow: 'shadow-2xl' }" class="backdrop-blur-xl bg-white/70 dark:bg-gray-900/70">
        <div class="text-center mb-8 mt-2">
          <div class="w-14 h-14 mx-auto mb-6 bg-gradient-to-br from-primary-500 to-purple-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary-500/30">
            <UIcon name="i-heroicons-sparkles-solid" class="w-7 h-7" />
          </div>
          <h2 class="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Welcome Back</h2>
          <p class="text-gray-500 dark:text-gray-400 text-base">Sign in to access your Supabase account</p>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-6">
          <UFormField label="Email address" name="email">
            <UInput 
              v-model="email" 
              type="email" 
              placeholder="name@example.com" 
              icon="i-heroicons-envelope"
              :disabled="loading" 
              required
              size="lg"
            />
          </UFormField>

          <UFormField label="Password" name="password">
            <UInput 
              v-model="password" 
              type="password" 
              placeholder="••••••••" 
              icon="i-heroicons-lock-closed"
              :disabled="loading" 
              required
              size="lg"
            />
          </UFormField>

          <UAlert v-if="errorMsg" icon="i-heroicons-exclamation-circle" color="error" variant="soft" :title="errorMsg" />

          <UButton 
            type="submit" 
            :loading="loading" 
            :disabled="!email || !password" 
            block 
            size="xl" 
            color="primary"
            class="mt-4 font-bold shadow-md shadow-primary-500/20"
          >
            Sign In
          </UButton>
        </form>
        
        <template #footer>
          <div class="flex justify-center py-2">
            <ULink to="/" class="text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-2 transition-colors">
              <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
              Back to Home
            </ULink>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>

<style scoped>
@keyframes float {
  0% { transform: translate(0px, 0px) scale(1); }
  100% { transform: translate(30px, 40px) scale(1.1); }
}
</style>
