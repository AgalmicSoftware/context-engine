import { useEffect, useState } from 'react';

import type { FidelityOverview } from '../../../../shared/agentFidelity.mjs';
import { computeFidelityOverview, type FidelityOverviewInput } from './fidelityOverview';

// Hydration replaces the report's rows several times in a row; score only once they settle.
const SETTLE_MS = 150;

/**
 * The fidelity overview of `input`, scored in a Web Worker where the browser
 * has them and on the main thread otherwise. It is undefined until the score
 * for the current input arrives; a newer input cancels the older work.
 */
export function useFidelityOverview(input: FidelityOverviewInput | null): FidelityOverview | null | undefined {
  const [result, setResult] = useState<{ input: FidelityOverviewInput; overview: FidelityOverview | null } | null>(
    null,
  );
  useEffect(() => {
    if (!input) return undefined;
    let canceled = false;
    let worker: Worker | null = null;
    const finish = (overview: FidelityOverview | null) => {
      if (!canceled) setResult({ input, overview });
    };
    const scoreHere = () => finish(computeFidelityOverview(input));
    const timer = setTimeout(() => {
      if (typeof Worker === 'undefined') {
        scoreHere();
        return;
      }
      import('./fidelityOverviewWorkerFactory.js')
        .then(({ createFidelityOverviewWorker }) => {
          if (canceled) return;
          worker = createFidelityOverviewWorker();
          worker.onmessage = (event: MessageEvent<FidelityOverview | null>) => {
            worker?.terminate();
            finish(event.data);
          };
          worker.onerror = () => {
            worker?.terminate();
            scoreHere();
          };
          worker.postMessage(input);
        })
        .catch(() => {
          if (!canceled) scoreHere();
        });
    }, SETTLE_MS);
    return () => {
      canceled = true;
      clearTimeout(timer);
      worker?.terminate();
    };
  }, [input]);
  if (!input) return null;
  return result?.input === input ? result.overview : undefined;
}
