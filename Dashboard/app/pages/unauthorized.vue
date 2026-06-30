<script setup>
const route = useRoute()
const role = route.query.role || 'unknown'
const errorMsg = route.query.err || 'none'
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
    <UCard class="w-full max-w-md text-center">
      <UIcon name="i-heroicons-exclamation-triangle" class="w-16 h-16 text-amber-500 mx-auto mb-4" />
      <h1 class="text-2xl font-bold mb-2">Access Denied</h1>
      <p class="text-gray-600 dark:text-gray-400 mb-6">
        You do not have a valid role assigned to access this application.
      </p>
      
      <div class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-left mb-6 font-mono text-sm break-all">
        <p><strong>Detected Role:</strong> {{ role }}</p>
        <p><strong>Error Fetching:</strong> {{ errorMsg }}</p>
      </div>
      
      <UButton to="/login" color="primary" block>Back to Login</UButton>
    </UCard>
  </div>
</template>
