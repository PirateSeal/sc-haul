import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock idb before importing db.ts
// ---------------------------------------------------------------------------
const mockGet = vi.fn();
const mockIndex = vi.fn(() => ({ get: mockGet }));
const mockStore = vi.fn(() => ({ index: mockIndex }));
const mockTransaction = vi.fn(() => ({ store: mockStore() }));
const mockDB = { transaction: mockTransaction };

vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve(mockDB)),
}));

// Mock API to avoid real network calls
vi.mock('@/services/api', () => ({
  fetchOrbitalBodies: vi.fn(() => Promise.resolve([])),
  fetchPOIs: vi.fn(() => Promise.resolve([])),
}));

// ---------------------------------------------------------------------------
// Import after mocks are in place
// ---------------------------------------------------------------------------
import { getLocationByName, syncDatabaseIfNeeded } from '@/services/db';
import { fetchOrbitalBodies, fetchPOIs } from '@/services/api';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Default: nothing found in DB
  mockGet.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// getLocationByName
// ---------------------------------------------------------------------------
describe('getLocationByName', () => {
  it('returns null when nothing found in DB', async () => {
    const result = await getLocationByName('Nowhere');
    expect(result).toBeNull();
  });

  it('resolves a POI in Space using its own coordinates', async () => {
    const poi = {
      item_id: 42,
      System: 'Stanton',
      Planet: 'Space',
      ObjectContainer: 'STO-JP',
      PoiName: 'Stanton-Pyro Jump Point',
      Type: 'Jumppoint',
      XCoord: 3.31e9,
      YCoord: -27.98e9,
      ZCoord: -2.68e9,
    };
    // First call (pois by-name): return the POI
    // Second call (orbitalBodies by-name): shouldn't be called for Space POIs
    mockGet.mockResolvedValueOnce(poi);

    const result = await getLocationByName('Stanton-Pyro Jump Point');
    expect(result).not.toBeNull();
    expect(result!.coords).toEqual({ x: 3.31e9, y: -27.98e9, z: -2.68e9 });
    expect(result!.name).toBe('Stanton-Pyro Jump Point');
    expect(result!.system).toBe('Stanton');
  });

  it('resolves a planet-based POI using parent body coordinates', async () => {
    const poi = {
      item_id: 5,
      System: 'Stanton',
      Planet: 'Crusader',
      ObjectContainer: 'Seraphim Station',
      PoiName: 'Seraphim Station',
      Type: 'Station',
      XCoord: 100,
      YCoord: 200,
      ZCoord: 300,
    };
    const parentBody = {
      item_id: 2,
      System: 'Stanton',
      ObjectContainer: 'Crusader',
      InternalName: 'Stanton2',
      Type: 'Planet',
      XCoord: 1e10,
      YCoord: 2e10,
      ZCoord: 0,
    };
    // First call: POI found
    mockGet.mockResolvedValueOnce(poi);
    // Second call: parent body found
    mockGet.mockResolvedValueOnce(parentBody);

    const result = await getLocationByName('Seraphim Station');
    expect(result).not.toBeNull();
    // Coordinates should be parent body's heliocentric position
    expect(result!.coords).toEqual({ x: 1e10, y: 2e10, z: 0 });
  });

  it('falls back to POI own coordinates when parent body not found', async () => {
    const poi = {
      item_id: 5,
      System: 'Stanton',
      Planet: 'UnknownPlanet',
      ObjectContainer: 'Mystery Station',
      PoiName: 'Mystery Station',
      Type: 'Station',
      XCoord: 10,
      YCoord: 20,
      ZCoord: 30,
    };
    mockGet.mockResolvedValueOnce(poi);
    mockGet.mockResolvedValueOnce(undefined); // parent body not found

    const result = await getLocationByName('Mystery Station');
    expect(result).not.toBeNull();
    // Falls back to km → m conversion
    expect(result!.coords).toEqual({ x: 10_000, y: 20_000, z: 30_000 });
  });

  it('resolves an orbital body when no POI matches', async () => {
    const body = {
      item_id: 1,
      System: 'Stanton',
      ObjectContainer: 'Hurston',
      InternalName: 'Stanton1',
      Type: 'Planet',
      XCoord: 1e10,
      YCoord: 0,
      ZCoord: 0,
    };
    mockGet.mockResolvedValueOnce(undefined); // no POI
    mockGet.mockResolvedValueOnce(body);       // orbital body found

    const result = await getLocationByName('Hurston');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Hurston');
    expect(result!.coords).toEqual({ x: 1e10, y: 0, z: 0 });
  });

  it('returns null when neither POI nor orbital body found', async () => {
    mockGet.mockResolvedValue(undefined);
    const result = await getLocationByName('Nonexistent Place');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// syncDatabaseIfNeeded
// ---------------------------------------------------------------------------
describe('syncDatabaseIfNeeded', () => {
  const mockClear = vi.fn(() => Promise.resolve());
  const mockPut = vi.fn();
  const mockTxDone = Promise.resolve();
  const mockObjectStore = vi.fn(() => ({ clear: mockClear, put: mockPut }));
  const mockRwTx = { objectStore: mockObjectStore, done: mockTxDone };

  beforeEach(() => {
    // Provide readwrite transaction for sync
    (mockDB as unknown as Record<string, unknown>).transaction = vi.fn((stores: string | string[], mode?: string) => {
      if (mode === 'readwrite') return mockRwTx;
      return { store: mockStore() };
    });
  });

  it('skips fetch when recently synced (within 1 week)', async () => {
    const recentSync = Date.now() - 1000; // 1 second ago
    localStorage.setItem('schaul_last_sync', recentSync.toString());

    await syncDatabaseIfNeeded();

    expect(fetchOrbitalBodies).not.toHaveBeenCalled();
    expect(fetchPOIs).not.toHaveBeenCalled();
  });

  it('fetches when no sync has occurred', async () => {
    vi.mocked(fetchOrbitalBodies).mockResolvedValue([]);
    vi.mocked(fetchPOIs).mockResolvedValue([]);

    await syncDatabaseIfNeeded();

    expect(fetchOrbitalBodies).toHaveBeenCalled();
    expect(fetchPOIs).toHaveBeenCalled();
  });

  it('fetches when last sync is older than 1 week', async () => {
    const oldSync = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
    localStorage.setItem('schaul_last_sync', oldSync.toString());

    vi.mocked(fetchOrbitalBodies).mockResolvedValue([]);
    vi.mocked(fetchPOIs).mockResolvedValue([]);

    await syncDatabaseIfNeeded();

    expect(fetchOrbitalBodies).toHaveBeenCalled();
  });

  it('fetches when force=true even if recently synced', async () => {
    localStorage.setItem('schaul_last_sync', Date.now().toString());

    vi.mocked(fetchOrbitalBodies).mockResolvedValue([]);
    vi.mocked(fetchPOIs).mockResolvedValue([]);

    await syncDatabaseIfNeeded(true);

    expect(fetchOrbitalBodies).toHaveBeenCalled();
  });

  it('updates schaul_last_sync timestamp after successful fetch', async () => {
    vi.mocked(fetchOrbitalBodies).mockResolvedValue([]);
    vi.mocked(fetchPOIs).mockResolvedValue([]);

    const before = Date.now();
    await syncDatabaseIfNeeded();
    const after = Date.now();

    const stored = parseInt(localStorage.getItem('schaul_last_sync') ?? '0', 10);
    expect(stored).toBeGreaterThanOrEqual(before);
    expect(stored).toBeLessThanOrEqual(after);
  });
});
