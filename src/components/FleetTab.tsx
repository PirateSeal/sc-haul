import { useEffect, useState } from 'react'
import { AlertCircle, ChevronsUpDown, RotateCcw, Ship, Trash2 } from 'lucide-react'

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { fetchUexVehicles, type UexVehicleCatalogEntry } from '@/services/uex'
import type { ShipConfig } from '@/store/useHaulStore'
import { cn } from '@/lib/utils'

interface FleetTabProps {
  ship: ShipConfig | null
  fleet: ShipConfig[]
  updateShip: (ship: ShipConfig) => void
  upsertFleetShip: (ship: ShipConfig) => void
  removeFleetShip: (ship: ShipConfig) => void
}

function normalizeSearchTerm(value: string) {
  return value.trim().toLowerCase()
}

function matchesShipSearch(ship: UexVehicleCatalogEntry, query: string) {
  const normalizedQuery = normalizeSearchTerm(query)
  if (!normalizedQuery) return true

  return ship.searchTerms.some((term) => term.includes(normalizedQuery))
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined'
      ? true
      : window.matchMedia('(min-width: 768px)').matches
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const updateMatch = (event: MediaQueryListEvent) => setIsDesktop(event.matches)

    mediaQuery.addEventListener('change', updateMatch)

    return () => mediaQuery.removeEventListener('change', updateMatch)
  }, [])

  return isDesktop
}

interface ShipPickerPanelProps {
  query: string
  selectedShipId: number | null
  ships: UexVehicleCatalogEntry[]
  onQueryChange: (value: string) => void
  onSelectShip: (ship: UexVehicleCatalogEntry) => void
}

function ShipPickerPanel({
  query,
  selectedShipId,
  ships,
  onQueryChange,
  onSelectShip,
}: ShipPickerPanelProps) {
  return (
    <Command shouldFilter={false} className="rounded-none border-0 bg-transparent p-0">
      <CommandInput
        value={query}
        onValueChange={onQueryChange}
        placeholder="Search by manufacturer or ship name"
      />
      <CommandList className="max-h-72">
        <CommandEmpty>No UEX ships matched that search.</CommandEmpty>
        <CommandGroup heading="Cargo Ships">
          {ships.map((catalogShip) => (
            <CommandItem
              key={catalogShip.id}
              value={`${catalogShip.manufacturer ?? ''} ${catalogShip.nameFull}`}
              data-checked={selectedShipId === catalogShip.id}
              onSelect={() => onSelectShip(catalogShip)}
            >
              <Ship />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate">{catalogShip.nameFull}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {catalogShip.manufacturer ?? 'Unknown maker'} · {catalogShip.scu} SCU
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

export function FleetTab({
  ship,
  fleet,
  updateShip,
  upsertFleetShip,
  removeFleetShip,
}: FleetTabProps) {
  const isDesktop = useIsDesktop()
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<UexVehicleCatalogEntry[]>([])
  const [query, setQuery] = useState(ship?.name ?? '')
  const [selectedShipId, setSelectedShipId] = useState<number | null>(
    ship?.source === 'uex' ? ship.uexVehicleId ?? null : null
  )
  const [customScu, setCustomScu] = useState(
    ship?.source === 'custom' && ship.maxScu > 0 ? ship.maxScu.toString() : ''
  )

  const filteredShips = catalog.filter((catalogShip) => matchesShipSearch(catalogShip, query))
  const selectedCatalogShip =
    catalog.find((catalogShip) => catalogShip.id === selectedShipId) ?? null
  const normalizedQuery = query.trim()
  const showCustomFallback =
    normalizedQuery.length > 0 && !isLoading && !loadError && filteredShips.length === 0

  const loadVehicleCatalog = async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const vehicles = await fetchUexVehicles()
      setCatalog(vehicles)
    } catch (error) {
      console.error(error)
      setLoadError('We could not load the UEX ship catalog.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadVehicleCatalog()
  }, [])

  const selectCatalogShip = (catalogShip: UexVehicleCatalogEntry) => {
    setSelectedShipId(catalogShip.id)
    setQuery(catalogShip.nameFull)
    setCustomScu('')
    setIsPickerOpen(false)
  }

  const handleRosterSelect = (fleetShip: ShipConfig) => {
    updateShip(fleetShip)
    setQuery(fleetShip.name)
    setSelectedShipId(fleetShip.uexVehicleId ?? null)
    setCustomScu(fleetShip.source === 'custom' && fleetShip.maxScu > 0 ? fleetShip.maxScu.toString() : '')
  }

  const saveSelectedShip = () => {
    if (!selectedCatalogShip) return

    const config: ShipConfig = {
      name: selectedCatalogShip.nameFull,
      maxScu: selectedCatalogShip.scu,
      source: 'uex',
      uexVehicleId: selectedCatalogShip.id,
      manufacturer: selectedCatalogShip.manufacturer,
    }

    updateShip(config)
    upsertFleetShip(config)
  }

  const saveCustomShip = () => {
    if (!normalizedQuery) return

    const config: ShipConfig = {
      name: normalizedQuery,
      maxScu: Number.parseInt(customScu, 10) || 0,
      source: 'custom',
      manufacturer: null,
    }

    updateShip(config)
    upsertFleetShip(config)
  }

  const pickerTriggerLabel =
    selectedCatalogShip?.nameFull || normalizedQuery || 'Search the UEX ship catalog'

  const handlePickerOpenChange = (open: boolean) => {
    if (open) {
      setQuery('')
    }

    setIsPickerOpen(open)
  }

  const pickerPanel = (
    <ShipPickerPanel
      query={query}
      selectedShipId={selectedShipId}
      ships={filteredShips}
      onQueryChange={setQuery}
      onSelectShip={selectCatalogShip}
    />
  )

  return (
    <div className="grid h-full grid-cols-1 gap-4 xl:grid-cols-[420px_1fr]">
      <Card className="flex min-h-0 flex-col border-border shadow-xl">
        <CardHeader className="shrink-0">
          <CardTitle>Active Ship</CardTitle>
          <CardDescription>
            Load hauling ships from UEX, then save a favorite to your local fleet roster.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <FieldGroup>
            <Field>
            <FieldContent>
                <FieldLabel>UEX Ship Catalog</FieldLabel>
                <FieldDescription>
                  Search by manufacturer or ship name. Only hauling-relevant ships with SCU are shown.
                </FieldDescription>
              </FieldContent>
              {isDesktop ? (
                <Popover open={isPickerOpen} onOpenChange={handlePickerOpenChange}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      disabled={isLoading}
                    >
                      <span className="truncate text-left">{pickerTriggerLabel}</span>
                      <ChevronsUpDown data-icon="inline-end" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[min(30rem,calc(100vw-3rem))] gap-0 p-0">
                    {pickerPanel}
                  </PopoverContent>
                </Popover>
              ) : (
                <Drawer open={isPickerOpen} onOpenChange={handlePickerOpenChange}>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => handlePickerOpenChange(true)}
                    disabled={isLoading}
                  >
                    <span className="truncate text-left">{pickerTriggerLabel}</span>
                    <ChevronsUpDown data-icon="inline-end" />
                  </Button>
                  <DrawerContent>
                    <DrawerHeader>
                      <DrawerTitle>Choose a ship</DrawerTitle>
                      <DrawerDescription>
                        Search the UEX cargo-ship catalog and save a favorite to your fleet.
                      </DrawerDescription>
                    </DrawerHeader>
                    {pickerPanel}
                  </DrawerContent>
                </Drawer>
              )}
            </Field>
          </FieldGroup>

          {isLoading && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {loadError && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>UEX ship catalog unavailable</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
              <AlertAction>
                <Button variant="outline" size="sm" onClick={() => void loadVehicleCatalog()}>
                  <RotateCcw data-icon="inline-start" />
                  Retry
                </Button>
              </AlertAction>
            </Alert>
          )}

          {!isLoading && !loadError && selectedCatalogShip && (
            <div className="flex flex-col gap-4 rounded-3xl border border-border/60 bg-muted/15 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-base font-medium">{selectedCatalogShip.nameFull}</span>
                  <span className="truncate text-sm text-muted-foreground">
                    {selectedCatalogShip.manufacturer ?? 'Unknown maker'}
                  </span>
                </div>
                <Badge variant="secondary" className="font-mono">
                  {selectedCatalogShip.scu} SCU
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">UEX</Badge>
                {selectedCatalogShip.isConcept && <Badge variant="secondary">Concept</Badge>}
                {selectedCatalogShip.isCargo && <Badge variant="secondary">Cargo</Badge>}
              </div>
              <Button onClick={saveSelectedShip} className="w-full">
                Save &amp; Set Active
              </Button>
            </div>
          )}

          {!isLoading && !loadError && showCustomFallback && (
            <Empty className="items-stretch text-left">
              <EmptyHeader className="items-start">
                <EmptyMedia variant="icon">
                  <Ship />
                </EmptyMedia>
                <EmptyTitle>Create a custom ship</EmptyTitle>
                <EmptyDescription>
                  UEX did not return “{normalizedQuery}”. Save a local ship override for this edge case.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="w-full">
                <FieldGroup className="gap-4">
                  <Field>
                    <FieldContent>
                      <FieldLabel htmlFor="custom-ship-scu">Maximum SCU Cargo Capacity</FieldLabel>
                      <FieldDescription>
                        Leave this empty if you want the optimizer to treat the ship as unlimited.
                      </FieldDescription>
                    </FieldContent>
                    <Input
                      id="custom-ship-scu"
                      type="number"
                      inputMode="numeric"
                      value={customScu}
                      onChange={(event) => setCustomScu(event.target.value)}
                      placeholder="e.g. 696"
                    />
                  </Field>
                </FieldGroup>
                <Button onClick={saveCustomShip} className="w-full">
                  Create Custom Ship
                </Button>
              </EmptyContent>
            </Empty>
          )}

          {ship && (
            <>
              <Separator />
              <div className="flex flex-col gap-3 rounded-3xl border border-primary/20 bg-primary/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-base font-medium text-primary">
                      {ship.name || 'Unnamed ship'}
                    </span>
                    <span className="truncate text-sm text-primary/80">
                      {ship.manufacturer ?? (ship.source === 'custom' ? 'Custom ship' : 'UEX catalog')}
                    </span>
                  </div>
                  <Badge className="font-mono">
                    {ship.maxScu > 0 ? `${ship.maxScu} SCU` : 'Unlimited'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{ship.source === 'custom' ? 'Custom' : 'UEX'}</Badge>
                  <Badge variant="secondary">Active</Badge>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-col border-border shadow-xl">
        <CardHeader className="shrink-0 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Fleet Roster</CardTitle>
              <CardDescription>Click a saved ship to make it active for route planning.</CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono">
              {fleet.length} ship{fleet.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <ScrollArea className="min-h-0 flex-1">
          <CardContent>
            {fleet.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Ship />
                  </EmptyMedia>
                  <EmptyTitle>No saved ships yet</EmptyTitle>
                  <EmptyDescription>
                    Pick a UEX ship or create a custom fallback to build your fleet roster.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {fleet.map((fleetShip) => {
                  const isActive =
                    ship?.uexVehicleId != null && fleetShip.uexVehicleId != null
                      ? ship.uexVehicleId === fleetShip.uexVehicleId
                      : ship?.name === fleetShip.name && ship?.maxScu === fleetShip.maxScu

                  return (
                    <div
                      key={fleetShip.uexVehicleId ?? fleetShip.name}
                      className={cn(
                        'group relative flex cursor-pointer flex-col gap-3 rounded-3xl border p-4 transition-colors',
                        isActive
                          ? 'border-primary/60 bg-primary/10'
                          : 'border-border bg-muted/15 hover:border-primary/40 hover:bg-primary/5'
                      )}
                      onClick={() => handleRosterSelect(fleetShip)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-col gap-1">
                          <span
                            className={cn(
                              'truncate text-sm font-medium',
                              isActive ? 'text-primary' : 'text-foreground'
                            )}
                          >
                            {fleetShip.name || 'Unnamed ship'}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {fleetShip.manufacturer ??
                              (fleetShip.source === 'custom' ? 'Custom ship' : 'UEX catalog')}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(event) => {
                            event.stopPropagation()
                            removeFleetShip(fleetShip)
                          }}
                          aria-label={`Remove ${fleetShip.name} from fleet`}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono">
                          {fleetShip.maxScu > 0 ? `${fleetShip.maxScu} SCU` : 'Unlimited'}
                        </Badge>
                        <Badge variant="secondary">
                          {fleetShip.source === 'custom' ? 'Custom' : 'UEX'}
                        </Badge>
                        {isActive && <Badge>Active</Badge>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </ScrollArea>
      </Card>
    </div>
  )
}
