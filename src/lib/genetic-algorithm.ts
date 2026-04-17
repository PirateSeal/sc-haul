export interface Point3D {
  x: number;
  y: number;
  z: number;
  /** If true, this point is in atmosphere (planet surface) - slower travel. */
  isAtmospheric?: boolean;
}

export interface GAMission {
  id: string;             // may be `${sourceId}:leg${i}` for capacity-split legs
  originalMissionId: string;
  sourceId: string;       // pre-split id, always `${missionId}:${cargoEntryId}`
  scu: number;
  pickup: Point3D;
  dropoff: Point3D;
}

export interface RouteNode {
  type: 'start' | 'pickup' | 'dropoff';
  missionId?: string;
  point: Point3D;
  /** Star Citizen system this stop belongs to (e.g. "Stanton", "Pyro"). Populated
   *  by the main thread after the GA result is received; undefined inside the worker. */
  system?: string;
}

export interface OptimizeResult {
  route: RouteNode[];
  history: number[]; // best cost per generation
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Distance Matrix / Caching
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a unique key for a point (rounded to avoid float precision issues). */
function pointKey(p: Point3D): string {
  return `${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.z)}`;
}

/** Create a cache key for two points (order-independent since distance is symmetric). */
function distCacheKey(a: Point3D, b: Point3D): string {
  const ka = pointKey(a);
  const kb = pointKey(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

/** Distance cache - populated per optimization run. */
const distanceCache: Map<string, number> = new Map();

/** Raw Euclidean distance between two 3D points (no caching). */
function rawDist(a: Point3D, b: Point3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Cached distance between two 3D points. */
function dist(a: Point3D, b: Point3D): number {
  const key = distCacheKey(a, b);
  let d = distanceCache.get(key);
  if (d === undefined) {
    d = rawDist(a, b);
    distanceCache.set(key, d);
  }
  return d;
}

/** Pre-populate distance cache with all point pairs from missions + start. */
function buildDistanceCache(startPoint: Point3D, missions: GAMission[]): void {
  distanceCache.clear();
  const points: Point3D[] = [startPoint];
  for (const m of missions) {
    points.push(m.pickup, m.dropoff);
  }
  // Pre-compute all pairs
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      dist(points[i], points[j]); // populates cache
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Domain-Aware Cost Function
// ─────────────────────────────────────────────────────────────────────────────

/** Atmospheric travel penalty multiplier. */
const ATMOSPHERIC_PENALTY = 1.5;

/** Calculate travel cost between two points, with atmospheric penalty. */
function travelCost(a: Point3D, b: Point3D): number {
  const baseDist = dist(a, b);
  // Apply penalty if either endpoint is atmospheric (entering or leaving atmosphere)
  const penalty = (a.isAtmospheric || b.isAtmospheric) ? ATMOSPHERIC_PENALTY : 1.0;
  return baseDist * penalty;
}

/** Calculate total route cost. */
export function calculateRouteCost(route: RouteNode[]): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += travelCost(route[i].point, route[i + 1].point);
  }
  return total;
}

/** @deprecated Use calculateRouteCost instead. */
export function calculateRouteDistance(route: RouteNode[]): number {
  return calculateRouteCost(route);
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/** Build a lookup map for missions by ID. */
function buildMissionMap(missions: GAMission[]): Map<string, GAMission> {
  return new Map(missions.map(m => [m.id, m]));
}

/** Check if a route satisfies all constraints. */
function isValidRoute(route: RouteNode[], missionMap: Map<string, GAMission>, maxScu: number): boolean {
  let currentScu = 0;
  const pickedUp = new Set<string>();
  const droppedOff = new Set<string>();

  for (const node of route) {
    if (node.type === 'start') continue;
    if (!node.missionId) continue;

    const mission = missionMap.get(node.missionId);
    if (!mission) return false;

    if (node.type === 'pickup') {
      if (pickedUp.has(node.missionId)) return false;
      pickedUp.add(node.missionId);
      currentScu += mission.scu;
      if (currentScu > maxScu) return false;
    } else if (node.type === 'dropoff') {
      if (!pickedUp.has(node.missionId)) return false;
      if (droppedOff.has(node.missionId)) return false;
      droppedOff.add(node.missionId);
      currentScu -= mission.scu;
    }
  }

  return droppedOff.size === missionMap.size;
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Generation
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a random valid route using constraint-aware construction. */
function generateRandomValidRoute(
  startPoint: Point3D,
  missions: GAMission[],
  missionMap: Map<string, GAMission>,
  maxScu: number
): RouteNode[] | null {
  const MAX_ATTEMPTS = 100;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const route: RouteNode[] = [{ type: 'start', point: startPoint }];
    const remainingPickups = new Set(missions.map(m => m.id));
    const pendingDropoffs = new Set<string>();
    let currentScu = 0;

    let possible = true;
    while (remainingPickups.size > 0 || pendingDropoffs.size > 0) {
      const validNext: { type: 'pickup' | 'dropoff'; id: string; point: Point3D }[] =[];

      for (const pid of remainingPickups) {
        const m = missionMap.get(pid)!;
        if (currentScu + m.scu <= maxScu) {
          validNext.push({ type: 'pickup', id: pid, point: m.pickup });
        }
      }

      for (const did of pendingDropoffs) {
        const m = missionMap.get(did)!;
        validNext.push({ type: 'dropoff', id: did, point: m.dropoff });
      }

      if (validNext.length === 0) {
        possible = false;
        break;
      }

      const choice = validNext[Math.floor(Math.random() * validNext.length)];
      if (choice.type === 'pickup') {
        remainingPickups.delete(choice.id);
        pendingDropoffs.add(choice.id);
        currentScu += missionMap.get(choice.id)!.scu;
      } else {
        pendingDropoffs.delete(choice.id);
        currentScu -= missionMap.get(choice.id)!.scu;
      }
      route.push({ type: choice.type, missionId: choice.id, point: choice.point });
    }

    if (possible) return route;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Heuristic Initialization (Greedy Nearest Neighbor)
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a greedy nearest-neighbor route. */
function generateGreedyRoute(
  startPoint: Point3D,
  missions: GAMission[],
  missionMap: Map<string, GAMission>,
  maxScu: number
): RouteNode[] | null {
  const route: RouteNode[] = [{ type: 'start', point: startPoint }];
  const remainingPickups = new Set(missions.map(m => m.id));
  const pendingDropoffs = new Set<string>();
  let currentScu = 0;
  let currentPoint = startPoint;

  while (remainingPickups.size > 0 || pendingDropoffs.size > 0) {
    const validNext: { type: 'pickup' | 'dropoff'; id: string; point: Point3D; dist: number }[] =[];

    // Gather valid pickups
    for (const pid of remainingPickups) {
      const m = missionMap.get(pid)!;
      if (currentScu + m.scu <= maxScu) {
        validNext.push({ type: 'pickup', id: pid, point: m.pickup, dist: dist(currentPoint, m.pickup) });
      }
    }

    // Gather valid dropoffs
    for (const did of pendingDropoffs) {
      const m = missionMap.get(did)!;
      validNext.push({ type: 'dropoff', id: did, point: m.dropoff, dist: dist(currentPoint, m.dropoff) });
    }

    if (validNext.length === 0) {
      return null; // Infeasible
    }

    // Pick nearest valid action
    validNext.sort((a, b) => a.dist - b.dist);
    const choice = validNext[0];

    if (choice.type === 'pickup') {
      remainingPickups.delete(choice.id);
      pendingDropoffs.add(choice.id);
      currentScu += missionMap.get(choice.id)!.scu;
    } else {
      pendingDropoffs.delete(choice.id);
      currentScu -= missionMap.get(choice.id)!.scu;
    }

    route.push({ type: choice.type, missionId: choice.id, point: choice.point });
    currentPoint = choice.point;
  }

  return route;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Tournament Selection
// ─────────────────────────────────────────────────────────────────────────────

const TOURNAMENT_SIZE = 3;

/** Select a parent via tournament selection. */
function tournamentSelect(scored: { route: RouteNode[]; cost: number }[]): RouteNode[] {
  let best: { route: RouteNode[]; cost: number } | null = null;
  for (let i = 0; i < TOURNAMENT_SIZE; i++) {
    const idx = Math.floor(Math.random() * scored.length);
    const candidate = scored[idx];
    if (!best || candidate.cost < best.cost) {
      best = candidate;
    }
  }
  return best!.route;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PDP-Aware Crossover
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PDP-aware crossover: Extract missions from parent1 in order, then insert
 * missions from parent2 that weren't covered, respecting constraints.
 */
function pdpCrossover(
  parent1: RouteNode[],
  parent2: RouteNode[],
  missionMap: Map<string, GAMission>,
  maxScu: number,
  startPoint: Point3D
): RouteNode[] | null {
  // Get mission order from each parent
  const getMissionOrder = (route: RouteNode[]): string[] => {
    const seen = new Set<string>();
    const order: string[] =[];
    for (const node of route) {
      if (node.type === 'pickup' && node.missionId && !seen.has(node.missionId)) {
        seen.add(node.missionId);
        order.push(node.missionId);
      }
    }
    return order;
  };

  const order1 = getMissionOrder(parent1);
  const order2 = getMissionOrder(parent2);

  // Take a random slice from parent1's order
  const sliceStart = Math.floor(Math.random() * order1.length);
  const sliceEnd = sliceStart + Math.floor(Math.random() * (order1.length - sliceStart));
  const inheritedMissions = new Set(order1.slice(sliceStart, sliceEnd));

  // Build child mission order: inherited from p1, then remaining from p2 in their order
  const childMissionOrder: string[] = [...inheritedMissions];
  for (const mid of order2) {
    if (!inheritedMissions.has(mid)) {
      childMissionOrder.push(mid);
    }
  }

  // Reconstruct route greedily with this mission preference order
  return reconstructRouteWithOrder(childMissionOrder, missionMap, maxScu, startPoint);
}

/** Reconstruct a valid route preferring missions in the given order. */
function reconstructRouteWithOrder(
  missionOrder: string[],
  missionMap: Map<string, GAMission>,
  maxScu: number,
  startPoint: Point3D
): RouteNode[] | null {
  const route: RouteNode[] = [{ type: 'start', point: startPoint }];
  const remainingPickups = new Set(missionOrder);
  const pendingDropoffs = new Set<string>();
  let currentScu = 0;

  // Priority queue for pickups based on mission order
  const pickupPriority = new Map(missionOrder.map((mid, idx) => [mid, idx]));

  while (remainingPickups.size > 0 || pendingDropoffs.size > 0) {
    // Must do dropoffs if no pickups fit
    const mustDropoff = [...remainingPickups].every(pid => {
      const m = missionMap.get(pid)!;
      return currentScu + m.scu > maxScu;
    });

    if (mustDropoff && pendingDropoffs.size > 0) {
      // Pick earliest-inserted mission to dropoff
      let bestDropoff: string | null = null;
      let bestPriority = Infinity;
      for (const did of pendingDropoffs) {
        const p = pickupPriority.get(did) ?? Infinity;
        if (p < bestPriority) {
          bestPriority = p;
          bestDropoff = did;
        }
      }
      if (bestDropoff) {
        pendingDropoffs.delete(bestDropoff);
        currentScu -= missionMap.get(bestDropoff)!.scu;
        const m = missionMap.get(bestDropoff)!;
        route.push({ type: 'dropoff', missionId: bestDropoff, point: m.dropoff });
        continue;
      }
    }

    // Try to pickup next mission in order that fits
    let pickedUp = false;
    for (const pid of missionOrder) {
      if (!remainingPickups.has(pid)) continue;
      const m = missionMap.get(pid)!;
      if (currentScu + m.scu <= maxScu) {
        remainingPickups.delete(pid);
        pendingDropoffs.add(pid);
        currentScu += m.scu;
        route.push({ type: 'pickup', missionId: pid, point: m.pickup });
        pickedUp = true;
        break;
      }
    }

    if (!pickedUp) {
      if (pendingDropoffs.size === 0) return null;
      const did = pendingDropoffs.values().next().value as string;
      pendingDropoffs.delete(did);
      currentScu -= missionMap.get(did)!.scu;
      const m = missionMap.get(did)!;
      route.push({ type: 'dropoff', missionId: did, point: m.dropoff });
    }
  }

  return route;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Constraint-Aware Mutation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Constraint-aware mutation: Remove a random mission's pickup+dropoff nodes,
 * then re-insert them together into valid positions.
 */
function constraintAwareMutate(
  route: RouteNode[],
  missionMap: Map<string, GAMission>,
  maxScu: number
): RouteNode[] | null {
  // Find all missions in the route
  const missionIds = new Set<string>();
  for (const node of route) {
    if (node.missionId) missionIds.add(node.missionId);
  }

  if (missionIds.size === 0) return route;

  // Pick a random mission to relocate
  const missionArray = [...missionIds];
  const targetMission = missionArray[Math.floor(Math.random() * missionArray.length)];
  const mission = missionMap.get(targetMission)!;

  // Filter out the mission we are mutating
  const filtered = route.filter(n => n.missionId !== targetMission);

  // We must find a valid (pickup, dropoff) index pair
  const validPairs: { p: number; d: number }[] =[];

  for (let p = 1; p <= filtered.length; p++) {
    for (let d = p; d <= filtered.length; d++) {
      const testRoute =[
        ...filtered.slice(0, p),
      { type: 'pickup' as const, missionId: targetMission, point: mission.pickup },
        ...filtered.slice(p, d),
        { type: 'dropoff' as const, missionId: targetMission, point: mission.dropoff },
        ...filtered.slice(d),
      ];

      // Validate the entirety of the newly formed route
      if (isValidRoute(testRoute, missionMap, maxScu)) {
        validPairs.push({ p, d });
      }
    }
  }

  if (validPairs.length === 0) return null;

  // Pick a random valid pair configuration
  const choice = validPairs[Math.floor(Math.random() * validPairs.length)];

  return[
    ...filtered.slice(0, choice.p),
    { type: 'pickup' as const, missionId: targetMission, point: mission.pickup },
    ...filtered.slice(choice.p, choice.d),
    { type: 'dropoff' as const, missionId: targetMission, point: mission.dropoff },
    ...filtered.slice(choice.d),
  ];
}

/**
 * 2-opt style mutation: Reverse a segment of the route if it improves cost
 * and maintains validity.
 */
function twoOptMutate(
  route: RouteNode[],
  missionMap: Map<string, GAMission>,
  maxScu: number
): RouteNode[] | null {
  if (route.length < 4) return route;

  // Pick two random positions (excluding start)
  const i = 1 + Math.floor(Math.random() * (route.length - 2));
  const j = i + 1 + Math.floor(Math.random() * (route.length - i - 1));

  const mutated =[
    ...route.slice(0, i),
    ...route.slice(i, j + 1).reverse(),
    ...route.slice(j + 1),
  ];

  if (isValidRoute(mutated, missionMap, maxScu)) {
    return mutated;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration & Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface OptimizeOptions {
  populationSize?: number;
  generations?: number;
  mutationRate?: number;
  crossoverRate?: number;
  onProgress?: (generation: number, total: number, bestCost: number) => void;
}

/**
 * Split any mission whose SCU exceeds maxScu into multiple legs.
 * Each leg gets id `${original}:leg${i}` and originalMissionId preserved.
 */
export function splitMissionsForCapacity(missions: GAMission[], maxScu: number): GAMission[] {
  if (maxScu <= 0 || !isFinite(maxScu)) return missions;

  const result: GAMission[] =[];
  for (const m of missions) {
    if (m.scu <= maxScu) {
      result.push(m);
      continue;
    }
    const numLegs = Math.ceil(m.scu / maxScu);
    let remaining = m.scu;
    for (let i = 0; i < numLegs; i++) {
      const legScu = Math.min(remaining, maxScu);
      result.push({
        id: `${m.id}:leg${i}`,
        originalMissionId: m.originalMissionId,
        sourceId: m.sourceId,
        scu: legScu,
        pickup: m.pickup,
        dropoff: m.dropoff,
      });
      remaining -= legScu;
    }
  }
  return result;
}

export function optimizeRoute(
  startPoint: Point3D,
  missions: GAMission[],
  maxScu: number,
  config?: OptimizeOptions
): OptimizeResult {
  const expandedMissions = splitMissionsForCapacity(missions, maxScu);

  if (expandedMissions.length === 0) {
    return { route:[{ type: 'start', point: startPoint }], history:[] };
  }

  // Build mission lookup map
  const missionMap = buildMissionMap(expandedMissions);

  // 1. Pre-build distance cache
  buildDistanceCache(startPoint, expandedMissions);

  const POPULATION_SIZE = config?.populationSize ?? 100;
  const GENERATIONS = config?.generations ?? 500;
  const MUTATION_RATE = config?.mutationRate ?? 0.15;
  const CROSSOVER_RATE = config?.crossoverRate ?? 0.8;
  const ELITE_COUNT = Math.max(2, Math.floor(POPULATION_SIZE * 0.1));
  const onProgress = config?.onProgress;

  const population: RouteNode[][] =[];

  // First route: greedy nearest-neighbor
  const greedyRoute = generateGreedyRoute(startPoint, expandedMissions, missionMap, maxScu);
  if (greedyRoute) {
    population.push(greedyRoute);
  }

  // Rest: random valid routes
  for (let i = population.length; i < POPULATION_SIZE; i++) {
    const route = generateRandomValidRoute(startPoint, expandedMissions, missionMap, maxScu);
    if (route) population.push(route);
  }

  if (population.length === 0) {
    throw new Error('Could not find any valid routes. Check SCU constraints.');
  }

  while (population.length < POPULATION_SIZE) {
    population.push([...population[Math.floor(Math.random() * population.length)]]);
  }

  let currentPop = population;
  let bestGlobalRoute = currentPop[0];
  let bestGlobalCost = calculateRouteCost(bestGlobalRoute);
  const history: number[] =[];

  // ─────────────────────────────────────────────────────────────────────────
  // Main GA Loop
  // ─────────────────────────────────────────────────────────────────────────
  for (let g = 0; g < GENERATIONS; g++) {
    // Score population
    const scored = currentPop.map(route => ({
      route,
      cost: calculateRouteCost(route),
    }));

    scored.sort((a, b) => a.cost - b.cost);

    // Update best
    if (scored[0].cost < bestGlobalCost) {
      bestGlobalCost = scored[0].cost;
      bestGlobalRoute = scored[0].route;
    }

    history.push(bestGlobalCost);

    if (onProgress && g % 10 === 0) {
      onProgress(g, GENERATIONS, bestGlobalCost);
    }

    const nextGen: RouteNode[][] =[];

    // Elitism: keep top performers
    for (let i = 0; i < ELITE_COUNT && i < scored.length; i++) {
      nextGen.push(scored[i].route);
    }

    // Fill rest with crossover and mutation
    while (nextGen.length < POPULATION_SIZE) {
      // 3. Tournament selection for parents
      const parent1 = tournamentSelect(scored);
      const parent2 = tournamentSelect(scored);

      let child: RouteNode[] | null = null;

      // 3. Crossover
      if (Math.random() < CROSSOVER_RATE) {
        child = pdpCrossover(parent1, parent2, missionMap, maxScu, startPoint);
      }

      // Fall back to parent1 if crossover failed
      if (!child) {
        child = [...parent1];
      }

      // 2. Constraint-aware mutation
      if (Math.random() < MUTATION_RATE) {
        // 50% chance each mutation type
        const mutated = Math.random() < 0.5
          ? constraintAwareMutate(child, missionMap, maxScu)
          : twoOptMutate(child, missionMap, maxScu);

        if (mutated) {
          child = mutated;
        }
      }

      nextGen.push(child);
    }

    currentPop = nextGen;
  }

  onProgress?.(GENERATIONS, GENERATIONS, bestGlobalCost);
  return { route: bestGlobalRoute, history };
}