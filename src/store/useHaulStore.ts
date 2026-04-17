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

export interface ShipConfig {
  name: string;
  maxScu: number;
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
  removeFleetShip: (name: string) => void;
  setStartLocation: (name: string) => void;
  updateGaConfig: (config: GAConfig) => void;
  clearMissions: () => void;
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
      updateShip: (ship) => set({ ship }),
      upsertFleetShip: (ship) =>
        set((state) => {
          const existing = state.fleet.findIndex(
            (s) => s.name.toLowerCase() === ship.name.toLowerCase()
          );
          const fleet =
            existing >= 0
              ? state.fleet.map((s, i) => (i === existing ? ship : s))
              : [...state.fleet, ship];
          return { fleet };
        }),
      removeFleetShip: (name) =>
        set((state) => ({
          fleet: state.fleet.filter(
            (s) => s.name.toLowerCase() !== name.toLowerCase()
          ),
        })),
      setStartLocation: (startLocationName) => set({ startLocationName }),
      updateGaConfig: (gaConfig) => set({ gaConfig }),
      clearMissions: () => set({ missions: [] }),
    }),
    {
      name: 'haul-storage',
      version: 7,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<HaulState>;
        // v5: Mission schema changed to cargoEntries[] — clear all missions
        if (version < 5) {
          return { ...state, missions: [], startLocationName: '', fleet: [], completedMissions: [], doneLegs: new Set<string>() };
        }
        // v6: Added fleet roster
        if (version < 6) {
          return { ...state, fleet: [], completedMissions: [], doneLegs: new Set<string>() };
        }
        // v7: Added completedMissions and doneLegs
        if (version < 7) {
          return { ...state, completedMissions: [], doneLegs: new Set<string>() };
        }
        return state as HaulState;
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
