# Route Optimization

## Domain Model

Mission types:

- `direct`
- `multi-pickup`
- `multi-dropoff`

Each mission contains `cargoEntries[]`. Each cargo entry is already self-describing:

- SCU
- pickup location name
- dropoff location name
- optional commodity

This is intentionally close to Primer’s flat event model.

## Route Prep

`useRouteOptimization` does the following before the worker runs:

- caches repeated `getLocationByName()` calls per optimization run
- builds `missionById` and `cargoEntriesByMission` maps to avoid repeated `find()` scans
- expands every cargo entry into one `GAMission`
- splits oversized entries using `splitMissionsForCapacity`
- builds `legMap` so UI rows can map split legs back to original mission/cargo metadata

## Genetic Algorithm

The worker uses `optimizeRoute()` from `src/lib/genetic-algorithm.ts`.

Core behaviors:

- cached pairwise distance calculations
- greedy seed route plus random valid routes
- pickup-before-dropoff validity checks
- cargo-capacity constraint enforcement
- tournament selection
- PDP-aware crossover
- constraint-aware mutation plus 2-opt mutation
- elitism

Default config in the app:

- population size: `100`
- generations: `500`
- mutation rate: `0.02`

Note:

- `optimizeRoute()` still has an internal fallback mutation default of `0.15` when config is omitted; the app normally overrides it

## Route Result Rendering

`RouteResults.tsx`:

- groups consecutive stops by location
- summarizes pickups and dropoffs by commodity
- tracks cumulative distance and current load
- marks overload with destructive styling
- lets the user mark pickup/dropoff legs complete
- auto-completes a mission when all its entry pickup/dropoff keys are done

ID compatibility rule:

- route rendering should tolerate both bare mission IDs and split-leg IDs

## Tests To Keep Healthy

- `src/lib/genetic-algorithm.test.ts`
- `src/components/RouteResults.test.tsx`
- `src/store/useHaulStore.test.ts`

If route result tests fail after a refactor, inspect mission ID shape and done-leg key shape first.
