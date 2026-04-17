import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddMissionForm } from '@/components/AddMissionForm';
import { useHaulStore } from '@/store/useHaulStore';
import type { LocationSearchOption } from '@/services/searchable-locations';

const { successToast, messageToast, alertMock } = vi.hoisted(() => ({
  successToast: vi.fn(),
  messageToast: vi.fn(),
  alertMock: vi.fn(),
}));

vi.mock('@/services/db', () => ({
  getCachedCommodities: vi.fn(() =>
    Promise.resolve([
      { id: 1, name: 'Iron', code: 'IRON', kind: 'Metal', is_illegal: 0 },
      { id: 2, name: 'Stims', code: 'STIM', kind: 'Drug', is_illegal: 1 },
    ])
  ),
}));

vi.mock('sonner', () => ({
  toast: {
    success: successToast,
    message: messageToast,
  },
}));

const LOCATION_OPTIONS: LocationSearchOption[] = [
  {
    id: 1,
    name: 'Everus Harbor',
    displayName: 'Everus Harbor',
    coords: { x: 1, y: 2, z: 3 },
    system: 'Stanton',
    source: 'starmap',
    confidence: 'exact',
    coordOrigin: 'starmap-body',
    aliases: ['Everus Harbor'],
    searchTerms: ['Everus Harbor'],
  },
  {
    id: 2,
    name: 'Baijini Point',
    displayName: 'Baijini Point',
    coords: { x: 4, y: 5, z: 6 },
    system: 'Stanton',
    source: 'starmap',
    confidence: 'exact',
    coordOrigin: 'starmap-body',
    aliases: ['Baijini Point'],
    searchTerms: ['Baijini Point'],
  },
];

async function selectPickerOption(name: string, search: string, optionLabel: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name }));
  await user.type(screen.getByPlaceholderText(search), optionLabel);
  await user.click(await screen.findByText(optionLabel));
}

describe('AddMissionForm', () => {
  beforeEach(() => {
    useHaulStore.setState({
      missions: [],
      completedMissions: [],
      doneLegs: new Set<string>(),
    });
    localStorage.clear();
    vi.clearAllMocks();
    window.alert = alertMock;
  });

  it('requires a selected commodity before submitting', async () => {
    const user = userEvent.setup();

    render(<AddMissionForm locationOptions={LOCATION_OPTIONS} />);

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Pickup location' })).toBeInTheDocument());
    await selectPickerOption('Pickup location', 'Search pickup location…', 'Everus Harbor');
    await selectPickerOption('Dropoff location', 'Search dropoff location…', 'Baijini Point');

    await user.type(screen.getByLabelText('SCU amount'), '16');
    await user.type(screen.getByLabelText('Contract Reward (aUEC)'), '45000');
    await user.click(screen.getByRole('button', { name: 'Add Contract' }));

    expect(alertMock).toHaveBeenCalledWith('Select a commodity for direct cargo row 1.');
    expect(useHaulStore.getState().missions).toHaveLength(0);
  });

  it('submits a direct contract with canonical location and commodity data', async () => {
    const user = userEvent.setup();

    render(<AddMissionForm locationOptions={LOCATION_OPTIONS} />);

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Pickup location' })).toBeInTheDocument());
    await selectPickerOption('Pickup location', 'Search pickup location…', 'Everus Harbor');
    await selectPickerOption('Dropoff location', 'Search dropoff location…', 'Baijini Point');
    await selectPickerOption('Commodity', 'Search commodity…', 'Iron');

    await user.type(screen.getByLabelText('SCU amount'), '16');
    await user.type(screen.getByLabelText('Contract Reward (aUEC)'), '45000');
    await user.click(screen.getByRole('button', { name: 'Add Contract' }));

    const state = useHaulStore.getState();
    expect(state.missions).toHaveLength(1);
    expect(state.missions[0].cargoEntries[0]).toEqual(
      expect.objectContaining({
        pickupLocationName: 'Everus Harbor',
        dropoffLocationName: 'Baijini Point',
        scu: 16,
        commodity: {
          id: 1,
          name: 'Iron',
          code: 'IRON',
          kind: 'Metal',
          isIllegal: false,
        },
      })
    );
    expect(successToast).toHaveBeenCalled();
  });
});
