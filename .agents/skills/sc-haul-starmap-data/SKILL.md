---
name: sc-haul-starmap-data
description: Use when working on starmap sync, IndexedDB, aliases, searchable locations, or location accuracy bugs.
---

# SC Haul Starmap Data

Use this skill when the task touches `starmap.space` ingestion, IndexedDB caching, location resolution, alias support, or searchable location lists.

## Read First

- `docs/agent-context/data-and-accuracy.md`
- `docs/agent-context/architecture.md`
- `docs/agent-context/workflow.md`

## Core Files

- `src/services/db.ts`
- `src/services/searchable-locations.ts`
- `src/services/api.ts`
- `src/data/static-locations.ts`
- `src/components/AddMissionForm.tsx`

## Accuracy Rules

- `starmap.space` remains the source of truth for routing coordinates and body/POI semantics.
- Preserve local reference caches in `api/oc.json` and `api/pois.json`, but do not bulk-load them into runtime or prompt context unless a task specifically requires it.
- Keep coordinate math in meters and respect that some POIs are body-relative while others are already system-positioned.
- Alias handling is product behavior, not a hack. Lagrange-point shorthand and searchable-name normalization should stay centralized.
- Prefer one shared searchable-location pipeline over duplicated body/POI loading in UI components.

## Task Guide

### Sync or schema work

1. Read `data-and-accuracy.md` before touching sync logic.
2. Inspect `db.ts` and `api.ts` together so fetch, parse, and persistence changes stay aligned.
3. Confirm the IndexedDB shape still supports offline reuse and location lookup performance.

### Search and resolution bugs

1. Start in `searchable-locations.ts`.
2. Keep static locations, excluded types, alias injection, and DB-backed entries in one place.
3. Avoid scattering string normalization or special-case location names through components.

### Accuracy regressions

1. Verify whether the bug is in upstream data, local caching, alias lookup, or route preparation.
2. Fix the resolver order before introducing new fallback guesses.
3. If you need the heavy local JSON caches, inspect only the minimal slices needed for the issue.

## Validation

Use checks that match the change:

- `pnpm lint`
- `pnpm test`
- `pnpm build`

For data-loading changes, also exercise the relevant UI flow so searchable locations and route coordinates still resolve the same way.
