import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../../../src/store/authStore'

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ user: null })
  })

  it('stores the signed-in user and reports authenticated state', () => {
    useAuthStore.getState().setUser({
      user_id: '1',
      role: 'admin',
      full_name: 'Admin User',
      status: 'approved',
      access_token: 'token-123',
    })

    const state = useAuthStore.getState()

    expect(state.user?.full_name).toBe('Admin User')
    expect(state.user?.access_token).toBe('token-123')
    expect(state.isAuthenticated()).toBe(true)
  })

  it('clears the user on logout', () => {
    useAuthStore.setState({
      user: {
        user_id: '1',
        role: 'reviewer',
        full_name: 'Reviewer One',
        status: 'approved',
        access_token: 'token-456',
      },
    })

    useAuthStore.getState().logout()

    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isAuthenticated()).toBe(false)
  })
})