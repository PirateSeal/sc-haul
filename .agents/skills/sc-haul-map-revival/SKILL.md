---
name: sc-haul-map-revival
description: Use when evaluating, reviving, or pruning the paused system map feature and its historical scaffolding.
---

# SC Haul Map Revival

Use this skill when the task concerns the paused map feature, historical Three.js plans, or the remaining map-support data files.

## Read First

- `docs/agent-context/map-status.md`
- `docs/agent-context/overview.md`
- `docs/agent-context/workflow.md`

Then inspect the historical plan notes under `.claude/plans/` before making structural decisions.

## Core Files

- `src/data/body-hierarchy.ts`
- `src/data/body-colors.ts`
- `docs/agent-context/map-status.md`
- `.claude/plans/`
- `tmp/Cargo Hauling Tool.html`

## Working Rules

- Treat `body-hierarchy.ts` and `body-colors.ts` as paused map-support files, not accidental dead code.
- Do not let visual map concerns change the optimizer's source-of-truth coordinate model.
- Keep any future map layer downstream of the real route data. Visualization may transform coordinates for display, but routing should remain in real meters.
- Primer's original HTML is reference material only. Reuse its intent selectively instead of copying its structure into the React app.
- If the feature stays paused, prefer documenting the boundary clearly over deleting context that future work will need.

## Task Guide

### Evaluating a revival

1. Read `map-status.md` and the `.claude/plans/` notes first.
2. Identify what survives today: data scaffolding, route output contracts, and any visual assumptions.
3. Separate product decisions from implementation leftovers before writing code.

### Restarting implementation

1. Define the view model explicitly: what comes from optimized route data, what comes from body hierarchy, and what is purely presentational.
2. Keep map code isolated from core route preparation so accuracy changes do not depend on rendering.
3. Add small integration seams first instead of reintroducing a large hidden map subsystem.

### Cleaning up map artifacts

1. Only remove files if you are sure the product direction no longer includes a map.
2. If the decision is still uncertain, update `map-status.md` and keep the scaffolding documented.

## Validation

- `pnpm lint`
- `pnpm test`
- `pnpm build`

If you add visual map code later, add focused tests or smoke checks around the transformation layer rather than the optimizer core.
