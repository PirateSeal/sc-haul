import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/services/uex', () => ({
  fetchUexVehicles: vi.fn(),
}))

import { FleetTab } from '@/components/FleetTab'
import { fetchUexVehicles } from '@/services/uex'

const CATALOG_SHIPS = [
  {
    id: 1,
    name: 'C2',
    nameFull: 'Hercules Starlifter C2',
    manufacturer: 'Crusader Industries',
    scu: 696,
    searchTerms: ['c2', 'hercules starlifter c2', 'crusader industries'],
    isCargo: true,
    isConcept: false,
  },
  {
    id: 2,
    name: 'Hull A',
    nameFull: 'Hull A',
    manufacturer: 'MISC',
    scu: 64,
    searchTerms: ['hull a', 'misc'],
    isCargo: true,
    isConcept: false,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

function renderFleetTab() {
  const updateShip = vi.fn()
  const upsertFleetShip = vi.fn()
  const removeFleetShip = vi.fn()

  render(
    <FleetTab
      ship={null}
      fleet={[]}
      updateShip={updateShip}
      upsertFleetShip={upsertFleetShip}
      removeFleetShip={removeFleetShip}
    />
  )

  return { updateShip, upsertFleetShip, removeFleetShip }
}

describe('FleetTab', () => {
  it('loads the UEX catalog, selects a ship, and saves it active', async () => {
    vi.mocked(fetchUexVehicles).mockResolvedValue(CATALOG_SHIPS)
    const user = userEvent.setup()
    const { updateShip, upsertFleetShip } = renderFleetTab()

    await user.click(
      await screen.findByRole('button', { name: /search the uex ship catalog/i })
    )
    await user.type(
      await screen.findByPlaceholderText(/search by manufacturer or ship name/i),
      'c2'
    )
    await user.click(await screen.findByText('Hercules Starlifter C2'))
    await user.click(await screen.findByRole('button', { name: /save & set active/i }))

    expect(updateShip).toHaveBeenCalledWith({
      name: 'Hercules Starlifter C2',
      maxScu: 696,
      source: 'uex',
      uexVehicleId: 1,
      manufacturer: 'Crusader Industries',
    })
    expect(upsertFleetShip).toHaveBeenCalledWith({
      name: 'Hercules Starlifter C2',
      maxScu: 696,
      source: 'uex',
      uexVehicleId: 1,
      manufacturer: 'Crusader Industries',
    })
  })

  it('reveals the custom fallback when no UEX ship matches', async () => {
    vi.mocked(fetchUexVehicles).mockResolvedValue(CATALOG_SHIPS)
    const user = userEvent.setup()
    const { updateShip, upsertFleetShip } = renderFleetTab()

    await user.click(
      await screen.findByRole('button', { name: /search the uex ship catalog/i })
    )
    await user.type(
      await screen.findByPlaceholderText(/search by manufacturer or ship name/i),
      'Ironclad'
    )

    expect(await screen.findByText(/create a custom ship/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/maximum scu cargo capacity/i), '512')
    await user.click(screen.getByRole('button', { name: /create custom ship/i }))

    expect(updateShip).toHaveBeenCalledWith({
      name: 'Ironclad',
      maxScu: 512,
      source: 'custom',
      manufacturer: null,
    })
    expect(upsertFleetShip).toHaveBeenCalledWith({
      name: 'Ironclad',
      maxScu: 512,
      source: 'custom',
      manufacturer: null,
    })
  })

  it('shows an error state and retries the catalog load', async () => {
    vi.mocked(fetchUexVehicles)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(CATALOG_SHIPS)
    const user = userEvent.setup()

    renderFleetTab()

    expect(await screen.findByText(/uex ship catalog unavailable/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /retry/i }))

    expect(fetchUexVehicles).toHaveBeenCalledTimes(2)
    expect(await screen.findByRole('button', { name: /search the uex ship catalog/i })).toBeInTheDocument()
  })
})
