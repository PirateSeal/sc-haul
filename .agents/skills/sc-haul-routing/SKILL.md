---
name: sc-haul-routing
description: Use when working on route optimization, mission leg expansion, GA constraints, worker orchestration, or RouteResults behavior.
---

# SC Haul Routing

Use this skill when the task touches route planning, mission stop expansion, capacity-aware leg splitting, GA behavior, or `RouteResults` rendering/tests.

## Read First

- `docs/agent-context/route-optimization.md`
- `docs/agent-context/architecture.md`
- `docs/agent-context/workflow.md`

## Core Files

- `src/hooks/useRouteOptimization.ts`
- `src/lib/genetic-algorithm.ts`
- `src/components/RouteResults.tsx`
- `src/store/useHaulStore.ts`
- `src/components/AddMissionForm.tsx`

## Working Rules

- Preserve the real routing model: heliocentric meters in the optimizer, with cross-system jump handling added as route structure rather than visual-only shortcuts.
- Keep mission constraints intact: pickups must occur before their related dropoffs, and capacity splitting must not break mission identity.
- Treat route node IDs as mixed-format inputs. The app and tests may use bare mission IDs, `missionId:entryId`, or `missionId:entryId:legN`.
- Prefer fixing route preparation once in `useRouteOptimization` or shared helpers instead of patching around inconsistencies in multiple UI components.
- When route output changes, check `RouteResults` tests and any mission checklist logic together. Contract drift has happened here before.

## Task Guide

### Optimization changes

1. Read `docs/agent-context/route-optimization.md`.
2. Inspect `useRouteOptimization.ts` and `genetic-algorithm.ts` together.
3. Verify mission expansion, coordinate resolution, and returned node IDs still agree with `RouteResults.tsx`.
4. Re-run the route-focused tests before widening the change.

### Mission model changes

1. Confirm whether the change affects direct, multi-pickup, and multi-dropoff missions differently.
2. Check whether load tracking or split-leg generation depends on stable mission or cargo entry IDs.
3. Prefer adding a shared helper over duplicating parsing or lookup logic in components.

### Rendering and checklist changes

1. Keep the ordered stop list, leg distance, payout totals, and SCU load state aligned with the optimized route.
2. If a route node shape changes, update the parser used by `RouteResults` and the tests in the same pass.

## Validation

Run the narrowest useful checks first:

- `pnpm test -- RouteResults`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

If the task changes optimization internals without touching UI, still confirm the worker path and route-result contract.
