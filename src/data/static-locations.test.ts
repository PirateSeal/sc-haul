import { describe, it, expect } from 'vitest';
import { STATIC_LOCATIONS, findStaticLocation, type StaticLocation } from '@/data/static-locations';

describe('STATIC_LOCATIONS', () => {
  it('is an array', () => {
    expect(Array.isArray(STATIC_LOCATIONS)).toBe(true);
  });

  it('starts empty (all major locations covered by API)', () => {
    expect(STATIC_LOCATIONS).toHaveLength(0);
  });
});

describe('findStaticLocation', () => {
  it('returns null when the list is empty', () => {
    expect(findStaticLocation('Anywhere')).toBeNull();
  });

  it('returns null for unknown location name', () => {
    expect(findStaticLocation('Nonexistent Station')).toBeNull();
  });
});

describe('findStaticLocation with populated list', () => {
  // Temporarily inject a fake entry to test matching logic
  const fakeEntry: StaticLocation = {
    id: -1,
    name: 'Test Station Alpha',
    system: 'Stanton',
    type: 'Station',
    parentBody: 'Hurston',
    x: 1e9,
    y: 2e9,
    z: 0,
  };

  beforeEach(() => {
    STATIC_LOCATIONS.push(fakeEntry);
  });

  afterEach(() => {
    STATIC_LOCATIONS.length = 0;
  });

  it('finds a location by exact name', () => {
    const result = findStaticLocation('Test Station Alpha');
    expect(result).not.toBeNull();
    expect(result!.id).toBe(-1);
  });

  it('finds a location case-insensitively', () => {
    expect(findStaticLocation('test station alpha')).not.toBeNull();
    expect(findStaticLocation('TEST STATION ALPHA')).not.toBeNull();
    expect(findStaticLocation('Test Station ALPHA')).not.toBeNull();
  });

  it('returns the full location object', () => {
    const result = findStaticLocation('Test Station Alpha');
    expect(result).toEqual(fakeEntry);
  });

  it('returns null for a different name even with populated list', () => {
    expect(findStaticLocation('Crusader')).toBeNull();
  });
});
