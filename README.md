# SC Haul

Modern cargo-hauling planner for Star Citizen, built as a React + Vite PWA.

## What It Does

- Plans hauling routes across Stanton, Pyro, and Nyx
- Uses `starmap.space` orbital body and POI data for route accuracy
- Lets you enter contract payouts, cargo entries, start location, and ship capacity
- Optimizes route order with a genetic algorithm under pickup-before-dropoff and cargo-capacity constraints
- Caches navigation data locally in IndexedDB for offline use after initial sync

## Local Data

- `api/oc.json` and `api/pois.json` are local cache/reference snapshots of upstream starmap data
- They are intentionally not imported directly into app runtime because they are large and token-heavy

## Scripts

```bash
pnpm dev
pnpm test
pnpm lint
pnpm build
```

## UEX Setup

Set a local Vite env var before running the app:

```bash
VITE_UEX_BEARER_TOKEN=your-token
```

Optional when your UEX app is version-locked:

```bash
VITE_UEX_CLIENT_VERSION=your-client-version
```

## Notes

- Route optimization uses real coordinate data in meters and displays totals in Gm
- `starmap.space` remains the coordinate source of truth; UEX-only locations fall back to parent-body or jump-point positions when no direct starmap match exists
- Map-support files from the paused Three.js visualization attempt are kept in the repo for future work
