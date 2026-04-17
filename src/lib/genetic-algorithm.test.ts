import { describe, it, expect } from 'vitest';
import {
  calculateRouteDistance,
  splitMissionsForCapacity,
  optimizeRoute,
  type GAMission,
  type RouteNode,
  type Point3D,
} from '@/lib/genetic-algorithm';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const P = (x: number, y: number, z = 0): Point3D => ({ x, y, z });

const ORIGIN = P(0, 0, 0);

function makeMission(id: string, scu: number, pickup: Point3D, dropoff: Point3D): GAMission {
  return { id, originalMissionId: id, sourceId: id, scu, pickup, dropoff };
}

// ---------------------------------------------------------------------------
// calculateRouteDistance
// ---------------------------------------------------------------------------
describe('calculateRouteDistance', () => {
  it('returns 0 for an empty route', () => {
    expect(calculateRouteDistance([])).toBe(0);
  });

  it('returns 0 for a single-node route', () => {
    const route: RouteNode[] = [{ type: 'start', point: ORIGIN }];
    expect(calculateRouteDistance(route)).toBe(0);
  });

  it('computes correct distance for two nodes (3-4-5 triangle)', () => {
    const route: RouteNode[] = [
      { type: 'start', point: P(0, 0) },
      { type: 'pickup', missionId: 'm1', point: P(3, 4) },
    ];
    expect(calculateRouteDistance(route)).toBeCloseTo(5);
  });

  it('sums all leg distances', () => {
    const route: RouteNode[] = [
      { type: 'start', point: P(0, 0) },
      { type: 'pickup', missionId: 'm1', point: P(3, 0) },
      { type: 'dropoff', missionId: 'm1', point: P(3, 4) },
    ];
    // 3 + 4 = 7
    expect(calculateRouteDistance(route)).toBeCloseTo(7);
  });

  it('works with 3D coordinates', () => {
    const route: RouteNode[] = [
      { type: 'start', point: P(0, 0, 0) },
      { type: 'pickup', missionId: 'm1', point: P(1, 0, 0) },
      { type: 'dropoff', missionId: 'm1', point: P(1, 1, 1) },
    ];
    // leg1 = dist((0,0,0)→(1,0,0)) = 1
    // leg2 = dist((1,0,0)→(1,1,1)) = sqrt(0+1+1) = sqrt(2)
    expect(calculateRouteDistance(route)).toBeCloseTo(1 + Math.sqrt(2));
  });
});

// ---------------------------------------------------------------------------
// splitMissionsForCapacity
// ---------------------------------------------------------------------------
describe('splitMissionsForCapacity', () => {
  const m = makeMission('m1', 100, P(0, 0), P(10, 0));

  it('returns missions unchanged when maxScu is 0', () => {
    const result = splitMissionsForCapacity([m], 0);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('m1');
  });

  it('returns missions unchanged when maxScu is Infinity', () => {
    const result = splitMissionsForCapacity([m], Infinity);
    expect(result).toHaveLength(1);
  });

  it('returns mission unchanged when scu exactly equals maxScu', () => {
    const result = splitMissionsForCapacity([m], 100);
    expect(result).toHaveLength(1);
    expect(result[0].scu).toBe(100);
  });

  it('returns mission unchanged when scu is below maxScu', () => {
    const result = splitMissionsForCapacity([m], 200);
    expect(result).toHaveLength(1);
  });

  it('splits a 100 SCU mission into 2 legs of 50', () => {
    const result = splitMissionsForCapacity([m], 50);
    expect(result).toHaveLength(2);
    expect(result[0].scu).toBe(50);
    expect(result[1].scu).toBe(50);
  });

  it('splits a 75 SCU mission into [50, 25]', () => {
    const m75 = makeMission('m1', 75, P(0, 0), P(10, 0));
    const result = splitMissionsForCapacity([m75], 50);
    expect(result).toHaveLength(2);
    expect(result[0].scu).toBe(50);
    expect(result[1].scu).toBe(25);
  });

  it('generates unique leg ids', () => {
    const result = splitMissionsForCapacity([m], 50);
    expect(result[0].id).toBe('m1:leg0');
    expect(result[1].id).toBe('m1:leg1');
  });

  it('preserves originalMissionId on each leg', () => {
    const result = splitMissionsForCapacity([m], 50);
    for (const leg of result) {
      expect(leg.originalMissionId).toBe('m1');
    }
  });

  it('preserves pickup and dropoff coordinates on each leg', () => {
    const result = splitMissionsForCapacity([m], 50);
    for (const leg of result) {
      expect(leg.pickup).toEqual(P(0, 0));
      expect(leg.dropoff).toEqual(P(10, 0));
    }
  });

  it('handles multiple missions independently', () => {
    const m2 = makeMission('m2', 30, P(1, 0), P(2, 0));
    const result = splitMissionsForCapacity([m, m2], 50);
    // m1(100) → 2 legs; m2(30) → 1 leg
    expect(result).toHaveLength(3);
    expect(result[2].id).toBe('m2');
  });

  it('total SCU across legs equals original SCU', () => {
    const result = splitMissionsForCapacity([m], 30);
    const total = result.reduce((s, leg) => s + leg.scu, 0);
    expect(total).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// optimizeRoute
// ---------------------------------------------------------------------------
describe('optimizeRoute', () => {
  it('returns just the start node when missions array is empty', () => {
    const { route, history } = optimizeRoute(ORIGIN, [], 100);
    expect(route).toHaveLength(1);
    expect(route[0].type).toBe('start');
    expect(history).toHaveLength(0);
  });

  it('returns a valid route for a single mission', () => {
    const missions = [makeMission('m1', 10, P(1, 0), P(2, 0))];
    const { route } = optimizeRoute(ORIGIN, missions, 100, { populationSize: 10, generations: 5, mutationRate: 0 });

    expect(route[0].type).toBe('start');
    const types = route.map(n => n.type);
    expect(types).toContain('pickup');
    expect(types).toContain('dropoff');
  });

  it('pickup always comes before its corresponding dropoff', () => {
    const missions = [
      makeMission('m1', 10, P(1, 0), P(5, 0)),
      makeMission('m2', 10, P(2, 0), P(6, 0)),
    ];
    const { route } = optimizeRoute(ORIGIN, missions, 100, { populationSize: 20, generations: 10, mutationRate: 0 });

    for (const id of ['m1', 'm2']) {
      const pickupIdx = route.findIndex(n => n.type === 'pickup' && n.missionId === id);
      const dropoffIdx = route.findIndex(n => n.type === 'dropoff' && n.missionId === id);
      expect(pickupIdx).toBeGreaterThan(-1);
      expect(dropoffIdx).toBeGreaterThan(-1);
      expect(pickupIdx).toBeLessThan(dropoffIdx);
    }
  });

  it('all missions appear exactly once as pickup and dropoff', () => {
    const missions = [
      makeMission('m1', 10, P(1, 0), P(5, 0)),
      makeMission('m2', 10, P(2, 0), P(6, 0)),
      makeMission('m3', 10, P(3, 0), P(7, 0)),
    ];
    const { route } = optimizeRoute(ORIGIN, missions, 100, { populationSize: 20, generations: 10, mutationRate: 0 });

    for (const id of ['m1', 'm2', 'm3']) {
      const pickups = route.filter(n => n.type === 'pickup' && n.missionId === id);
      const dropoffs = route.filter(n => n.type === 'dropoff' && n.missionId === id);
      expect(pickups).toHaveLength(1);
      expect(dropoffs).toHaveLength(1);
    }
  });

  it('route length is 1 (start) + 2 * missions', () => {
    const missions = [
      makeMission('m1', 10, P(1, 0), P(5, 0)),
      makeMission('m2', 10, P(2, 0), P(6, 0)),
    ];
    const { route } = optimizeRoute(ORIGIN, missions, 100, { populationSize: 10, generations: 5, mutationRate: 0 });
    expect(route).toHaveLength(1 + 2 * 2); // start + 2 pickups + 2 dropoffs
  });

  it('history length equals number of generations', () => {
    const missions = [makeMission('m1', 10, P(1, 0), P(5, 0))];
    const { history } = optimizeRoute(ORIGIN, missions, 100, { populationSize: 10, generations: 20, mutationRate: 0 });
    expect(history).toHaveLength(20);
  });

  it('history values are non-increasing (best distance improves or stays same)', () => {
    const missions = [
      makeMission('m1', 10, P(1, 0), P(5, 0)),
      makeMission('m2', 10, P(3, 0), P(8, 0)),
    ];
    const { history } = optimizeRoute(ORIGIN, missions, 100, { populationSize: 30, generations: 30, mutationRate: 0.3 });
    for (let i = 1; i < history.length; i++) {
      expect(history[i]).toBeLessThanOrEqual(history[i - 1] + 1e-9); // allow float rounding
    }
  });

  it('splits missions exceeding maxScu before optimizing', () => {
    // 100 SCU mission with 50 SCU cap → 2 legs → 5 nodes in route
    const missions = [makeMission('m1', 100, P(1, 0), P(5, 0))];
    const { route } = optimizeRoute(ORIGIN, missions, 50, { populationSize: 10, generations: 5, mutationRate: 0 });
    // 1 start + 2 pickups (leg0, leg1) + 2 dropoffs
    expect(route).toHaveLength(5);
  });

  it('throws when no valid route exists due to SCU constraints', () => {
    // maxScu=0: splitMissionsForCapacity returns mission unchanged (guard kicks in),
    // then generateRandomValidRoute can never pick up (0 + scu > 0) → throws
    const missions = [makeMission('m1', 100, P(1, 0), P(5, 0))];
    expect(() => optimizeRoute(ORIGIN, missions, 0, { populationSize: 5, generations: 3, mutationRate: 0 })).toThrow();
  });

  it('calls onProgress callback', () => {
    const calls: number[] = [];
    const missions = [makeMission('m1', 10, P(1, 0), P(5, 0))];
    optimizeRoute(ORIGIN, missions, 100, {
      populationSize: 10,
      generations: 20,
      mutationRate: 0,
      onProgress: (gen) => calls.push(gen),
    });
    expect(calls.length).toBeGreaterThan(0);
    // Final call should be at generation count
    expect(calls[calls.length - 1]).toBe(20);
  });
});
