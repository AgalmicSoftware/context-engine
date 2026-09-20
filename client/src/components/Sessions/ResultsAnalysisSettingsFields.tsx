import React, { useId } from 'react';
import { FormText, Input, Label } from 'reactstrap';
import {
  RESULTS_ANALYSIS_THRESHOLD_MAX,
  RESULTS_ANALYSIS_THRESHOLD_MIN,
  normalizeResultsAnalysisSettings,
  validResultsAnalysisSettings,
} from '../../../../shared/resultsAnalysisSettings.mjs';

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
      <Label for={`${id}-mode`}>Generation mode</Label>
      <Input
        id={`${id}-mode`}
        type="select"
        value={settings.generationMode}
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
      {unsupportedReason ? <FormText>{unsupportedReason}</FormText> : null}
      {settingsInvalid ? (
        <FormText color="danger">Results analysis settings need a valid threshold and known options.</FormText>
      ) : null}

      {(['circles', 'breakdown', 'riskMatrix'] as const).map((key) => (
        <Label key={key} style={{ display: 'block', marginTop: 12 }}>
          <input
            type="checkbox"
            checked={settings.views[key]}
            onChange={(event) => changeView(key, event.target.checked)}
          />{' '}
          {VIEW_LABELS[key]}
        </Label>
      ))}

      {(settings.generationMode === 'automatic' || settings.generationMode === 'both') && (
        <>
          <Label for={`${id}-threshold`}>Distinct participant threshold</Label>
          <Input
            id={`${id}-threshold`}
            type="number"
            min={RESULTS_ANALYSIS_THRESHOLD_MIN}
            max={RESULTS_ANALYSIS_THRESHOLD_MAX}
            value={thresholdValue}
            invalid={thresholdInvalid}
            onChange={(event) =>
              change({
                autoAfter: {
                  threshold: event.target.value === '' ? '' : Number(event.target.value),
                  unit: 'distinctParticipants',
                },
              })
            }
          />
          <FormText>
            Runs after this many newly seen distinct participants since the last successful automatic or manual run.
            Resubmits do not advance the threshold.
          </FormText>
        </>
      )}
    </fieldset>
  );
}
