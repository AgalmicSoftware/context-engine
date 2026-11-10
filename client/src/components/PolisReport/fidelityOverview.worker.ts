/// <reference lib="webworker" />
import { computeFidelityOverview, type FidelityOverviewInput } from './fidelityOverview';

// Scores off the main thread: a large session takes long enough to freeze the page.
self.onmessage = (event: MessageEvent<FidelityOverviewInput>) => {
  self.postMessage(computeFidelityOverview(event.data));
};
