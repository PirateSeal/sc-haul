/**
 * Map feature support data for the paused route-visualization work.
 * Canonical colors are kept here for future system-map rendering.
 * Keys match the ObjectContainer names returned by the starmap.space API.
 */
export const BODY_COLORS: ReadonlyMap<string, string> = new Map([
  // ── Stanton ──────────────────────────────────────────────────────────────
  // Hurston
  ['Hurston',   '#9A7B4F'],
  ['Arial',     '#E1B243'],
  ['Aberdeen',  '#968940'],
  ['Magda',     '#507C82'],
  ['Ita',       '#A19783'],
  // Crusader
  ['Crusader',  '#BF919C'],
  ['Cellin',    '#C0C0C0'],
  ['Daymar',    '#D2945D'],
  ['Yela',      '#9FBCC2'],
  // ArcCorp
  ['ArcCorp',   '#AC5E44'],
  ['Lyria',     '#8AA4B4'],
  ['Wala',      '#94958B'],
  // microTech
  ['microTech', '#A5C9EA'],
  ['Calliope',  '#BDC6CC'],
  ['Clio',      '#84A3B1'],
  ['Euterpe',   '#E0E5E7'],

  // ── Pyro ─────────────────────────────────────────────────────────────────
  ['Pyro I',    '#3A2E28'],
  ['Pyro II',   '#B58B4C'],
  ['Pyro III',  '#7A3B2E'],
  ['Pyro IV',   '#6B5B4E'],
  ['Pyro V',    '#606842'],
  ['Ignis',     '#D9A05B'],
  ['Vatur',     '#8C4839'],
  ['Adrano',    '#7B7E75'],
  ['Fuego',     '#C26D3C'],
  ['Vuur',      '#63645E'],
  ['Acheron',   '#4A5240'],
  ['Pyro VI',   '#4B4E6D'],

  // ── Nyx ──────────────────────────────────────────────────────────────────
  ['Nyx I',     '#3D3D3D'],
  ['Nyx II',    '#6B7B8C'],
  ['Nyx III',   '#A18E79'],
  ['Delamar',   '#555555'],
]);
