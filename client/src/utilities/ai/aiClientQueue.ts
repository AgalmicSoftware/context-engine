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

// A browser's own words for a request that got no reply at all: Chrome, Safari, Firefox (which ends in a full stop).
const NO_REPLY_RE = /^(?:failed to fetch|load failed|networkerror when attempting to fetch resource\.?)$/i;

export const isAiRequestWithoutReply = (message: unknown): boolean => NO_REPLY_RE.test(String(message || '').trim());

export const createQueuedAiCallRunner = ({ delay = defaultDelay, random = Math.random }: AiQueueOptions = {}) => {
  let queue: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(invoke: AiCallInvoker<T>): Promise<T> => {
    const run = async (): Promise<T> => {
      // A request lost on the way is sent once more, at once: a connection that sat open can be dead, and a
      // browser does not send a POST again by itself. An AI reply is only text, so asking twice stores nothing twice.
      let sentAgain = false;
      const send = async (): Promise<T> => {
        try {
          return await invoke();
        } catch (error) {
          if (sentAgain || !(error instanceof TypeError) || !isAiRequestWithoutReply(error.message)) throw error;
          sentAgain = true;
          return invoke();
        }
      };
      for (let attempt = 0; attempt < DEFAULT_MAX_ATTEMPTS; attempt += 1) {
        try {
          return await send();
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
