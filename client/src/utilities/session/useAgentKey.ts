import { useEffect, useRef, useState } from 'react';
import { AGENTS_SIGNED_OUT_EVENT, agentKeyErrorMessage, type AgentDelegateKey } from './agentHandoff';

/** How long after each failed quiet try the next one waits; after the last, the prompt goes without a key. */
export const QUIET_RETRY_DELAYS_MS = [1500, 3000];

const stillGood = (key: AgentDelegateKey | null): key is AgentDelegateKey =>
  Boolean(key) && Date.parse(key!.expiresAt) > Date.now();

/**
 * The AI key that goes into a signed-in person's AI prompt, so their AI can submit as them. While `wanted`
 * (they are signed in and the session gives keys), one is made without asking them anything; where that would
 * need a fresh sign-in to the session, none is made unless `ask` runs, for a person who came for the key. It is made before
 * the copy, never in it, since a copy must begin in its own tap. The key lives only here, never in browser
 * storage; one past its time is replaced, and Sign Agents Out drops it and makes no other until the person
 * comes back to the card.
 */
export const useAgentKey = (
  requestKey: (options: { prompt: boolean }) => Promise<AgentDelegateKey>,
  wanted: boolean,
) => {
  const [key, setKey] = useState<AgentDelegateKey | null>(null);
  const [making, setMaking] = useState(false);
  const [error, setError] = useState('');
  // The quiet tries found a sign-in was needed.
  const [quietFailed, setQuietFailed] = useState(false);
  // After Sign Agents Out no key is made until the person comes back to it: the card is opened again, or `resume`.
  const [paused, setPaused] = useState(false);
  // A quiet try that fails is tried again shortly, a few times: right after a sign-in the page is still signing
  // in to the session, and a quiet try never waits on that.
  const [waiting, setWaiting] = useState(false);
  const quietTries = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(retryTimer.current), []);
  // Bumped by each request and each reset, so a key asked for before one is not kept after it.
  const round = useRef(0);
  const request = useRef(requestKey);
  request.current = requestKey;

  const make = async (prompt: boolean) => {
    round.current += 1;
    const mine = round.current;
    setMaking(true);
    setError('');
    try {
      const made = await request.current({ prompt });
      // One that has already ended is no key: asking again at once would only get the same.
      if (!stillGood(made)) throw new Error('the key had already ended');
      if (mine === round.current) setKey(made);
    } catch (err) {
      if (mine !== round.current) return;
      if (prompt) setError(agentKeyErrorMessage(err));
      else if (quietTries.current < QUIET_RETRY_DELAYS_MS.length) {
        setWaiting(true);
        retryTimer.current = setTimeout(() => setWaiting(false), QUIET_RETRY_DELAYS_MS[quietTries.current]);
        quietTries.current += 1;
      } else setQuietFailed(true);
    } finally {
      if (mine === round.current) setMaking(false);
    }
  };

  const good = stillGood(key);
  useEffect(() => {
    if (wanted && !paused && !good && !making && !waiting && !quietFailed && !error) void make(false);
    // `make` reads only refs and setters.
  }, [wanted, paused, good, making, waiting, quietFailed, error]);

  /** Drops the key and starts afresh, as for another account or after Sign Agents Out. */
  const reset = () => {
    round.current += 1;
    clearTimeout(retryTimer.current);
    quietTries.current = 0;
    setKey(null);
    setMaking(false);
    setWaiting(false);
    setError('');
    setQuietFailed(false);
    setPaused(false);
  };
  const resetRef = useRef(reset);
  resetRef.current = reset;
  useEffect(() => {
    const dropKey = () => {
      resetRef.current();
      setPaused(true);
    };
    window.addEventListener(AGENTS_SIGNED_OUT_EVENT, dropKey);
    return () => window.removeEventListener(AGENTS_SIGNED_OUT_EVENT, dropKey);
  }, []);

  // The key goes into the prompt only where the session lets an AI submit with it, and only while it lasts.
  const promptKey = wanted && good && key.submitAnswers ? { key } : null;
  return {
    promptKey,
    /** A key is on its way, or about to be asked for: a copy now would give the prompt without it. */
    making: wanted && (making || (!paused && !good && !quietFailed && !error)),
    error,
    /** Every quiet try needed a sign-in: the prompt goes without a key, unless the caller asks outright. */
    quietFailed: wanted && !paused && quietFailed && !good && !making && !error,
    /** Asks for the key, signing in to the session if need be: for a person who came for it. */
    ask: () => void make(true),
    /** Lets a key be made again after Sign Agents Out. */
    resume: () => setPaused(false),
    reset,
  };
};
