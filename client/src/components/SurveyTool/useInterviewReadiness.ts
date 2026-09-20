import { useCallback, useEffect, useState } from 'react';

type Readiness = { state: 'checking' | 'ready' | 'unavailable' | 'unknown'; detail: string };
const checking: Readiness = { state: 'checking', detail: 'Checking voice interview setup…' };

export function useInterviewReadiness(workerUrl: string, sessionSlug: string) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; value: Readiness } | null>(null);
  const key = `${workerUrl}|${sessionSlug}|${revision}`;
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!workerUrl) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 8000);
    const run = async (): Promise<Readiness> => {
      if (!navigator.mediaDevices?.getUserMedia)
        return {
          state: 'unavailable',
          detail: 'Microphone access requires a supported browser and a secure connection.',
        };
      try {
        const permission = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
        if (permission?.state === 'denied')
          return {
            state: 'unavailable',
            detail: 'Allow microphone access in your browser settings, then check again.',
          };
      } catch {
        /* Some browsers do not expose microphone permission state until Start is clicked. */
      }
      const response = await fetch(`${workerUrl.replace(/\/+$/, '')}/resource-presence?interview=1`, {
        headers: { 'X-Session-Slug': sessionSlug || 'general' },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok)
        return {
          state: 'unknown',
          detail: 'Could not verify voice setup. Check the connection or ask the session owner to update the Worker.',
        };
      const body = await response.json();
      if (body.interview?.ready === true)
        return {
          state: 'ready',
          detail:
            'The Worker has an OpenAI key and permits voice interviews. Microphone permission and the live connection are checked when you start.',
        };
      if (body.interview?.ready === false)
        return {
          state: 'unavailable',
          detail: String(body.interview.reason || 'The session owner needs to finish voice interview setup.'),
        };
      return {
        state: 'unknown',
        detail:
          'This Worker cannot report voice readiness yet. You can try starting, or ask the session owner to update it.',
      };
    };
    void run()
      .catch((): Readiness => ({
        state: 'unknown',
        detail: 'Voice setup could not be checked. Check your connection and try again.',
      }))
      .then((value) => {
        if (active) setResult({ key, value });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [key, workerUrl, sessionSlug]);
  return { ...(result?.key === key ? result.value : checking), retry };
}
