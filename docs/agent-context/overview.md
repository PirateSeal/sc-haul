# Overview

## Product

`SC Haul` is a React/Vite PWA for planning Star Citizen cargo hauling routes.

The current app covers:

- mission entry for direct, multi-pickup, and multi-dropoff contracts
- ship capacity and fleet presets
- route optimization with a web-worker-backed genetic algorithm
- route results with cargo checklists, SCU load tracking, reward, and convergence chart
- IndexedDB-backed sync of orbital body and POI data from `starmap.space`

## Current State

- The runtime app is the React code under `src/`
- Primer’s original tool is kept at `tmp/Cargo Hauling Tool.html` as reference
- The 3D map feature is paused; there is no active `three` or `react-three-fiber` runtime code in the app
- The repo keeps map-support data and historical plans because the feature may return

## Key Decisions

- Coordinate accuracy beats visual simplification in the optimizer
- User-entered payouts stay local because upstream APIs do not provide them
- Offline behavior is important: navigation data is cached in IndexedDB and reused between sessions
- Searchability matters more than strict source naming, so the app supports aliases such as bare Lagrange codes

## Main Entrypoints

- `src/App.tsx`: top-level app shell and tab composition
- `src/hooks/useRouteOptimization.ts`: route-preparation orchestration and worker lifecycle
- `src/services/db.ts`: IndexedDB schema, sync, and location resolution
- `src/lib/genetic-algorithm.ts`: optimization engine and capacity splitting
- `src/components/RouteResults.tsx`: optimized stop rendering and mission-completion checklist UI
