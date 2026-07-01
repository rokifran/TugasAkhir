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
  const { nama, email, password, kontak, kode_lokasi } = body

  if (!nama || !email || !password || !kontak || !kode_lokasi) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields',
    })
  }

  let newUserAuthId: string | null = null

  try {
    // 2. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: nama }
    })

    if (authError) throw authError
    if (!authData?.user) throw new Error('Failed to create auth user')
    newUserAuthId = authData.user.id

    // 3. Insert into public.users
    const { error: usersError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUserAuthId,
        username: nama,
        role: 'Teknisi'
      })

    if (usersError) throw usersError

    // 4. Insert into public.teknisi
    const { error: teknisiError } = await supabaseAdmin
      .from('teknisi')
      .insert({
        user_id: newUserAuthId,
        nama,
        kontak,
        kode_lokasi
      })

    if (teknisiError) throw teknisiError

    return {
      success: true,
      userId: newUserAuthId
    }

  } catch (error: any) {
    // Rollback: if auth user was created but database inserts failed, delete the auth user
    if (newUserAuthId) {
      await supabaseAdmin.auth.admin.deleteUser(newUserAuthId)
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Internal Server Error',
    })
  }
})
