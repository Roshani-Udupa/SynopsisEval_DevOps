import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requestHandler: undefined as undefined | ((config: any) => any),
  responseSuccessHandler: undefined as undefined | ((response: any) => any),
  responseErrorHandler: undefined as undefined | ((error: any) => Promise<any>),
  state: { user: null as null | { access_token: string } },
  logout: vi.fn(),
}))

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: {
          use: (handler: (config: any) => any) => {
            mocks.requestHandler = handler
          },
        },
        response: {
          use: (
            successHandler: (response: any) => any,
            errorHandler: (error: any) => Promise<any>
          ) => {
            mocks.responseSuccessHandler = successHandler
            mocks.responseErrorHandler = errorHandler
          },
        },
      },
    })),
  },
}))

vi.mock('../../../src/store/authStore', () => ({
  useAuthStore: {
    getState: () => ({
      user: mocks.state.user,
      logout: mocks.logout,
    }),
  },
}))

import api from '../../../src/utils/api'

describe('api client', () => {
  beforeEach(() => {
    mocks.state.user = { access_token: 'token-123' }
    mocks.logout.mockReset()
  })

  it('adds the bearer token to outgoing requests', () => {
    const config = mocks.requestHandler?.({ headers: {} })

    expect(config?.headers?.Authorization).toBe('Bearer token-123')
  })

  it('does not add authorization when there is no token', () => {
    mocks.state.user = null

    const config = mocks.requestHandler?.({ headers: {} })

    expect(config?.headers?.Authorization).toBeUndefined()
  })

  it('passes successful responses through unchanged', () => {
    const response = { data: { ok: true } }

    expect(mocks.responseSuccessHandler?.(response)).toBe(response)
    expect(api).toBeDefined()
  })

  it('logs out on 401 responses', async () => {
    await expect(
      mocks.responseErrorHandler?.({ response: { status: 401 } })
    ).rejects.toMatchObject({ response: { status: 401 } })

    expect(mocks.logout).toHaveBeenCalledTimes(1)
  })

  it('redirects on 403 and 500 responses without swallowing the error', async () => {
    await expect(
      mocks.responseErrorHandler?.({ response: { status: 403 } })
    ).rejects.toMatchObject({ response: { status: 403 } })

    await expect(
      mocks.responseErrorHandler?.({ response: { status: 500 } })
    ).rejects.toMatchObject({ response: { status: 500 } })
  })
})