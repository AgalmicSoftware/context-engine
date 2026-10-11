import React from 'react';
import { isStaleChunkLoadError } from '../../bootRecovery.js';

type LazyModule<T extends React.ComponentType<any>> = {
  default: T;
};

type LazyModuleLoader<T extends React.ComponentType<any>> = () => Promise<LazyModule<T>>;

type RetryLazyImportOptions = {
  attempts?: number;
  delayMs?: number;
  // Rethrow a stale chunk error at once instead of retrying it.
  rethrowStaleChunks?: boolean;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const retryLazyImport = async <T extends React.ComponentType<any>>(
  loader: LazyModuleLoader<T>,
  { attempts = 3, delayMs = 250, rethrowStaleChunks = false }: RetryLazyImportOptions = {},
): Promise<LazyModule<T>> => {
  const totalAttempts = Math.max(1, Math.floor(Number(attempts) || 1));
  let lastError: unknown = null;

  for (let index = 0; index < totalAttempts; index += 1) {
    try {
      return await loader();
    } catch (error) {
      lastError = error;
      if ((rethrowStaleChunks && isStaleChunkLoadError(error)) || index >= totalAttempts - 1) break;
      await sleep(delayMs * (index + 1));
    }
  }

  throw lastError;
};

// The browser caches a failed import for this page load, and Vite skips a failed
// stylesheet on retry, so a lazy view hands a stale chunk straight to its error
// boundary, which can reload the page, instead of rendering unstyled after a retry.
export const lazyWithRetry = <T extends React.ComponentType<any>>(
  loader: LazyModuleLoader<T>,
  options?: Omit<RetryLazyImportOptions, 'rethrowStaleChunks'>,
) => React.lazy(() => retryLazyImport(loader, { ...options, rethrowStaleChunks: true }));
