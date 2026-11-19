import { useState } from 'react';
import { Button } from 'reactstrap';
import { normalizeResultsAnalysisSettings } from '../../../../shared/resultsAnalysisSettings.mjs';

type Props = {
  value: unknown;
  onChange: (value: Record<string, unknown>) => void;
  // No longer used here; kept so the set-up and Settings pages pass what they always have.
  backgroundAutoSupported?: boolean;
  unsupportedReason?: string;
  disabled?: boolean;
};

/**
 * AI Views has been taken off the site: its Results buttons and these settings are gone, and what is stored for
 * a session is left as it is. One thing remains. A session set to build automatically goes on building in its
 * Worker, a paid AI call, with nothing on the site to show for it; this is the way to stop that. A session on
 * manual builds, which is every new one, sees nothing here.
 */
export default function ResultsAnalysisSettingsFields({ value, onChange, disabled = false }: Props) {
  const settings = normalizeResultsAnalysisSettings(value);
  // Once stopped, the mode is manual; this keeps the reminder to save on the page.
  const [stopped, setStopped] = useState(false);
  if (settings.generationMode !== 'automatic' && settings.generationMode !== 'both') {
    return stopped ? (
      <p role="status" data-testid="ce-ai-views-stopped">
        Automatic AI Views builds stop when you save.
      </p>
    ) : null;
  }
  return (
    <fieldset disabled={disabled} style={{ minWidth: 0 }} data-testid="ce-ai-views-automatic">
      <legend>Automatic AI Views builds</legend>
      <p>
        This session&apos;s Worker still builds AI Views automatically as people answer. Each build is a paid AI call on
        the session&apos;s AI key, and the site no longer shows or controls AI Views.
      </p>
      <Button
        type="button"
        color="secondary"
        onClick={() => {
          setStopped(true);
          // Only the settings the session's validation knows, so a stray stored key cannot block the save.
          onChange({ ...settings, generationMode: 'manual' });
        }}
      >
        Stop automatic builds
      </Button>
    </fieldset>
  );
}
