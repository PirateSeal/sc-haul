/**
 * Static locations not provided by the starmap.space API.
 * Coordinates are heliocentric meters in the Stanton system.
 * Orbital stations use their parent planet's position (orbital altitude
 * is ~100-700 km, negligible at Gm routing scale).
 *
 * IDs are negative to avoid collisions with API item_ids.
 */
export interface StaticLocation {
  id: number;
  name: string;
  system: string;
  type: string;
  parentBody: string;
  x: number;
  y: number;
  z: number;
}

// All major trading locations are covered by the starmap.space APIs.
// Add entries here only for locations confirmed missing from both APIs.
export const STATIC_LOCATIONS: StaticLocation[] = [];

/**
 * Maps Lagrange point shorthand (e.g. "CRU-L3") to the station name stored in the DB
 * (e.g. "Thundering Express Station"). Derived from oc.json by nearest-station analysis.
 *
 * CRU-L2 and CRU-L3 are excluded — no stations are present at those points.
 */
export const LAGRANGE_STATION_MAP: ReadonlyMap<string, string> = new Map([
  // Hurston (HUR)
  ['HUR-L1', 'Green Glade Station'],
  ['HUR-L2', 'Faithful Dream Station'],
  ['HUR-L3', 'Thundering Express Station'],
  ['HUR-L4', 'Melodic Fields Station'],
  ['HUR-L5', 'High Course Station'],
  // Crusader (CRU) — L2 and L3 have no stations
  ['CRU-L1', 'Ambitious Dream Station'],
  ['CRU-L4', 'Shallow Fields Station'],
  ['CRU-L5', 'Beautiful Glen Station'],
  // ArcCorp (ARC)
  ['ARC-L1', 'Wide Forest Station'],
  ['ARC-L2', 'Lively Pathway Station'],
  ['ARC-L3', 'Modern Express Station'],
  ['ARC-L4', 'Faint Glen Station'],
  ['ARC-L5', 'Yellow Core Station'],
  // MicroTech (MIC)
  ['MIC-L1', 'Shallow Frontier Station'],
  ['MIC-L2', 'Long Forest Station'],
  ['MIC-L3', 'Endless Odyssey Station'],
  ['MIC-L4', 'Red Crossroads Station'],
  ['MIC-L5', 'Modern Icarus Station'],
]);

/** Reverse map: station name → LP code, for display purposes. */
export const STATION_LAGRANGE_MAP: ReadonlyMap<string, string> = new Map(
  Array.from(LAGRANGE_STATION_MAP, ([lp, station]) => [station, lp])
);

export function findStaticLocation(name: string): StaticLocation | null {
  return STATIC_LOCATIONS.find(
    l => l.name.toLowerCase() === name.toLowerCase()
  ) ?? null;
}
