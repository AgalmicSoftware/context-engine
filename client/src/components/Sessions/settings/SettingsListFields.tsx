import React from 'react';
import { Input } from 'reactstrap';

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
}: FieldsProps & { listKey: string; label: string; help: string }) => {
  const id = `ce-settings-list-${listKey}`;
  return (
    <SetupField id={id} label={label} help={help}>
      <Input
        id={id}
        type="textarea"
        rows={3}
        value={text(asRecord(draft.lists)[listKey])}
        aria-describedby={setupHelpId(id)}
        data-testid={id}
        onChange={(event) => onChange(['lists', listKey], event.target.value)}
      />
    </SetupField>
  );
};

// How the question list opens and which questions and surveys it highlights
// or hides. Lists take one ID per line.
export const SettingsQuestionListFields = ({ draft, onChange }: FieldsProps) => (
  <>
    <h3 className={styles.subheading}>Question list</h3>
    <SetupCheck
      id="ce-settings-pile-auto-advance"
      label="Next question after an answer"
      help="After someone answers, the question pile moves on by itself."
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
    <ListField
      draft={draft}
      onChange={onChange}
      listKey="HIGHLIGHTED_QUESTION_IDS"
      label="Highlighted questions"
      help="Question IDs shown first, one per line."
    />
    <ListField
      draft={draft}
      onChange={onChange}
      listKey="BLOCKED_QUESTION_IDS"
      label="Hidden questions"
      help="Question IDs participants don’t see, one per line."
    />
    <ListField
      draft={draft}
      onChange={onChange}
      listKey="HIGHLIGHTED_SURVEY_IDS"
      label="Highlighted surveys"
      help="Survey IDs shown first, one per line."
    />
    <ListField
      draft={draft}
      onChange={onChange}
      listKey="BLOCKED_SURVEY_IDS"
      label="Hidden surveys"
      help="Survey IDs participants don’t see, one per line."
    />
  </>
);

// Defaults for sessions where SBTs grant access.
export const SettingsSbtFields = ({ draft, onChange }: FieldsProps) => (
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
  </>
);
