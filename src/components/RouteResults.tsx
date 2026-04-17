import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { RouteNode } from '@/lib/genetic-algorithm';
import { calculateRouteCost } from '@/lib/genetic-algorithm';
import type { Mission, CargoEntry } from '@/store/useHaulStore';
import { useHaulStore } from '@/store/useHaulStore';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

const GM = 1e9; // meters per Gigameter

export interface LegEntry {
  mission: Mission;
  cargoEntry: CargoEntry;
  scu: number; // actual SCU for this leg (may differ from cargoEntry.scu for capacity-split legs)
}

interface RouteResultsProps {
  route: RouteNode[];
  history: number[];
  missions: Mission[];
  /** Maps GA leg ID → LegEntry (handles capacity-split legs and multi-stop expansions) */
  legMap: Map<string, LegEntry>;
  maxScu: number;
}

function dist3d(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

type CargoAction = {
  legId: string;
  scu: number;
  commodity?: string;
  isIllegal?: boolean;
};

type CommodityGroup = {
  commodity: string | undefined;
  isIllegal: boolean | undefined;
  totalScu: number;
  entries: CargoAction[];
};

function groupByCommodity(actions: CargoAction[]): CommodityGroup[] {
  const map = new Map<string, CommodityGroup>();
  for (const action of actions) {
    const key = action.commodity ?? '';
    if (!map.has(key)) {
      map.set(key, { commodity: action.commodity, isIllegal: action.isIllegal, totalScu: 0, entries: [] });
    }
    const g = map.get(key)!;
    g.totalScu += action.scu;
    g.entries.push(action);
  }
  return Array.from(map.values());
}

function getActiveMissionId(legId: string): string {
  const parts = legId.split(':');
  return parts.length >= 2 ? parts[0] : legId;
}

type LocationGroup = {
  name: string;
  legGm: number;
  cumulativeGm: number;
  load: number; // ship load after all actions at this location
  pickups: CargoAction[];
  dropoffs: CargoAction[];
  isStart: boolean;
};

export function RouteResults({ route, history, missions, legMap, maxScu }: RouteResultsProps) {
  const doneLegs = useHaulStore((state) => state.doneLegs);
  const toggleLegDone = useHaulStore((state) => state.toggleLegDone);

  // Filter route to only include nodes for active missions
  const activeMissionIds = new Set(missions.map((m) => m.id));
  const filteredRoute = route.filter((node) => {
    if (!node.missionId) return true; // keep start node
    return activeMissionIds.has(getActiveMissionId(node.missionId));
  });

  const totalDistanceGm = calculateRouteCost(filteredRoute) / GM;
  const totalReward = missions.reduce((sum, m) => sum + m.reward, 0);
  const efficiency = totalDistanceGm > 0 ? totalReward / totalDistanceGm : 0;
  const hasCap = maxScu > 0 && isFinite(maxScu);

  // Build flat stops first, then group by consecutive location
  type FlatStop = {
    name: string;
    type: 'Start' | 'Pickup' | 'Dropoff';
    legId: string;
    legGm: number;
    cumulativeGm: number;
    deltaScu: number;
    currentLoad: number;
    commodity?: string;
    isIllegal?: boolean;
  };

  const flatStops: FlatStop[] = [];
  let cumulative = 0;
  let currentLoad = 0;

  for (let i = 0; i < filteredRoute.length; i++) {
    const node = filteredRoute[i];
    let name = 'Starting Point';
    let typeLabel: 'Start' | 'Pickup' | 'Dropoff' = 'Start';
    let deltaScu = 0;
    let commodity: string | undefined;
    let isIllegal: boolean | undefined;
    const legId = node.missionId ?? '';

    if (node.missionId) {
      const legEntry = legMap.get(node.missionId);
      const legScu = legEntry?.scu ?? 0;
      commodity = legEntry?.cargoEntry.commodity?.name;
      isIllegal = legEntry?.cargoEntry.commodity?.isIllegal;

      if (node.type === 'pickup') {
        deltaScu = legScu;
        currentLoad += deltaScu;
        name = legEntry?.cargoEntry.pickupLocationName ?? node.missionId;
        typeLabel = 'Pickup';
      } else if (node.type === 'dropoff') {
        deltaScu = -legScu;
        currentLoad += deltaScu;
        name = legEntry?.cargoEntry.dropoffLocationName ?? node.missionId;
        typeLabel = 'Dropoff';
      }
    }

    const legGm = i > 0 ? dist3d(filteredRoute[i - 1].point, node.point) / GM : 0;
    cumulative += legGm;

    flatStops.push({ name, type: typeLabel, legId, legGm, cumulativeGm: cumulative, deltaScu, currentLoad, commodity, isIllegal });
  }

  // Group consecutive stops at the same location
  const groups: LocationGroup[] = [];
  let i = 0;
  while (i < flatStops.length) {
    const stop = flatStops[i];
    const group: LocationGroup = {
      name: stop.name,
      legGm: stop.legGm,
      cumulativeGm: stop.cumulativeGm,
      load: stop.currentLoad,
      pickups: [],
      dropoffs: [],
      isStart: stop.type === 'Start',
    };

    // Collect all consecutive stops at the same location
    let j = i;
    while (j < flatStops.length && flatStops[j].name === stop.name) {
      const s = flatStops[j];
      group.load = s.currentLoad; // update to latest load at this location
      if (s.type === 'Pickup') {
        group.pickups.push({ legId: s.legId, scu: s.deltaScu, commodity: s.commodity, isIllegal: s.isIllegal });
      } else if (s.type === 'Dropoff') {
        group.dropoffs.push({ legId: s.legId, scu: Math.abs(s.deltaScu), commodity: s.commodity, isIllegal: s.isIllegal });
      }
      j++;
    }

    groups.push(group);
    i = j;
  }

  // Downsample convergence history to max 200 points for chart performance
  const chartData = history.length > 200
    ? history.filter((_, k) => k % Math.ceil(history.length / 200) === 0)
    : history;

  const convergenceData = chartData.map((d, k) => ({
    generation: Math.round(k * (history.length / chartData.length)),
    distance: parseFloat((d / GM).toFixed(4)),
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-muted/40 p-3 border border-border">
          <div className="text-xs text-muted-foreground mb-1">Total Distance</div>
          <div className="text-lg font-mono text-primary">{totalDistanceGm.toFixed(3)} Gm</div>
        </div>
        <div className="rounded-lg bg-muted/40 p-3 border border-border">
          <div className="text-xs text-muted-foreground mb-1">Total Reward</div>
          <div className="text-lg font-mono text-success">{totalReward.toLocaleString()} aUEC</div>
        </div>
        <div className="rounded-lg bg-muted/40 p-3 border border-border">
          <div className="text-xs text-muted-foreground mb-1">Efficiency</div>
          <div className="text-lg font-mono text-warning">{efficiency.toFixed(0)} aUEC/Gm</div>
        </div>
      </div>

      {/* Location-grouped stop list */}
      <div className="flex flex-col gap-2">
        {groups.map((group, idx) => (
          <div key={idx} className="rounded-lg border border-border/30 overflow-hidden">
            {/* Location header */}
            <div className={cn(
              'px-3 py-2 border-b border-border/30',
              group.isStart
                ? 'bg-primary/10'
                : group.pickups.length > 0 && group.dropoffs.length > 0
                ? 'bg-muted/40'
                : group.pickups.length > 0
                ? 'bg-primary/5'
                : 'bg-success/5'
            )}>
              {/* Line 1: index + name + transit badge */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono text-muted-foreground shrink-0">#{idx + 1}</span>
                <span className="font-medium text-sm truncate">{group.name}</span>
                {group.pickups.length > 0 && group.dropoffs.length > 0 && (
                  <Badge variant="secondary" className="shrink-0">transit</Badge>
                )}
              </div>
              {/* Line 2: distances + cargo */}
              {!group.isStart && (() => {
                const netScu = group.pickups.reduce((s, p) => s + p.scu, 0) - group.dropoffs.reduce((s, d) => s + d.scu, 0);
                return (
                  <div className="flex items-center gap-3 mt-0.5 text-xs font-mono">
                    <span className="text-muted-foreground">
                      {group.legGm > 0 ? `+${group.legGm.toFixed(2)} Gm` : '—'}
                    </span>
                    <span className="text-muted-foreground/50">{group.cumulativeGm.toFixed(2)} Gm</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {netScu !== 0 && (
                        <span className={netScu > 0 ? 'text-primary' : 'text-success'}>
                          {netScu > 0 ? `+${netScu}` : netScu}
                        </span>
                      )}
                      <span className={cn(hasCap && group.load > maxScu ? 'text-destructive' : 'text-muted-foreground')}>
                        {group.load}{hasCap ? `/${maxScu}` : ''} SCU
                      </span>
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Cargo actions */}
            {(group.pickups.length > 0 || group.dropoffs.length > 0) && (
              <div className="divide-y divide-border/20">
                {group.pickups.length > 0 && (
                  <div className="px-3 py-2 bg-primary/5">
                    <div className="text-[10px] uppercase tracking-wider text-primary/70 mb-1.5 font-semibold">Pickup</div>
                    <div className="flex flex-col gap-1.5">
                      {groupByCommodity(group.pickups).map((cg, ci) => (
                        <div key={ci}>
                          {/* Commodity group header */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                              {cg.commodity ? (
                                <>
                                  <span>{cg.commodity}</span>
                                  {cg.isIllegal && <span className="text-destructive text-[10px]">⚠ illegal</span>}
                                </>
                              ) : (
                                <span className="italic opacity-60">cargo</span>
                              )}
                            </div>
                            <span className="font-mono text-primary">+{cg.totalScu} SCU</span>
                          </div>
                          {/* Individual entries with checkboxes (shown when >1 leg for same commodity) */}
                          {cg.entries.map((entry, ei) => {
                            // Extract missionId:entryId from legId (may have :splitN suffix)
                            const parts = entry.legId.split(':');
                            const baseKey = parts.length >= 2 ? `${parts[0]}:${parts[1]}` : entry.legId;
                            const pickupKey = `${baseKey}:pickup`;
                            return (
                              <div
                                key={ei}
                                className={cn(
                                  'flex items-center gap-2 mt-1 pl-2 text-xs cursor-pointer',
                                  doneLegs.has(pickupKey) ? 'opacity-40 line-through' : 'opacity-75'
                                )}
                                onClick={() => toggleLegDone(pickupKey)}
                              >
                                <Checkbox
                                  checked={doneLegs.has(pickupKey)}
                                  className="h-3 w-3 shrink-0"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleLegDone(pickupKey);
                                  }}
                                />
                                <span className="font-mono text-primary/80">+{entry.scu} SCU</span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {group.dropoffs.length > 0 && (
                  <div className="px-3 py-2 bg-success/5">
                    <div className="text-[10px] uppercase tracking-wider text-success/70 mb-1.5 font-semibold">Dropoff</div>
                    <div className="flex flex-col gap-1.5">
                      {groupByCommodity(group.dropoffs).map((cg, ci) => (
                        <div key={ci}>
                          {/* Commodity group header */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                              {cg.commodity ? (
                                <>
                                  <span>{cg.commodity}</span>
                                  {cg.isIllegal && <span className="text-destructive text-[10px]">⚠ illegal</span>}
                                </>
                              ) : (
                                <span className="italic opacity-60">cargo</span>
                              )}
                            </div>
                            <span className="font-mono text-success">-{cg.totalScu} SCU</span>
                          </div>
                          {/* Individual entries with checkboxes */}
                          {cg.entries.map((entry, ei) => {
                            // Extract missionId:entryId from legId (may have :splitN suffix)
                            const parts = entry.legId.split(':');
                            const baseKey = parts.length >= 2 ? `${parts[0]}:${parts[1]}` : entry.legId;
                            const dropoffKey = `${baseKey}:dropoff`;
                            return (
                              <div
                                key={ei}
                                className={cn(
                                  'flex items-center gap-2 mt-1 pl-2 text-xs cursor-pointer',
                                  doneLegs.has(dropoffKey) ? 'opacity-40 line-through' : 'opacity-75'
                                )}
                                onClick={() => toggleLegDone(dropoffKey)}
                              >
                                <Checkbox
                                  checked={doneLegs.has(dropoffKey)}
                                  className="h-3 w-3 shrink-0"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleLegDone(dropoffKey);
                                  }}
                                />
                                <span className="font-mono text-success/80">-{entry.scu} SCU</span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Convergence chart */}
      {convergenceData.length > 1 && (
        <div>
          <div className="text-xs text-muted-foreground mb-2">GA Convergence</div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={convergenceData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="generation"
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}Gm`}
                width={50}
              />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                formatter={(v) => [`${v} Gm`, 'Best Distance']}
                labelFormatter={(l) => `Generation ${l}`}
              />
              <Line
                type="monotone"
                dataKey="distance"
                stroke="#06b6d4"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  );
}
