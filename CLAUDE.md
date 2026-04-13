# SC Hauling Mission Planner

## Goal

Replicate and modernize the SC Hauling Tool by SigPrimer:
https://primer23.github.io/SC_Hauling_Tool_2_by_SigPrimer/Cargo%20Hauling%20Tool.html

Source code here :
https://raw.githubusercontent.com/primer23/SC_Hauling_Tool_2_by_SigPrimer/refs/heads/main/Cargo%20Hauling%20Tool.html

A modern PWA that helps Star Citizen players plan optimal routes for cargo hauling missions across Stanton, Pyro, and Nyx systems.

---

## Core Features (MVP)

### 1. Starting Location
- Searchable dropdown of all stations, outposts, and landing zones
- Grouped by system > planet/moon
- Remember last used location

### 2. Ship Configuration
- Cargo capacity input (SCU)
- Optional: ship preset selector (future)

### 3. Mission Management
Add hauling missions with:
- Mission name (optional, for user reference)
- Pickup location(s) - one or more
- Dropoff location(s) - one or more
- Payout (aUEC)
- Mission type:
  - **Direct**: single pickup, single dropoff
  - **Multi-Pickup**: multiple pickups, single dropoff
  - **Multi-Dropoff**: single pickup, multiple dropoffs

### 4. Route Optimization
- Genetic Algorithm finds optimal visiting order
- Respects constraints: pickup must precede its dropoff
- Configurable GA parameters:
  - Population size (default: 100)
  - Generations (default: 500)
  - Mutation rate (default: 0.02)

### 5. Results Display
- Ordered list of stops with leg distances
- Total route distance (Gm)
- Total profit (aUEC)
- Profit efficiency (aUEC/Gm)
- GA convergence chart (distance over generations)

### 6. Route Visualization (Stretch Goal)
- 2D system map showing route lines
- Color-coded by mission

---

## Tech Stack

| Layer         | Technology             |
| ------------- | ---------------------- |
| Framework     | React 18 + TypeScript  |
| Build         | Vite                   |
| Styling       | Tailwind CSS           |
| Components    | shadcn/ui (dark theme) |
| State         | Zustand                |
| Charts        | Recharts               |
| PWA           | vite-plugin-pwa        |
| Offline Cache | IndexedDB (via idb)    |

---

## Data Sources

### Location Coordinates
- **Orbital bodies**: `https://starmap.space/api/v3/oc/index.php`
- **POIs (stations, outposts)**: `https://starmap.space/api/v3/pois/index.php`

### What the API Does NOT Provide
- Mission payouts (user input)

---

## Coordinate System

### Format
- Heliocentric: each system's star is at origin (0, 0, 0)
- Units: **meters**
- Display conversion: 1 Gm = 1,000,000,000 m (1e9)

### Per-System Notes
| System  | Z-Axis Usage | Notes                         |
| ------- | ------------ | ----------------------------- |
| Stanton | ~0 (2D)      | All planets/moons on ecliptic |
| Pyro    | ~0 (2D)      | Same as Stanton               |
| Nyx     | Significant  | Full 3D calculations required |

---

## Genetic Algorithm Specification

### Problem Type
Traveling Salesman Problem (TSP) with precedence constraints.

### Constraints
1. Starting location is always first
2. For each mission: all pickups must come before all dropoffs
3. Optional: Final location

### Algorithm Details
- **Selection**: Tournament selection (size 3)
- **Crossover**: Ordered Crossover (OX) - preserves relative order
- **Mutation**: Swap mutation (respecting constraints)
- **Fitness**: `1 / totalDistance` (maximize)
- **Elitism**: Keep top 10% unchanged

### Output
- Best route found (ordered array of stop IDs)
- Fitness history (for convergence chart)
- Total distance of best route

---

## Multi-System Routes

### Jump Points
When a route spans multiple systems:
1. Identify required jump point(s)
2. Insert jump point as mandatory waypoint
3. Add configurable jump traversal cost (default: 0, just distance)

### Known Jump Points (Stanton)
| Jump Point     | Destination | Coordinates (m)              |
| -------------- | ----------- | ---------------------------- |
| Pyro Gateway   | Pyro        | (3.31e9, -27.98e9, -2.68e9)  |

---

## UI/UX Guidelines

### Theme
- Dark mode by default (space theme)
- Accent color: cyan/teal (#06b6d4)
- Use shadcn/ui components consistently

### Layout
- Left sidebar: mission list, GA controls
- Main area: route results, convergence chart
- Mobile: collapsible sidebar, stacked layout

### Interactions
- Drag-and-drop to reorder missions (optional)
- Click mission to edit
- Swipe to delete on mobile
- Real-time route recalculation on changes

---

## PWA Requirements

### Offline Capability
- Cache location data in IndexedDB
- App works fully offline after first load
- Show "offline" indicator when disconnected

### Install Prompt
- Custom install banner after 2nd visit
- App icon and splash screen configured

### Manifest
```json
{
  "name": "SC Hauling Planner",
  "short_name": "SC Hauler",
  "theme_color": "#06b6d4",
  "background_color": "#0f172a",
  "display": "standalone"
}
```

---

## Future Enhancements

1. **Profit Optimization**: Optimize for aUEC/hour instead of distance
2. **Route Sharing**: Export/import routes as URLs
3. **3D Visualization**: Three.js system map
