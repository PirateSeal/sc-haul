# Data And Accuracy

## Sources

- Orbital bodies: `https://starmap.space/api/v3/oc/index.php`
- POIs: `https://starmap.space/api/v3/pois/index.php`
- Commodities: `https://api.uexcorp.space/2.0/commodities`

## Local Cache Files

- `api/oc.json`
- `api/pois.json`

These are reference snapshots only. They are useful for inspection, tests, and one-off validation, but they are intentionally not imported into app runtime because they are large.

## IndexedDB

Database name: `schaul-db`

Stores:

- `orbitalBodies`
  - key: `item_id`
  - indexes: `by-system`, `by-name`, `by-internal`
- `pois`
  - key: `item_id`
  - indexes: `by-system`, `by-container`, `by-name`

Sync cadence:

- weekly by default
- forced by clearing `localStorage['schaul_last_sync']`

## Coordinate Rules

- canonical unit is meters
- route display converts to Gm using `1e9`
- POIs in `Space` use their own heliocentric coordinates directly
- many POIs on planets/moons are body-relative km, so the app resolves them to their parent body’s heliocentric position
- the resolver prefers `ObjectContainer` over `Planet` when both exist, which avoids collapsing moon stations onto the parent planet

## Name Resolution

`getLocationByName()` resolves in this order:

1. hardcoded static locations
2. POIs by `PoiName`
3. orbital bodies by `ObjectContainer`
4. Lagrange alias formats

Important alias behavior:

- bare LP code: `CRU-L1`
- prefixed display name: `CRU-L1 Ambitious Dream Station`

## Accuracy Constraints

- user payouts remain manual input
- route calculations should continue using real coordinate data even if a future map feature uses visually remapped positions
- do not replace current resolver logic with raw POI coordinates unless you are explicitly fixing a validated accuracy bug
