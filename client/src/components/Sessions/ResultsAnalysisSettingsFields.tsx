import { useId, useState } from 'react';
import { FormText, Input, Label } from 'reactstrap';
import {
  RESULTS_ANALYSIS_THRESHOLD_MAX,
  RESULTS_ANALYSIS_THRESHOLD_MIN,
  normalizeResultsAnalysisSettings,
} from '../../../../shared/resultsAnalysisSettings.mjs';
import { SetupHelp, setupHelpId } from './setup/SetupPrimitives';

type Props = {
  value: unknown;
  onChange: (value: Record<string, unknown>) => void;
  // No longer used here; kept so the set-up and Settings pages pass what they always have.
  backgroundAutoSupported?: boolean;
  unsupportedReason?: string;
  disabled?: boolean;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const MODE_HELP =
  'When what the Session Agent knows about the results as a whole is refreshed. Each update is a paid AI call on the session’s AI key.';
const THRESHOLD_HELP =
  'An automatic update starts after this many new participants since the last update. Someone answering again doesn’t count.';
const ROW = { display: 'flex', alignItems: 'center', gap: 8 } as const;

/**
 * The Session Agent answers about the results as a whole from a build an admin starts with Update Session Agent
 * in Results. That is the whole feature, so a session on manual updates, which is every new one, sees nothing
 * here. A session already set to update automatically goes on doing so in its Worker, each one a paid AI call;
 * it sees when and how often, and can turn it back to manual. What else is stored for the build stays as it is.
 */
export default function ResultsAnalysisSettingsFields({ value, onChange, disabled = false }: Props) {
  const id = useId();
  const settings = normalizeResultsAnalysisSettings(value);
  const automatic = settings.generationMode === 'automatic' || settings.generationMode === 'both';
  // Once shown the fields stay, so an admin who picks manual can still change their mind before saving.
  const [shown, setShown] = useState(automatic);
  if (automatic && !shown) setShown(true);
  if (!shown) return null;

  const rawAutoAfter = asRecord(asRecord(value).autoAfter);
  const thresholdValue = Object.prototype.hasOwnProperty.call(rawAutoAfter, 'threshold')
    ? String(rawAutoAfter.threshold ?? '')
    : String(settings.autoAfter.threshold);
  const thresholdNumber = Number(thresholdValue);
  const thresholdInvalid =
    thresholdValue === '' ||
    !Number.isSafeInteger(thresholdNumber) ||
    thresholdNumber < RESULTS_ANALYSIS_THRESHOLD_MIN ||
    thresholdNumber > RESULTS_ANALYSIS_THRESHOLD_MAX;
  // Only the settings the session's validation knows, so a stray stored key cannot block the save.
  const change = (patch: Record<string, unknown>) => onChange({ ...settings, ...patch });

  return (
    <fieldset disabled={disabled} style={{ minWidth: 0 }} data-testid="ce-session-agent-updates">
      <legend>Session Agent updates</legend>
      <div style={{ ...ROW, marginBottom: '0.5rem' }}>
        <Label for={`${id}-mode`} style={{ marginBottom: 0 }}>
          Update the Session Agent
        </Label>
        <SetupHelp id={`${id}-mode`} label="Update the Session Agent" help={MODE_HELP} />
      </div>
      <Input
        id={`${id}-mode`}
        type="select"
        value={settings.generationMode}
        aria-describedby={setupHelpId(`${id}-mode`)}
        onChange={(event) => change({ generationMode: event.target.value })}
      >
        <option value="manual">When an admin presses Update Session Agent</option>
        <option value="automatic">Automatically, after new participants</option>
        <option value="both">Both</option>
      </Input>
      {automatic ? (
        <div>
          <div style={{ ...ROW, margin: '12px 0 0.5rem' }}>
            <Label for={`${id}-threshold`} style={{ marginBottom: 0 }}>
              New participants before an automatic update
            </Label>
            <SetupHelp
              id={`${id}-threshold`}
              label="New participants before an automatic update"
              help={THRESHOLD_HELP}
            />
          </div>
          <Input
            id={`${id}-threshold`}
            type="number"
            min={RESULTS_ANALYSIS_THRESHOLD_MIN}
            max={RESULTS_ANALYSIS_THRESHOLD_MAX}
            value={thresholdValue}
            invalid={thresholdInvalid}
            aria-describedby={setupHelpId(`${id}-threshold`)}
            onChange={(event) =>
              change({
                autoAfter: {
                  threshold: event.target.value === '' ? '' : Number(event.target.value),
                  unit: 'distinctParticipants',
                },
              })
            }
          />
          {thresholdInvalid ? <FormText color="danger">Enter a whole number of participants.</FormText> : null}
        </div>
      ) : (
        <FormText>Automatic updates stop when you save.</FormText>
      )}
    </fieldset>
  );
}
