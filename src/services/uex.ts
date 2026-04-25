export interface Commodity {
  id: number
  name: string
  code: string
  kind: string | null
  is_illegal: number
}

export interface UexVehicle {
  id: number
  name: string
  name_full: string | null
  company_name: string | null
  scu: number | string | null
  is_cargo: number | string | null
  is_concept: number | string | null
  is_spaceship: number | string | null
  is_ground_vehicle: number | string | null
  is_addon: number | string | null
}

export interface UexVehicleCatalogEntry {
  id: number
  name: string
  nameFull: string
  manufacturer: string | null
  scu: number
  searchTerms: string[]
  isCargo: boolean
  isConcept: boolean
}

interface UexLocationBase {
  id: number
  star_system_name: string | null
  planet_name: string | null
  moon_name: string | null
  orbit_name?: string | null
  is_available_live: number
  is_visible: number
  has_freight_elevator: number
}

export interface UexCity extends UexLocationBase {
  name: string
  code: string
}

export interface UexSpaceStation extends UexLocationBase {
  name: string
  nickname: string | null
  is_jump_point: number
}

export interface UexOutpost extends UexLocationBase {
  name: string
  nickname: string | null
}

export interface UexPoi extends UexLocationBase {
  name: string
  nickname: string | null
  type: string
}

export interface UexTerminal {
  id: number
  id_city: number
  id_outpost: number
  id_poi: number
  id_space_station: number
  name: string
  fullname: string | null
  displayname: string | null
  nickname: string | null
  type: string
  city_name: string | null
  outpost_name: string | null
  space_station_name: string | null
  star_system_name: string | null
  planet_name: string | null
  moon_name: string | null
  orbit_name: string | null
  is_available_live: number
  is_visible: number
  has_freight_elevator: number
}

type UexResponse<T> = {
  status?: string
  data?: T[]
}

const UEX_API_BASE = import.meta.env.PROD
  ? '/api/uex'
  : (import.meta.env.VITE_UEX_API_BASE ?? 'https://api.uexcorp.space/2.0')
const uexResourceCache = new Map<string, Promise<unknown[]>>()

interface UexFetchOptions {
  requireAuth?: boolean
  includeAuth?: boolean
}

function getUexHeaders({
  requireAuth = true,
  includeAuth = requireAuth,
}: UexFetchOptions = {}): HeadersInit {
  // In prod the Lambda proxy injects the Authorization header — no client token needed.
  const token = import.meta.env.PROD ? undefined : import.meta.env.VITE_UEX_BEARER_TOKEN?.trim()
  if (!token && requireAuth && !import.meta.env.PROD) {
    throw new Error('Missing VITE_UEX_BEARER_TOKEN for live UEX data.')
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  if (token && includeAuth) {
    headers.Authorization = `Bearer ${token}`
  }

  const clientVersion = import.meta.env.VITE_UEX_CLIENT_VERSION?.trim()
  if (clientVersion) {
    headers['X-Client-Version'] = clientVersion
  }

  return headers
}

async function fetchUexResource<T>(resource: string, options: UexFetchOptions = {}): Promise<T[]> {
  const cached = uexResourceCache.get(resource)
  if (cached) return cached as Promise<T[]>

  const pending = fetch(`${UEX_API_BASE}/${resource}`, {
    headers: getUexHeaders(options),
  }).then(async (response) => {
    if (!response.ok) {
      let details = ''

      try {
        const json = (await response.json()) as {
          message?: string
          status?: string
          http_code?: number
        }
        details = [json.status, json.message].filter(Boolean).join(': ')
      } catch {
        details = ''
      }

      throw new Error(
        details
          ? `Failed to fetch UEX ${resource} (${details})`
          : `Failed to fetch UEX ${resource}`
      )
    }

    const json = (await response.json()) as UexResponse<T>
    return Array.isArray(json.data) ? json.data : []
  })

  uexResourceCache.set(resource, pending as Promise<unknown[]>)

  try {
    return await pending
  } catch (error) {
    uexResourceCache.delete(resource)
    throw error
  }
}

export function clearUexResourceCache() {
  uexResourceCache.clear()
}

export function isLiveVisibleUexLocation(
  location: Pick<UexLocationBase, 'is_available_live' | 'is_visible'>
) {
  return location.is_available_live === 1 && location.is_visible === 1
}

export async function fetchUexCities() {
  return fetchUexResource<UexCity>('cities')
}

export async function fetchUexSpaceStations() {
  return fetchUexResource<UexSpaceStation>('space_stations')
}

export async function fetchUexOutposts() {
  return fetchUexResource<UexOutpost>('outposts')
}

export async function fetchUexPois() {
  return fetchUexResource<UexPoi>('poi')
}

export async function fetchUexTerminals() {
  return fetchUexResource<UexTerminal>('terminals?type=commodity')
}

export async function fetchCommodities(): Promise<Commodity[]> {
  return fetchUexResource<Commodity>('commodities')
}

function parseNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function parseFlag(value: number | string | null | undefined) {
  return parseNumber(value) === 1
}

function buildSearchTerms(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value))
    )
  )
}

function isCargoShipVehicle(vehicle: UexVehicle) {
  return (
    parseFlag(vehicle.is_spaceship) &&
    !parseFlag(vehicle.is_ground_vehicle) &&
    !parseFlag(vehicle.is_addon) &&
    parseNumber(vehicle.scu) > 0
  )
}

function toVehicleCatalogEntry(vehicle: UexVehicle): UexVehicleCatalogEntry {
  const name = vehicle.name.trim()
  const nameFull = vehicle.name_full?.trim() || name
  const manufacturer = vehicle.company_name?.trim() || null

  return {
    id: vehicle.id,
    name,
    nameFull,
    manufacturer,
    scu: parseNumber(vehicle.scu),
    searchTerms: buildSearchTerms([name, nameFull, manufacturer]),
    isCargo: parseFlag(vehicle.is_cargo),
    isConcept: parseFlag(vehicle.is_concept),
  }
}

export async function fetchUexVehicles(): Promise<UexVehicleCatalogEntry[]> {
  const vehicles = await fetchUexResource<UexVehicle>('vehicles')

  return vehicles
    .filter(isCargoShipVehicle)
    .map(toVehicleCatalogEntry)
    .sort((left, right) => {
      const manufacturerCompare = (left.manufacturer ?? '').localeCompare(right.manufacturer ?? '')
      if (manufacturerCompare !== 0) return manufacturerCompare

      const fullNameCompare = left.nameFull.localeCompare(right.nameFull)
      if (fullNameCompare !== 0) return fullNameCompare

      return left.scu - right.scu
    })
}
