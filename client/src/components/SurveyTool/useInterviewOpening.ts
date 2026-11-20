import { useEffect, useState } from 'react';
import { normalizeInterviewSettings } from '../../../../shared/interviewSettings.mjs';
import { sessionReadHeaders } from '../../utilities/worker/workerSessionReadHeaders';

export function useInterviewOpening({
  config,
  workerUrl,
  sessionSlug,
  hasQuestions,
}: {
  config: unknown;
  workerUrl?: string;
  sessionSlug?: string;
  hasQuestions: boolean;
}) {
  const settings = normalizeInterviewSettings((config as { interviewMode?: unknown })?.interviewMode);
  const [opening, setOpening] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setOpening('');
    setLoading(false);
    if (settings.openingMode === 'owner' || !workerUrl || !hasQuestions) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 10000);
    setLoading(true);
    void fetch(`${workerUrl.replace(/\/+$/, '')}/interview/starter?slug=${encodeURIComponent(sessionSlug || '')}`, {
      method: 'POST',
      headers: sessionReadHeaders(workerUrl, sessionSlug),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Opening unavailable');
        return response.json();
      })
      .then((value) => {
        if (active) setOpening(String(value.openingPrompt || ''));
      })
      // Without an opening the interview starts from a session question; that is not the participant's concern.
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [workerUrl, sessionSlug, hasQuestions, settings.openingMode]);
  return {
    opening: settings.openingMode === 'owner' ? settings.openingPrompt : opening,
    steeringPrompt: settings.steeringPrompt,
    loading: settings.openingMode === 'auto' && loading,
  };
}
