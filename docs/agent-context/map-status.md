# Map Status

## Current Status

The map feature is paused.

There is no active runtime map code in `src/` today. The current shipping app is planner-only plus charts.

## What Remains In Repo

These files are intentional:

- `src/data/body-hierarchy.ts`
- `src/data/body-colors.ts`
- `.claude/plans/*.md`

They exist to preserve previous design work for a future visualization restart.

## Historical Direction

The attempted map implementation moved toward:

- Three.js / React Three Fiber system view
- hierarchy-aware rendering for planets, moons, stations, and Lagrange points
- visual-only remapping of heliocentric distances
- separate handling for jump points and multi-system routes

The strongest surviving references are the `.claude/plans/` notes, especially the plans around:

- map layout
- system scene hierarchy
- LOD / focus behavior
- paused removal plan versus revival plans

## Rules For Future Revival

- keep optimizer math in real meters
- keep map projection and layout as a visual layer only
- reuse `body-hierarchy.ts` and `body-colors.ts` instead of recreating those mappings
- preserve `starmap.space` as the truth source for coordinates and direction vectors
- read the paused plans before adding new dependencies such as `three`

## What Not To Assume

- do not assume the old plans were implemented
- do not assume `tmp/Cargo Hauling Tool.html` map math should be copied directly
- do not classify map-support data as dead code unless the user explicitly asks for a full map-feature purge
