import React, { useState } from 'react';
import { Button } from 'reactstrap';
import { normalizeInterviewSettings } from '../../../../shared/interviewSettings.mjs';
export default function AdminInterviewOpening({
  settings,
  onRefresh,
}: {
  settings: unknown;
  onRefresh: () => Promise<{ openingPrompt?: string }>;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const config = normalizeInterviewSettings(settings);
  if (!config.allowManualRefresh || config.openingMode === 'owner') return null;
  return (
    <div>
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const value = await onRefresh();
            setResult(value.openingPrompt || 'Waiting for accessible session questions.');
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Could not refresh the opening.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Generating opening…' : 'Regenerate interview opening'}
      </Button>
      {result && <p role="status">{result}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
