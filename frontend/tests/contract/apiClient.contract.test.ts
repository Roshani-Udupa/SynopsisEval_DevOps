import { describe, expect, it } from 'vitest'
import api from '../../src/utils/api'

describe('api client contract', () => {
  it('uses the /api base URL and JSON content type', () => {
    const headers = api.defaults.headers as Record<string, unknown> & {
      common?: Record<string, string>
    }

    expect(api.defaults.baseURL).toBe('/api')
    expect(headers.common?.['Content-Type'] ?? headers['Content-Type']).toBe('application/json')
  })
})