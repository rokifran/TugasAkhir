import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import IndexPage from '../app/pages/index.vue'

// Mock useSupabaseClient and useSupabaseUser
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      range: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], count: 0, error: null }))
      })),
      eq: vi.fn(() => Promise.resolve({ data: [], count: 0, error: null }))
    }))
  })),
  auth: {
    signOut: vi.fn()
  }
}

mockNuxtImport('useSupabaseClient', () => {
  return () => mockSupabase
})

const mockUser = ref(null)
mockNuxtImport('useSupabaseUser', () => {
  return () => mockUser
})

mockNuxtImport('useState', () => {
  return (key, init) => ref(init ? init() : '')
})

describe('Index Page (Admin Dashboard)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser.value = null
  })

  it('renders login prompt when no user is authenticated', () => {
    const wrapper = mount(IndexPage, {
      global: {
        stubs: {
          UButton: true,
          UAlert: true,
          UModal: true,
          UIcon: true,
          UPagination: true
        }
      }
    })

    expect(wrapper.text()).toContain('Access Restricted')
    expect(wrapper.text()).toContain('Please log in to view the maintenance records.')
  })

  it('renders dashboard stats when user is authenticated', async () => {
    mockUser.value = { id: 'test-user-id' }
    
    // We need to wait for component to fetch data on mount
    const wrapper = mount(IndexPage, {
      global: {
        stubs: {
          UButton: true,
          UAlert: true,
          UModal: true,
          UIcon: true,
          UPagination: true
        }
      }
    })

    // wait for promises to resolve
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(wrapper.text()).toContain('Pending Task')
    expect(wrapper.text()).toContain('Completed Task')
    expect(wrapper.text()).toContain('Teknisi Aktif')
    expect(wrapper.text()).toContain('TOTAL Teknisi')
  })
})
