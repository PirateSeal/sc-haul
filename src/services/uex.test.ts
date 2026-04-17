import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearUexResourceCache,
  fetchCommodities,
  fetchUexCities,
  fetchUexOutposts,
  fetchUexPois,
  fetchUexSpaceStations,
  fetchUexTerminals,
  fetchUexVehicles,
} from '@/services/uex'

function makeJsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

beforeEach(() => {
  clearUexResourceCache()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  clearUexResourceCache()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('fetchUexVehicles', () => {
  it('requires a bearer token for vehicle catalog requests', async () => {
    vi.stubEnv('VITE_UEX_BEARER_TOKEN', '')
    await expect(fetchUexVehicles()).rejects.toThrow(
      'Missing VITE_UEX_BEARER_TOKEN for live UEX data.'
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('loads cargo ships when a bearer token is present', async () => {
    vi.stubEnv('VITE_UEX_BEARER_TOKEN', 'secret-token')
    vi.mocked(fetch).mockResolvedValue(
      makeJsonResponse({
        data: [
          {
            id: 9,
            name: 'C2',
            name_full: 'Hercules Starlifter C2',
            company_name: 'Crusader Industries',
            scu: 696,
            is_cargo: 1,
            is_concept: 0,
            is_spaceship: 1,
            is_ground_vehicle: 0,
            is_addon: 0,
          },
        ],
      })
    )

    const result = await fetchUexVehicles()

    expect(fetch).toHaveBeenCalledWith('https://api.uexcorp.space/2.0/vehicles', {
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer secret-token',
      },
    })
    expect(result).toEqual([
      {
        id: 9,
        isCargo: true,
        isConcept: false,
        manufacturer: 'Crusader Industries',
        name: 'C2',
        nameFull: 'Hercules Starlifter C2',
        scu: 696,
        searchTerms: ['c2', 'hercules starlifter c2', 'crusader industries'],
      },
    ])
  })

  it('sends bearer and client version headers when available', async () => {
    vi.stubEnv('VITE_UEX_BEARER_TOKEN', 'secret-token')
    vi.stubEnv('VITE_UEX_CLIENT_VERSION', '2.1.0')
    vi.mocked(fetch).mockResolvedValue(makeJsonResponse({ data: [] }))

    await fetchUexVehicles()

    expect(fetch).toHaveBeenCalledWith(
      'https://api.uexcorp.space/2.0/vehicles',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
          Authorization: 'Bearer secret-token',
          'X-Client-Version': '2.1.0',
        }),
      })
    )
  })

  it('filters non-hauling vehicles and sorts remaining ships deterministically', async () => {
    vi.stubEnv('VITE_UEX_BEARER_TOKEN', 'secret-token')
    vi.mocked(fetch).mockResolvedValue(
      makeJsonResponse({
        data: [
          {
            id: 4,
            name: 'Mule',
            name_full: 'Mule',
            company_name: 'Drake',
            scu: 1,
            is_cargo: 1,
            is_concept: 0,
            is_spaceship: 0,
            is_ground_vehicle: 1,
            is_addon: 0,
          },
          {
            id: 3,
            name: 'Hull A',
            name_full: 'Hull A',
            company_name: 'MISC',
            scu: 64,
            is_cargo: 1,
            is_concept: 0,
            is_spaceship: 1,
            is_ground_vehicle: 0,
            is_addon: 0,
          },
          {
            id: 2,
            name: 'Cargo Pod',
            name_full: 'Cargo Pod',
            company_name: 'ARGO',
            scu: 32,
            is_cargo: 1,
            is_concept: 0,
            is_spaceship: 1,
            is_ground_vehicle: 0,
            is_addon: 1,
          },
          {
            id: 1,
            name: 'RAFT',
            name_full: 'RAFT',
            company_name: 'ARGO',
            scu: 96,
            is_cargo: 1,
            is_concept: 0,
            is_spaceship: 1,
            is_ground_vehicle: 0,
            is_addon: 0,
          },
        ],
      })
    )

    const result = await fetchUexVehicles()

    expect(result.map((vehicle) => vehicle.nameFull)).toEqual(['RAFT', 'Hull A'])
  })
})

describe('fetchCommodities', () => {
  it('requires auth for catalog resources and sends bearer headers', async () => {
    vi.stubEnv('VITE_UEX_BEARER_TOKEN', 'secret-token')
    vi.stubEnv('VITE_UEX_CLIENT_VERSION', '2.1.0')
    vi.mocked(fetch).mockResolvedValue(makeJsonResponse({ data: [] }))

    await Promise.all([
      fetchCommodities(),
      fetchUexCities(),
      fetchUexSpaceStations(),
      fetchUexOutposts(),
      fetchUexPois(),
      fetchUexTerminals(),
    ])

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.uexcorp.space/2.0/commodities',
      {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer secret-token',
          'X-Client-Version': '2.1.0',
        },
      }
    )
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.uexcorp.space/2.0/cities',
      {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer secret-token',
          'X-Client-Version': '2.1.0',
        },
      }
    )
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      'https://api.uexcorp.space/2.0/space_stations',
      {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer secret-token',
          'X-Client-Version': '2.1.0',
        },
      }
    )
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      'https://api.uexcorp.space/2.0/outposts',
      {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer secret-token',
          'X-Client-Version': '2.1.0',
        },
      }
    )
    expect(fetch).toHaveBeenNthCalledWith(
      5,
      'https://api.uexcorp.space/2.0/poi',
      {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer secret-token',
          'X-Client-Version': '2.1.0',
        },
      }
    )
    expect(fetch).toHaveBeenNthCalledWith(
      6,
      'https://api.uexcorp.space/2.0/terminals?type=commodity',
      {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer secret-token',
          'X-Client-Version': '2.1.0',
        },
      }
    )
  })

  it('throws when the bearer token is missing', async () => {
    vi.stubEnv('VITE_UEX_BEARER_TOKEN', '')

    await expect(fetchCommodities()).rejects.toThrow(
      'Missing VITE_UEX_BEARER_TOKEN for live UEX data.'
    )
    expect(fetch).not.toHaveBeenCalled()
  })
})
