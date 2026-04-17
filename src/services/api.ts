export interface OrbitalBody {
  item_id: number;
  System: string;
  ObjectContainer: string;
  InternalName: string;
  Type: string;
  XCoord: number;
  YCoord: number;
  ZCoord: number;
}

export interface POI {
  item_id: number;
  System: string;
  Planet: string;       // parent body name, or "Space" for deep-space/jump-point locations
  ObjectContainer: string;
  PoiName: string;
  Type: string;
  XCoord: number;
  YCoord: number;
  ZCoord: number;
}

export interface Commodity {
  id: number;
  name: string;
  code: string;
  kind: string;
  is_illegal: number; // 0 or 1
}

const OC_URL = 'https://starmap.space/api/v3/oc/index.php';
const POIS_URL = 'https://starmap.space/api/v3/pois/index.php';
const COMMODITIES_URL = 'https://api.uexcorp.space/2.0/commodities';

export async function fetchOrbitalBodies(): Promise<OrbitalBody[]> {
  const rs = await fetch(OC_URL);
  if (!rs.ok) throw new Error('Failed to fetch orbital bodies');
  const text = await rs.text();
  return JSON.parse(text);
}

export async function fetchPOIs(): Promise<POI[]> {
  const rs = await fetch(POIS_URL);
  if (!rs.ok) throw new Error('Failed to fetch POIs');
  const text = await rs.text();
  return JSON.parse(text);
}

export async function fetchCommodities(): Promise<Commodity[]> {
  const rs = await fetch(COMMODITIES_URL);
  if (!rs.ok) throw new Error('Failed to fetch commodities');
  const json = await rs.json();
  // UEX Corp v2 API wraps results in { status, data: [...] }
  return Array.isArray(json) ? json : (json.data ?? []);
}
