import { useEffect, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { syncDatabaseIfNeeded } from '@/services/db'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function DataSyncStatus({ onSynced }: { onSynced: () => void }) {
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading')

  useEffect(() => {
    syncDatabaseIfNeeded()
      .then(() => {
        setStatus('success')
        onSynced()
      })
      .catch((err) => {
        console.error(err)
        setStatus('error')
      })
  }, [onSynced])

  if (status === 'success') return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-96 border-border/50 bg-background/90 shadow-2xl">
        <CardHeader>
          <CardTitle>Starmap Synchronization</CardTitle>
          <CardDescription>
            {status === 'loading'
              ? 'Downloading latest Star Citizen navigation data...'
              : 'Failed to synchronize data. Check your connection.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pt-4 pb-6">
          {status === 'loading' && (
            <RotateCw className="size-8 animate-spin text-primary" />
          )}
          {status === 'error' && (
            <Button onClick={() => window.location.reload()} variant="destructive">
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
