import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from 'sonner';

export type MissionType = 'direct' | 'multi-pickup' | 'multi-dropoff';

export interface MissionCommodity {
  id: number;
  name: string;
  code: string;
  kind: string;
  isIllegal: boolean;
}

/**
 * One cargo line inside a contract.
 * Each entry has its own pickup, dropoff, commodity and quantity — matching the
 * source tool's flat event model where every cargo item is fully self-described.
 */
export interface CargoEntry {
  id: string;
  commodity?: MissionCommodity;
  scu: number;
  pickupLocationName: string;
  dropoffLocationName: string;
}

export interface Mission {
  id: string;
  type: MissionType;
  cargoEntries: CargoEntry[];
  reward: number;
}

export type ShipSource = 'uex' | 'custom';

export interface ShipConfig {
  name: string;
  maxScu: number;
  source?: ShipSource;
  uexVehicleId?: number;
  manufacturer?: string | null;
}

export interface GAConfig {
  populationSize: number;
  generations: number;
  mutationRate: number;
}

const DEFAULT_GA_CONFIG: GAConfig = {
  populationSize: 100,
  generations: 500,
  mutationRate: 0.02,
};

interface HaulState {
  missions: Mission[];
  completedMissions: Mission[];
  doneLegs: Set<string>; // tracks checked leg keys like "missionId:entryId:pickup"
  ship: ShipConfig | null;
  fleet: ShipConfig[];
  startLocationName: string;
  gaConfig: GAConfig;
  addMission: (mission: Mission) => void;
  removeMission: (id: string) => void;
  toggleLegDone: (legKey: string) => void;
  clearHistory: () => void;
  updateShip: (ship: ShipConfig) => void;
  upsertFleetShip: (ship: ShipConfig) => void;
  removeFleetShip: (ship: ShipConfig) => void;
  setStartLocation: (name: string) => void;
  updateGaConfig: (config: GAConfig) => void;
  clearMissions: () => void;
}

function normalizeShipConfig(ship: ShipConfig): ShipConfig {
  return {
    ...ship,
    source: ship.source ?? (ship.uexVehicleId ? 'uex' : 'custom'),
    manufacturer: ship.manufacturer ?? null,
  };
}

function shipsMatch(left: ShipConfig, right: ShipConfig) {
  if (left.uexVehicleId != null && right.uexVehicleId != null) {
    return left.uexVehicleId === right.uexVehicleId;
  }

  if (left.uexVehicleId != null || right.uexVehicleId != null) {
    return false;
  }

  return left.name.trim().toLowerCase() === right.name.trim().toLowerCase();
}

function normalizeFleet(fleet: ShipConfig[] | undefined) {
  return (fleet ?? []).map(normalizeShipConfig);
}

export const useHaulStore = create<HaulState>()(
  persist(
    (set, get) => ({
      missions: [],
      completedMissions: [],
      doneLegs: new Set<string>(),
      ship: null,
      fleet: [],
      startLocationName: '',
      gaConfig: DEFAULT_GA_CONFIG,
      addMission: (mission) =>
        set((state) => ({ missions: [...state.missions, mission] })),
      removeMission: (id) =>
        set((state) => ({
          missions: state.missions.filter((m) => m.id !== id),
        })),
      toggleLegDone: (legKey) =>
        set((state) => {
          const newDoneLegs = new Set(state.doneLegs);
          if (newDoneLegs.has(legKey)) {
            newDoneLegs.delete(legKey);
          } else {
            newDoneLegs.add(legKey);
          }
          // Check if any mission is now fully complete
          // legKey format: "missionId:entryId:pickup" or "missionId:entryId:dropoff"
          const parts = legKey.split(':');
          if (parts.length >= 3) {
            const missionId = parts[0];
            const mission = get().missions.find((m) => m.id === missionId);
            if (mission) {
              // Check all entries have both pickup and dropoff done
              const allDone = mission.cargoEntries.every((entry) => {
                const pickupKey = `${missionId}:${entry.id}:pickup`;
                const dropoffKey = `${missionId}:${entry.id}:dropoff`;
                return newDoneLegs.has(pickupKey) && newDoneLegs.has(dropoffKey);
              });
              if (allDone) {
                // Auto-complete mission
                const newMissions = state.missions.filter((m) => m.id !== missionId);
                // Clean doneLegs for this mission
                for (const key of newDoneLegs) {
                  if (key.startsWith(`${missionId}:`)) newDoneLegs.delete(key);
                }
                const totalScu = mission.cargoEntries.reduce((sum, e) => sum + e.scu, 0);
                toast.success('Contract complete', {
                  description: `${totalScu} SCU delivered · +${mission.reward.toLocaleString()} aUEC`,
                });
                return {
                  missions: newMissions,
                  completedMissions: [...state.completedMissions, mission],
                  doneLegs: newDoneLegs,
                };
              }
            }
          }
          return { doneLegs: newDoneLegs };
        }),
      clearHistory: () => set({ completedMissions: [] }),
      updateShip: (ship) => set({ ship: normalizeShipConfig(ship) }),
      upsertFleetShip: (ship) =>
        set((state) => {
          const normalizedShip = normalizeShipConfig(ship);
          const existing = state.fleet.findIndex(
            (fleetShip) => shipsMatch(fleetShip, normalizedShip)
          );
          const fleet =
            existing >= 0
              ? state.fleet.map((fleetShip, index) =>
                  index === existing ? normalizedShip : fleetShip
                )
              : [...state.fleet, normalizedShip];
          return { fleet };
        }),
      removeFleetShip: (ship) =>
        set((state) => ({
          fleet: state.fleet.filter(
            (fleetShip) => !shipsMatch(fleetShip, normalizeShipConfig(ship))
          ),
        })),
      setStartLocation: (startLocationName) => set({ startLocationName }),
      updateGaConfig: (gaConfig) => set({ gaConfig }),
      clearMissions: () => set({ missions: [] }),
    }),
    {
      name: 'haul-storage',
      version: 8,
      migrate: (persistedState, version) => {
        let state = persistedState as Partial<HaulState>;
        // v5: Mission schema changed to cargoEntries[] — clear all missions
        if (version < 5) {
          state = { ...state, missions: [], startLocationName: '', fleet: [], completedMissions: [], doneLegs: new Set<string>() };
        }
        // v6: Added fleet roster
        if (version < 6) {
          state = { ...state, fleet: [], completedMissions: [], doneLegs: new Set<string>() };
        }
        // v7: Added completedMissions and doneLegs
        if (version < 7) {
          state = { ...state, completedMissions: [], doneLegs: new Set<string>() };
        }

        return {
          ...state,
          ship: state.ship ? normalizeShipConfig(state.ship) : null,
          fleet: normalizeFleet(state.fleet),
          completedMissions: state.completedMissions ?? [],
          doneLegs: state.doneLegs ?? new Set<string>(),
        } as HaulState;
      },
      // Custom storage to handle Set serialization
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          if (parsed.state?.doneLegs) {
            parsed.state.doneLegs = new Set(parsed.state.doneLegs);
          }
          return parsed;
        },
        setItem: (name, value) => {
          const toStore = {
            ...value,
            state: {
              ...value.state,
              doneLegs: value.state.doneLegs ? Array.from(value.state.doneLegs) : [],
            },
          };
          localStorage.setItem(name, JSON.stringify(toStore));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
