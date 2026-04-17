import {
  getMergedLocationByName,
  getMergedLocationSearchOptions,
} from '@/services/db'
export type {
  LocationConfidence,
  LocationCoordOrigin,
  LocationResult,
  LocationSearchOption,
  LocationSource,
  PersistedLocationRecord,
  UexLocationMetadata,
} from '@/services/location-catalog-data'
import { normalizeLocationName } from '@/lib/utils'

export function clearLocationCatalogCache() {}

export const getLocationByName = getMergedLocationByName
export const getLocationSearchOptions = getMergedLocationSearchOptions

export async function getSearchableLocationNames(): Promise<string[]> {
  const options = await getLocationSearchOptions()
  const names = new Map<string, string>()

  options.forEach((option) => {
    option.searchTerms.forEach((term) => {
      const normalized = normalizeLocationName(term)
      if (!normalized || names.has(normalized)) return
      names.set(normalized, term)
    })
  })

  return [...names.values()].sort((a, b) => a.localeCompare(b))
}
