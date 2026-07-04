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
  const { id, nama, kontak, kode_lokasi } = body

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required ID',
    })
  }

  try {
    const updateData: any = {}
    if (nama) updateData.nama = nama
    if (kontak) updateData.kontak = kontak
    if (kode_lokasi) updateData.kode_lokasi = kode_lokasi

    const { error: teknisiError } = await supabaseAdmin
      .from('teknisi')
      .update(updateData)
      .eq('id', id)

    if (teknisiError) throw teknisiError

    // Optionally update users table if nama is provided
    if (nama) {
      const { error: usersError } = await supabaseAdmin
        .from('users')
        .update({ username: nama })
        .eq('id', id)
      
      if (usersError) throw usersError
    }

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
