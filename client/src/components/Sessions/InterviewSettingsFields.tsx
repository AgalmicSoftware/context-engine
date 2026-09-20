import React, { useId } from 'react';
import { Input, Label } from 'reactstrap';
import { normalizeInterviewSettings } from '../../../../shared/interviewSettings.mjs';
import { DEFAULT_REALTIME_INTERVIEW_MODEL } from '../../utilities/audio/realtimeInterviewConfig';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

type Props = { value: unknown; onChange: (value: Record<string, unknown>) => void; disabled?: boolean };
export default function InterviewSettingsFields({ value, onChange, disabled = false }: Props) {
  const id = useId();
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const settings = normalizeInterviewSettings(value);
  const change = (key: string, next: unknown) => onChange({ ...raw, ...settings, [key]: next });
  return (
    <fieldset disabled={disabled} style={{ minWidth: 0 }}>
      <legend>Interview settings</legend>
      <Label for={`${id}-model`}>Interview voice model</Label>
      <Input
        id={`${id}-model`}
        data-testid={E2E_TESTIDS.WIZARD_INTERVIEW_REALTIME_MODEL}
        value={String(raw.realtimeModel || DEFAULT_REALTIME_INTERVIEW_MODEL)}
        onChange={(e) => change('realtimeModel', e.target.value)}
      />
      <Label for={`${id}-mode`}>Opening question</Label>
      <Input
        id={`${id}-mode`}
        type="select"
        value={settings.openingMode}
        onChange={(e) => change('openingMode', e.target.value)}
      >
        <option value="auto">Generate from session information and questions</option>
        <option value="owner">Use an owner-written opening</option>
      </Input>
      {settings.openingMode === 'owner' ? (
        <>
          <Label for={`${id}-prompt`}>Owner opening question</Label>
          <Input
            id={`${id}-prompt`}
            type="textarea"
            maxLength={1200}
            required
            value={settings.openingPrompt}
            onChange={(e) => change('openingPrompt', e.target.value)}
          />
        </>
      ) : (
        <p>Generated when an interview first has accessible questions. Reused until refreshed.</p>
      )}
      <Label for={`${id}-steering`}>Interview steering prompt</Label>
      <Input
        id={`${id}-steering`}
        type="textarea"
        maxLength={3000}
        value={settings.steeringPrompt}
        onChange={(e) => change('steeringPrompt', e.target.value)}
      />
      {(['autoRegenerate', 'followNewQuestions', 'suggestQuestions', 'allowManualRefresh'] as const).map((key) => (
        <Label key={key} style={{ display: 'block', marginTop: 12 }}>
          <input
            type="checkbox"
            checked={settings[key]}
            onChange={(e) => change(key, e.target.checked)}
            disabled={key === 'autoRegenerate' && settings.openingMode === 'owner'}
          />{' '}
          {
            {
              autoRegenerate: 'Regenerate opening when the question bank grows',
              followNewQuestions: 'Check for new session questions during interviews',
              suggestQuestions: 'Suggest new question drafts from interview evidence',
              allowManualRefresh: 'Allow admins to regenerate the opening',
            }[key]
          }
        </Label>
      ))}
      {(settings.autoRegenerate || settings.followNewQuestions) && (
        <>
          <Label for={`${id}-growth`}>Question growth threshold (%)</Label>
          <Input
            id={`${id}-growth`}
            type="number"
            min={1}
            max={100}
            value={settings.questionGrowthPercent}
            onChange={(e) => change('questionGrowthPercent', Number(e.target.value))}
          />
          <p>
            Additions accumulate since the last opening generation or conversation update. Follow-ups remain enabled.
          </p>
        </>
      )}
    </fieldset>
  );
}
