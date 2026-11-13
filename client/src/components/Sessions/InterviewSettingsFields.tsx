import React, { useContext, useId } from 'react';
import { ReactReduxContext } from 'react-redux';
import { getSessionWizardInterviewValidationError } from './sessionWizardInterviewValidation';
import useSessionWizardTooltipPreference from './hooks/useSessionWizardTooltipPreference';
import SessionWizardInfoTooltip from './SessionWizardInfoTooltip';
import { Input, Label } from 'reactstrap';
import {
  DEFAULT_INTERVIEW_SETTINGS,
  MAX_RECORDING_QUESTION_COUNT,
  normalizeInterviewSettings,
  type GroupSuggestionDataKind,
} from '../../../../shared/interviewSettings.mjs';
import { DEFAULT_REALTIME_INTERVIEW_MODEL } from '../../utilities/audio/realtimeInterviewConfig';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { SetupHelp, setupHelpId } from './setup/SetupPrimitives';

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

const JOIN_GROUPS_ABOUT =
  'After an AI prefill or voice interview, the AI suggests the session’s open groups that fit each participant’s answers, under their drafts. They tick any they want, and submitting joins them. Their own AI can suggest groups too. Off, no groups are matched.';
// What an AI may base those suggestions on, in the setting's order.
const GROUP_DATA_LABELS: Record<GroupSuggestionDataKind, string> = {
  country: 'Country',
  town: 'Town or city',
  work: 'Work',
  interests: 'Interests and causes',
};
const GROUP_DATA_KINDS = Object.keys(GROUP_DATA_LABELS) as GroupSuggestionDataKind[];
const GROUP_DATA_ABOUT =
  'What the session’s AI and each participant’s own AI may go on when suggesting groups; with none ticked, neither suggests any. Town or city means anywhere smaller than a country. Every AI is instructed never to go on health, disability, religion, ethnicity, sexuality, gender identity, age, family life, or party or union membership. Groups named like an answer someone chose are suggested either way.';

// The smallest group "How well AIs predicted people" reports on; 1 shows every figure.
const FIDELITY_MINIMUMS = [1, 3, 5, 10];
const fidelityMinimumLabel = (people: number) => (people === 1 ? 'Off: show every result' : `${people} people`);
const FIDELITY_MINIMUM_ABOUT =
  'That Results section hides any figure based on fewer people than this, so no one’s AI score can be singled out. Turn it off only where everyone knows small groups’ figures are visible.';

const RESEARCH_SHARING_HELP =
  'Whether the box that shares someone’s AI draft changes for research starts ticked on new answers. Each person can change it before submitting, and choices already saved stay as they are.';
const RESEARCH_DETAIL_HELP =
  'What a shared draft comparison saves. Minimal keeps none of the AI’s notes or drafted text, which suits public sessions; Full also keeps them and drafts for skipped questions.';
const DRAFT_TEXT_HELP =
  'People who share for research can also let this session’s config admins read the AI’s drafted answers and comments; nobody else can, and no AI feature or Results uses it. Each person can turn it off. Turning this off stops collecting; text already kept stays until each person withdraws it. Session backups leave it out, so download it from Admin before deleting the session or restoring it from a backup.';
const HIDDEN_DRAFTS_HELP =
  'Hides this share of each participant’s AI prefill drafts until they answer, to measure how much seeing a draft sways answers. Only for participants sharing draft changes for research.';
const VOICE_MODEL_HELP = `The OpenAI live model that holds voice interviews. Keep ${DEFAULT_REALTIME_INTERVIEW_MODEL} unless you need another; the session’s OpenAI key must have access to it.`;
const OPENING_HELP =
  'How each voice interview starts. Generate: the AI writes an opening from the session’s information and questions once there are questions it can use, and reuses it until it is regenerated. Owner-written: every interview opens with your question.';
const OWNER_OPENING_HELP = 'The question every voice interview opens with, up to 1,200 characters.';
const STEERING_HELP =
  'Extra instructions for the AI interviewer, such as what to explore or how to speak, up to 3,000 characters. They are saved in the session’s public settings, so anyone can read them.';
const RECORDING_QUESTIONS_HELP =
  'The most draft questions the AI writes from a group recording, and when. It writes only questions the discussion clearly supports and the session doesn’t already ask, so fewer or none is normal. Once, at the end: when the recording stops; recording more afterwards can add one more. After each part: every three minutes, from the conversation so far. Changing it needs a Session Worker from 0.9.6 on.';
const GROWTH_HELP =
  'How many questions must be added, as a share of those there were, counted since the last opening or interview update and rounded up; at 20%, 42 questions need nine more.';

// The plain switches, in their order on the page.
const SWITCHES = {
  autoRegenerate: {
    label: 'Regenerate opening when the question bank grows',
    help: 'Once enough questions have been added, by the threshold below, the next interview gets a newly written opening. Off while the opening is owner-written.',
  },
  followNewQuestions: {
    label: 'Check for new session questions during interviews',
    help: 'While someone records, the interviewer checks the session’s public questions every 30 seconds and brings in new ones.',
  },
  suggestQuestions: {
    label: 'Suggest new question drafts from interview evidence',
    help: 'When someone’s answers are drafted from their interview, the AI also drafts up to three new questions from what they said. They review them, and only people allowed to add questions can.',
  },
  allowManualRefresh: {
    label: 'Allow admins to regenerate the opening',
    help: 'Admins get Regenerate interview opening, which writes a new generated opening when they choose.',
  },
  showFidelityScore: {
    label: 'Show participants how well their AI predicted them',
    help: 'After someone submits AI prefill drafts, they see privately how closely their AI predicted their answers.',
  },
} as const;
const FIDELITY_RESULTS_LABEL = 'Show “How well AIs predicted people” in Results';
const FIDELITY_RESULTS_HELP =
  'Adds How well AIs predicted people to Results, once AI prefill drafts come from at least the smallest group set below.';

const ROW = { display: 'flex', alignItems: 'center', gap: 8 } as const;

type HelpFieldProps = { htmlFor: string; label: string; help: string; children: React.ReactNode };

// A label and its "?" above the control, which names setupHelpId(htmlFor) in aria-describedby.
const HelpField = ({ htmlFor, label, help, children }: HelpFieldProps) => (
  <div>
    <div style={{ ...ROW, marginBottom: '0.5rem' }}>
      <Label for={htmlFor} style={{ marginBottom: 0 }}>
        {label}
      </Label>
      <SetupHelp id={htmlFor} label={label} help={help} />
    </div>
    {children}
  </div>
);

type Props = {
  value: unknown;
  onChange: (value: Record<string, unknown>) => void;
  disabled?: boolean;
  // Where voice interviews can be off while these settings show, as in /admin, this turns them on.
  onTurnOnInterviews?: () => void;
  // Why AI draft text can't be kept for admins here (an older Worker, or no Session Worker); empty when it can.
  draftTextUnavailable?: string;
};
export const DRAFT_TEXT_NEEDS_WORKER = 'Needs a session hosted on a Session Worker.';
export const DRAFT_TEXT_NEEDS_NEWER_WORKER = 'Needs a newer Session Worker (0.9.6 or later).';
export default function InterviewSettingsFields({
  value,
  onChange,
  disabled = false,
  onTurnOnInterviews,
  draftTextUnavailable = '',
}: Props) {
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
  const joinGroupsId = `${fidelityId}-join-groups`;
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
      <HelpField
        htmlFor={`${id}-research-sharing`}
        label="Share AI draft changes for research by default"
        help={RESEARCH_SHARING_HELP}
      >
        <Input
          id={`${id}-research-sharing`}
          type="select"
          value={String(settings.shareDraftChangesByDefault)}
          onChange={(e) => change('shareDraftChangesByDefault', e.target.value === 'true')}
          aria-describedby={setupHelpId(`${id}-research-sharing`)}
        >
          <option value="false">Off</option>
          <option value="true">On</option>
        </Input>
      </HelpField>
      <HelpField htmlFor={`${id}-research-detail`} label="AI draft research detail" help={RESEARCH_DETAIL_HELP}>
        <Input
          id={`${id}-research-detail`}
          type="select"
          value={settings.researchDetail}
          onChange={(e) => change('researchDetail', e.target.value === 'full' ? 'full' : 'minimal')}
          aria-describedby={setupHelpId(`${id}-research-detail`)}
        >
          <option value="minimal">Minimal: predicted answers, confidence and changes</option>
          <option value="full">Full: also the AI&apos;s notes, drafted text and drafts for skipped questions</option>
        </Input>
      </HelpField>
      {settings.researchDetail === 'minimal' ? (
        <HelpField htmlFor={`${id}-draft-text`} label="Keep AI draft text for admins" help={DRAFT_TEXT_HELP}>
          <Input
            id={`${id}-draft-text`}
            type="select"
            value={String(settings.keepDraftTextForAdmins)}
            // Where it can't be stored, turning it off stays possible.
            disabled={!!draftTextUnavailable && !settings.keepDraftTextForAdmins}
            onChange={(e) => change('keepDraftTextForAdmins', e.target.value === 'true')}
            aria-describedby={setupHelpId(`${id}-draft-text`)}
          >
            <option value="false">Off</option>
            <option value="true">On</option>
          </Input>
          {draftTextUnavailable ? <div>{draftTextUnavailable}</div> : null}
        </HelpField>
      ) : null}
      <HelpField htmlFor={`${id}-hidden-drafts`} label="Hidden AI drafts" help={HIDDEN_DRAFTS_HELP}>
        <Input
          id={`${id}-hidden-drafts`}
          type="select"
          value={String(settings.hiddenDraftShare)}
          onChange={(e) => change('hiddenDraftShare', Number(e.target.value))}
          aria-describedby={setupHelpId(`${id}-hidden-drafts`)}
        >
          {[...new Set([...HIDDEN_DRAFT_SHARES, settings.hiddenDraftShare])].map((share) => (
            <option key={share} value={String(share)}>
              {hiddenDraftShareLabel(share)}
            </option>
          ))}
        </Input>
      </HelpField>
      <HelpField htmlFor={`${id}-model`} label="Interview voice model" help={VOICE_MODEL_HELP}>
        <Input
          id={`${id}-model`}
          data-testid={E2E_TESTIDS.WIZARD_INTERVIEW_REALTIME_MODEL}
          value={String(raw.realtimeModel || DEFAULT_REALTIME_INTERVIEW_MODEL)}
          aria-describedby={setupHelpId(`${id}-model`)}
          onChange={(e) => change('realtimeModel', e.target.value)}
        />
      </HelpField>
      <HelpField htmlFor={`${id}-mode`} label="Opening question" help={OPENING_HELP}>
        <Input
          id={`${id}-mode`}
          type="select"
          value={settings.openingMode}
          aria-describedby={setupHelpId(`${id}-mode`)}
          onChange={(e) => change('openingMode', e.target.value)}
        >
          <option value="auto">Generate from session information and questions</option>
          <option value="owner">Use an owner-written opening</option>
        </Input>
      </HelpField>
      {settings.openingMode === 'owner' ? (
        <>
          <HelpField htmlFor={`${id}-prompt`} label="Owner opening question" help={OWNER_OPENING_HELP}>
            <Input
              id={`${id}-prompt`}
              type="textarea"
              maxLength={1200}
              required
              invalid={!!validationError}
              aria-describedby={[setupHelpId(`${id}-prompt`), validationError ? `${id}-error` : '']
                .filter(Boolean)
                .join(' ')}
              value={settings.openingPrompt}
              onChange={(e) => change('openingPrompt', e.target.value)}
            />
          </HelpField>
        </>
      ) : null}
      {validationError ? (
        <p id={`${id}-error`} role="alert">
          {validationError}
        </p>
      ) : null}
      <HelpField htmlFor={`${id}-steering`} label="Interview steering prompt" help={STEERING_HELP}>
        <Input
          id={`${id}-steering`}
          type="textarea"
          maxLength={3000}
          value={settings.steeringPrompt}
          aria-describedby={setupHelpId(`${id}-steering`)}
          onChange={(e) => change('steeringPrompt', e.target.value)}
        />
      </HelpField>
      <HelpField htmlFor={`${id}-recording-count`} label="Group recording questions" help={RECORDING_QUESTIONS_HELP}>
        {/* How many and when are one setting, under one "?". */}
        <div role="group" aria-label="Group recording questions" style={ROW}>
          <Input
            id={`${id}-recording-count`}
            type="select"
            style={{ width: 'auto' }}
            value={String(settings.recordingQuestionCount)}
            aria-describedby={setupHelpId(`${id}-recording-count`)}
            onChange={(e) => change('recordingQuestionCount', Number(e.target.value))}
          >
            {Array.from({ length: MAX_RECORDING_QUESTION_COUNT }, (_, index) => (
              <option key={index} value={String(index + 1)}>
                up to {index + 1}
              </option>
            ))}
          </Input>
          <Input
            type="select"
            style={{ width: 'auto' }}
            aria-label="When group recording questions are written"
            value={settings.recordingQuestionTiming}
            onChange={(e) => change('recordingQuestionTiming', e.target.value === 'end' ? 'end' : 'chunk')}
          >
            <option value="end">once, at the end</option>
            <option value="chunk">after each part</option>
          </Input>
        </div>
      </HelpField>
      {(
        [
          'autoRegenerate',
          'followNewQuestions',
          'suggestQuestions',
          'joinMatchingGroups',
          'allowManualRefresh',
          'showFidelityScore',
        ] as const
      ).map((key) =>
        key === 'joinMatchingGroups' ? (
          <div key={key} style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Label style={{ marginBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={settings.joinMatchingGroups}
                  aria-describedby={`${joinGroupsId}-about`}
                  onChange={(e) => change(key, e.target.checked)}
                />{' '}
                Suggest groups to join
              </Label>
              <SessionWizardInfoTooltip
                enabled={tooltipsEnabled}
                id={`${joinGroupsId}-help`}
                content={JOIN_GROUPS_ABOUT}
                placement="top"
                ariaLabel="About suggesting groups to join"
              />
              <span id={`${joinGroupsId}-about`} hidden>
                {JOIN_GROUPS_ABOUT}
              </span>
            </div>
            {settings.joinMatchingGroups ? (
              <div
                role="group"
                aria-labelledby={`${joinGroupsId}-data`}
                aria-describedby={`${joinGroupsId}-data-about`}
                style={{ marginLeft: 24, marginTop: 4 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span id={`${joinGroupsId}-data`}>The AI may use</span>
                  <SessionWizardInfoTooltip
                    enabled={tooltipsEnabled}
                    id={`${joinGroupsId}-data-help`}
                    content={GROUP_DATA_ABOUT}
                    placement="top"
                    ariaLabel="About what the AI may use"
                  />
                  <span id={`${joinGroupsId}-data-about`} hidden>
                    {GROUP_DATA_ABOUT}
                  </span>
                </div>
                {GROUP_DATA_KINDS.map((kind) => (
                  <Label key={kind} style={{ display: 'block', marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      checked={settings.groupSuggestionData.includes(kind)}
                      onChange={(e) =>
                        change(
                          'groupSuggestionData',
                          GROUP_DATA_KINDS.filter((each) =>
                            each === kind ? e.target.checked : settings.groupSuggestionData.includes(each),
                          ),
                        )
                      }
                    />{' '}
                    {GROUP_DATA_LABELS[kind]}
                  </Label>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div key={key} style={{ ...ROW, marginTop: 12 }}>
            <Label style={{ marginBottom: 0 }}>
              <input
                type="checkbox"
                checked={settings[key]}
                aria-describedby={setupHelpId(`${id}-${key}`)}
                onChange={(e) => change(key, e.target.checked)}
                disabled={key === 'autoRegenerate' && settings.openingMode === 'owner'}
              />{' '}
              {SWITCHES[key].label}
            </Label>
            <SetupHelp id={`${id}-${key}`} label={SWITCHES[key].label} help={SWITCHES[key].help} />
          </div>
        ),
      )}
      <div style={{ ...ROW, marginTop: 12 }}>
        <Label style={{ marginBottom: 0 }}>
          <input
            type="checkbox"
            checked={settings.showFidelityResults}
            aria-describedby={setupHelpId(`${id}-fidelity-results`)}
            data-testid={E2E_TESTIDS.WIZARD_INTERVIEW_FIDELITY_RESULTS}
            // Turning it off also resets the minimum it hides, so no unseen setting is saved.
            onChange={(e) =>
              onChange({
                ...raw,
                ...settings,
                showFidelityResults: e.target.checked,
                ...(e.target.checked
                  ? {}
                  : { fidelityMinimumPeople: DEFAULT_INTERVIEW_SETTINGS.fidelityMinimumPeople }),
              })
            }
          />{' '}
          {FIDELITY_RESULTS_LABEL}
        </Label>
        <SetupHelp id={`${id}-fidelity-results`} label={FIDELITY_RESULTS_LABEL} help={FIDELITY_RESULTS_HELP} />
      </div>
      {settings.showFidelityResults ? (
        <div>
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
        </div>
      ) : null}
      {(settings.autoRegenerate || settings.followNewQuestions) && (
        <>
          <HelpField htmlFor={`${id}-growth`} label="Question growth threshold (%)" help={GROWTH_HELP}>
            <Input
              id={`${id}-growth`}
              type="number"
              min={1}
              max={100}
              value={settings.questionGrowthPercent}
              aria-describedby={setupHelpId(`${id}-growth`)}
              onChange={(e) => change('questionGrowthPercent', Number(e.target.value))}
            />
          </HelpField>
        </>
      )}
    </fieldset>
  );
}
