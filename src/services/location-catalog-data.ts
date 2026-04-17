import type { OrbitalBody, POI } from '@/services/api'
import {
  isLiveVisibleUexLocation,
  type UexCity,
  type UexOutpost,
  type UexPoi,
  type UexSpaceStation,
  type UexTerminal,
} from '@/services/uex'
import {
  LAGRANGE_STATION_MAP,
  STATIC_LOCATIONS,
  STATION_LAGRANGE_MAP,
} from '@/data/static-locations'
import { normalizeLocationName, stableHash } from '@/lib/utils'

const SEARCHABLE_SYSTEMS = new Set(['Stanton', 'Pyro', 'Nyx'])

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

const MANUAL_LOCATION_OVERRIDES = new Map<string, string>([
  ['deakins research', 'Deakins Research Outpost'],
  ['hickes research', 'Hickes Research Outpost'],
  ['samson & sons salvage center', "Samson & Son's Salvage Yard (old)"],
  ['samson sons salvage center', "Samson & Son's Salvage Yard (old)"],
  ['shady glen', 'Shady Glen Farms'],
])

const GATEWAY_TARGETS = new Map<string, string>([
  ['pyro gateway', 'Jump Point to Pyro'],
  ['pyro gateway stanton', 'Jump Point to Pyro'],
  ['terra gateway', 'Jump Point to Terra'],
  ['terra gateway stanton', 'Jump Point to Terra'],
  ['nyx gateway', 'Gateway Station Stanton'],
  ['nyx gateway stanton', 'Gateway Station Stanton'],
])

export type LocationSource = 'starmap' | 'uex-matched' | 'uex-fallback'
export type LocationConfidence =
  | 'exact'
  | 'alias'
  | 'gateway-fallback'
  | 'parent-fallback'
export type LocationCoordOrigin =
  | 'starmap-body'
  | 'starmap-poi'
  | 'starmap-jump-point'
  | 'uex-parent-fallback'

export interface UexLocationMetadata {
  cityId?: number
  spaceStationId?: number
  outpostId?: number
  poiId?: number
  terminalIds: number[]
  hasFreightElevator?: boolean
}

export interface LocationResult {
  id: number
  name: string
  displayName: string
  coords: { x: number; y: number; z: number }
  system: string
  source: LocationSource
  confidence: LocationConfidence
  coordOrigin: LocationCoordOrigin
  uex?: UexLocationMetadata
}

export interface LocationSearchOption extends LocationResult {
  aliases: string[]
  searchTerms: string[]
}

export interface PersistedLocationRecord extends LocationSearchOption {
  normalizedNames: string[]
  hasFreightElevator: boolean
  isUiSelectable: boolean
}

interface CatalogEntry extends LocationResult {
  searchableNames: Set<string>
  aliasNames: Set<string>
}

interface LocationCatalogState {
  aliasToEntry: Map<string, CatalogEntry>
  entriesById: Map<number, CatalogEntry>
}

type UexOwnerRecord =
  | ({ kind: 'city' } & UexCity)
  | ({ kind: 'space-station' } & UexSpaceStation)
  | ({ kind: 'outpost' } & UexOutpost)
  | ({ kind: 'poi' } & UexPoi)

export interface BuildPersistedLocationCatalogInput {
  bodies: OrbitalBody[]
  pois: POI[]
  cities: UexCity[]
  spaceStations: UexSpaceStation[]
  outposts: UexOutpost[]
  uexPois: UexPoi[]
  terminals: UexTerminal[]
}

function isJumpPointPoi(poi: Pick<POI, 'Type' | 'PoiName'>) {
  return poi.Type.toLowerCase().includes('jump') || poi.PoiName.startsWith('Jump Point')
}

function makeCatalogEntry(input: Omit<CatalogEntry, 'searchableNames' | 'aliasNames'>) {
  return {
    ...input,
    searchableNames: new Set<string>(),
    aliasNames: new Set<string>(),
  }
}

function cloneLocationResult(entry: CatalogEntry): LocationResult {
  return {
    id: entry.id,
    name: entry.name,
    displayName: entry.displayName,
    coords: entry.coords,
    system: entry.system,
    source: entry.source,
    confidence: entry.confidence,
    coordOrigin: entry.coordOrigin,
    uex: entry.uex
      ? {
          ...entry.uex,
          terminalIds: [...entry.uex.terminalIds],
        }
      : undefined,
  }
}

function registerAlias(
  state: LocationCatalogState,
  entry: CatalogEntry,
  alias: string | null | undefined
) {
  const trimmed = alias?.trim()
  if (!trimmed) return

  const normalized = normalizeLocationName(trimmed)
  if (!normalized) return

  entry.aliasNames.add(trimmed)
  if (!state.aliasToEntry.has(normalized)) {
    state.aliasToEntry.set(normalized, entry)
  }
}

function registerEntry(
  state: LocationCatalogState,
  entry: CatalogEntry,
  aliases: Array<string | null | undefined>,
  searchableNames: Array<string | null | undefined>
) {
  aliases.forEach((alias) => registerAlias(state, entry, alias))

  searchableNames.forEach((name) => {
    const trimmed = name?.trim()
    if (!trimmed) return
    entry.searchableNames.add(trimmed)
  })

  state.entriesById.set(entry.id, entry)
}

function mergeUexMetadata(entry: CatalogEntry, metadata: Partial<UexLocationMetadata>) {
  const existing = entry.uex ?? { terminalIds: [] }
  entry.uex = {
    ...existing,
    ...metadata,
    terminalIds: Array.from(
      new Set([...(existing.terminalIds ?? []), ...(metadata.terminalIds ?? [])])
    ),
  }
}

function entryHasFreightElevator(entry: CatalogEntry) {
  return entry.uex?.hasFreightElevator === true || (entry.uex?.terminalIds.length ?? 0) > 0
}

function buildStaticLocationEntry(location: (typeof STATIC_LOCATIONS)[number]): CatalogEntry {
  return makeCatalogEntry({
    id: location.id,
    name: location.name,
    displayName: location.name,
    coords: { x: location.x, y: location.y, z: location.z },
    system: location.system,
    source: 'starmap',
    confidence: 'exact',
    coordOrigin: 'starmap-body',
  })
}

function buildBodyEntry(body: OrbitalBody): CatalogEntry {
  const lpCode = STATION_LAGRANGE_MAP.get(body.ObjectContainer)
  const displayName = lpCode ? `${lpCode} ${body.ObjectContainer}` : body.ObjectContainer

  return makeCatalogEntry({
    id: body.item_id,
    name: body.ObjectContainer,
    displayName,
    coords: { x: body.XCoord, y: body.YCoord, z: body.ZCoord },
    system: body.System,
    source: 'starmap',
    confidence: lpCode ? 'alias' : 'exact',
    coordOrigin: 'starmap-body',
  })
}

function resolvePoiCoordinates(
  poi: POI,
  bodiesByName: Map<string, OrbitalBody>
): { coords: { x: number; y: number; z: number }; coordOrigin: LocationCoordOrigin } {
  if (poi.Planet === 'Space' || !poi.Planet) {
    return {
      coords: { x: poi.XCoord, y: poi.YCoord, z: poi.ZCoord },
      coordOrigin: isJumpPointPoi(poi) ? 'starmap-jump-point' : 'starmap-poi',
    }
  }

  const specificBody =
    poi.ObjectContainer && poi.ObjectContainer !== poi.Planet
      ? bodiesByName.get(normalizeLocationName(poi.ObjectContainer))
      : null
  const parentBody = specificBody ?? bodiesByName.get(normalizeLocationName(poi.Planet))

  if (parentBody) {
    return {
      coords: {
        x: parentBody.XCoord,
        y: parentBody.YCoord,
        z: parentBody.ZCoord,
      },
      coordOrigin: 'starmap-body',
    }
  }

  return {
    coords: {
      x: poi.XCoord * 1000,
      y: poi.YCoord * 1000,
      z: poi.ZCoord * 1000,
    },
    coordOrigin: 'starmap-poi',
  }
}

function buildPoiEntry(poi: POI, bodiesByName: Map<string, OrbitalBody>): CatalogEntry {
  const { coords, coordOrigin } = resolvePoiCoordinates(poi, bodiesByName)

  return makeCatalogEntry({
    id: poi.item_id,
    name: poi.PoiName,
    displayName: poi.PoiName,
    coords,
    system: poi.System,
    source: 'starmap',
    confidence: 'exact',
    coordOrigin,
  })
}

function buildStarmapCatalog(bodies: OrbitalBody[], pois: POI[]): LocationCatalogState {
  const state: LocationCatalogState = {
    aliasToEntry: new Map(),
    entriesById: new Map(),
  }

  STATIC_LOCATIONS.forEach((location) => {
    const entry = buildStaticLocationEntry(location)
    registerEntry(state, entry, [entry.name, entry.displayName], [entry.displayName])
  })

  const bodiesByName = new Map(
    bodies.map((body) => [normalizeLocationName(body.ObjectContainer), body])
  )

  pois.forEach((poi) => {
    const entry = buildPoiEntry(poi, bodiesByName)
    registerEntry(
      state,
      entry,
      [entry.name, entry.displayName],
      EXCLUDED_POI_TYPES.has(poi.Type) ? [] : [entry.displayName]
    )
  })

  bodies.forEach((body) => {
    const entry = buildBodyEntry(body)
    const lpCode = STATION_LAGRANGE_MAP.get(body.ObjectContainer)
    registerEntry(
      state,
      entry,
      [entry.name, entry.displayName, lpCode],
      EXCLUDED_ORBITAL_BODY_TYPES.has(body.Type)
        ? lpCode
          ? [lpCode]
          : []
        : lpCode
          ? [entry.name, entry.displayName, lpCode]
          : [entry.name]
    )
  })

  LAGRANGE_STATION_MAP.forEach((stationName, lagrangeCode) => {
    const stationEntry = state.aliasToEntry.get(normalizeLocationName(stationName))
    if (stationEntry) {
      registerEntry(state, stationEntry, [lagrangeCode], [lagrangeCode])
    }
  })

  return state
}

function getScopedSystemName(systemName: string | null | undefined) {
  const trimmed = systemName?.trim()
  if (!trimmed || !SEARCHABLE_SYSTEMS.has(trimmed)) return null
  return trimmed
}

function findEntryByAliases(
  state: LocationCatalogState,
  aliases: Array<string | null | undefined>
) {
  for (const alias of aliases) {
    const normalized = normalizeLocationName(alias)
    if (!normalized) continue

    const exact = state.aliasToEntry.get(normalized)
    if (exact) return exact

    const overrideName = MANUAL_LOCATION_OVERRIDES.get(normalized)
    if (overrideName) {
      const overrideMatch = state.aliasToEntry.get(normalizeLocationName(overrideName))
      if (overrideMatch) return overrideMatch
    }
  }

  return null
}

function findGatewayEntry(
  state: LocationCatalogState,
  aliases: Array<string | null | undefined>
) {
  for (const alias of aliases) {
    const normalized = normalizeLocationName(alias)
    if (!normalized) continue

    const gatewayTarget = GATEWAY_TARGETS.get(normalized)
    if (!gatewayTarget) continue

    const targetAliases = [
      gatewayTarget,
      gatewayTarget.replace(/^Jump Point to /, 'Gateway Station '),
    ]

    for (const targetAlias of targetAliases) {
      const gatewayMatch = state.aliasToEntry.get(normalizeLocationName(targetAlias))
      if (gatewayMatch) return gatewayMatch
    }
  }

  return null
}

function getParentFallbackEntry(
  state: LocationCatalogState,
  parentNames: Array<string | null | undefined>,
  systemName: string | null | undefined
) {
  const directParent = findEntryByAliases(state, parentNames)
  if (directParent) return directParent

  const scopedSystem = getScopedSystemName(systemName)
  if (!scopedSystem) return null

  return (
    state.aliasToEntry.get(normalizeLocationName(`${scopedSystem} Star`)) ??
    state.aliasToEntry.get(normalizeLocationName(scopedSystem))
  )
}

function getOwnerNames(record: UexOwnerRecord) {
  return [record.name, 'nickname' in record ? record.nickname : null]
}

function createFallbackEntry(
  record: UexOwnerRecord,
  fallbackTarget: CatalogEntry,
  confidence: LocationConfidence
): CatalogEntry {
  return makeCatalogEntry({
    id: -stableHash(`uex:${record.kind}:${record.id}`),
    name: record.name,
    displayName: record.name,
    coords: fallbackTarget.coords,
    system: getScopedSystemName(record.star_system_name) ?? fallbackTarget.system,
    source: 'uex-fallback',
    confidence,
    coordOrigin:
      confidence === 'gateway-fallback' ? fallbackTarget.coordOrigin : 'uex-parent-fallback',
  })
}

function buildFreightTerminalsByOwner(terminals: UexTerminal[]) {
  const city = new Map<number, number[]>()
  const spaceStation = new Map<number, number[]>()
  const outpost = new Map<number, number[]>()
  const poi = new Map<number, number[]>()

  const assign = (map: Map<number, number[]>, id: number, terminalId: number) => {
    if (!id) return
    const existing = map.get(id) ?? []
    existing.push(terminalId)
    map.set(id, existing)
  }

  terminals.forEach((terminal) => {
    if (
      terminal.is_available_live !== 1 ||
      terminal.is_visible !== 1 ||
      terminal.has_freight_elevator !== 1
    ) {
      return
    }

    assign(city, terminal.id_city, terminal.id)
    assign(spaceStation, terminal.id_space_station, terminal.id)
    assign(outpost, terminal.id_outpost, terminal.id)
    assign(poi, terminal.id_poi, terminal.id)
  })

  return { city, spaceStation, outpost, poi }
}

function applyUexOwnerRecord(
  state: LocationCatalogState,
  record: UexOwnerRecord,
  freightTerminalsByOwner: {
    city: Map<number, number[]>
    spaceStation: Map<number, number[]>
    outpost: Map<number, number[]>
    poi: Map<number, number[]>
  },
  ownerEntryByKey: Map<string, CatalogEntry>
) {
  const systemName = getScopedSystemName(record.star_system_name)
  if (!systemName || !isLiveVisibleUexLocation(record)) return

  const aliases = getOwnerNames(record)
  const matchedEntry = findEntryByAliases(state, aliases)
  const ownerKey = `${record.kind}:${record.id}`
  const terminalIds =
    record.kind === 'city'
      ? freightTerminalsByOwner.city.get(record.id) ?? []
      : record.kind === 'space-station'
        ? freightTerminalsByOwner.spaceStation.get(record.id) ?? []
        : record.kind === 'outpost'
          ? freightTerminalsByOwner.outpost.get(record.id) ?? []
          : freightTerminalsByOwner.poi.get(record.id) ?? []

  const metadata =
    record.kind === 'city'
      ? {
          cityId: record.id,
          terminalIds,
          hasFreightElevator: record.has_freight_elevator === 1,
        }
      : record.kind === 'space-station'
        ? {
            spaceStationId: record.id,
            terminalIds,
            hasFreightElevator: record.has_freight_elevator === 1,
          }
        : record.kind === 'outpost'
          ? {
              outpostId: record.id,
              terminalIds,
              hasFreightElevator: record.has_freight_elevator === 1,
            }
          : {
              poiId: record.id,
              terminalIds,
              hasFreightElevator: record.has_freight_elevator === 1,
            }

  if (matchedEntry) {
    matchedEntry.source = 'uex-matched'
    mergeUexMetadata(matchedEntry, metadata)
    registerEntry(state, matchedEntry, aliases, aliases)
    ownerEntryByKey.set(ownerKey, matchedEntry)
    return
  }

  const gatewayMatch = findGatewayEntry(state, aliases)
  const fallbackTarget =
    gatewayMatch ??
    getParentFallbackEntry(state, [record.moon_name, record.planet_name], record.star_system_name)

  if (!fallbackTarget) return

  const entry = createFallbackEntry(
    record,
    fallbackTarget,
    gatewayMatch ? 'gateway-fallback' : 'parent-fallback'
  )
  mergeUexMetadata(entry, metadata)
  registerEntry(state, entry, aliases, [record.name])
  ownerEntryByKey.set(ownerKey, entry)
}

function applyTerminals(
  state: LocationCatalogState,
  terminals: UexTerminal[],
  ownerEntryByKey: Map<string, CatalogEntry>
) {
  terminals.forEach((terminal) => {
    if (
      terminal.is_available_live !== 1 ||
      terminal.is_visible !== 1 ||
      !getScopedSystemName(terminal.star_system_name)
    ) {
      return
    }

    const ownerEntry =
      (terminal.id_city && ownerEntryByKey.get(`city:${terminal.id_city}`)) ||
      (terminal.id_space_station &&
        ownerEntryByKey.get(`space-station:${terminal.id_space_station}`)) ||
      (terminal.id_outpost && ownerEntryByKey.get(`outpost:${terminal.id_outpost}`)) ||
      (terminal.id_poi && ownerEntryByKey.get(`poi:${terminal.id_poi}`)) ||
      findEntryByAliases(state, [
        terminal.city_name,
        terminal.space_station_name,
        terminal.outpost_name,
        terminal.displayname,
      ])

    if (!ownerEntry) return

    if (terminal.has_freight_elevator === 1) {
      mergeUexMetadata(ownerEntry, { terminalIds: [terminal.id] })
    }

    registerEntry(
      state,
      ownerEntry,
      [
        terminal.city_name,
        terminal.space_station_name,
        terminal.outpost_name,
        terminal.displayname,
      ],
      [
        terminal.city_name,
        terminal.space_station_name,
        terminal.outpost_name,
        terminal.displayname,
      ]
    )
  })
}

function toPersistedRecord(entry: CatalogEntry): PersistedLocationRecord {
  const aliases = [...entry.aliasNames].sort((a, b) => a.localeCompare(b))
  const searchTerms = [...new Set([...entry.aliasNames, ...entry.searchableNames])].sort((a, b) =>
    a.localeCompare(b)
  )
  const normalizedNames = [...new Set([...aliases, ...searchTerms])]
    .map((value) => normalizeLocationName(value))
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => a.localeCompare(b))
  const hasFreightElevator = entryHasFreightElevator(entry)

  return {
    ...cloneLocationResult(entry),
    aliases,
    searchTerms,
    normalizedNames,
    hasFreightElevator,
    isUiSelectable: hasFreightElevator,
  }
}

export function buildPersistedLocationCatalog({
  bodies,
  pois,
  cities,
  spaceStations,
  outposts,
  uexPois,
  terminals,
}: BuildPersistedLocationCatalogInput): PersistedLocationRecord[] {
  const state = buildStarmapCatalog(bodies, pois)
  const freightTerminalsByOwner = buildFreightTerminalsByOwner(terminals)
  const ownerEntryByKey = new Map<string, CatalogEntry>()

  const ownerRecords: UexOwnerRecord[] = [
    ...cities.map((city) => ({ ...city, kind: 'city' as const })),
    ...spaceStations.map((station) => ({ ...station, kind: 'space-station' as const })),
    ...outposts.map((outpost) => ({ ...outpost, kind: 'outpost' as const })),
    ...uexPois.map((poi) => ({ ...poi, kind: 'poi' as const })),
  ]

  ownerRecords.forEach((record) =>
    applyUexOwnerRecord(state, record, freightTerminalsByOwner, ownerEntryByKey)
  )
  applyTerminals(state, terminals, ownerEntryByKey)

  return [...state.entriesById.values()]
    .map(toPersistedRecord)
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
}

export function toLocationSearchOption(record: PersistedLocationRecord): LocationSearchOption {
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
    aliases: [...record.aliases],
    searchTerms: [...record.searchTerms],
  }
}
