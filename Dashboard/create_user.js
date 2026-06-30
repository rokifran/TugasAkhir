import { createClient } from '@supabase/supabase-js'

// Gunakan service_role key dari check_users.js agar memiliki akses bypass RLS dan membuat user Auth
const s = createClient('https://lepgnndkyzjxbvsiyxlq.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlcGdubmRreXpqeGJ2c2l5eGxxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDkzNTYyNSwiZXhwIjoyMDkwNTExNjI1fQ.0VwZMBdyzsUdK3plfGAwYI0lC2ePC3QdJOS8FsxZ0wU')

async function createUser(email, password, role) {
  console.log(`Membuat user ${email} dengan role ${role}...`)
  
  let userId
  
  // Cek apakah user sudah ada di Auth
  const { data: listData, error: listError } = await s.auth.admin.listUsers()
  if (listError) {
    console.error('Gagal mengambil daftar user Auth:', listError.message)
    return
  }
  
  const existingUser = listData.users.find(u => u.email === email)
  
  if (existingUser) {
    userId = existingUser.id
    console.log('ℹ️ User Auth sudah ada dengan ID:', userId)
  } else {
    // 1. Buat user di Supabase Auth
    const { data: authData, error: authError } = await s.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    })

    if (authError) {
      console.error('Gagal membuat user di Auth:', authError.message)
      return
    }
    
    userId = authData.user.id
    console.log('✅ User Auth berhasil dibuat dengan ID:', userId)
  }

  const username = email.split('@')[0]
  // 2. Tambahkan role ke public.users
  const { error: dbError } = await s.from('users').insert({
    id: userId,
    role: role,
    username: username
  })

  if (dbError) {
    console.error('Gagal menambahkan ke tabel users:', dbError.message)
    // Supabase biasanya memiliki trigger (opsional) yang otomatis menambah ke tabel users. 
    // Jika error karena duplicate key, berarti trigger sudah bekerja.
    if (dbError.code === '23505') {
       console.log('Catatan: User sudah ada di tabel public.users (mungkin karena trigger). Memperbarui role...')
       await s.from('users').update({ role: role }).eq('id', userId)
       console.log('✅ Role berhasil diperbarui menjadi:', role)
    }
    return
  }

  console.log(`✅ User ${email} berhasil ditambahkan ke tabel users dengan role ${role}\n`)
}

async function run() {
  // Anda bisa mengganti email dan password di bawah ini sesuai keinginan
  await createUser('admin@example.com', 'admin123456', 'Admin')
  await createUser('teknisi@example.com', 'teknisi123456', 'Teknisi')
}

run()
