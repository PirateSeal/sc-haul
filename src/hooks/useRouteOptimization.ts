import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getLocationByName, type LocationResult } from '@/services/location-catalog'
import { pointKey } from '@/lib/utils'
import { splitMissionsForCapacity } from '@/lib/genetic-algorithm'
import type {
  GAMission,
  OptimizeResult,
  RouteNode,
} from '@/lib/genetic-algorithm'
import type { LegEntry } from '@/components/RouteResults'
import type {
  GAConfig,
  Mission,
  ShipConfig,
} from '@/store/useHaulStore'

type WorkerMessage =
  | { type: 'progress'; generation: number; total: number; bestDist: number }
  | ({ type: 'result' } & OptimizeResult)
  | { type: 'error'; message: string }

interface UseRouteOptimizationParams {
  missions: Mission[]
  ship: ShipConfig | null
  gaConfig: GAConfig
  startLocationName: string
}

export function useRouteOptimization({
  missions,
  ship,
  gaConfig,
  startLocationName,
}: UseRouteOptimizationParams) {
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizeError, setOptimizeError] = useState<string | null>(null)
  const [routeResult, setRouteResult] = useState<OptimizeResult | null>(null)
  const [legMap, setLegMap] = useState<Map<string, LegEntry>>(new Map())
  const [progress, setProgress] = useState<{ gen: number; total: number } | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const prevMissionIdsRef = useRef(new Set(missions.map((mission) => mission.id)))

  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    const currentIds = new Set(missions.map((mission) => mission.id))
    const previousIds = prevMissionIdsRef.current
    const hasNewMission = missions.some((mission) => !previousIds.has(mission.id))

    if (hasNewMission) {
      setRouteResult(null)
      setOptimizeError(null)
      setProgress(null)
    }

    prevMissionIdsRef.current = currentIds
  }, [missions])

  const optimizeRoutePlan = useCallback(async () => {
    if (missions.length === 0) return

    workerRef.current?.terminate()
    workerRef.current = null

    setIsOptimizing(true)
    setOptimizeError(null)
    setRouteResult(null)
    setProgress(null)

    try {
      const maxScu = ship?.maxScu && ship.maxScu > 0 ? ship.maxScu : Infinity
      const coordSystemMap = new Map<string, string>()
      const locationCache = new Map<string, Promise<LocationResult | null>>()
      const fallbackLocations = new Set<string>()

      const resolveLocation = (locationName: string) => {
        const trimmed = locationName.trim()
        const key = trimmed.toLowerCase()
        const cached = locationCache.get(key)
        if (cached) return cached

        const pending = getLocationByName(trimmed)
        locationCache.set(key, pending)
        return pending
      }

      let startPoint: { x: number; y: number; z: number } | null = null
        if (startLocationName.trim()) {
          const startLocation = await resolveLocation(startLocationName)
          if (startLocation) {
            startPoint = startLocation.coords
            coordSystemMap.set(pointKey(startLocation.coords), startLocation.system)
            if (startLocation.source === 'uex-fallback') {
              fallbackLocations.add(startLocation.displayName)
            }
          }
        }

      const missionById = new Map(missions.map((mission) => [mission.id, mission]))
      const cargoEntriesByMission = new Map(
        missions.map((mission) => [
          mission.id,
          new Map(mission.cargoEntries.map((entry) => [entry.id, entry])),
        ])
      )

      const expandedRaw = (
        await Promise.all(
          missions.flatMap((mission) =>
            mission.cargoEntries.map(async (entry) => {
              const [pickupLocation, dropoffLocation] = await Promise.all([
                resolveLocation(entry.pickupLocationName),
                resolveLocation(entry.dropoffLocationName),
              ])

              if (!pickupLocation) {
                throw new Error(`Pickup location not found: "${entry.pickupLocationName}"`)
              }

              if (!dropoffLocation) {
                throw new Error(`Dropoff location not found: "${entry.dropoffLocationName}"`)
              }

              if (pickupLocation.source === 'uex-fallback') {
                fallbackLocations.add(pickupLocation.displayName)
              }
              if (dropoffLocation.source === 'uex-fallback') {
                fallbackLocations.add(dropoffLocation.displayName)
              }

              coordSystemMap.set(pointKey(pickupLocation.coords), pickupLocation.system)
              coordSystemMap.set(pointKey(dropoffLocation.coords), dropoffLocation.system)

              const sourceId = `${mission.id}:${entry.id}`
              return {
                id: sourceId,
                sourceId,
                originalMissionId: mission.id,
                scu: entry.scu,
                pickup: pickupLocation.coords,
                dropoff: dropoffLocation.coords,
              } satisfies GAMission
            })
          )
        )
      )

      const finalLegs = splitMissionsForCapacity(expandedRaw, maxScu)
      if (finalLegs.length === 0) {
        throw new Error('No route legs available to optimize.')
      }

      if (!startPoint) {
        startPoint = finalLegs[0].pickup
      }

      const nextLegMap = new Map<string, LegEntry>()
      finalLegs.forEach((leg) => {
        const mission = missionById.get(leg.originalMissionId)
        const cargoEntryId = leg.sourceId.slice(leg.originalMissionId.length + 1)
        const cargoEntry = cargoEntriesByMission.get(leg.originalMissionId)?.get(cargoEntryId)

        if (mission && cargoEntry) {
          nextLegMap.set(leg.id, { mission, cargoEntry, scu: leg.scu })
        }
      })
      setLegMap(nextLegMap)

      const worker = new Worker(new URL('../lib/ga-worker.ts', import.meta.url), {
        type: 'module',
      })
      workerRef.current = worker

      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        if (event.data.type === 'progress') {
          setProgress({ gen: event.data.generation, total: event.data.total })
          return
        }

        if (event.data.type === 'result') {
          const annotatedRoute = event.data.route.map((node: RouteNode) => ({
            ...node,
            system: coordSystemMap.get(pointKey(node.point)) ?? 'Stanton',
          }))

          setRouteResult({ route: annotatedRoute, history: event.data.history })
          setIsOptimizing(false)
          setProgress(null)
          worker.terminate()
          workerRef.current = null

          const bestDistance = event.data.history[event.data.history.length - 1] ?? 0
          const distanceGm = (bestDistance / 1e9).toFixed(2)
          toast.success('Route optimized', {
            description: `${annotatedRoute.length} stops · ${distanceGm} Gm total`,
          })
          if (fallbackLocations.size > 0) {
            const names = [...fallbackLocations].slice(0, 3).join(', ')
            toast.message('Using approximate UEX fallback coordinates', {
              description:
                fallbackLocations.size > 3
                  ? `${names}, and ${fallbackLocations.size - 3} more`
                  : names,
            })
          }
          return
        }

        setOptimizeError(event.data.message)
        setIsOptimizing(false)
        setProgress(null)
        worker.terminate()
        workerRef.current = null
      }

      worker.onerror = (event) => {
        setOptimizeError(event.message ?? 'Worker error')
        setIsOptimizing(false)
        setProgress(null)
        worker.terminate()
        workerRef.current = null
      }

      worker.postMessage({
        startPoint,
        gaMissions: finalLegs,
        maxScu,
        config: {
          populationSize: gaConfig.populationSize,
          generations: gaConfig.generations,
          mutationRate: gaConfig.mutationRate,
        },
      })
    } catch (err) {
      setOptimizeError(err instanceof Error ? err.message : 'Optimization failed')
      setIsOptimizing(false)
      setProgress(null)
    }
  }, [gaConfig, missions, ship, startLocationName])

  return {
    isOptimizing,
    optimizeError,
    routeResult,
    legMap,
    progress,
    optimizeRoutePlan,
    maxScu: ship?.maxScu && ship.maxScu > 0 ? ship.maxScu : Infinity,
  }
}
