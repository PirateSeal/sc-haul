import { describe, it, expect, beforeEach } from 'vitest';
import { useHaulStore, type Mission, type GAConfig } from '@/store/useHaulStore';

const DEFAULT_GA: GAConfig = { populationSize: 100, generations: 500, mutationRate: 0.02 };

function makeMission(id = 'test-1'): Mission {
  return {
    id,
    type: 'direct',
    reward: 10000,
    cargoEntries: [
      {
        id: 'entry-1',
        scu: 25,
        pickupLocationName: 'Everus Harbour',
        dropoffLocationName: 'Port Tressler',
      },
    ],
  };
}

beforeEach(() => {
  // Reset to clean state before every test
  useHaulStore.setState({
    missions: [],
    completedMissions: [],
    doneLegs: new Set<string>(),
    ship: null,
    fleet: [],
    startLocationName: '',
    gaConfig: DEFAULT_GA,
  });
  localStorage.clear();
});

describe('initial state', () => {
  it('has no missions', () => {
    expect(useHaulStore.getState().missions).toHaveLength(0);
  });

  it('has null ship', () => {
    expect(useHaulStore.getState().ship).toBeNull();
  });

  it('has empty start location', () => {
    expect(useHaulStore.getState().startLocationName).toBe('');
  });

  it('has default GA config', () => {
    expect(useHaulStore.getState().gaConfig).toEqual(DEFAULT_GA);
  });
});

describe('addMission', () => {
  it('adds a mission to the list', () => {
    useHaulStore.getState().addMission(makeMission());
    expect(useHaulStore.getState().missions).toHaveLength(1);
  });

  it('appends multiple missions in order', () => {
    useHaulStore.getState().addMission(makeMission('m1'));
    useHaulStore.getState().addMission(makeMission('m2'));
    const ids = useHaulStore.getState().missions.map(m => m.id);
    expect(ids).toEqual(['m1', 'm2']);
  });

  it('stores mission data correctly', () => {
    const mission = makeMission();
    useHaulStore.getState().addMission(mission);
    expect(useHaulStore.getState().missions[0]).toEqual(mission);
  });
});

describe('removeMission', () => {
  it('removes a mission by id', () => {
    useHaulStore.getState().addMission(makeMission('m1'));
    useHaulStore.getState().removeMission('m1');
    expect(useHaulStore.getState().missions).toHaveLength(0);
  });

  it('only removes the targeted mission', () => {
    useHaulStore.getState().addMission(makeMission('m1'));
    useHaulStore.getState().addMission(makeMission('m2'));
    useHaulStore.getState().removeMission('m1');
    const ids = useHaulStore.getState().missions.map(m => m.id);
    expect(ids).toEqual(['m2']);
  });

  it('is a no-op for a non-existent id', () => {
    useHaulStore.getState().addMission(makeMission('m1'));
    useHaulStore.getState().removeMission('does-not-exist');
    expect(useHaulStore.getState().missions).toHaveLength(1);
  });
});

describe('clearMissions', () => {
  it('removes all missions', () => {
    useHaulStore.getState().addMission(makeMission('m1'));
    useHaulStore.getState().addMission(makeMission('m2'));
    useHaulStore.getState().clearMissions();
    expect(useHaulStore.getState().missions).toHaveLength(0);
  });

  it('is a no-op on an empty list', () => {
    useHaulStore.getState().clearMissions();
    expect(useHaulStore.getState().missions).toHaveLength(0);
  });
});

describe('updateShip', () => {
  it('sets the ship config', () => {
    useHaulStore.getState().updateShip({ name: 'Cutlass Black', maxScu: 46 });
    expect(useHaulStore.getState().ship).toEqual({
      name: 'Cutlass Black',
      maxScu: 46,
      manufacturer: null,
      source: 'custom',
    });
  });

  it('replaces an existing ship config', () => {
    useHaulStore.getState().updateShip({ name: 'Cutlass Black', maxScu: 46 });
    useHaulStore.getState().updateShip({ name: 'Freelancer MAX', maxScu: 122 });
    expect(useHaulStore.getState().ship!.name).toBe('Freelancer MAX');
  });
});

describe('fleet roster', () => {
  it('dedupes UEX ships by vehicle id', () => {
    useHaulStore.getState().upsertFleetShip({
      name: 'C2 Hercules',
      maxScu: 696,
      source: 'uex',
      uexVehicleId: 77,
      manufacturer: 'Crusader Industries',
    });

    useHaulStore.getState().upsertFleetShip({
      name: 'Hercules Starlifter C2',
      maxScu: 696,
      source: 'uex',
      uexVehicleId: 77,
      manufacturer: 'Crusader Industries',
    });

    expect(useHaulStore.getState().fleet).toHaveLength(1);
    expect(useHaulStore.getState().fleet[0].name).toBe('Hercules Starlifter C2');
  });

  it('removes UEX ships by vehicle id', () => {
    useHaulStore.getState().upsertFleetShip({
      name: 'C2 Hercules',
      maxScu: 696,
      source: 'uex',
      uexVehicleId: 77,
      manufacturer: 'Crusader Industries',
    });

    useHaulStore.getState().removeFleetShip({
      name: 'Different Name',
      maxScu: 696,
      source: 'uex',
      uexVehicleId: 77,
      manufacturer: 'Crusader Industries',
    });

    expect(useHaulStore.getState().fleet).toHaveLength(0);
  });

  it('migrates legacy saved ships to custom source metadata', async () => {
    useHaulStore.setState({
      missions: [],
      completedMissions: [],
      doneLegs: new Set<string>(),
      ship: null,
      fleet: [],
      startLocationName: '',
      gaConfig: DEFAULT_GA,
    });

    localStorage.setItem(
      'haul-storage',
      JSON.stringify({
        state: {
          missions: [],
          completedMissions: [],
          doneLegs: [],
          ship: { name: 'Cutlass Black', maxScu: 46 },
          fleet: [{ name: 'Freelancer MAX', maxScu: 122 }],
          startLocationName: '',
          gaConfig: DEFAULT_GA,
        },
        version: 7,
      })
    );

    await useHaulStore.persist.rehydrate();

    expect(useHaulStore.getState().ship).toMatchObject({
      name: 'Cutlass Black',
      maxScu: 46,
      source: 'custom',
      manufacturer: null,
    });
    expect(useHaulStore.getState().fleet[0]).toMatchObject({
      name: 'Freelancer MAX',
      maxScu: 122,
      source: 'custom',
      manufacturer: null,
    });
  });
});

describe('setStartLocation', () => {
  it('sets the start location name', () => {
    useHaulStore.getState().setStartLocation('Everus Harbour');
    expect(useHaulStore.getState().startLocationName).toBe('Everus Harbour');
  });

  it('overwrites the previous value', () => {
    useHaulStore.getState().setStartLocation('Everus Harbour');
    useHaulStore.getState().setStartLocation('Port Tressler');
    expect(useHaulStore.getState().startLocationName).toBe('Port Tressler');
  });
});

describe('updateGaConfig', () => {
  it('replaces the GA config', () => {
    useHaulStore.getState().updateGaConfig({ populationSize: 500, generations: 200, mutationRate: 0.1 });
    expect(useHaulStore.getState().gaConfig).toEqual({ populationSize: 500, generations: 200, mutationRate: 0.1 });
  });

  it('does not merge with previous config (full replacement)', () => {
    useHaulStore.getState().updateGaConfig({ populationSize: 50, generations: 100, mutationRate: 0.5 });
    expect(useHaulStore.getState().gaConfig.populationSize).toBe(50);
    expect(useHaulStore.getState().gaConfig.mutationRate).toBe(0.5);
  });
});
