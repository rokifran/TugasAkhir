import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import TeknisiDashboard from '../app/pages/teknisi-dashboard.vue'

// Mock useSupabaseClient and useSupabaseUser
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: 'test-teknisi-id' }, error: null })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      in: vi.fn(() => Promise.resolve({ data: [], error: null }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  })),
  auth: {
    signOut: vi.fn(() => Promise.resolve({ error: null }))
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

mockNuxtImport('useToast', () => {
  return () => ({ add: vi.fn() })
})

mockNuxtImport('navigateTo', () => {
  return vi.fn()
})

describe('Teknisi Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser.value = { id: 'test-user-id', sub: 'test-user-id' }
  })

  it('renders loading state initially', () => {
    const wrapper = mount(TeknisiDashboard, {
      global: {
        stubs: {
          UButton: true,
          UAlert: true,
          UModal: true,
          UIcon: true
        }
      }
    })

    expect(wrapper.text()).toContain('Dashboard Teknisi')
  })

  it('renders stats when loaded', async () => {
    const wrapper = mount(TeknisiDashboard, {
      global: {
        stubs: {
          UButton: true,
          UAlert: true,
          UModal: true,
          UIcon: true
        }
      }
    })

    // wait for promises to resolve
    await new Promise(resolve => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Total Tugas')
    expect(wrapper.text()).toContain('Tugas Pending')
    expect(wrapper.text()).toContain('Selesai')
  })
})
