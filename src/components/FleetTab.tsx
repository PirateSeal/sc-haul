import { Ship, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ShipConfig } from '@/store/useHaulStore'

interface FleetTabProps {
  ship: ShipConfig | null
  shipName: string
  shipScu: string
  setShipName: (value: string) => void
  setShipScu: (value: string) => void
  fleet: ShipConfig[]
  updateShip: (ship: ShipConfig) => void
  upsertFleetShip: (ship: ShipConfig) => void
  removeFleetShip: (name: string) => void
}

export function FleetTab({
  ship,
  shipName,
  shipScu,
  setShipName,
  setShipScu,
  fleet,
  updateShip,
  upsertFleetShip,
  removeFleetShip,
}: FleetTabProps) {
  const saveShip = () => {
    const config = { name: shipName, maxScu: parseInt(shipScu, 10) || 0 }
    updateShip(config)
    if (config.name.trim()) {
      upsertFleetShip(config)
    }
  }

  return (
    <div className="grid h-full grid-cols-[360px_1fr] gap-4">
      <Card className="flex min-h-0 flex-col border-border shadow-xl">
        <CardHeader className="shrink-0">
          <CardTitle>Active Ship</CardTitle>
          <CardDescription>
            Set capacity constraints for route calculation. Saving adds the ship to your
            fleet roster.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ship-name">Ship Classification</Label>
            <Input
              id="ship-name"
              value={shipName}
              onChange={(event) => setShipName(event.target.value)}
              placeholder="e.g. C2 Hercules"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="max-scu">Maximum SCU Cargo Capacity</Label>
            <Input
              id="max-scu"
              type="number"
              value={shipScu}
              onChange={(event) => setShipScu(event.target.value)}
              placeholder="e.g. 696"
            />
            <p className="text-xs text-muted-foreground">Leave empty for unlimited capacity.</p>
          </div>
          {ship && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm">
              <Ship className="size-4 shrink-0 text-primary" />
              <span className="font-medium text-primary">{ship.name || 'Unnamed ship'}</span>
              {ship.maxScu > 0 && (
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {ship.maxScu} SCU
                </span>
              )}
            </div>
          )}
          <Button onClick={saveShip} className="w-full">
            Save &amp; Set Active
          </Button>
        </CardContent>
      </Card>

      <Card className="flex min-h-0 flex-col border-border shadow-xl">
        <CardHeader className="shrink-0 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fleet Roster</CardTitle>
              <CardDescription>Click a ship to set it as active.</CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono">
              {fleet.length} ship{fleet.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <ScrollArea className="min-h-0 flex-1">
          <CardContent>
            {fleet.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border/40 py-16 text-center text-sm text-muted-foreground">
                <Ship className="size-8 opacity-30" />
                <span>
                  No ships saved yet.
                  <br />
                  Save a configuration to add it here.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                {fleet.map((fleetShip) => {
                  const isActive =
                    ship?.name === fleetShip.name && ship?.maxScu === fleetShip.maxScu

                  return (
                    <div
                      key={fleetShip.name}
                      className={`group relative cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 ${
                        isActive
                          ? 'border-primary/60 bg-primary/10'
                          : 'border-border bg-muted/20'
                      }`}
                      onClick={() => {
                        updateShip(fleetShip)
                        setShipName(fleetShip.name)
                        setShipScu(fleetShip.maxScu > 0 ? fleetShip.maxScu.toString() : '')
                      }}
                    >
                      <button
                        className="absolute top-2 right-2 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation()
                          removeFleetShip(fleetShip.name)
                        }}
                        title="Remove from fleet"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                      <Ship
                        className={`mb-2 size-6 ${
                          isActive ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      />
                      <div
                        className={`text-sm leading-tight font-medium ${
                          isActive ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {fleetShip.name || 'Unnamed'}
                      </div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        {fleetShip.maxScu > 0 ? `${fleetShip.maxScu} SCU` : 'Unlimited'}
                      </div>
                      {isActive && (
                        <div className="mt-2">
                          <Badge variant="default" className="px-1.5 py-0 text-[10px]">
                            Active
                          </Badge>
                        </div>
                      )}
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
