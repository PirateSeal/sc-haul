# Workflow

## Commands

- `pnpm dev`
- `pnpm test`
- `pnpm lint`
- `pnpm build`
- `.\node_modules\.bin\tsc -b`

## Validation Expectations

For normal code changes:

1. run `tsc -b`
2. run `pnpm lint`
3. run `pnpm test`
4. run `pnpm build` when bundling might be affected

## Known Build Note

`pnpm build` may require elevated execution in restricted environments because Vite/Tailwind native dependencies can fail under sandboxed `EPERM` conditions even when source code is correct.

## Repo Hygiene

- `README.md` is project-specific and should stay aligned with the actual app
- `AGENTS.md` is an index; keep heavy context in `docs/agent-context/`
- keep project-specific skills in `.agents/skills/`

## High-Value Files

- `src/App.tsx`
- `src/hooks/useRouteOptimization.ts`
- `src/services/db.ts`
- `src/services/searchable-locations.ts`
- `src/lib/genetic-algorithm.ts`
- `src/components/RouteResults.tsx`
- `src/store/useHaulStore.ts`

## Low-Context Pitfalls

- broad reads of `api/pois.json` are expensive and usually unnecessary
- cargo checklist state is store-driven; test leaks can happen if `doneLegs` is not reset
- `RouteResults` relies on `legMap` shape and route mission ID compatibility
- location accuracy bugs often come from POI coordinate interpretation, not from the GA
