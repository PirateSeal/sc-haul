import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import { fetchOrbitalBodies, fetchPOIs } from '@/services/api'
import type { Commodity, OrbitalBody, POI } from '@/services/api'
export type { Commodity, OrbitalBody, POI } from '@/services/api'
import {
  buildPersistedLocationCatalog,
  toLocationSearchOption,
  type LocationResult,
  type LocationSearchOption,
  type PersistedLocationRecord,
} from '@/services/location-catalog-data'
import {
  clearUexResourceCache,
  fetchCommodities as fetchUexCommodities,
  fetchUexCities,
  fetchUexOutposts,
  fetchUexPois,
  fetchUexSpaceStations,
  fetchUexTerminals,
} from '@/services/uex'
import { normalizeLocationName } from '@/lib/utils'

interface ScHaulDB extends DBSchema {
  orbitalBodies: {
    key: number
    value: OrbitalBody
    indexes: { 'by-system': string; 'by-name': string; 'by-internal': string }
  }
  pois: {
    key: number
    value: POI
    indexes: { 'by-system': string; 'by-container': string; 'by-name': string }
  }
  locations: {
    key: number
    value: PersistedLocationRecord
    indexes: { 'by-system': string; 'by-display-name': string; 'by-normalized-name': string }
  }
  commodities: {
    key: number
    value: Commodity
    indexes: { 'by-name': string; 'by-code': string }
  }
}

let dbPromise: Promise<IDBPDatabase<ScHaulDB>> | null = null
let syncPromise: Promise<void> | null = null

type StoreName = 'orbitalBodies' | 'pois' | 'locations' | 'commodities'

function resetObjectStore(db: IDBPDatabase<ScHaulDB>, name: StoreName) {
  if (db.objectStoreNames.contains(name)) {
    db.deleteObjectStore(name)
  }
}

function createOrbitalBodiesStore(db: IDBPDatabase<ScHaulDB>) {
  const store = db.createObjectStore('orbitalBodies', { keyPath: 'item_id' })
  store.createIndex('by-system', 'System')
  store.createIndex('by-name', 'ObjectContainer')
  store.createIndex('by-internal', 'InternalName')
}

function createPoisStore(db: IDBPDatabase<ScHaulDB>) {
  const store = db.createObjectStore('pois', { keyPath: 'item_id' })
  store.createIndex('by-system', 'System')
  store.createIndex('by-container', 'ObjectContainer')
  store.createIndex('by-name', 'PoiName')
}

function createLocationsStore(db: IDBPDatabase<ScHaulDB>) {
  const store = db.createObjectStore('locations', { keyPath: 'id' })
  store.createIndex('by-system', 'system')
  store.createIndex('by-display-name', 'displayName')
  store.createIndex('by-normalized-name', 'normalizedNames', { multiEntry: true })
}

function createCommoditiesStore(db: IDBPDatabase<ScHaulDB>) {
  const store = db.createObjectStore('commodities', { keyPath: 'id' })
  store.createIndex('by-name', 'name')
  store.createIndex('by-code', 'code')
}

export async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ScHaulDB>('schaul-db', 3, {
      upgrade(db, oldVersion) {
        void oldVersion

        resetObjectStore(db, 'orbitalBodies')
        resetObjectStore(db, 'pois')
        resetObjectStore(db, 'locations')
        resetObjectStore(db, 'commodities')

        createOrbitalBodiesStore(db)
        createPoisStore(db)
        createLocationsStore(db)
        createCommoditiesStore(db)

        localStorage.removeItem('schaul_last_sync')
      },
    })
  }

  return dbPromise
}

function cloneLocation(record: PersistedLocationRecord): LocationResult {
  return {
    id: record.id,
    name: record.name,
    displayName: record.displayName,
    coords: record.coords,
    system: record.system,
    source: record.source,
    confidence: record.confidence,
    coordOrigin: record.coordOrigin,
    uex: record.uex
      ? {
          ...record.uex,
          terminalIds: [...record.uex.terminalIds],
        }
      : undefined,
  }
}

export async function getMergedLocationByName(name: string): Promise<LocationResult | null> {
  const normalized = normalizeLocationName(name)
  if (!normalized) return null

  const db = await getDB()
  const record =
    (await db.transaction('locations').store.index('by-normalized-name').get(normalized)) ?? null

  return record ? cloneLocation(record) : null
}

export const getLocationByName = getMergedLocationByName

export async function getMergedLocationSearchOptions(): Promise<LocationSearchOption[]> {
  const db = await getDB()
  const locations = await db.getAll('locations')

  return locations
    .filter((location) => location.isUiSelectable)
    .map((location) => toLocationSearchOption(location))
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
}

export async function getCachedCommodities(): Promise<Commodity[]> {
  const db = await getDB()
  const commodities = await db.getAll('commodities')

  return commodities.slice().sort((left, right) => {
    if (left.is_illegal !== right.is_illegal) {
      return left.is_illegal - right.is_illegal
    }

    return left.name.localeCompare(right.name)
  })
}

export async function syncDatabaseIfNeeded(force = false) {
  if (syncPromise) {
    return syncPromise
  }

  const lastSyncStr = localStorage.getItem('schaul_last_sync')
  const lastSync = lastSyncStr ? Number.parseInt(lastSyncStr, 10) : 0
  const oneWeek = 7 * 24 * 60 * 60 * 1000
  const now = Date.now()

  if (!force && lastSync > 0 && now - lastSync < oneWeek) {
    return
  }

  syncPromise = (async () => {
    clearUexResourceCache()

    try {
      const [
        bodies,
        pois,
        cities,
        spaceStations,
        outposts,
        uexPois,
        terminals,
        commodities,
      ] = await Promise.all([
        fetchOrbitalBodies(),
        fetchPOIs(),
        fetchUexCities(),
        fetchUexSpaceStations(),
        fetchUexOutposts(),
        fetchUexPois(),
        fetchUexTerminals(),
        fetchUexCommodities(),
      ])

      const locations = buildPersistedLocationCatalog({
        bodies,
        pois,
        cities,
        spaceStations,
        outposts,
        uexPois,
        terminals,
      })

      const db = await getDB()
      const tx = db.transaction(
        ['orbitalBodies', 'pois', 'locations', 'commodities'],
        'readwrite'
      )

      const orbitalBodiesStore = tx.objectStore('orbitalBodies')
      const poisStore = tx.objectStore('pois')
      const locationsStore = tx.objectStore('locations')
      const commoditiesStore = tx.objectStore('commodities')

      await Promise.all([
        orbitalBodiesStore.clear(),
        poisStore.clear(),
        locationsStore.clear(),
        commoditiesStore.clear(),
      ])

      bodies.forEach((body) => {
        orbitalBodiesStore.put(body)
      })
      pois.forEach((poi) => {
        poisStore.put(poi)
      })
      locations.forEach((location) => {
        locationsStore.put(location)
      })
      commodities.forEach((commodity) => {
        commoditiesStore.put(commodity)
      })

      await tx.done
      localStorage.setItem('schaul_last_sync', now.toString())
    } catch (error) {
      console.error('Failed to sync database:', error)
      throw error
    } finally {
      syncPromise = null
    }
  })()

  return syncPromise
}
