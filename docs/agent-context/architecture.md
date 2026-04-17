# Architecture

## Runtime Layout

The app is split into three tabs:

- `PlannerTab`: mission input, manifest, optimization trigger, route results
- `FleetTab`: active ship and saved fleet presets
- `SettingsTab`: theme controls, GA parameters, manual data resync

Supporting components:

- `DataSyncStatus`: blocking overlay while IndexedDB sync completes
- `ThemeProvider` and `ThemeSettings`: persisted light/dark mode plus accent palette

## State

Zustand stores:

- `useHaulStore`
  - missions
  - completed missions
  - done-leg checklist state
  - active ship and fleet presets
  - start location
  - GA config
- `useThemeStore`
  - color mode
  - palette

Persistence:

- both stores persist to `localStorage`
- `useHaulStore` custom-serializes `doneLegs` because it is a `Set`

## Optimization Flow

1. User enters missions and optional start location / ship capacity.
2. `useRouteOptimization` resolves human-readable names into coordinates via `getLocationByName`.
3. Cargo entries are flattened into `GAMission` legs.
4. Oversized entries are split with `splitMissionsForCapacity`.
5. A worker runs the GA.
6. The main thread annotates the resulting route with system names and prepares `legMap` for UI rendering.

## Searchable Locations

The planner and mission form both rely on `getSearchableLocationNames()`:

- static locations first
- POI names except excluded noisy types
- orbital body names except excluded non-user-facing types
- Lagrange aliases such as `CRU-L1`

This is centralized on purpose; avoid duplicating filter logic elsewhere.
