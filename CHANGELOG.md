# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]

## [0.3.3] - 2026-04-26

### Fixed

- Restored production UEX proxy access by adding the required Lambda Function URL invoke permission for public `NONE` auth.
- Added case-insensitive CloudFront shared-secret header validation and a stable UEX outbound `User-Agent` to avoid false `403` responses.
- Granted Lambda KMS decrypt access for SecureString SSM reads through SSM.

### Changed

- Upgraded Terraform AWS provider constraints to v6 for native `invoked_via_function_url` support.

## [0.3.2] - 2026-04-26

### Fixed

- Switched CI/CD workflows from repository variables to secrets for AWS OIDC role configuration.

## [0.3.1] - 2026-04-26

### Fixed

- Removed a duplicate pnpm version declaration from the deploy workflow.

## [0.3.0] - 2026-04-26

### Added

- AWS infrastructure via Terraform: S3 + CloudFront + ACM (ECDSA P-256) + Route53 records, deploying to `sc-haul.tcousin.com`.
- Lambda proxy for UEX API — bearer token stored in SSM SecureString, never exposed in the client bundle. CloudFront routes `/api/uex/*` to the proxy with a shared secret header.
- Terraform S3 backend with native locking, bootstrap module for state bucket and GitHub OIDC trust.
- GitHub Actions CI/CD: Terraform plan on PRs, apply on `master`, SPA deploy on version tags (`v*`) via OIDC — no static AWS credentials.
- AWS AppRegistry application grouping all resources under `sc-haul` in the myApplications console.

### Changed

- UEX client base URL switches to same-origin `/api/uex` in production builds; local dev retains `VITE_UEX_API_BASE` / `VITE_UEX_BEARER_TOKEN` fallback.

## [0.2.0] - 2026-04-17

### Added

- Authenticated UEX ship catalog support in the fleet tab, including manufacturer metadata, SCU import, and custom-ship fallbacks when catalog lookups miss.
- Reusable search picker controls for mission locations, commodities, start locations, and ship selection across desktop popovers and mobile drawers.
- Automated coverage for the UEX client, merged location catalog helpers, search picker behavior, and the updated fleet and mission form flows.

### Changed

- Merged `starmap.space` and UEX location data into a single searchable catalog with alias-aware matching, persisted fallback coordinates, and safer sync failure handling.
- Reworked planner and mission entry forms around searchable catalog data and cached commodity loading so alias-heavy locations resolve more reliably.
- Normalized stored fleet ship records with source metadata and UEX vehicle identifiers so saved rosters dedupe and migrate cleanly.

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
