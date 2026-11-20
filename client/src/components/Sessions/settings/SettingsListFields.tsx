import { Input } from 'reactstrap';

import { CONTEXT_CARDS_HELP } from '../setup/ContextSourcesPanel';
import { SetupCheck, SetupField, setupHelpId } from '../setup/SetupPrimitives';
import { asRecord, text, type SetupDraft } from '../setup/setupSectionTypes';
import styles from '../setup/SessionSetup.module.scss';

type FieldsProps = {
  draft: SetupDraft;
  onChange: (path: string[], value: unknown) => void;
};

const ListField = ({
  draft,
  onChange,
  listKey,
  label,
  help,
  readOnly = false,
}: FieldsProps & { listKey: string; label: string; help: string; readOnly?: boolean }) => {
  const id = `ce-settings-list-${listKey}`;
  return (
    <SetupField id={id} label={label} help={help}>
      <Input
        id={id}
        type="textarea"
        rows={3}
        value={text(asRecord(draft.lists)[listKey])}
        readOnly={readOnly}
        aria-describedby={setupHelpId(id)}
        data-testid={id}
        onChange={(event) => onChange(['lists', listKey], event.target.value)}
      />
    </SetupField>
  );
};

// How the question list opens and which questions and surveys it highlights
// or hides. Lists take one ID per line.
export const SettingsQuestionListFields = ({
  draft,
  onChange,
  listsLockedReason = '',
}: FieldsProps & {
  /** Why the ID lists are read-only here, or '' when they can be edited. */
  listsLockedReason?: string;
}) => (
  <>
    <h3 className={styles.subheading}>Question list</h3>
    <SetupCheck
      id="ce-settings-pile-auto-advance"
      label="Next question after an answer"
      help="After an agree, unsure or disagree answer, the question pile moves on by itself."
      checked={draft.pileAutoAdvanceEnabled === true}
      testId="ce-settings-pile-auto-advance"
      onChange={(checked) => onChange(['pileAutoAdvanceEnabled'], checked)}
    />
    <SetupField
      id="ce-settings-default-filters"
      label="Default filters"
      help='What the question list starts filtered by: a JSON object such as {"selectedTags":["housing"]}, or a query such as tag=housing&sort=importance.'
    >
      <Input
        id="ce-settings-default-filters"
        type="textarea"
        rows={3}
        value={text(draft.defaultFilterState)}
        aria-describedby={setupHelpId('ce-settings-default-filters')}
        data-testid="ce-settings-default-filters"
        onChange={(event) => onChange(['defaultFilterState'], event.target.value)}
      />
    </SetupField>
    {listsLockedReason ? (
      <p className={styles.hint} data-testid="ce-settings-lists-locked">
        {listsLockedReason}
      </p>
    ) : null}
    <ListField
      draft={draft}
      onChange={onChange}
      listKey="HIGHLIGHTED_QUESTION_IDS"
      label="Highlighted questions"
      help="Question IDs shown first, one per line."
      readOnly={!!listsLockedReason}
    />
    <ListField
      draft={draft}
      onChange={onChange}
      listKey="BLOCKED_QUESTION_IDS"
      label="Hidden questions"
      help="Question IDs left out of the question list, Results and exports, one per line."
      readOnly={!!listsLockedReason}
    />
    <ListField
      draft={draft}
      onChange={onChange}
      listKey="HIGHLIGHTED_SURVEY_IDS"
      label="Highlighted surveys"
      help="Survey IDs shown first, one per line."
      readOnly={!!listsLockedReason}
    />
    <ListField
      draft={draft}
      onChange={onChange}
      listKey="BLOCKED_SURVEY_IDS"
      label="Hidden surveys"
      help="Survey IDs participants don’t see, one per line."
      readOnly={!!listsLockedReason}
    />
  </>
);

// Defaults for sessions where SBTs grant access. The SBT lists exist only in
// on-chain sessions' metadata.
export const SettingsSbtFields = ({ draft, onChange, onChain }: FieldsProps & { onChain: boolean }) => (
  <>
    <h3 className={styles.subheading}>SBTs</h3>
    <SetupField id="ce-settings-sbt-tags" label="SBT tags" help="Suggested tags for new SBTs. Separate with commas.">
      <Input
        id="ce-settings-sbt-tags"
        value={text(draft.defaultSbtTags)}
        aria-describedby={setupHelpId('ce-settings-sbt-tags')}
        data-testid="ce-settings-sbt-tags"
        onChange={(event) => onChange(['defaultSbtTags'], event.target.value)}
      />
    </SetupField>
    <ListField
      draft={draft}
      onChange={onChange}
      listKey="defaultFeaturedSBTs"
      label="Featured SBTs"
      help="SBT contract addresses featured in this session, one per line."
    />
    <SetupCheck
      id="ce-settings-sbt-auto-feature"
      label="Feature this session’s SBTs"
      help="SBTs made for this session are featured without being listed above."
      checked={draft.autoFeatureSBTsBySessionSlug !== false}
      testId="ce-settings-sbt-auto-feature"
      onChange={(checked) => onChange(['autoFeatureSBTsBySessionSlug'], checked)}
    />
    {onChain ? (
      <>
        <ListField
          draft={draft}
          onChange={onChange}
          listKey="featured_SBTs_LIST"
          label="SBT list: featured"
          help="SBT addresses shown first in the session’s SBT lists, one per line."
        />
        <ListField
          draft={draft}
          onChange={onChange}
          listKey="ignored_SBTs_LIST"
          label="SBT list: ignored"
          help="SBT addresses left out of the session’s SBT lists, one per line."
        />
      </>
    ) : null}
  </>
);

// Whether the session's AI writes a card for each context source, the session takes images, and the AI reads a PDF or image for whoever adds it.
export const SettingsContextCardsField = ({ draft, onChange }: FieldsProps) => (
  <SetupCheck
    id="ce-settings-context-cards"
    label="Context cards"
    help={CONTEXT_CARDS_HELP}
    checked={draft.contextCardsEnabled === true}
    testId="ce-settings-context-cards"
    onChange={(checked) => onChange(['contextCardsEnabled'], checked)}
  />
);

// Whether AI agents may take part with accounts of their own, as through the MCP.
export const SettingsAgentParticipationField = ({ draft, onChange }: FieldsProps) => (
  <SetupCheck
    id="ce-settings-agent-participation"
    label="AI agents can take part"
    help="Lets AI agents join with accounts of their own, as through the Context Engine MCP, and lets a person open their agent’s account from a link the agent makes. Turned off, the session refuses sign-ins and answers that say they come from an agent, and makes no such links; nobody is signed out. It binds agents that say what they are: a program that presents itself as a browser can’t be told from a person."
    checked={draft.agentParticipationEnabled !== false}
    testId="ce-settings-agent-participation"
    onChange={(checked) => onChange(['agentParticipationEnabled'], checked)}
  />
);

// Whether the session page offers its Feedback button, for feedback about the app itself.
export const SettingsFeedbackField = ({ draft, onChange }: FieldsProps) => (
  <SetupCheck
    id="ce-settings-feedback-enabled"
    label="Feedback box"
    help="Shows a Feedback button in the session page’s footer, where anyone can say what worked in the app and what didn’t. Messages come to this session’s admins, here, and aren’t part of anyone’s answers."
    checked={draft.feedbackEnabled !== false}
    testId="ce-settings-feedback-enabled"
    onChange={(checked) => onChange(['feedbackEnabled'], checked)}
  />
);
