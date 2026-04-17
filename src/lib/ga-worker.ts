import { optimizeRoute } from '@/lib/genetic-algorithm';
import type { GAMission, OptimizeOptions, OptimizeResult } from '@/lib/genetic-algorithm';

interface WorkerInput {
  startPoint: { x: number; y: number; z: number };
  gaMissions: GAMission[];
  maxScu: number;
  config: OptimizeOptions;
}

type WorkerMessage =
  | { type: 'progress'; generation: number; total: number; bestDist: number }
  | ({ type: 'result' } & OptimizeResult)
  | { type: 'error'; message: string };

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { startPoint, gaMissions, maxScu, config } = e.data;
  try {
    const result = optimizeRoute(startPoint, gaMissions, maxScu, {
      ...config,
      onProgress: (generation, total, bestDist) => {
        (self as unknown as Worker).postMessage({ type: 'progress', generation, total, bestDist } satisfies WorkerMessage);
      },
    });
    (self as unknown as Worker).postMessage({ type: 'result', ...result } satisfies WorkerMessage);
  } catch (err) {
    (self as unknown as Worker).postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) } satisfies WorkerMessage);
  }
};
