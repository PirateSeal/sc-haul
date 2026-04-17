import { useCallback, useEffect, useState } from 'react'
import { Map as MapIcon, Plane, Settings, Ship } from 'lucide-react'
import { DataSyncStatus } from '@/components/DataSyncStatus'
import { FleetTab } from '@/components/FleetTab'
import { PlannerTab } from '@/components/PlannerTab'
import { SettingsTab } from '@/components/SettingsTab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getLocationSearchOptions,
  type LocationSearchOption,
} from '@/services/searchable-locations'
import { useRouteOptimization } from '@/hooks/useRouteOptimization'
import { useHaulStore, type Mission } from '@/store/useHaulStore'

const uid = () => Math.random().toString(36).slice(2, 9)

const EXAMPLE_MISSIONS: Omit<Mission, 'id'>[] = [
  {
    type: 'multi-pickup',
    cargoEntries: [
      {
        id: uid(),
        scu: 12,
        pickupLocationName: 'Everus Harbor',
        dropoffLocationName: 'Baijini Point',
      },
      {
        id: uid(),
        scu: 18,
        pickupLocationName: 'Wikelo Emporium Dasi Station',
        dropoffLocationName: 'Baijini Point',
      },
    ],
    reward: 72000,
  },
  {
    type: 'direct',
    cargoEntries: [
      {
        id: uid(),
        scu: 20,
        pickupLocationName: 'Port Tressler',
        dropoffLocationName: 'Thundering Express Station',
      },
    ],
    reward: 45000,
  },
  {
    type: 'multi-dropoff',
    cargoEntries: [
      {
        id: uid(),
        scu: 16,
        pickupLocationName: 'Shallow Frontier Station',
        dropoffLocationName: 'Long Forest Station',
      },
      {
        id: uid(),
        scu: 12,
        pickupLocationName: 'Shallow Frontier Station',
        dropoffLocationName: 'Endless Odyssey Station',
      },
    ],
    reward: 68000,
  },
  {
    type: 'direct',
    cargoEntries: [
      {
        id: uid(),
        scu: 24,
        pickupLocationName: 'Red Crossroads Station',
        dropoffLocationName: 'Everus Harbor',
      },
    ],
    reward: 55000,
  },
  {
    type: 'direct',
    cargoEntries: [
      {
        id: uid(),
        scu: 8,
        pickupLocationName: 'Station at Pyro JumpPoint',
        dropoffLocationName: 'Port Tressler',
      },
    ],
    reward: 95000,
  },
]

export default function App() {
  const [dataReady, setDataReady] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [locationOptions, setLocationOptions] = useState<LocationSearchOption[]>([])

  const missions = useHaulStore((state) => state.missions)
  const addMission = useHaulStore((state) => state.addMission)
  const removeMission = useHaulStore((state) => state.removeMission)
  const clearMissions = useHaulStore((state) => state.clearMissions)
  const completedMissions = useHaulStore((state) => state.completedMissions)
  const clearHistory = useHaulStore((state) => state.clearHistory)
  const ship = useHaulStore((state) => state.ship)
  const updateShip = useHaulStore((state) => state.updateShip)
  const fleet = useHaulStore((state) => state.fleet)
  const upsertFleetShip = useHaulStore((state) => state.upsertFleetShip)
  const removeFleetShip = useHaulStore((state) => state.removeFleetShip)
  const gaConfig = useHaulStore((state) => state.gaConfig)
  const updateGaConfig = useHaulStore((state) => state.updateGaConfig)
  const startLocationName = useHaulStore((state) => state.startLocationName)
  const setStartLocation = useHaulStore((state) => state.setStartLocation)

  const [gaPopulation, setGaPopulation] = useState(gaConfig.populationSize.toString())
  const [gaGenerations, setGaGenerations] = useState(gaConfig.generations.toString())
  const [gaMutationRate, setGaMutationRate] = useState(gaConfig.mutationRate.toString())

  const {
    isOptimizing,
    optimizeError,
    routeResult,
    legMap,
    progress,
    optimizeRoutePlan,
    maxScu,
  } = useRouteOptimization({
    missions,
    ship,
    gaConfig,
    startLocationName,
  })

  useEffect(() => {
    if (!dataReady) return

    getLocationSearchOptions()
      .then(setLocationOptions)
      .catch((err) => console.error(err))
  }, [dataReady])

  const loadExampleMissions = useCallback(() => {
    clearMissions()
    EXAMPLE_MISSIONS.forEach((mission) => {
      addMission({ ...mission, id: Math.random().toString(36).substring(7) })
    })
  }, [addMission, clearMissions])

  const saveGaConfig = useCallback(() => {
    updateGaConfig({
      populationSize: parseInt(gaPopulation, 10) || 100,
      generations: parseInt(gaGenerations, 10) || 500,
      mutationRate: parseFloat(gaMutationRate) || 0.02,
    })
  }, [gaGenerations, gaMutationRate, gaPopulation, updateGaConfig])

  const forceFullDatabaseSync = useCallback(() => {
    localStorage.removeItem('schaul_last_sync')
    window.location.reload()
  }, [])

  const handleSynced = useCallback(() => setDataReady(true), [])
  const resetMissionForm = useCallback(() => setFormKey((key) => key + 1), [])

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-background to-background text-foreground">
      <DataSyncStatus onSynced={handleSynced} />

      {dataReady && (
        <div className="flex h-screen flex-col overflow-hidden">
          <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border/40 bg-background/60 px-6 backdrop-blur-md">
            <Plane className="size-6 text-primary" />
            <h1 className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
              SC Haul
            </h1>
            <div className="ml-auto flex items-center gap-4">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="size-2 animate-pulse rounded-full bg-success" />
                Data Synced
              </span>
            </div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 lg:p-6">
            <Tabs defaultValue="planner" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="mb-4 grid h-12 w-full shrink-0 grid-cols-3 rounded-xl border border-border/50 bg-background/40 p-1 backdrop-blur-sm">
                <TabsTrigger
                  value="planner"
                  className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  <MapIcon className="mr-2 size-4" /> Route Planner
                </TabsTrigger>
                <TabsTrigger
                  value="fleet"
                  className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  <Ship className="mr-2 size-4" /> Fleet Configuration
                </TabsTrigger>
                <TabsTrigger
                  value="settings"
                  className="rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  <Settings className="mr-2 size-4" /> Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="planner"
                className="min-h-0 flex-1 animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                <PlannerTab
                  formKey={formKey}
                  startLocationName={startLocationName}
                  setStartLocation={setStartLocation}
                  locationOptions={locationOptions}
                  missions={missions}
                  completedMissions={completedMissions}
                  clearHistory={clearHistory}
                  clearMissions={clearMissions}
                  removeMission={removeMission}
                  loadExamples={loadExampleMissions}
                  resetMissionForm={resetMissionForm}
                  routeResult={routeResult}
                  legMap={legMap}
                  maxScu={maxScu}
                  isOptimizing={isOptimizing}
                  optimizeError={optimizeError}
                  progress={progress}
                  optimizeRoutePlan={optimizeRoutePlan}
                />
              </TabsContent>

              <TabsContent
                value="fleet"
                className="min-h-0 flex-1 animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                <FleetTab
                  ship={ship}
                  fleet={fleet}
                  updateShip={updateShip}
                  upsertFleetShip={upsertFleetShip}
                  removeFleetShip={removeFleetShip}
                />
              </TabsContent>

              <TabsContent
                value="settings"
                className="flex-1 overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                <SettingsTab
                  gaPopulation={gaPopulation}
                  gaGenerations={gaGenerations}
                  gaMutationRate={gaMutationRate}
                  setGaPopulation={setGaPopulation}
                  setGaGenerations={setGaGenerations}
                  setGaMutationRate={setGaMutationRate}
                  saveGaConfig={saveGaConfig}
                  forceFullDatabaseSync={forceFullDatabaseSync}
                />
              </TabsContent>
            </Tabs>
          </main>
        </div>
      )}
    </div>
  )
}
