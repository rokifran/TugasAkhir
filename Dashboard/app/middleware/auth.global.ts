export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser()
  const client = useSupabaseClient()
  const roleState = useState<string | null>('user-role', () => null)

  console.log(`[AUTH MIDDLEWARE] Navigating to: ${to.path}`)
  console.log(`[AUTH MIDDLEWARE] User present: ${!!user.value}`)
  if (user.value) {
    console.log(`[AUTH MIDDLEWARE] User keys: ${Object.keys(user.value).join(', ')}`)
    console.log(`[AUTH MIDDLEWARE] User object start: ${JSON.stringify(user.value).substring(0, 150)}`)
    console.log(`[AUTH MIDDLEWARE] user.id: ${user.value?.id}, user.sub: ${user.value?.sub}, user.user?.id: ${user.value?.user?.id}`)
  }

  // 1. If not authenticated or missing user id, handle redirect to /login
  const userId = user.value?.id || user.value?.sub || user.value?.user?.id
  if (!user.value || !userId) {
    roleState.value = null
    console.log(`[AUTH MIDDLEWARE] Missing user or ID, redirecting to /login (if not already there)`)
    if (to.path !== '/login' && to.path !== '/unauthorized') {
      return navigateTo('/login')
    }
    return
  }

  // 2. Fetch role if authenticated and not already in state
  let fetchError = null
  if (!roleState.value) {
    try {
      const { data, error } = await client
        .from('users')
        .select('role')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching role:', error)
        fetchError = error.message
      } else if (data) {
        roleState.value = data.role
      }
    } catch (err) {
      console.error('Exception fetching role:', err)
      fetchError = String(err)
    }
  }

  const role = roleState.value ? roleState.value.toLowerCase() : null
  console.log(`[AUTH MIDDLEWARE] Evaluated role: '${role}' (Original state: '${roleState.value}')`)

  // 3. Route protection based on role
  if (role === 'teknisi') {
    console.log(`[AUTH MIDDLEWARE] Role matches 'teknisi'`)
    // Technicians are only allowed on the blank page
    if (to.path !== '/teknisi-dashboard' && to.path !== '/unauthorized') {
      return navigateTo('/teknisi-dashboard')
    }
  } else if (role === 'admin') {
    console.log(`[AUTH MIDDLEWARE] Role matches 'admin'`)
    // Admins are not allowed on the technician blank page or login page
    if (to.path === '/teknisi-dashboard' || to.path === '/login') {
      return navigateTo('/')
    }
  } else {
    console.log(`[AUTH MIDDLEWARE] Role did not match 'admin' or 'teknisi'. Redirecting to /unauthorized`)
    // Fallback if role is undefined or not found
    if (to.path !== '/unauthorized' && to.path !== '/login') {
      return navigateTo(`/unauthorized?role=${roleState.value || 'none'}&err=${fetchError || 'none'}`)
    }
  }
})
