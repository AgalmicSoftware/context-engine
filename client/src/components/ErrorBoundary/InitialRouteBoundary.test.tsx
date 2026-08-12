import React from 'react';
import { act, render, screen } from '@testing-library/react';
import * as bootRecovery from '../../bootRecovery.js';
import InitialRouteBoundary from './InitialRouteBoundary';

type DeferredModule = {
  promise: Promise<{ default: React.ComponentType }>;
  reject: (reason?: unknown) => void;
  resolve: (value: { default: React.ComponentType }) => void;
};

const createDeferredModule = (): DeferredModule => {
  let resolve!: DeferredModule['resolve'];
  let reject!: DeferredModule['reject'];
  const promise = new Promise<{ default: React.ComponentType }>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe('InitialRouteBoundary', () => {
  let clearSpy: jest.SpyInstance;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    clearSpy = jest.spyOn(bootRecovery, 'clearStaleChunkReloadMarker').mockReturnValue(true);
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    clearSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('keeps stale-chunk recovery state while the primary lazy route is pending', () => {
    const deferred = createDeferredModule();
    const LazyRoute = React.lazy(() => deferred.promise);

    render(
      <InitialRouteBoundary fallback={<div>Loading route...</div>} resetKey="/pending">
        <LazyRoute />
      </InitialRouteBoundary>,
    );

    expect(screen.getByText('Loading route...')).toBeInTheDocument();
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('clears stale-chunk recovery state once after the primary route commits', async () => {
    const deferred = createDeferredModule();
    const LazyRoute = React.lazy(() => deferred.promise);
    const view = render(
      <InitialRouteBoundary fallback={<div>Loading route...</div>} resetKey="/ready">
        <LazyRoute />
      </InitialRouteBoundary>,
    );

    await act(async () => {
      deferred.resolve({ default: () => <div>Ready route</div> });
      await deferred.promise;
    });

    expect(screen.getByText('Ready route')).toBeInTheDocument();
    expect(clearSpy).toHaveBeenCalledTimes(1);

    view.rerender(
      <InitialRouteBoundary fallback={<div>Loading route...</div>} resetKey="/ready">
        <LazyRoute />
      </InitialRouteBoundary>,
    );
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });

  it('recovers a rejected stale route chunk without clearing the loop guard', async () => {
    const recoverSpy = jest.spyOn(bootRecovery, 'recoverFromStaleChunkLoadError').mockReturnValue(true);
    const deferred = createDeferredModule();
    const LazyRoute = React.lazy(() => deferred.promise);

    render(
      <InitialRouteBoundary fallback={<div>Loading route...</div>} resetKey="/rejected">
        <LazyRoute />
      </InitialRouteBoundary>,
    );

    await act(async () => {
      deferred.reject(new TypeError('Failed to fetch dynamically imported module'));
      try {
        await deferred.promise;
      } catch {
        // The route boundary consumes the rejected lazy module during React's retry.
      }
    });

    expect(screen.getByText(/this section encountered an error/i)).toBeInTheDocument();
    expect(recoverSpy).toHaveBeenCalledWith(expect.any(TypeError));
    expect(clearSpy).not.toHaveBeenCalled();

    recoverSpy.mockRestore();
  });
});
