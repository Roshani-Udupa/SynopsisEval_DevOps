import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PortalLayout from '../../../src/components/layout/PortalLayout'
import { useAuthStore } from '../../../src/store/authStore'

const navigateMock = vi.hoisted(() => ({
  navigate: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock.navigate,
  }
})

describe('PortalLayout', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({
      user: {
        user_id: '1',
        role: 'student_leader',
        full_name: 'Student Leader',
        status: 'approved',
        access_token: 'token-123',
      },
    })
    navigateMock.navigate.mockReset()
  })

  it('highlights the active nav item and logs out the current user', () => {
    render(
      <MemoryRouter initialEntries={['/student']}>
        <PortalLayout
          portalTitle="Student Portal"
          navItems={[
            { label: 'Dashboard', path: '/student', icon: () => null },
            { label: 'Documents', path: '/student/documents', icon: () => null },
          ]}
        >
          <div>Portal body</div>
        </PortalLayout>
      </MemoryRouter>
    )

    const activeLink = screen.getByRole('link', { name: /^dashboard$/i })
    expect(activeLink.className).toContain('nav-item-active')
    expect(screen.getByText('Portal body')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))

    expect(useAuthStore.getState().user).toBeNull()
    expect(navigateMock.navigate).toHaveBeenCalledWith('/login')
  })
})