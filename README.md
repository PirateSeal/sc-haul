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

## Notes

- Route optimization uses real coordinate data in meters and displays totals in Gm
- Map-support files from the paused Three.js visualization attempt are kept in the repo for future work
