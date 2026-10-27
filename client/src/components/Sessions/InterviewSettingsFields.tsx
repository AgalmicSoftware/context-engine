import { useId } from 'react';
import { getSessionWizardInterviewValidationError } from './sessionWizardInterviewValidation';
import { Input, Label } from 'reactstrap';
import { normalizeInterviewSettings } from '../../../../shared/interviewSettings.mjs';
import { DEFAULT_REALTIME_INTERVIEW_MODEL } from '../../utilities/audio/realtimeInterviewConfig';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const HIDDEN_DRAFT_SHARES = [0, 1 / 10, 1 / 5, 1 / 4, 1 / 3, 1 / 2];
const hiddenDraftShareLabel = (share: number) => {
  if (!share) return 'Off';
  const oneIn = Math.round(1 / share);
  return Math.abs(1 / oneIn - share) < 1e-9 ? `1 in ${oneIn}` : `${Math.round(share * 100)}%`;
};

type Props = { value: unknown; onChange: (value: Record<string, unknown>) => void; disabled?: boolean };
export default function InterviewSettingsFields({ value, onChange, disabled = false }: Props) {
  const id = useId();
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const settings = normalizeInterviewSettings(value);
  const validationError = getSessionWizardInterviewValidationError(value);
  const change = (key: string, next: unknown) => onChange({ ...raw, ...settings, [key]: next });
  return (
    <fieldset disabled={disabled} style={{ minWidth: 0 }}>
      <legend>Interview settings</legend>
      <Label for={`${id}-research-sharing`}>Share AI draft changes for research by default</Label>
      <Input
        id={`${id}-research-sharing`}
        type="select"
        value={String(settings.shareDraftChangesByDefault)}
        onChange={(e) => change('shareDraftChangesByDefault', e.target.value === 'true')}
        aria-describedby={`${id}-research-sharing-help`}
      >
        <option value="false">Off</option>
        <option value="true">On</option>
      </Input>
      <p id={`${id}-research-sharing-help`}>
        Sets the initial research-sharing checkbox for new responses. Participants can change it before submitting;
        their saved choices are preserved.
      </p>
      <Label for={`${id}-research-detail`}>AI draft research detail</Label>
      <Input
        id={`${id}-research-detail`}
        type="select"
        value={settings.researchDetail}
        onChange={(e) => change('researchDetail', e.target.value === 'full' ? 'full' : 'minimal')}
        aria-describedby={`${id}-research-detail-help`}
      >
        <option value="minimal">Minimal: predicted answers, confidence and changes</option>
        <option value="full">Full: also the AI&apos;s notes, drafted text and drafts for skipped questions</option>
      </Input>
      <p id={`${id}-research-detail-help`}>
        What a shared draft comparison saves. Minimal keeps none of the AI&apos;s notes or drafted text, which suits
        public sessions.
      </p>
      <Label for={`${id}-hidden-drafts`}>Hidden AI drafts</Label>
      <Input
        id={`${id}-hidden-drafts`}
        type="select"
        value={String(settings.hiddenDraftShare)}
        onChange={(e) => change('hiddenDraftShare', Number(e.target.value))}
        aria-describedby={`${id}-hidden-drafts-help`}
      >
        {[...new Set([...HIDDEN_DRAFT_SHARES, settings.hiddenDraftShare])].map((share) => (
          <option key={share} value={String(share)}>
            {hiddenDraftShareLabel(share)}
          </option>
        ))}
      </Input>
      <p id={`${id}-hidden-drafts-help`}>
        Hides this share of each participant&apos;s AI prefill drafts until they answer, to measure how much seeing a
        draft sways answers. Only for participants sharing draft changes for research.
      </p>
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
            invalid={!!validationError}
            aria-describedby={validationError ? `${id}-error` : undefined}
            value={settings.openingPrompt}
            onChange={(e) => change('openingPrompt', e.target.value)}
          />
        </>
      ) : (
        <p>Generated when an interview first has accessible questions. Reused until refreshed.</p>
      )}
      {validationError ? (
        <p id={`${id}-error`} role="alert">
          {validationError}
        </p>
      ) : null}
      <Label for={`${id}-steering`}>Interview steering prompt</Label>
      <Input
        id={`${id}-steering`}
        type="textarea"
        maxLength={3000}
        value={settings.steeringPrompt}
        onChange={(e) => change('steeringPrompt', e.target.value)}
      />
      {(
        [
          'autoRegenerate',
          'followNewQuestions',
          'suggestQuestions',
          'suggestGroups',
          'allowManualRefresh',
          'showFidelityScore',
        ] as const
      ).map((key) => (
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
              suggestGroups: 'Suggest open groups that fit participants’ answers',
              allowManualRefresh: 'Allow admins to regenerate the opening',
              showFidelityScore: 'Show participants how well their AI predicted them',
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
