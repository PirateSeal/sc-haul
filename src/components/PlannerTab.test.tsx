import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlannerTab } from '@/components/PlannerTab';
import type { LocationSearchOption } from '@/services/searchable-locations';

vi.mock('@/components/AddMissionForm', () => ({
  AddMissionForm: () => <div>Mock contract form</div>,
}));

const LOCATION_OPTIONS: LocationSearchOption[] = [
  {
    id: 1,
    name: 'Ambitious Dream Station',
    displayName: 'Ambitious Dream Station',
    coords: { x: 1, y: 2, z: 3 },
    system: 'Stanton',
    source: 'starmap',
    confidence: 'exact',
    coordOrigin: 'starmap-body',
    aliases: ['Ambitious Dream Station', 'CRU-L1'],
    searchTerms: ['Ambitious Dream Station', 'CRU-L1'],
  },
];

describe('PlannerTab', () => {
  it('reuses the location search picker for the start location field', async () => {
    const user = userEvent.setup();
    const setStartLocation = vi.fn();

    render(
      <PlannerTab
        formKey={0}
        startLocationName=""
        setStartLocation={setStartLocation}
        locationOptions={LOCATION_OPTIONS}
        missions={[]}
        completedMissions={[]}
        clearHistory={vi.fn()}
        clearMissions={vi.fn()}
        removeMission={vi.fn()}
        loadExamples={vi.fn()}
        resetMissionForm={vi.fn()}
        routeResult={null}
        legMap={new Map()}
        maxScu={0}
        isOptimizing={false}
        optimizeError={null}
        progress={null}
        optimizeRoutePlan={vi.fn()}
      />
    );

    await user.click(screen.getByRole('combobox', { name: 'Start location' }));
    await user.type(screen.getByPlaceholderText('Search starting station…'), 'CRU-L1');
    await user.click(screen.getByText('Ambitious Dream Station'));

    expect(setStartLocation).toHaveBeenCalledWith('Ambitious Dream Station');
  });
});
