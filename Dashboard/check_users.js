const { createClient } = require('@supabase/supabase-js')
const s = createClient('https://lepgnndkyzjxbvsiyxlq.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlcGdubmRreXpqeGJ2c2l5eGxxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDkzNTYyNSwiZXhwIjoyMDkwNTExNjI1fQ.0VwZMBdyzsUdK3plfGAwYI0lC2ePC3QdJOS8FsxZ0wU')

async function run() {
  console.log('Fetching users from auth.users...')
  const auth = await s.auth.admin.listUsers()
  if (auth.error) {
    console.error('Auth Error:', auth.error)
    return
  }
  
  const authUsers = auth.data.users.map(u => ({ id: u.id, email: u.email }))
  console.log('Auth Users:', authUsers)

  console.log('\nFetching users from public.users table...')
  const { data, error } = await s.from('users').select('*')
  if (error) {
    console.error('Table Error:', error)
    return
  }
  
  console.log('Table Users:', data)
}

run()
