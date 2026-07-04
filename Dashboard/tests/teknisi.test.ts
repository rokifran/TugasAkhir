import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Mock the Supabase client
vi.mock('@supabase/supabase-js', () => {
  const mockClient = {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn()
      })),
      delete: vi.fn(() => ({
        eq: vi.fn()
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          limit: vi.fn()
        })),
        limit: vi.fn()
      }))
    })),
    auth: {
      admin: {
        deleteUser: vi.fn(),
        createUser: vi.fn()
      }
    }
  }
  
  return {
    createClient: vi.fn(() => mockClient)
  }
})

import { mockNuxtImport } from '@nuxt/test-utils/runtime'

// Mock Nuxt runtime config
mockNuxtImport('useRuntimeConfig', () => {
  return () => ({
    public: {
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key'
    },
    supabaseServiceRoleKey: 'test-service-role-key'
  })
})

vi.stubGlobal('defineEventHandler', (handler: any) => handler)
const mockReadBody = vi.fn()
vi.stubGlobal('readBody', mockReadBody)
vi.stubGlobal('createError', vi.fn((opts: any) => {
  const err = new Error(opts.statusMessage) as any
  err.statusCode = opts.statusCode
  return err
}))

describe('Teknisi API Endpoints', () => {
  let mockSupabase: any
  let mockSupabaseAdmin: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockSupabase = createClient('https://test', 'test')
    mockSupabaseAdmin = createClient('https://test', 'test')
  })

  afterEach(() => {
    // Only clear mock history, do not reset mock implementations!
    vi.clearAllMocks()
  })

  describe('POST /api/teknisi/create', () => {
    it('should create a new teknisi successfully', async () => {
      const mockInsertResult = { data: { id: 'new-teknisi-id' }, error: null }
      const mockAuthResult = { data: { user: { id: 'new-user-id' } }, error: null }
      const mockUsersInsert = { data: null, error: null }
      const mockTeknisiInsert = { data: null, error: null }

      mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue(mockAuthResult)
      mockSupabaseAdmin.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(mockUsersInsert)
              })
            })
          }
        }
        if (table === 'teknisi') {
          return {
            insert: vi.fn().mockResolvedValue(mockTeknisiInsert)
          }
        }
        return {}
      })

      // Import the handler dynamically to use mocks
      const handler = (await import('../server/api/teknisi/create.post.ts')).default

      const event = {
        context: {},
        body: {
          nama: 'John Doe',
          email: 'john@example.com',
          password: 'password123',
          kontak: '081234567890',
          kode_lokasi: 'LOC001'
        }
      }

      // Mock readBody
      mockReadBody.mockResolvedValue(event.body)

      const result = await handler(event as any)
      
      expect(result.success).toBe(true)
      expect(result.userId).toBe('new-user-id')
    })

    it('should return error when required fields are missing', async () => {
      const handler = (await import('../server/api/teknisi/create.post.ts')).default

      const event = {
        body: {
          nama: 'John Doe'
          // missing kontak and kode_lokasi
        }
      }

      mockReadBody.mockResolvedValue(event.body)

      await expect(handler(event as any)).rejects.toThrow()
    })

    it('should rollback auth user creation if teknisi insert fails', async () => {
      const mockAuthResult = { data: { user: { id: 'new-user-id' } }, error: null }
      const mockUsersInsert = { data: null, error: null }
      const mockTeknisiInsert = { data: null, error: { message: 'Insert failed' } }

      mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue(mockAuthResult)
      mockSupabaseAdmin.auth.admin.deleteUser.mockResolvedValue({ error: null })
      mockSupabaseAdmin.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue(mockUsersInsert)
              })
            })
          }
        }
        if (table === 'teknisi') {
          return {
            insert: vi.fn().mockResolvedValue(mockTeknisiInsert)
          }
        }
        return {}
      })

      const handler = (await import('../server/api/teknisi/create.post.ts')).default

      const event = {
        body: {
          nama: 'John Doe',
          email: 'john@example.com',
          password: 'password123',
          kontak: '081234567890',
          kode_lokasi: 'LOC001'
        }
      }

      mockReadBody.mockResolvedValue(event.body)

      await expect(handler(event as any)).rejects.toThrow()
      expect(mockSupabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith('new-user-id')
    })
  })

  describe('POST /api/teknisi/update', () => {
    it('should update teknisi successfully', async () => {
      const mockUpdate = { data: null, error: null }

      mockSupabaseAdmin.from.mockImplementation((table: string) => {
        if (table === 'teknisi' || table === 'users') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue(mockUpdate)
            })
          }
        }
        return {}
      })

      // Assuming the file is actually named update.post.ts if it exists, otherwise this test will still fail
      // but let's append .ts for consistency.
      const handler = (await import('../server/api/teknisi/update.post.ts')).default

      const event = {
        body: {
          id: 'teknisi-id',
          nama: 'Updated Name',
          kontak: '081234567890',
          kode_lokasi: 'LOC002'
        }
      }

      mockReadBody.mockResolvedValue(event.body)

      const result = await handler(event as any)
      
      expect(result.success).toBe(true)
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('teknisi')
    })

    it('should return error when ID is missing', async () => {
      const handler = (await import('../server/api/teknisi/update.post.ts')).default

      const event = {
        body: {
          nama: 'Updated Name'
          // missing id
        }
      }

      mockReadBody.mockResolvedValue(event.body)

      await expect(handler(event as any)).rejects.toThrow()
    })
  })

  describe('POST /api/teknisi/activate', () => {
    it('should activate teknisi successfully', async () => {
      const mockUpdate = { data: null, error: null }

      mockSupabaseAdmin.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue(mockUpdate)
            })
          }
        }
        return {}
      })

      const handler = (await import('../server/api/teknisi/activate.post.ts')).default

      const event = {
        body: {
          id: 'user-id'
        }
      }

      mockReadBody.mockResolvedValue(event.body)

      const result = await handler(event as any)
      
      expect(result.success).toBe(true)
    })

    it('should return error when ID is missing', async () => {
      const handler = (await import('../server/api/teknisi/activate.post.ts')).default

      const event = {
        body: {}
      }

      mockReadBody.mockResolvedValue(event.body)

      await expect(handler(event as any)).rejects.toThrow()
    })
  })

  describe('POST /api/teknisi/deactivate', () => {
    it('should deactivate teknisi successfully', async () => {
      const mockUpdate = { data: null, error: null }

      mockSupabaseAdmin.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue(mockUpdate)
            })
          }
        }
        return {}
      })

      const handler = (await import('../server/api/teknisi/deactivate.post.ts')).default

      const event = {
        body: {
          id: 'user-id'
        }
      }

      mockReadBody.mockResolvedValue(event.body)

      const result = await handler(event as any)
      
      expect(result.success).toBe(true)
    })
  })

  describe('POST /api/teknisi/delete', () => {
    it('should delete teknisi successfully', async () => {
      const mockTeknisiDelete = { data: null, error: null }
      const mockUsersDelete = { data: null, error: null }
      const mockAuthDelete = { data: null, error: null }

      mockSupabaseAdmin.from.mockImplementation((table) => {
        if (table === 'teknisi') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue(mockTeknisiDelete)
            })
          }
        }
        if (table === 'users') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue(mockUsersDelete)
            })
          }
        }
        return {}
      })
      mockSupabaseAdmin.auth.admin.deleteUser.mockResolvedValue(mockAuthDelete)

      const handler = (await import('../server/api/teknisi/delete.delete.ts')).default

      const event = {
        body: {
          id: 'user-id'
        }
      }

      mockReadBody.mockResolvedValue(event.body)

      const result = await handler(event as any)
      
      expect(result.success).toBe(true)
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('teknisi')
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith('users')
      expect(mockSupabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith('user-id')
    })

    it('should return error when ID is missing', async () => {
      const handler = (await import('../server/api/teknisi/delete.delete.ts')).default

      const event = {
        body: {}
      }

      mockReadBody.mockResolvedValue(event.body)

      await expect(handler(event as any)).rejects.toThrow()
    })
  })
})
