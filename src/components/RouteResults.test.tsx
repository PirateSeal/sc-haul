import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouteResults, type LegEntry } from '@/components/RouteResults';
import type { RouteNode } from '@/lib/genetic-algorithm';
import { useHaulStore, type Mission, type CargoEntry } from '@/store/useHaulStore';

// Recharts uses ResizeObserver which is not in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeEach(() => {
  useHaulStore.setState({
    missions: [],
    completedMissions: [],
    doneLegs: new Set<string>(),
  });
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Test data builders
// ---------------------------------------------------------------------------
function makeCargoEntry(id: string, pickupLoc: string, dropoffLoc: string, scu = 10): CargoEntry {
  return { id, scu, pickupLocationName: pickupLoc, dropoffLocationName: dropoffLoc };
}

function makeMission(id: string, reward = 5000): Mission {
  return {
    id,
    type: 'direct',
    reward,
    cargoEntries: [makeCargoEntry('e1', 'Alpha Station', 'Beta Outpost')],
  };
}

const P = (x: number, y = 0, z = 0) => ({ x, y, z });

// Simple 2-mission route: start → pickup m1 → pickup m2 → dropoff m1 → dropoff m2
function makeRouteAndLegMap() {
  const missionA = makeMission('mA', 10_000);
  const missionB = makeMission('mB', 8_000);

  const route: RouteNode[] = [
    { type: 'start', point: P(0) },
    { type: 'pickup', missionId: 'mA', point: P(3, 4) },       // 5 Gm from start
    { type: 'pickup', missionId: 'mB', point: P(6, 8) },       // 5 Gm further
    { type: 'dropoff', missionId: 'mA', point: P(9, 12) },     // 5 Gm further
    { type: 'dropoff', missionId: 'mB', point: P(12, 16) },    // 5 Gm further
  ];

  const legMap = new Map<string, LegEntry>([
    ['mA', { mission: missionA, cargoEntry: makeCargoEntry('eA', 'Alpha Station', 'Alpha Dropoff'), scu: 10 }],
    ['mB', { mission: missionB, cargoEntry: makeCargoEntry('eB', 'Beta Station', 'Beta Dropoff', 20), scu: 20 }],
  ]);

  return { route, legMap, missions: [missionA, missionB] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('RouteResults — stats panel', () => {
  it('renders total reward from all missions', () => {
    const { route, legMap, missions } = makeRouteAndLegMap();
    render(<RouteResults route={route} history={[]} missions={missions} legMap={legMap} maxScu={100} />);

    // 10000 + 8000 = 18000
    expect(screen.getByText(/18[,.]?000/)).toBeInTheDocument();
  });

  it('renders total distance label', () => {
    const { route, legMap, missions } = makeRouteAndLegMap();
    render(<RouteResults route={route} history={[]} missions={missions} legMap={legMap} maxScu={100} />);

    expect(screen.getByText('Total Distance')).toBeInTheDocument();
  });

  it('renders efficiency label', () => {
    const { route, legMap, missions } = makeRouteAndLegMap();
    render(<RouteResults route={route} history={[]} missions={missions} legMap={legMap} maxScu={100} />);

    expect(screen.getByText('Efficiency')).toBeInTheDocument();
  });

  it('shows aUEC/Gm efficiency metric', () => {
    const { route, legMap, missions } = makeRouteAndLegMap();
    render(<RouteResults route={route} history={[]} missions={missions} legMap={legMap} maxScu={100} />);

    expect(screen.getByText(/aUEC\/Gm/)).toBeInTheDocument();
  });
});

describe('RouteResults — stop list', () => {
  it('renders the starting point as stop #1', () => {
    const { route, legMap, missions } = makeRouteAndLegMap();
    render(<RouteResults route={route} history={[]} missions={missions} legMap={legMap} maxScu={100} />);

    expect(screen.getByText('Starting Point')).toBeInTheDocument();
  });

  it('renders pickup location names', () => {
    const { route, legMap, missions } = makeRouteAndLegMap();
    render(<RouteResults route={route} history={[]} missions={missions} legMap={legMap} maxScu={100} />);

    expect(screen.getByText('Alpha Station')).toBeInTheDocument();
    expect(screen.getByText('Beta Station')).toBeInTheDocument();
  });

  it('renders dropoff location names', () => {
    const { route, legMap, missions } = makeRouteAndLegMap();
    render(<RouteResults route={route} history={[]} missions={missions} legMap={legMap} maxScu={100} />);

    expect(screen.getByText('Alpha Dropoff')).toBeInTheDocument();
    expect(screen.getByText('Beta Dropoff')).toBeInTheDocument();
  });

  it('shows Pickup and Dropoff section labels', () => {
    const { route, legMap, missions } = makeRouteAndLegMap();
    render(<RouteResults route={route} history={[]} missions={missions} legMap={legMap} maxScu={100} />);

    expect(screen.getAllByText('Pickup').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dropoff').length).toBeGreaterThan(0);
  });

  it('shows SCU amounts in pickup sections', () => {
    const { route, legMap, missions } = makeRouteAndLegMap();
    render(<RouteResults route={route} history={[]} missions={missions} legMap={legMap} maxScu={100} />);

    // Each mission has its own aggregate pickup total
    expect(screen.getAllByText('+10 SCU').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('+20 SCU').length).toBeGreaterThanOrEqual(1);
  });

  it('shows overload warning when cargo exceeds maxScu', () => {
    const { route, legMap, missions } = makeRouteAndLegMap();
    // maxScu=5 means carrying 10+20=30 SCU → overloaded
    render(<RouteResults route={route} history={[]} missions={missions} legMap={legMap} maxScu={5} />);

    // The load counter should show e.g. "30/5 SCU" which exceeds limit
    const overloadEl = document.querySelector('.text-destructive');
    expect(overloadEl).toBeInTheDocument();
  });
});

describe('RouteResults — commodity grouping', () => {
  it('groups same-commodity pickups under one header', () => {
    // Two missions both picking up from the same location with same commodity
    const commodity = { id: 1, name: 'Iron', code: 'IRON', kind: 'Metal', isIllegal: false };
    const mission1: Mission = { id: 'm1', type: 'direct', reward: 1000, cargoEntries: [{ id: 'e1', scu: 10, pickupLocationName: 'Hub', dropoffLocationName: 'Depot', commodity }] };
    const mission2: Mission = { id: 'm2', type: 'direct', reward: 1000, cargoEntries: [{ id: 'e2', scu: 20, pickupLocationName: 'Hub', dropoffLocationName: 'Depot', commodity }] };

    const route: RouteNode[] = [
      { type: 'start', point: P(0) },
      { type: 'pickup', missionId: 'm1', point: P(5) },
      { type: 'pickup', missionId: 'm2', point: P(5) }, // same location
      { type: 'dropoff', missionId: 'm1', point: P(10) },
      { type: 'dropoff', missionId: 'm2', point: P(10) }, // same location
    ];

    const legMap = new Map<string, LegEntry>([
      ['m1', { mission: mission1, cargoEntry: mission1.cargoEntries[0], scu: 10 }],
      ['m2', { mission: mission2, cargoEntry: mission2.cargoEntries[0], scu: 20 }],
    ]);

    render(<RouteResults route={route} history={[]} missions={[mission1, mission2]} legMap={legMap} maxScu={100} />);

    // "Iron" should appear as a group header with total +30 SCU
    expect(screen.getByText('+30 SCU')).toBeInTheDocument();
  });

  it('shows illegal warning badge', () => {
    const commodity = { id: 2, name: 'Stims', code: 'STIM', kind: 'Drug', isIllegal: true };
    const mission: Mission = { id: 'm1', type: 'direct', reward: 5000, cargoEntries: [{ id: 'e1', scu: 10, pickupLocationName: 'A', dropoffLocationName: 'B', commodity }] };

    const route: RouteNode[] = [
      { type: 'start', point: P(0) },
      { type: 'pickup', missionId: 'm1', point: P(1) },
      { type: 'dropoff', missionId: 'm1', point: P(2) },
    ];

    const legMap = new Map<string, LegEntry>([
      ['m1', { mission, cargoEntry: mission.cargoEntries[0], scu: 10 }],
    ]);

    render(<RouteResults route={route} history={[]} missions={[mission]} legMap={legMap} maxScu={100} />);

    expect(screen.getAllByText(/illegal/i).length).toBeGreaterThan(0);
  });
});

describe('RouteResults — delivery checkboxes', () => {
  it('renders checkboxes for cargo entries', () => {
    const { route, legMap, missions } = makeRouteAndLegMap();
    render(<RouteResults route={route} history={[]} missions={missions} legMap={legMap} maxScu={100} />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('toggles entry to done state when checkbox is clicked', () => {
    const { route, legMap, missions } = makeRouteAndLegMap();
    render(<RouteResults route={route} history={[]} missions={missions} legMap={legMap} maxScu={100} />);

    const checkbox = screen.getAllByRole('checkbox')[0];
    const row = checkbox.closest('div[class*="cursor-pointer"]');
    expect(row).not.toBeNull();
    expect(row!.className).not.toContain('line-through');

    fireEvent.click(row!);
    expect(row!.className).toContain('line-through');
  });

  it('unchecks a checked entry on second click', () => {
    const { route, legMap, missions } = makeRouteAndLegMap();
    render(<RouteResults route={route} history={[]} missions={missions} legMap={legMap} maxScu={100} />);

    const checkbox = screen.getAllByRole('checkbox')[0];
    const row = checkbox.closest('div[class*="cursor-pointer"]');
    expect(row).not.toBeNull();

    fireEvent.click(row!);
    fireEvent.click(row!);
    expect(row!.className).not.toContain('line-through');
  });

  it('applies line-through style when entry is done', () => {
    const { route, legMap, missions } = makeRouteAndLegMap();
    render(<RouteResults route={route} history={[]} missions={missions} legMap={legMap} maxScu={100} />);

    const checkbox = screen.getAllByRole('checkbox')[0];
    const row = checkbox.closest('div[class*="cursor-pointer"]');
    expect(row).not.toBeNull();

    fireEvent.click(row!);
    expect(row!.className).toContain('line-through');
  });
});

describe('RouteResults — convergence chart', () => {
  it('does not render chart when history is empty', () => {
    const { route, legMap, missions } = makeRouteAndLegMap();
    render(<RouteResults route={route} history={[]} missions={missions} legMap={legMap} maxScu={100} />);

    expect(screen.queryByText('GA Convergence')).not.toBeInTheDocument();
  });

  it('renders chart label when history has data', () => {
    const { route, legMap, missions } = makeRouteAndLegMap();
    const history = Array.from({ length: 10 }, (_, i) => 1000 - i * 10);

    render(<RouteResults route={route} history={history} missions={missions} legMap={legMap} maxScu={100} />);

    expect(screen.getByText('GA Convergence')).toBeInTheDocument();
  });
});

describe('RouteResults — transit badge', () => {
  it('shows transit badge when a location has both pickup and dropoff', () => {
    const mTransit: Mission = { id: 'mT', type: 'direct', reward: 1000, cargoEntries: [{ id: 'eT', scu: 5, pickupLocationName: 'SharedHub', dropoffLocationName: 'SharedHub' }] };
    const routeTransit2: RouteNode[] = [
      { type: 'start', point: P(0) },
      { type: 'pickup', missionId: 'mT', point: P(5) },
      { type: 'dropoff', missionId: 'mT', point: P(5) }, // same point = same location group
    ];
    const legMapTransit = new Map<string, LegEntry>([
      ['mT', { mission: mTransit, cargoEntry: mTransit.cargoEntries[0], scu: 5 }],
    ]);

    render(<RouteResults route={routeTransit2} history={[]} missions={[mTransit]} legMap={legMapTransit} maxScu={100} />);

    expect(screen.getByText('transit')).toBeInTheDocument();
  });
});
