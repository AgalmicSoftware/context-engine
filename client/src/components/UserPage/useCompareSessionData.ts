import { useEffect, useRef } from 'react';

type Options = {
  sessionSlug: string;
  ready?: boolean;
  error?: string;
  load?: () => Promise<unknown>;
};

// A comparison may wait for hydration, but must never silently promote partial data to ready.
export const useCompareSessionData = (options: Options) => {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const pending = useRef<{ promise: Promise<void>; finish: (error?: Error) => void } | null>(null);

  useEffect(() => () => pending.current?.finish(new Error('The comparison session changed.')), [options.sessionSlug]);
  useEffect(() => {
    if (options.error) pending.current?.finish(new Error(options.error));
    else if (options.ready !== false) pending.current?.finish();
  }, [options.error, options.ready]);

  return (): Promise<void> => {
    const { ready, error, load } = optionsRef.current;
    if (error && !load) return Promise.reject(new Error(error));
    if (ready !== false && !error) return Promise.resolve();
    if (pending.current) return pending.current.promise;
    let finish!: (error?: Error) => void;
    const promise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => finish(new Error('Session data is taking too long to load. Please retry.')),
        30000,
      );
      finish = (failure) => {
        clearTimeout(timer);
        if (pending.current?.promise === promise) pending.current = null;
        if (failure) reject(failure);
        else resolve();
      };
    });
    pending.current = { promise, finish };
    if (load)
      void Promise.resolve()
        .then(load)
        .catch((failure: unknown) =>
          finish(failure instanceof Error ? failure : new Error('Could not load session data. Please retry.')),
        );
    return promise;
  };
};
