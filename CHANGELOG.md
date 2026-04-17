# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [0.1.0] - 2026-04-17

Initial public release of `SC Haul`.

### Added

- Planner, fleet, and settings tabs for entering hauling contracts, managing ship presets, tuning themes, and manually refreshing navigation data.
- A web-worker-backed genetic algorithm pipeline that resolves locations, splits oversized cargo legs, and optimizes routes under pickup/dropoff and capacity constraints.
- IndexedDB-backed syncing and search over `starmap.space` orbital body and POI data, including alias support for Lagrange point names.
- Persistent Zustand stores for hauling state and theme preferences, plus test coverage for routing, stores, themes, static locations, and route result rendering.
- Repo agent documentation and project-specific skills for routing, starmap data, and future map revival work.

### Changed

- Replaced the default Vite starter UI with the shipping SC Haul planner experience and its shadcn/Radix component set.
- Updated project scripts and tooling to support linting, Vitest runs, coverage, and the PWA-oriented app workflow.
