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
    // 1. Update public.users to be active
    const { error: usersError } = await supabaseAdmin
      .from('users')
      .update({ is_active: true })
      .eq('id', id)

    if (usersError) throw usersError

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
