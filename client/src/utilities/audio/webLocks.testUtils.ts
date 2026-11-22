type Grant = (lock: { name: string } | null) => unknown;

/**
 * Installs a fake Web Locks manager on `navigator`: one holder per lock name, with later requests waiting in
 * order until it lets go, an aborted wait leaving the queue, and an `ifAvailable` request given null while the
 * lock is held. Returns the uninstaller.
 */
export function installFakeWebLocks(): () => void {
  const queues = new Map<string, Array<() => void>>();
  const request = (name: string, options: { signal?: AbortSignal; ifAvailable?: boolean }, callback: Grant) =>
    new Promise((resolve, reject) => {
      const queue = queues.get(name) || [];
      queues.set(name, queue);
      if (options.ifAvailable && queue.length > 0) {
        Promise.resolve(callback(null)).then(resolve, reject);
        return;
      }
      const grant = () => {
        void Promise.resolve(callback({ name })).then((result) => {
          queue.shift();
          queue[0]?.();
          resolve(result);
        });
      };
      options.signal?.addEventListener('abort', () => {
        const index = queue.indexOf(grant);
        if (index < 1) return;
        queue.splice(index, 1);
        reject(new DOMException('The request was aborted.', 'AbortError'));
      });
      queue.push(grant);
      if (queue.length === 1) grant();
    });
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });
  return () => {
    Reflect.deleteProperty(navigator, 'locks');
  };
}
