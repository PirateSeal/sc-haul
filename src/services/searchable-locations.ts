import { getDB } from '@/services/db'
import { LAGRANGE_STATION_MAP, STATIC_LOCATIONS } from '@/data/static-locations'

const EXCLUDED_POI_TYPES = new Set([
  'Cave',
  'Wreck',
  'River',
  'Animal Area',
  'Mission Area',
  'Racetrack',
  'Racetrack (Community)',
  'Easteregg',
  'Unknown',
  'Event',
  'Object Container',
  'Orbital Laser Platform',
  'Planetary Alignment Facility',
  'Ground Activation Platform',
  'Asteroid Belt',
  'Missing Derelict Outpost',
  'Abandoned Outpost',
  'Comm Array',
])

const EXCLUDED_ORBITAL_BODY_TYPES = new Set([
  'Star',
  'Lagrange',
  'Lagrange Point',
  'AsteroidBelt',
  'Jumppoint',
])

export async function getSearchableLocationNames(): Promise<string[]> {
  const db = await getDB()
  const [pois, bodies] = await Promise.all([
    db.getAll('pois'),
    db.getAll('orbitalBodies'),
  ])

  const names = new Map<string, string>()
  const addName = (name: string | undefined) => {
    const trimmed = name?.trim()
    if (!trimmed) return

    const key = trimmed.toLowerCase()
    if (!names.has(key)) {
      names.set(key, trimmed)
    }
  }

  STATIC_LOCATIONS.forEach((location) => addName(location.name))

  pois.forEach((poi) => {
    if (!EXCLUDED_POI_TYPES.has(poi.Type)) {
      addName(poi.PoiName)
    }
  })

  bodies.forEach((body) => {
    if (!EXCLUDED_ORBITAL_BODY_TYPES.has(body.Type)) {
      addName(body.ObjectContainer)
    }
  })

  LAGRANGE_STATION_MAP.forEach((_, lagrangeCode) => addName(lagrangeCode))

  return [...names.values()].sort((a, b) => a.localeCompare(b))
}
