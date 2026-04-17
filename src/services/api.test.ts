import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/uex', () => ({
  fetchCommodities: vi.fn(() => Promise.resolve([])),
}))

import { fetchCommodities, fetchOrbitalBodies, fetchPOIs } from '@/services/api'
import { fetchCommodities as fetchUexCommodities } from '@/services/uex'

function makeResponse(body: unknown, ok = true): Response {
  return {
    ok,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchOrbitalBodies', () => {
  it('returns parsed array on success', async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeResponse([{ item_id: 1, System: 'Stanton', ObjectContainer: 'Crusader' }])
    )

    const result = await fetchOrbitalBodies()
    expect(result).toHaveLength(1)
    expect(result[0].ObjectContainer).toBe('Crusader')
  })

  it('throws when response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse('error', false))
    await expect(fetchOrbitalBodies()).rejects.toThrow('Failed to fetch orbital bodies')
  })
})

describe('fetchPOIs', () => {
  it('returns parsed array on success', async () => {
    vi.mocked(fetch).mockResolvedValue(
      makeResponse([{ item_id: 10, System: 'Stanton', Planet: 'Crusader', PoiName: 'Seraphim Station' }])
    )

    const result = await fetchPOIs()
    expect(result).toHaveLength(1)
    expect(result[0].PoiName).toBe('Seraphim Station')
  })

  it('throws when response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse('error', false))
    await expect(fetchPOIs()).rejects.toThrow('Failed to fetch POIs')
  })
})

describe('fetchCommodities', () => {
  it('delegates to the authenticated UEX client', async () => {
    vi.mocked(fetchUexCommodities).mockResolvedValueOnce([
      { id: 1, name: 'Iron', code: 'IRON', kind: 'Metal', is_illegal: 0 },
    ])

    const result = await fetchCommodities()

    expect(fetchUexCommodities).toHaveBeenCalled()
    expect(result[0].name).toBe('Iron')
  })
})
