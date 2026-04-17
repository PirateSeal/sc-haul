import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import { fetchOrbitalBodies, fetchPOIs } from '@/services/api';
import type { OrbitalBody, POI } from '@/services/api';
export type { OrbitalBody, POI } from '@/services/api';
import { findStaticLocation, LAGRANGE_STATION_MAP, STATION_LAGRANGE_MAP } from '@/data/static-locations';

interface ScHaulDB extends DBSchema {
  orbitalBodies: {
    key: number;
    value: OrbitalBody;
    // by-name  → ObjectContainer (human-readable, e.g. "Daymar")
    // by-internal → InternalName (game code, e.g. "Stanton2b")
    indexes: { 'by-system': string; 'by-name': string; 'by-internal': string };
  };
  pois: {
    key: number;
    value: POI;
    // by-name → PoiName (actual field from the API)
    indexes: { 'by-system': string; 'by-container': string; 'by-name': string };
  };
}

let dbPromise: Promise<IDBPDatabase<ScHaulDB>> | null = null;

export async function getDB() {
  if (!dbPromise) {
    // Version 2: fixes 'by-name' index on pois (PoiName not Name)
    //            and fixes orbitalBodies indexes
    dbPromise = openDB<ScHaulDB>('schaul-db', 2, {
      upgrade(db, oldVersion) {
        // ── orbitalBodies ──────────────────────────────────────────────
        if (db.objectStoreNames.contains('orbitalBodies')) {
          db.deleteObjectStore('orbitalBodies');
        }
        const ocStore = db.createObjectStore('orbitalBodies', { keyPath: 'item_id' });
        ocStore.createIndex('by-system',   'System');
        ocStore.createIndex('by-name',     'ObjectContainer'); // human-readable name
        ocStore.createIndex('by-internal', 'InternalName');    // game code

        // ── pois ───────────────────────────────────────────────────────
        if (db.objectStoreNames.contains('pois')) {
          db.deleteObjectStore('pois');
        }
        const poiStore = db.createObjectStore('pois', { keyPath: 'item_id' });
        poiStore.createIndex('by-system',    'System');
        poiStore.createIndex('by-container', 'ObjectContainer');
        poiStore.createIndex('by-name',      'PoiName'); // actual API field

        void oldVersion;

        // Force a full re-sync since the schema changed
        localStorage.removeItem('schaul_last_sync');
      },
    });
  }
  return dbPromise;
}

export type LocationResult = {
  id: number;
  /** Bare name as stored in the DB — used for re-resolution in the optimizer. */
  name: string;
  /** Display name with LP code prefix, e.g. "CRU-L1 Ambitious Dream Station". Falls back to name when not a Lagrange station. */
  displayName: string;
  coords: { x: number; y: number; z: number };
  system: string;
};

/** Look up a location by exact name.
 *  Priority: static locations → POIs → orbital bodies → LP alias
 *  Accepts bare LP codes ("CRU-L1") and full prefixed names ("CRU-L1 Ambitious Dream Station"). */
export async function getLocationByName(name: string): Promise<LocationResult | null> {
  // 1. Static hardcoded locations (anything not in either API)
  const staticLoc = findStaticLocation(name);
  if (staticLoc) {
    return {
      id: staticLoc.id,
      name: staticLoc.name,
      displayName: staticLoc.name,
      coords: { x: staticLoc.x, y: staticLoc.y, z: staticLoc.z },
      system: staticLoc.system,
    };
  }

  const db = await getDB();

  // 2. POIs — indexed by PoiName
  const poiIndex = db.transaction('pois').store.index('by-name');
  const poiEntry = await poiIndex.get(name);
  if (poiEntry) {
    let coords: { x: number; y: number; z: number };

    if (poiEntry.Planet === 'Space' || !poiEntry.Planet) {
      // Deep-space / jump-point POIs: coordinates are already heliocentric meters
      coords = { x: poiEntry.XCoord, y: poiEntry.YCoord, z: poiEntry.ZCoord };
    } else {
      // Surface/orbital POIs: XCoord/YCoord/ZCoord are body-relative km.
      // Prefer ObjectContainer (the specific moon/body the POI is on) over Planet
      // (the parent planet) so that e.g. Daymar stations resolve to Daymar's
      // heliocentric position rather than Crusader's.
      const bodyIndex = db.transaction('orbitalBodies').store.index('by-name');
      const specificBody =
        poiEntry.ObjectContainer && poiEntry.ObjectContainer !== poiEntry.Planet
          ? await bodyIndex.get(poiEntry.ObjectContainer)
          : null;
      const parentBody = specificBody ?? (await bodyIndex.get(poiEntry.Planet));
      if (parentBody) {
        coords = { x: parentBody.XCoord, y: parentBody.YCoord, z: parentBody.ZCoord };
      } else {
        // Fallback: treat body-relative km as heliocentric meters
        coords = { x: poiEntry.XCoord * 1000, y: poiEntry.YCoord * 1000, z: poiEntry.ZCoord * 1000 };
      }
    }

    return { id: poiEntry.item_id, name: poiEntry.PoiName, displayName: poiEntry.PoiName, coords, system: poiEntry.System };
  }

  // 3. Orbital bodies (planets, moons, stations) — heliocentric meters
  const bodyIndex = db.transaction('orbitalBodies').store.index('by-name');
  const bodyEntry = await bodyIndex.get(name);
  if (bodyEntry) {
    const lpCode = STATION_LAGRANGE_MAP.get(bodyEntry.ObjectContainer);
    const displayName = lpCode
      ? `${lpCode} ${bodyEntry.ObjectContainer}`
      : bodyEntry.ObjectContainer;
    return {
      id: bodyEntry.item_id,
      name: bodyEntry.ObjectContainer,
      displayName,
      coords: { x: bodyEntry.XCoord, y: bodyEntry.YCoord, z: bodyEntry.ZCoord },
      system: bodyEntry.System,
    };
  }

  // 4a. "LP-CODE Station Name" format (e.g. "CRU-L1 Ambitious Dream Station")
  //     Strip the code prefix and look up the bare station name.
  const spaceIdx = name.indexOf(' ');
  if (spaceIdx > 0) {
    const prefix = name.slice(0, spaceIdx).toUpperCase();
    if (LAGRANGE_STATION_MAP.has(prefix)) {
      return getLocationByName(name.slice(spaceIdx + 1));
    }
  }

  // 4b. Bare LP code alias (e.g. "CRU-L1" → "Ambitious Dream Station")
  const stationName = LAGRANGE_STATION_MAP.get(name.toUpperCase());
  if (stationName) return getLocationByName(stationName);

  return null;
}

export async function syncDatabaseIfNeeded(force = false) {
  const lastSyncStr = localStorage.getItem('schaul_last_sync');
  const lastSync = lastSyncStr ? parseInt(lastSyncStr, 10) : 0;
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (!force && lastSync > 0 && now - lastSync < ONE_WEEK) {
    return;
  }

  try {
    const [bodies, pois] = await Promise.all([
      fetchOrbitalBodies(),
      fetchPOIs(),
    ]);

    const db = await getDB();
    const tx = db.transaction(['orbitalBodies', 'pois'], 'readwrite');
    const bStore = tx.objectStore('orbitalBodies');
    const pStore = tx.objectStore('pois');

    await bStore.clear();
    await pStore.clear();

    for (const b of bodies) bStore.put(b);
    for (const p of pois)  pStore.put(p);

    await tx.done;
    localStorage.setItem('schaul_last_sync', now.toString());
  } catch (error) {
    console.error('Failed to sync database:', error);
    if (!lastSync) throw error;
  }
}
