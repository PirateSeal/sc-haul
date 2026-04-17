import { ThemeSettings } from '@/components/ThemeSettings'
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

interface SettingsTabProps {
  gaPopulation: string
  gaGenerations: string
  gaMutationRate: string
  setGaPopulation: (value: string) => void
  setGaGenerations: (value: string) => void
  setGaMutationRate: (value: string) => void
  saveGaConfig: () => void
  forceFullDatabaseSync: () => void
}

export function SettingsTab({
  gaPopulation,
  gaGenerations,
  gaMutationRate,
  setGaPopulation,
  setGaGenerations,
  setGaMutationRate,
  saveGaConfig,
  forceFullDatabaseSync,
}: SettingsTabProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <ThemeSettings />

      <Card className="border-border shadow-xl">
        <CardHeader>
          <CardTitle>Algorithm Parameters</CardTitle>
          <CardDescription>Tune the Genetic Algorithm for your needs.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ga-pop">Population Size</Label>
              <Input
                id="ga-pop"
                type="number"
                min="10"
                max="1000"
                value={gaPopulation}
                onChange={(event) => setGaPopulation(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ga-gen">Generations</Label>
              <Input
                id="ga-gen"
                type="number"
                min="50"
                max="5000"
                value={gaGenerations}
                onChange={(event) => setGaGenerations(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ga-mutation">Mutation Rate (0.001 – 0.5)</Label>
            <Input
              id="ga-mutation"
              type="number"
              min="0.001"
              max="0.5"
              step="0.001"
              value={gaMutationRate}
              onChange={(event) => setGaMutationRate(event.target.value)}
            />
          </div>
          <Button onClick={saveGaConfig} className="w-full">
            Save Algorithm Settings
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border shadow-xl">
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Manage local starmap cache.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={forceFullDatabaseSync}>
            Force Full Database Sync
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
