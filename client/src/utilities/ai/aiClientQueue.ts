export type AiCallInvoker<T> = () => Promise<T>;

export type AiQueueOptions = {
  delay?: (ms: number) => Promise<void>;
  random?: () => number;
};

const DEFAULT_MAX_ATTEMPTS = 3;

const defaultDelay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const isTransientAiQueueError = (error: unknown): boolean => {
  const message = String(error && typeof error === 'object' && 'message' in error ? error.message : '');
  return /rate\s*limit|concurrent|overload|overloaded|busy|temporarily|try\s*again|429/i.test(message);
};

export const createQueuedAiCallRunner = ({ delay = defaultDelay, random = Math.random }: AiQueueOptions = {}) => {
  let queue: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(invoke: AiCallInvoker<T>): Promise<T> => {
    const run = async (): Promise<T> => {
      for (let attempt = 0; attempt < DEFAULT_MAX_ATTEMPTS; attempt += 1) {
        try {
          return await invoke();
        } catch (error) {
          if (!isTransientAiQueueError(error) || attempt >= DEFAULT_MAX_ATTEMPTS - 1) {
            throw error;
          }
          const backoffMs = 500 * Math.pow(2, attempt) + Math.floor(random() * 200);
          await delay(backoffMs);
        }
      }
      throw new Error('AI queue retry loop exhausted');
    };

    queue = queue.then(run, run);
    return queue as Promise<T>;
  };

  return enqueue;
};

export const enqueueAiCallWithRetry = createQueuedAiCallRunner();
