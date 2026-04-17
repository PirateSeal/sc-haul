import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchOrbitalBodies, fetchPOIs, fetchCommodities } from '@/services/api';

function makeResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// fetchOrbitalBodies
// ---------------------------------------------------------------------------
describe('fetchOrbitalBodies', () => {
  it('returns parsed array on success', async () => {
    const data = [{ item_id: 1, System: 'Stanton', ObjectContainer: 'Crusader', InternalName: 'Stanton2', Type: 'Planet', XCoord: 0, YCoord: 0, ZCoord: 0 }];
    vi.mocked(fetch).mockResolvedValue(makeResponse(data));

    const result = await fetchOrbitalBodies();
    expect(result).toHaveLength(1);
    expect(result[0].ObjectContainer).toBe('Crusader');
  });

  it('throws when response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse('error', false, 500));
    await expect(fetchOrbitalBodies()).rejects.toThrow('Failed to fetch orbital bodies');
  });

  it('calls the correct endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse([]));
    await fetchOrbitalBodies();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('starmap.space'));
  });
});

// ---------------------------------------------------------------------------
// fetchPOIs
// ---------------------------------------------------------------------------
describe('fetchPOIs', () => {
  it('returns parsed array on success', async () => {
    const data = [{ item_id: 10, System: 'Stanton', Planet: 'Crusader', ObjectContainer: 'Seraphim Station', PoiName: 'Seraphim Station', Type: 'Station', XCoord: 1, YCoord: 2, ZCoord: 3 }];
    vi.mocked(fetch).mockResolvedValue(makeResponse(data));

    const result = await fetchPOIs();
    expect(result).toHaveLength(1);
    expect(result[0].PoiName).toBe('Seraphim Station');
  });

  it('throws when response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse('error', false, 503));
    await expect(fetchPOIs()).rejects.toThrow('Failed to fetch POIs');
  });

  it('calls the correct endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse([]));
    await fetchPOIs();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('pois'));
  });
});

// ---------------------------------------------------------------------------
// fetchCommodities
// ---------------------------------------------------------------------------
describe('fetchCommodities', () => {
  it('returns array directly when API responds with an array', async () => {
    const data = [{ id: 1, name: 'Iron', code: 'IRON', kind: 'Metal', is_illegal: 0 }];
    vi.mocked(fetch).mockResolvedValue(makeResponse(data));

    const result = await fetchCommodities();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Iron');
  });

  it('unwraps data property when API responds with { data: [...] }', async () => {
    const data = [{ id: 2, name: 'Stims', code: 'STIM', kind: 'Drug', is_illegal: 1 }];
    vi.mocked(fetch).mockResolvedValue(makeResponse({ status: 'ok', data }));

    const result = await fetchCommodities();
    expect(result).toHaveLength(1);
    expect(result[0].is_illegal).toBe(1);
  });

  it('returns empty array when wrapped response has no data property', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse({ status: 'ok' }));
    const result = await fetchCommodities();
    expect(result).toEqual([]);
  });

  it('throws when response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse('error', false, 400));
    await expect(fetchCommodities()).rejects.toThrow('Failed to fetch commodities');
  });

  it('calls the correct endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(makeResponse([]));
    await fetchCommodities();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('uexcorp'));
  });
});
