import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  storeData,
  resetStoreData,
  fetchOrbitalBodiesMock,
  fetchPOIsMock,
  fetchUexCitiesMock,
  fetchUexSpaceStationsMock,
  fetchUexOutpostsMock,
  fetchUexPoisMock,
  fetchUexTerminalsMock,
  fetchUexCommoditiesMock,
} = vi.hoisted(() => {
  const storeData = {
    orbitalBodies: new Map<number, unknown>(),
    pois: new Map<number, unknown>(),
    locations: new Map<number, unknown>(),
    commodities: new Map<number, unknown>(),
  }

  return {
    storeData,
    resetStoreData: () => {
      Object.values(storeData).forEach((store) => store.clear())
    },
    fetchOrbitalBodiesMock: vi.fn(),
    fetchPOIsMock: vi.fn(),
    fetchUexCitiesMock: vi.fn(),
    fetchUexSpaceStationsMock: vi.fn(),
    fetchUexOutpostsMock: vi.fn(),
    fetchUexPoisMock: vi.fn(),
    fetchUexTerminalsMock: vi.fn(),
    fetchUexCommoditiesMock: vi.fn(),
  }
})

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function getStoreKey(
  storeName: keyof typeof storeData,
  value: Record<string, unknown>
) {
  return storeName === 'commodities' || storeName === 'locations'
    ? Number(value.id)
    : Number(value.item_id)
}

const mockDB = {
  getAll: vi.fn(async (storeName: keyof typeof storeData) =>
    [...storeData[storeName].values()].map((value) => clone(value))
  ),
  transaction: vi.fn((stores: keyof typeof storeData | Array<keyof typeof storeData>, mode?: string) => {
    if (mode === 'readwrite') {
      return {
        objectStore(storeName: keyof typeof storeData) {
          return {
            clear: vi.fn(async () => {
              storeData[storeName].clear()
            }),
            put: vi.fn((value: Record<string, unknown>) => {
              storeData[storeName].set(getStoreKey(storeName, value), clone(value))
            }),
          }
        },
        done: Promise.resolve(),
      }
    }

    const storeName = Array.isArray(stores) ? stores[0] : stores

    return {
      store: {
        index(indexName: string) {
          return {
            get: vi.fn(async (key: string) => {
              if (storeName !== 'locations' || indexName !== 'by-normalized-name') {
                return undefined
              }

              for (const value of storeData.locations.values()) {
                const location = value as { normalizedNames: string[] }
                if (location.normalizedNames.includes(key)) {
                  return clone(value)
                }
              }

              return undefined
            }),
          }
        },
      },
    }
  }),
}

vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve(mockDB)),
}))

vi.mock('@/services/api', () => ({
  fetchOrbitalBodies: fetchOrbitalBodiesMock,
  fetchPOIs: fetchPOIsMock,
}))

vi.mock('@/services/uex', () => ({
  clearUexResourceCache: vi.fn(),
  fetchUexCities: fetchUexCitiesMock,
  fetchUexSpaceStations: fetchUexSpaceStationsMock,
  fetchUexOutposts: fetchUexOutpostsMock,
  fetchUexPois: fetchUexPoisMock,
  fetchUexTerminals: fetchUexTerminalsMock,
  fetchCommodities: fetchUexCommoditiesMock,
  isLiveVisibleUexLocation: vi.fn(
    (location: { is_available_live: number; is_visible: number }) =>
      location.is_available_live === 1 && location.is_visible === 1
  ),
}))

import {
  getCachedCommodities,
  getMergedLocationByName,
  getMergedLocationSearchOptions,
  syncDatabaseIfNeeded,
} from '@/services/db'

const BODIES = [
  {
    item_id: 2,
    System: 'Stanton',
    ObjectContainer: 'ArcCorp',
    InternalName: 'Stanton3',
    Type: 'Planet',
    XCoord: 100,
    YCoord: 200,
    ZCoord: 300,
  },
  {
    item_id: 4,
    System: 'Stanton',
    ObjectContainer: 'Wide Forest Station',
    InternalName: 'Stanton3_L1_station',
    Type: 'Refinery Station',
    XCoord: 700,
    YCoord: 800,
    ZCoord: 900,
  },
]

const POIS = [
  {
    item_id: 12,
    System: 'Stanton',
    Planet: 'Space',
    ObjectContainer: '',
    PoiName: 'Jump Point to Pyro',
    Type: 'Jump Point',
    XCoord: 1000,
    YCoord: 2000,
    ZCoord: 3000,
  },
]

const CITIES = [
  {
    id: 1,
    name: 'Area 18',
    code: 'AR18',
    star_system_name: 'Stanton',
    planet_name: 'ArcCorp',
    moon_name: null,
    is_available_live: 1,
    is_visible: 1,
    has_freight_elevator: 0,
  },
]

const SPACE_STATIONS = [
  {
    id: 10,
    name: 'ARC-L1 Wide Forest Station',
    nickname: 'ARC-L1',
    star_system_name: 'Stanton',
    planet_name: 'ArcCorp',
    moon_name: null,
    orbit_name: 'ArcCorp Lagrange Point 1',
    is_available_live: 1,
    is_visible: 1,
    is_jump_point: 0,
    has_freight_elevator: 0,
  },
]

const TERMINALS = [
  {
    id: 90,
    id_city: 1,
    id_outpost: 0,
    id_poi: 0,
    id_space_station: 0,
    name: 'TDD - Trade and Development Division - Area 18',
    fullname: 'Commodity Shop - TDD - Trade and Development Division - Area 18',
    displayname: 'Area 18',
    nickname: 'TDD Area 18',
    type: 'commodity',
    city_name: 'Area 18',
    outpost_name: null,
    space_station_name: null,
    star_system_name: 'Stanton',
    planet_name: 'ArcCorp',
    moon_name: null,
    orbit_name: 'ArcCorp',
    is_available_live: 1,
    is_visible: 1,
    has_freight_elevator: 1,
  },
  {
    id: 91,
    id_city: 0,
    id_outpost: 0,
    id_poi: 0,
    id_space_station: 10,
    name: 'Admin - ARC-L1',
    fullname: 'Commodity Shop - Admin - ARC-L1',
    displayname: 'ARC-L1 Wide Forest Station',
    nickname: 'ARC-L1',
    type: 'commodity',
    city_name: null,
    outpost_name: null,
    space_station_name: 'ARC-L1 Wide Forest Station',
    star_system_name: 'Stanton',
    planet_name: 'ArcCorp',
    moon_name: null,
    orbit_name: 'ArcCorp Lagrange Point 1',
    is_available_live: 1,
    is_visible: 1,
    has_freight_elevator: 1,
  },
]

const COMMODITIES = [
  { id: 1, name: 'Iron', code: 'IRON', kind: 'Metal', is_illegal: 0 },
  { id: 2, name: 'Stims', code: 'STIM', kind: 'Drug', is_illegal: 1 },
]

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  resetStoreData()

  fetchOrbitalBodiesMock.mockResolvedValue(BODIES)
  fetchPOIsMock.mockResolvedValue(POIS)
  fetchUexCitiesMock.mockResolvedValue(CITIES)
  fetchUexSpaceStationsMock.mockResolvedValue(SPACE_STATIONS)
  fetchUexOutpostsMock.mockResolvedValue([])
  fetchUexPoisMock.mockResolvedValue([])
  fetchUexTerminalsMock.mockResolvedValue(TERMINALS)
  fetchUexCommoditiesMock.mockResolvedValue(COMMODITIES)
})

describe('syncDatabaseIfNeeded', () => {
  it('persists raw and merged stores only after a successful full rebuild', async () => {
    const before = Date.now()

    await syncDatabaseIfNeeded()

    expect(fetchOrbitalBodiesMock).toHaveBeenCalled()
    expect(fetchPOIsMock).toHaveBeenCalled()
    expect(fetchUexCitiesMock).toHaveBeenCalled()
    expect(fetchUexTerminalsMock).toHaveBeenCalled()
    expect(fetchUexCommoditiesMock).toHaveBeenCalled()
    expect(storeData.orbitalBodies.size).toBe(BODIES.length)
    expect(storeData.pois.size).toBe(POIS.length)
    expect(storeData.locations.size).toBeGreaterThan(0)
    expect(storeData.commodities.size).toBe(COMMODITIES.length)

    const area18 = [...storeData.locations.values()].find(
      (value) => (value as { displayName: string }).displayName === 'Area 18'
    ) as { isUiSelectable: boolean; hasFreightElevator: boolean } | undefined
    expect(area18).toEqual(
      expect.objectContaining({
        hasFreightElevator: true,
        isUiSelectable: true,
      })
    )

    const stored = Number.parseInt(localStorage.getItem('schaul_last_sync') ?? '0', 10)
    expect(stored).toBeGreaterThanOrEqual(before)
  })

  it('keeps the last good catalog when a required UEX fetch fails', async () => {
    storeData.locations.set(123, {
      id: 123,
      name: 'Old Location',
      displayName: 'Old Location',
      coords: { x: 1, y: 2, z: 3 },
      system: 'Stanton',
      source: 'starmap',
      confidence: 'exact',
      coordOrigin: 'starmap-body',
      aliases: ['Old Location'],
      searchTerms: ['Old Location'],
      normalizedNames: ['oldlocation'],
      hasFreightElevator: true,
      isUiSelectable: true,
    })
    localStorage.setItem('schaul_last_sync', '42')
    fetchUexTerminalsMock.mockRejectedValueOnce(new Error('UEX unavailable'))

    await expect(syncDatabaseIfNeeded(true)).rejects.toThrow('UEX unavailable')

    expect(storeData.locations.size).toBe(1)
    expect(storeData.locations.get(123)).toEqual(
      expect.objectContaining({ displayName: 'Old Location' })
    )
    expect(localStorage.getItem('schaul_last_sync')).toBe('42')
  })
})

describe('merged catalog queries', () => {
  beforeEach(() => {
    storeData.locations.set(1, {
      id: 1,
      name: 'ARC-L1 Wide Forest Station',
      displayName: 'ARC-L1 Wide Forest Station',
      coords: { x: 700, y: 800, z: 900 },
      system: 'Stanton',
      source: 'uex-matched',
      confidence: 'alias',
      coordOrigin: 'starmap-body',
      aliases: ['ARC-L1', 'ARC-L1 Wide Forest Station'],
      searchTerms: ['ARC-L1', 'ARC-L1 Wide Forest Station'],
      normalizedNames: ['arc l1', 'arc l1 wide forest station'],
      hasFreightElevator: true,
      isUiSelectable: true,
      uex: {
        spaceStationId: 10,
        terminalIds: [91],
        hasFreightElevator: false,
      },
    })
    storeData.locations.set(2, {
      id: 2,
      name: 'No Freight Outpost',
      displayName: 'No Freight Outpost',
      coords: { x: 10, y: 20, z: 30 },
      system: 'Stanton',
      source: 'uex-fallback',
      confidence: 'parent-fallback',
      coordOrigin: 'uex-parent-fallback',
      aliases: ['No Freight Outpost'],
      searchTerms: ['No Freight Outpost'],
      normalizedNames: ['nofreightoutpost'],
      hasFreightElevator: false,
      isUiSelectable: false,
    })
    storeData.commodities.set(1, COMMODITIES[0])
    storeData.commodities.set(2, COMMODITIES[1])
  })

  it('resolves canonical locations by normalized alias from the persisted catalog', async () => {
    const result = await getMergedLocationByName('ARC-L1')

    expect(result).toEqual(
      expect.objectContaining({
        displayName: 'ARC-L1 Wide Forest Station',
        system: 'Stanton',
      })
    )
  })

  it('returns only UI-selectable freight-capable search options', async () => {
    const options = await getMergedLocationSearchOptions()

    expect(options).toHaveLength(1)
    expect(options[0].displayName).toBe('ARC-L1 Wide Forest Station')
    expect(options[0].aliases).toContain('ARC-L1')
  })

  it('returns cached commodities from IndexedDB', async () => {
    const commodities = await getCachedCommodities()

    expect(commodities.map((commodity) => commodity.name)).toEqual(['Iron', 'Stims'])
  })
})
