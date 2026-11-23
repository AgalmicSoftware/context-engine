import { useEffect, useRef, useState } from 'react';
import { AGENTS_SIGNED_OUT_EVENT, agentKeyErrorMessage, type AgentDelegateKey } from './agentHandoff';

/** How long after each failed quiet try the next one waits; after the last, the card says no key was added. */
export const QUIET_RETRY_DELAYS_MS = [1500, 3000];
/** A quiet try that has not answered by then has failed for good: the copy button stops turning. */
export const QUIET_TRY_TIMEOUT_MS = 15000;

const stillGood = (key: AgentDelegateKey | null): key is AgentDelegateKey =>
  Boolean(key) && Date.parse(key!.expiresAt) > Date.now();

/**
 * The AI key that goes into a signed-in person's AI prompt, so their AI can submit as them. While `wanted`
 * (they are signed in, the session gives keys, and they have ticked "AI can submit for me"), one is made
 * without asking them anything more; where that would need a fresh sign-in to the session, none is made unless
 * `ask` runs, for a person who came for the key. It is made before the copy, never in it, since a copy must
 * begin in its own tap. The key lives only here, never in browser storage; one past its time is replaced, and
 * Sign Agents Out drops it and makes no other until the person comes back to the card.
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
  // When the key last copied ends: it works until then wherever it was pasted, whatever the card does next.
  const [copiedUntil, setCopiedUntil] = useState('');
  // Counts Sign Agents Out, so a card can go back to drafting only.
  const [signOuts, setSignOuts] = useState(0);
  // A quiet try that fails is tried again shortly, a few times: right after a sign-in the page is still signing
  // in to the session, and a quiet try never waits on that.
  const [waiting, setWaiting] = useState(false);
  const quietTries = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout>>();
  // Bumped by each request and each reset, so a key asked for before one is not kept after it.
  const round = useRef(0);
  // Gone from the page, nothing is tried again and no answer still on its way is acted on.
  useEffect(
    () => () => {
      round.current += 1;
      clearTimeout(retryTimer.current);
    },
    [],
  );
  const request = useRef(requestKey);
  request.current = requestKey;

  const make = async (prompt: boolean) => {
    round.current += 1;
    const mine = round.current;
    setMaking(true);
    setError('');
    let timedOut = false;
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const made = await Promise.race([
        request.current({ prompt }),
        // Asked for outright, the person may be at their passkey: only a quiet try is timed.
        ...(prompt
          ? []
          : [
              new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                  timedOut = true;
                  reject(new Error('no answer in time'));
                }, QUIET_TRY_TIMEOUT_MS);
              }),
            ]),
      ]).finally(() => clearTimeout(timer));
      // One that has already ended is no key: asking again at once would only get the same.
      if (!stillGood(made)) throw new Error('the key had already ended');
      if (mine === round.current) setKey(made);
    } catch (err) {
      if (mine !== round.current) return;
      if (prompt) setError(agentKeyErrorMessage(err));
      // A try that got no answer is not tried again: the button would turn for as long again.
      else if (!timedOut && quietTries.current < QUIET_RETRY_DELAYS_MS.length) {
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

  /** Drops the key this page holds, and the answer to any request for one still on its way. */
  const forget = () => {
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
  /** Starts afresh, as for another account or after Sign Agents Out: no key, and none copied that still works. */
  const reset = () => {
    forget();
    setCopiedUntil('');
  };
  const resetRef = useRef(reset);
  resetRef.current = reset;
  useEffect(() => {
    const dropKey = () => {
      resetRef.current();
      setPaused(true);
      setSignOuts((count) => count + 1);
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
    /** No key could be added, quietly or when asked for: the card says so and offers to add it. */
    keyMissing: wanted && !paused && !good && !making && (quietFailed || Boolean(error)),
    /** The session gave a key that cannot submit: the prompt holds none, and drafts. */
    draftOnly: wanted && good && !key.submitAnswers,
    /** Asks for the key, signing in to the session if need be: for a person who came for it. */
    ask: () => void make(true),
    /** Lets a key be made again after Sign Agents Out. */
    resume: () => setPaused(false),
    /** Call when the prompt was copied: a key in it now works wherever it is pasted. */
    markCopied: () => setCopiedUntil(promptKey ? promptKey.key.expiresAt : copiedUntil),
    /** When a key that was copied ends, while it still works; '' otherwise. */
    copiedUntil: Date.parse(copiedUntil) > Date.now() ? copiedUntil : '',
    signOuts,
    forget,
    reset,
  };
};
