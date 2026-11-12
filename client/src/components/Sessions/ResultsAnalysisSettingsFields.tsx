import { useId } from 'react';
import { FormText, Input, Label } from 'reactstrap';
import {
  RESULTS_ANALYSIS_THRESHOLD_MAX,
  RESULTS_ANALYSIS_THRESHOLD_MIN,
  normalizeResultsAnalysisSettings,
  validResultsAnalysisSettings,
} from '../../../../shared/resultsAnalysisSettings.mjs';
import { SetupHelp, setupHelpId } from './setup/SetupPrimitives';

type Props = {
  value: unknown;
  onChange: (value: Record<string, unknown>) => void;
  backgroundAutoSupported?: boolean;
  unsupportedReason?: string;
  disabled?: boolean;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const VIEW_LABELS = {
  circles: 'Circles',
  breakdown: 'Breakdown',
  riskMatrix: 'Risk Matrix',
} as const;

const MODE_HELP =
  'When the AI makes the views below. Manual: an admin presses Generate in Results. Automatic: after the number of new participants set below, on Centralized sessions. Manual and automatic: both.';
const VIEWS_HELP =
  'Which views the AI makes from the answers. Circles: a map of the arguments, with its atlas. Breakdown: how groups of participants answered, showing only groups of at least the smallest size. Risk Matrix: the answers on a grid whose two axes come from the session’s subject.';
const THRESHOLD_HELP =
  'An automatic run starts after this many new participants since the last run, automatic or manual. Someone answering again doesn’t count.';
const ROW = { display: 'flex', alignItems: 'center', gap: 8 } as const;

export default function ResultsAnalysisSettingsFields({
  value,
  onChange,
  backgroundAutoSupported = false,
  unsupportedReason = '',
  disabled = false,
}: Props) {
  const id = useId();
  const raw = asRecord(value);
  const settings = normalizeResultsAnalysisSettings(value);
  const rawAutoAfter = asRecord(raw.autoAfter);
  const thresholdValue = Object.prototype.hasOwnProperty.call(rawAutoAfter, 'threshold')
    ? String(rawAutoAfter.threshold ?? '')
    : String(settings.autoAfter.threshold);
  const thresholdNumber = Number(thresholdValue);
  const thresholdInvalid =
    thresholdValue === '' ||
    !Number.isSafeInteger(thresholdNumber) ||
    thresholdNumber < RESULTS_ANALYSIS_THRESHOLD_MIN ||
    thresholdNumber > RESULTS_ANALYSIS_THRESHOLD_MAX;
  const settingsInvalid = raw && Object.keys(raw).length ? !validResultsAnalysisSettings(raw) : false;
  const autoDisabled = disabled || !backgroundAutoSupported;
  const change = (patch: Record<string, unknown>) =>
    onChange({
      ...raw,
      ...settings,
      ...patch,
    });
  const changeView = (key: keyof typeof VIEW_LABELS, checked: boolean) =>
    change({
      views: {
        ...settings.views,
        [key]: checked,
      },
    });

  return (
    <fieldset disabled={disabled} style={{ minWidth: 0 }}>
      <legend>Results analysis</legend>
      <div>
        <div style={{ ...ROW, marginBottom: '0.5rem' }}>
          <Label for={`${id}-mode`} style={{ marginBottom: 0 }}>
            Generation mode
          </Label>
          <SetupHelp id={`${id}-mode`} label="Generation mode" help={MODE_HELP} />
        </div>
        <Input
          id={`${id}-mode`}
          type="select"
          value={settings.generationMode}
          aria-describedby={setupHelpId(`${id}-mode`)}
          onChange={(event) => change({ generationMode: event.target.value })}
        >
          <option value="manual">Manual</option>
          <option value="automatic" disabled={autoDisabled}>
            Automatic after threshold
          </option>
          <option value="both" disabled={autoDisabled}>
            Manual and automatic
          </option>
        </Input>
      </div>
      {unsupportedReason ? <FormText>{unsupportedReason}</FormText> : null}
      {settingsInvalid ? (
        <FormText color="danger">Results analysis settings need a valid threshold and known options.</FormText>
      ) : null}

      <div role="group" aria-labelledby={`${id}-views`} aria-describedby={setupHelpId(`${id}-views`)}>
        <div style={{ ...ROW, marginTop: 12 }}>
          <span id={`${id}-views`}>AI Views</span>
          <SetupHelp id={`${id}-views`} label="AI Views" help={VIEWS_HELP} />
        </div>
        {(['circles', 'breakdown', 'riskMatrix'] as const).map((key) => (
          <Label key={key} style={{ display: 'block', marginBottom: 0 }}>
            <input
              type="checkbox"
              checked={settings.views[key]}
              onChange={(event) => changeView(key, event.target.checked)}
            />{' '}
            {VIEW_LABELS[key]}
          </Label>
        ))}
      </div>

      {(settings.generationMode === 'automatic' || settings.generationMode === 'both') && (
        <div>
          <div style={{ ...ROW, margin: '12px 0 0.5rem' }}>
            <Label for={`${id}-threshold`} style={{ marginBottom: 0 }}>
              Distinct participant threshold
            </Label>
            <SetupHelp id={`${id}-threshold`} label="Distinct participant threshold" help={THRESHOLD_HELP} />
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
        </div>
      )}
    </fieldset>
  );
}
