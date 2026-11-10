import { useContext, useId } from 'react';
import { ReactReduxContext } from 'react-redux';
import { getSessionWizardInterviewValidationError } from './sessionWizardInterviewValidation';
import useSessionWizardTooltipPreference from './hooks/useSessionWizardTooltipPreference';
import SessionWizardInfoTooltip from './SessionWizardInfoTooltip';
import { Input, Label } from 'reactstrap';
import { DEFAULT_INTERVIEW_SETTINGS, normalizeInterviewSettings } from '../../../../shared/interviewSettings.mjs';
import { DEFAULT_REALTIME_INTERVIEW_MODEL } from '../../utilities/audio/realtimeInterviewConfig';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const HIDDEN_DRAFT_SHARES = [0, 1 / 10, 1 / 5, 1 / 4, 1 / 3, 1 / 2];
const hiddenDraftShareLabel = (share: number) => {
  if (!share) return 'Off';
  const oneIn = Math.round(1 / share);
  return Math.abs(1 / oneIn - share) < 1e-9 ? `1 in ${oneIn}` : `${Math.round(share * 100)}%`;
};

// What "Measure how well AI represents participants" turns on. AI prefill needs
// no switch of its own: its links and card work whenever interviews are on.
const FIDELITY_SETTINGS = { shareDraftChangesByDefault: true, hiddenDraftShare: 1 / 5, showFidelityScore: true };
const FIDELITY_DEFAULTS = {
  shareDraftChangesByDefault: DEFAULT_INTERVIEW_SETTINGS.shareDraftChangesByDefault,
  hiddenDraftShare: DEFAULT_INTERVIEW_SETTINGS.hiddenDraftShare,
  showFidelityScore: DEFAULT_INTERVIEW_SETTINGS.showFidelityScore,
};
const FIDELITY_ABOUT =
  'Turns on voice interviews, which AI prefill uses, research sharing by default and hidden drafts for 1 in 5 of each person’s AI-prefill drafts, and shows people how well their AI predicted them. Turning it off sets the research settings back to their defaults; each can still be changed below.';

// The smallest group "How well AIs predicted people" reports on; 1 shows every figure.
const FIDELITY_MINIMUMS = [1, 3, 5, 10];
const fidelityMinimumLabel = (people: number) => (people === 1 ? 'Off: show every result' : `${people} people`);
const FIDELITY_MINIMUM_ABOUT =
  'That Results section hides any figure based on fewer people than this, so no one’s AI score can be singled out. Turn it off only where everyone knows small groups’ figures are visible.';

type Props = {
  value: unknown;
  onChange: (value: Record<string, unknown>) => void;
  disabled?: boolean;
  // Where voice interviews can be off while these settings show, as in /admin, this turns them on.
  onTurnOnInterviews?: () => void;
};
export default function InterviewSettingsFields({ value, onChange, disabled = false, onTurnOnInterviews }: Props) {
  const id = useId();
  const tooltipsEnabled = useSessionWizardTooltipPreference(useContext(ReactReduxContext)?.store ?? null);
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const settings = normalizeInterviewSettings(value);
  const validationError = getSessionWizardInterviewValidationError(value);
  const change = (key: string, next: unknown) => onChange({ ...raw, ...settings, [key]: next });
  // On while all of its settings are, even after the hidden share is changed.
  const measuring = settings.shareDraftChangesByDefault && settings.hiddenDraftShare > 0 && settings.showFidelityScore;
  // Tooltip targets are CSS selectors, which can't contain React's colons.
  const fidelityId = `${id.replace(/:/g, '')}-fidelity`;
  const minimumId = `${fidelityId}-minimum`;
  return (
    <fieldset disabled={disabled} style={{ minWidth: 0 }}>
      <legend>Interview settings</legend>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Label style={{ marginBottom: 0 }}>
          <input
            type="checkbox"
            checked={measuring}
            aria-describedby={`${fidelityId}-about`}
            data-testid={E2E_TESTIDS.WIZARD_INTERVIEW_FIDELITY}
            onChange={(e) => {
              const on = e.target.checked;
              onChange({ ...raw, ...settings, ...(on ? { ...FIDELITY_SETTINGS, enabled: true } : FIDELITY_DEFAULTS) });
              if (on) onTurnOnInterviews?.();
            }}
          />{' '}
          Measure how well AI represents participants
        </Label>
        {/* Outside the label, so opening the help doesn't toggle the switch. */}
        <SessionWizardInfoTooltip
          enabled={tooltipsEnabled}
          id={`${fidelityId}-help`}
          content={FIDELITY_ABOUT}
          placement="top"
          ariaLabel="About measuring how well AI represents participants"
        />
      </div>
      <span id={`${fidelityId}-about`} hidden>
        {FIDELITY_ABOUT}
      </span>
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
      <Label style={{ display: 'block', marginTop: 12 }}>
        <input
          type="checkbox"
          checked={settings.showFidelityResults}
          data-testid={E2E_TESTIDS.WIZARD_INTERVIEW_FIDELITY_RESULTS}
          // Turning it off also resets the minimum it hides, so no unseen setting is saved.
          onChange={(e) =>
            onChange({
              ...raw,
              ...settings,
              showFidelityResults: e.target.checked,
              ...(e.target.checked ? {} : { fidelityMinimumPeople: DEFAULT_INTERVIEW_SETTINGS.fidelityMinimumPeople }),
            })
          }
        />{' '}
        Show “How well AIs predicted people” in Results
      </Label>
      {settings.showFidelityResults ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem' }}>
            <Label for={minimumId} style={{ marginBottom: 0 }}>
              Smallest group shown in “How well AIs predicted people”
            </Label>
            <SessionWizardInfoTooltip
              enabled={tooltipsEnabled}
              id={`${minimumId}-help`}
              content={FIDELITY_MINIMUM_ABOUT}
              placement="top"
              ariaLabel="About the smallest group shown"
            />
          </div>
          <Input
            id={minimumId}
            type="select"
            data-testid={E2E_TESTIDS.WIZARD_INTERVIEW_FIDELITY_MINIMUM}
            value={String(settings.fidelityMinimumPeople)}
            onChange={(e) => change('fidelityMinimumPeople', Number(e.target.value))}
            aria-describedby={`${minimumId}-about`}
          >
            {[...new Set([...FIDELITY_MINIMUMS, settings.fidelityMinimumPeople])]
              .sort((a, b) => a - b)
              .map((people) => (
                <option key={people} value={String(people)}>
                  {fidelityMinimumLabel(people)}
                </option>
              ))}
          </Input>
          <span id={`${minimumId}-about`} hidden>
            {FIDELITY_MINIMUM_ABOUT}
          </span>
        </>
      ) : null}
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
