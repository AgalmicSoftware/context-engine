import { act, renderHook, waitFor } from '@testing-library/react';

import { createFidelityOverviewWorker } from './fidelityOverviewWorkerFactory';
import type { FidelityOverviewInput } from './fidelityOverview';
import { useFidelityOverview } from './useFidelityOverview';

jest.mock('./fidelityOverviewWorkerFactory', () => ({ createFidelityOverviewWorker: jest.fn() }));

class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = jest.fn();
  terminate = jest.fn();
}

describe('useFidelityOverview', () => {
  const browserWorker = (globalThis as { Worker?: unknown }).Worker;
  let workers: FakeWorker[];
  beforeAll(() => {
    (globalThis as { Worker?: unknown }).Worker = FakeWorker;
  });
  afterAll(() => {
    (globalThis as { Worker?: unknown }).Worker = browserWorker;
  });
  beforeEach(() => {
    workers = [];
    jest.mocked(createFidelityOverviewWorker).mockReset();
    jest.mocked(createFidelityOverviewWorker).mockImplementation(() => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    });
  });

  it('scores in a worker, and a newer input cancels the older work', async () => {
    const first: FidelityOverviewInput = { questions: {}, questionResponses: {}, minParticipants: 5 };
    const { result, rerender } = renderHook(({ input }) => useFidelityOverview(input), {
      initialProps: { input: first },
    });
    expect(result.current).toBeUndefined();
    await waitFor(() => expect(workers).toHaveLength(1));
    expect(workers[0].postMessage).toHaveBeenCalledWith(first);

    const second: FidelityOverviewInput = { questions: {}, questionResponses: { q1: [] }, minParticipants: 1 };
    rerender({ input: second });
    expect(workers[0].terminate).toHaveBeenCalled();
    await waitFor(() => expect(workers).toHaveLength(2));
    expect(workers[1].postMessage).toHaveBeenCalledWith(second);
    const overview = { coverage: { participants: 7 } };
    act(() => workers[1].onmessage?.({ data: overview }));
    expect(result.current).toBe(overview);
    expect(workers[1].terminate).toHaveBeenCalled();
  });

  it('scores on the main thread when the worker fails to load', async () => {
    const input: FidelityOverviewInput = { questions: {}, questionResponses: {}, minParticipants: 5 };
    const { result } = renderHook(() => useFidelityOverview(input));
    await waitFor(() => expect(workers).toHaveLength(1));
    act(() => workers[0].onerror?.());
    // Nothing to score: no AI-prefill drafts.
    expect(result.current).toBeNull();
  });

  it('has nothing to show without input', () => {
    const { result } = renderHook(() => useFidelityOverview(null));
    expect(result.current).toBeNull();
    expect(createFidelityOverviewWorker).not.toHaveBeenCalled();
  });
});
