/**
 * Map feature support data for the paused route-visualization work.
 * The starmap.space API does not expose parent relationships,
 * so this supplements the runtime data with explicit hierarchy.
 * Keys match OrbitalBody.ObjectContainer / POI.ObjectContainer exactly.
 */

/** moon ObjectContainer → parent planet ObjectContainer */
export const MOON_PARENT: ReadonlyMap<string, string> = new Map([
  // ── Stanton ──────────────────────────────────────────────────────────────
  // Hurston
  ['Aerial',     'Hurston'],
  ['Arial',      'Hurston'],   // legacy API variant
  ['Aberdeen',   'Hurston'],
  ['Ita',        'Hurston'],
  ['Magda',      'Hurston'],
  // Crusader
  ['Cellin',     'Crusader'],
  ['Daymar',     'Crusader'],
  ['Yela',       'Crusader'],
  // ArcCorp
  ['Lyria',      'ArcCorp'],
  ['Wala',       'ArcCorp'],
  // microTech
  ['Calliope',   'microTech'],
  ['Clio',       'microTech'],
  ['Euterpe',    'microTech'],

  // ── Pyro ─────────────────────────────────────────────────────────────────
  // Pyro V
  ['Ignis',      'Pyro V'],
  ['Vultus',     'Pyro V'],
  ['Adrasteia',  'Pyro V'],
  ['Fyr',        'Pyro V'],
  ['Vatach',     'Pyro V'],
  ['Monolith',   'Pyro V'],

  // ── Nyx ──────────────────────────────────────────────────────────────────
  ['Delamar',    'Nyx II'],
]);

/**
 * Orbital station ObjectContainer → parent planet ObjectContainer.
 * These stations orbit their planet directly (not at Lagrange points)
 * and appear in the planet's subsystem ring when focused.
 */
export const ORBITAL_STATION: ReadonlyMap<string, string> = new Map([
  // ── Stanton ──────────────────────────────────────────────────────────────
  ['Everus Harbor',     'Hurston'],
  ['Seraphim Station',  'Crusader'],
  ['Baijini Point',     'ArcCorp'],
  ['Port Tressler',     'microTech'],

  // ── Pyro ─────────────────────────────────────────────────────────────────
  ['Checkmate',         'Pyro VI'],
]);

/** planet ObjectContainer → moon ObjectContainer[] (inverse of MOON_PARENT) */
export const PLANET_MOONS: ReadonlyMap<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const [moon, planet] of MOON_PARENT) {
    const list = map.get(planet) ?? [];
    list.push(moon);
    map.set(planet, list);
  }
  return map;
})();
