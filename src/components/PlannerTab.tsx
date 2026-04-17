import { AlertCircle, RotateCw, X } from 'lucide-react'
import { AddMissionForm } from '@/components/AddMissionForm'
import { SearchPicker } from '@/components/SearchPicker'
import { RouteResults, type LegEntry } from '@/components/RouteResults'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { LocationSearchOption } from '@/services/searchable-locations'
import type { OptimizeResult } from '@/lib/genetic-algorithm'
import type { Mission } from '@/store/useHaulStore'

interface PlannerTabProps {
  formKey: number
  startLocationName: string
  setStartLocation: (name: string) => void
  locationOptions: LocationSearchOption[]
  missions: Mission[]
  completedMissions: Mission[]
  clearHistory: () => void
  clearMissions: () => void
  removeMission: (id: string) => void
  loadExamples: () => void
  resetMissionForm: () => void
  routeResult: OptimizeResult | null
  legMap: Map<string, LegEntry>
  maxScu: number
  isOptimizing: boolean
  optimizeError: string | null
  progress: { gen: number; total: number } | null
  optimizeRoutePlan: () => void
}

export function PlannerTab({
  formKey,
  startLocationName,
  setStartLocation,
  locationOptions,
  missions,
  completedMissions,
  clearHistory,
  clearMissions,
  removeMission,
  loadExamples,
  resetMissionForm,
  routeResult,
  legMap,
  maxScu,
  isOptimizing,
  optimizeError,
  progress,
  optimizeRoutePlan,
}: PlannerTabProps) {
  const startLocationOption =
    locationOptions.find((option) =>
      [option.displayName, option.name, ...option.aliases].some(
        (value) => value.toLowerCase() === startLocationName.trim().toLowerCase()
      )
    ) ?? null

  const locationPickerOptions = locationOptions.map((option) => ({
    id: `location:${option.id}`,
    label: option.displayName,
    meta: option.system,
    keywords: option.searchTerms,
    badges:
      option.source === 'uex-fallback'
        ? [{ label: 'Approx', variant: 'outline' as const }]
        : undefined,
  }))

  return (
    <div className="grid h-full grid-cols-3 gap-4">
      <Card className="flex min-h-0 flex-col border-border shadow-xl">
        <CardHeader className="shrink-0 pb-3">
          <CardTitle>New Contract</CardTitle>
          <CardDescription>Fill in the details and click Add Contract.</CardDescription>
        </CardHeader>
        <ScrollArea className="min-h-0 flex-1">
          <CardContent>
            <AddMissionForm
              key={formKey}
              locationOptions={locationOptions}
              onClose={resetMissionForm}
            />
          </CardContent>
        </ScrollArea>
      </Card>

      <Card className="flex min-h-0 flex-col border-border shadow-xl">
        <CardHeader className="shrink-0 pb-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle>Mission Manifest</CardTitle>
              <CardDescription className="mt-1">
                <div className="mt-2">
                  <SearchPicker
                    title="Start location"
                    placeholder="Starting station…"
                    searchPlaceholder="Search starting station…"
                    emptyMessage="No location matches that search."
                    options={locationPickerOptions}
                    selectedOption={
                      startLocationOption
                        ? locationPickerOptions.find(
                            (option) => option.id === `location:${startLocationOption.id}`
                          ) ?? null
                        : null
                    }
                    onSelect={(option) => {
                      const selected = option
                        ? locationOptions.find((location) => `location:${location.id}` === option.id) ?? null
                        : null
                      setStartLocation(selected?.displayName ?? '')
                    }}
                    allowClear
                    triggerClassName="min-h-7 rounded-2xl px-2.5 py-1.5 text-xs"
                    contentClassName="sm:max-w-md"
                  />
                </div>
              </CardDescription>
            </div>
            {missions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMissions}
                className="ml-2 shrink-0 text-destructive/70 hover:text-destructive"
              >
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>
        <ScrollArea className="min-h-0 flex-1">
          <CardContent>
            {missions.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border/40 py-10 text-center text-sm text-muted-foreground">
                <span>No contracts yet.</span>
                <Button variant="outline" size="sm" onClick={loadExamples}>
                  Load Examples
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {missions.map((mission) => (
                  <div key={mission.id} className="rounded-lg border border-border bg-muted/40 p-3">
                    <div className="flex items-start justify-between">
                      <div className="mb-1.5 flex items-center gap-2">
                        <Badge variant="secondary" className="rounded-full capitalize">
                          {mission.type.replace('-', ' ')}
                        </Badge>
                        <span className="font-mono text-sm text-success">
                          {mission.reward.toLocaleString()} aUEC
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-mt-0.5 size-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeMission(mission.id)}
                      >
                        <X data-icon />
                      </Button>
                    </div>
                    <div className="space-y-0.5">
                      {mission.cargoEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
                        >
                          <span className="font-mono text-foreground/80">{entry.scu} SCU</span>
                          {entry.commodity && (
                            <span className="text-primary/80">{entry.commodity.name}</span>
                          )}
                          {entry.commodity?.isIllegal && (
                            <span className="text-[10px] text-red-400">⚠</span>
                          )}
                          <span className="text-muted-foreground/50">·</span>
                          <span>{entry.pickupLocationName}</span>
                          <span className="text-muted-foreground/50">→</span>
                          <span>{entry.dropoffLocationName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {completedMissions.length > 0 && (
              <div className="mt-6 border-t border-border/40 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Completed
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={clearHistory}
                  >
                    Clear
                  </Button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {completedMissions.map((mission) => (
                    <div
                      key={mission.id}
                      className="rounded-lg border border-success/20 bg-success/5 p-2 opacity-60"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-success">✓</span>
                        <span className="text-xs text-muted-foreground">
                          {mission.cargoEntries.reduce((sum, entry) => sum + entry.scu, 0)} SCU
                        </span>
                        <span className="ml-auto font-mono text-xs text-success">
                          {mission.reward.toLocaleString()} aUEC
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="mt-1 text-right text-xs text-muted-foreground/70">
                    Total earned:{' '}
                    <span className="font-mono text-success">
                      {completedMissions
                        .reduce((sum, mission) => sum + mission.reward, 0)
                        .toLocaleString()}{' '}
                      aUEC
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </ScrollArea>
      </Card>

      <Card className="flex min-h-0 flex-col border-border shadow-xl">
        <CardHeader className="shrink-0">
          <CardTitle>Route Analysis</CardTitle>
          <CardDescription>Genetic Algorithm pathfinder</CardDescription>
        </CardHeader>
        <ScrollArea className="min-h-0 flex-1">
          <CardContent>
            <div className="flex flex-col gap-4">
              {optimizeError && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{optimizeError}</AlertDescription>
                </Alert>
              )}
              {isOptimizing && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Optimizing route…</span>
                    {progress && (
                      <span>
                        {progress.gen} / {progress.total} gen
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-primary transition-all duration-300"
                      style={{
                        width: progress
                          ? `${Math.round((progress.gen / progress.total) * 100)}%`
                          : '0%',
                      }}
                    />
                  </div>
                </div>
              )}
              {!routeResult && !isOptimizing && (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="mb-1 text-sm text-muted-foreground">Total Distance</div>
                  <div className="text-2xl font-mono text-primary">—</div>
                </div>
              )}
              {routeResult && (
                <RouteResults
                  route={routeResult.route}
                  history={routeResult.history}
                  missions={missions}
                  legMap={legMap}
                  maxScu={Number.isFinite(maxScu) ? maxScu : 0}
                />
              )}
            </div>
          </CardContent>
        </ScrollArea>
        <div className="shrink-0 p-4 pt-0">
          <Button
            className="w-full transition-all duration-300 hover:shadow-[0_0_20px_rgba(var(--primary),0.4)]"
            onClick={optimizeRoutePlan}
            disabled={isOptimizing || missions.length === 0}
          >
            {isOptimizing ? (
              <>
                <RotateCw data-icon="inline-start" className="animate-spin" />
                Optimizing...
              </>
            ) : (
              'Optimize Flight Path'
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}
