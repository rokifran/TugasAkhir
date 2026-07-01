import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const supabaseAdmin = createClient(
    config.public.supabaseUrl,
    config.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  const body = await readBody(event)
  const { id } = body

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required ID',
    })
  }

  try {
    // Deactivation according to the issue requirement means deleting the account.
    
    // 1. Delete from public.teknisi
    const { error: teknisiError } = await supabaseAdmin
      .from('teknisi')
      .delete()
      .eq('user_id', id)

    if (teknisiError) throw teknisiError

    // 2. Delete from public.users
    const { error: usersError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id)

    if (usersError) throw usersError

    // 3. Delete from Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)

    if (authError) throw authError

    return {
      success: true
    }

  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Internal Server Error',
    })
  }
})
