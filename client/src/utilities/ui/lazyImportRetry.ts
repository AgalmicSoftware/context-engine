import React from 'react';

type LazyModule<T extends React.ComponentType<any>> = {
  default: T;
};

type LazyModuleLoader<T extends React.ComponentType<any>> = () => Promise<LazyModule<T>>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const retryLazyImport = async <T extends React.ComponentType<any>>(
  loader: LazyModuleLoader<T>,
  {
    attempts = 3,
    delayMs = 250,
  }: {
    attempts?: number;
    delayMs?: number;
  } = {},
): Promise<LazyModule<T>> => {
  const totalAttempts = Math.max(1, Math.floor(Number(attempts) || 1));
  let lastError: unknown = null;

  for (let index = 0; index < totalAttempts; index += 1) {
    try {
      return await loader();
    } catch (error) {
      lastError = error;
      if (index >= totalAttempts - 1) break;
      await sleep(delayMs * (index + 1));
    }
  }

  throw lastError;
};

export const lazyWithRetry = <T extends React.ComponentType<any>>(
  loader: LazyModuleLoader<T>,
  options?: Parameters<typeof retryLazyImport<T>>[1],
) => React.lazy(() => retryLazyImport(loader, options));
