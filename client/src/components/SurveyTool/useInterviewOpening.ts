import { useEffect, useState } from 'react';
import { normalizeInterviewSettings } from '../../../../shared/interviewSettings.mjs';

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
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setOpening('');
    setNotice('');
    setLoading(false);
    if (settings.openingMode === 'owner' || !workerUrl || !hasQuestions) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 10000);
    setLoading(true);
    void fetch(`${workerUrl.replace(/\/+$/, '')}/interview/starter?slug=${encodeURIComponent(sessionSlug || '')}`, {
      method: 'POST',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Opening unavailable');
        return response.json();
      })
      .then((value) => {
        if (active) {
          setOpening(String(value.openingPrompt || ''));
          if (value.warning) setNotice(String(value.warning));
        }
      })
      .catch(() => {
        if (active)
          setNotice('A saved opening is unavailable. The interview will start directly with a session question.');
      })
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
    notice,
    loading: settings.openingMode === 'auto' && loading,
  };
}
