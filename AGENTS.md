# SC Haul Agent Guide

Use this file as the entrypoint, not the full project reference.

## Read First

1. [Overview](./docs/agent-context/overview.md)
2. [Architecture](./docs/agent-context/architecture.md)
3. [Data And Accuracy](./docs/agent-context/data-and-accuracy.md)
4. [Route Optimization](./docs/agent-context/route-optimization.md)
5. [Map Status](./docs/agent-context/map-status.md)
6. [Workflow](./docs/agent-context/workflow.md)

## Repo-Specific Rules

- Preserve `api/oc.json` and `api/pois.json` as local reference caches. They are intentionally large and should not be bulk-loaded into runtime or prompts unless a task specifically needs them.
- Treat `src/data/body-hierarchy.ts` and `src/data/body-colors.ts` as paused map-support files, not dead code.
- Prefer editing the current React app over copying behavior from `tmp/Cargo Hauling Tool.html`; use Primer’s file as historical reference only.
- Keep routing accuracy based on `starmap.space` semantics: heliocentric meters, POIs sometimes body-relative, LP aliases supported.
- Before reviving map work, read [Map Status](./docs/agent-context/map-status.md) and the existing `.claude/plans/` notes.

## Local Skills

Project-specific skills live under `.agents/skills/`:

- `sc-haul-routing`
- `sc-haul-starmap-data`
- `sc-haul-map-revival`

Use them when the task matches their scope.
