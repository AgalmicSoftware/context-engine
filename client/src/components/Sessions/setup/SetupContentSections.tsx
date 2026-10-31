import React, { useState } from 'react';
import { Input } from 'reactstrap';

import InterviewSettingsFields from '../InterviewSettingsFields';
import { SESSION_CONTEXT_LIMITS, isHttpsUrl, validateSessionContext } from '@ce-shared/sessionContext.mjs';
import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';
import {
  SESSION_COLOR_SCHEME_REGISTRY,
  normalizeSessionColorSchemeId,
} from '../../../utilities/ui/sessionColorSchemes';
import {
  DEFAULT_NEW_SESSION_GROUP_CREATION_POLICY,
  normalizeGroupCreationPolicy,
} from '../../../utilities/session/groupCreationPolicy';
import { SetupCheck, SetupField, SetupSection, setupHelpId } from './SetupPrimitives';
import {
  SETUP_QUESTION_TYPES,
  asList,
  asRecord,
  setupQuestionTypeLabel,
  setupQuestionUsesOptions,
  text,
  type SetupQuestion,
  type SetupSectionProps,
} from './setupSectionTypes';
import styles from './SessionSetup.module.scss';

type BasicsProps = Pick<SetupSectionProps, 'draft' | 'onChange'> & {
  /** The session link: a preview while creating, fixed once published. */
  link?: React.ReactNode;
  /** /new passes its header image control (paste, upload); otherwise a URL. */
  headerImage?: React.ReactNode;
};

export const SetupBasicsSection = ({ draft, onChange, link = null, headerImage = null }: BasicsProps) => (
  <SetupSection sectionKey="basics" title="Basics" alwaysOpen>
    <SetupField id="ce-setup-name" label="Name">
      <Input
        id="ce-setup-name"
        value={text(draft.sessionName)}
        required
        aria-required="true"
        autoComplete="off"
        data-testid={E2E_TESTIDS.WIZARD_SESSION_NAME}
        onChange={(event) => onChange(['sessionName'], event.target.value)}
      />
    </SetupField>
    {link}
    <SetupField id="ce-setup-description" label="Description" help="Shown on the session page and in link previews.">
      <Input
        id="ce-setup-description"
        type="textarea"
        className={styles.textarea}
        value={text(draft.sessionInfo)}
        aria-describedby={setupHelpId('ce-setup-description')}
        data-testid={E2E_TESTIDS.WIZARD_SESSION_INFO}
        onChange={(event) => onChange(['sessionInfo'], event.target.value)}
      />
    </SetupField>
    {headerImage || (
      <SetupField id="ce-setup-header-image" label="Header image" help="An https:// image link.">
        <Input
          id="ce-setup-header-image"
          type="url"
          value={text(draft.sessionHeader)}
          aria-describedby={setupHelpId('ce-setup-header-image')}
          data-testid={E2E_TESTIDS.WIZARD_SESSION_HEADER_URL}
          onChange={(event) => onChange(['sessionHeader'], event.target.value)}
        />
      </SetupField>
    )}
    <SetupField id="ce-setup-colors" label="Colors">
      <Input
        id="ce-setup-colors"
        type="select"
        value={normalizeSessionColorSchemeId(asRecord(draft.appearance).colorSchemeId)}
        data-testid={E2E_TESTIDS.WIZARD_SESSION_COLOR_SCHEME}
        onChange={(event) => onChange(['appearance'], { colorSchemeId: event.target.value })}
      >
        {SESSION_COLOR_SCHEME_REGISTRY.map(({ id, label }) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </Input>
    </SetupField>
  </SetupSection>
);

type ContextLink = { label: string; url: string };

const readContext = (draft: SetupSectionProps['draft']) => {
  const context = asRecord(draft.sessionContext);
  return {
    title: text(context.title),
    paragraphs: asList(context.paragraphs).map(text),
    links: asList(context.links).map((link) => ({ label: text(asRecord(link).label), url: text(asRecord(link).url) })),
  };
};

const LINK_URL_PATH = /^sessionContext\.links\.\d+\.url$/;

// The writer's problems with the draft's context, as Create and Save see them.
const contextProblems = (draft: SetupSectionProps['draft']) => {
  const result = validateSessionContext(readContext(draft));
  return result.ok ? [] : result.errors;
};

/** The first thing to fix in the context before Create, or ''. */
export const describeContextProblem = (draft: SetupSectionProps['draft']): string =>
  contextProblems(draft)[0]?.message || '';

export const summarizeContext = (draft: SetupSectionProps['draft']): string => {
  const { title, paragraphs, links } = readContext(draft);
  const parts = [
    paragraphs.length ? `${paragraphs.length} ${paragraphs.length === 1 ? 'paragraph' : 'paragraphs'}` : '',
    links.length ? `${links.length} ${links.length === 1 ? 'link' : 'links'}` : '',
  ].filter(Boolean);
  if (!parts.length) return 'No context yet';
  return title ? `${title}: ${parts.join(', ')}` : parts.join(', ');
};

type ContextProps = SetupSectionProps & {
  /** Files and private links: chosen for after Create on /new, managed live on the edit page. */
  sources?: React.ReactNode;
  /** After creation: what adds the chosen files and reads the links. */
  publisher?: React.ReactNode;
};

const CONTEXT_HELP =
  'Paragraphs and links show on the session page to everyone who can open it, and the session’s AI reads them. Files and admins-only links go below.';

// sessionContext's title, paragraphs and links, then the session's files and
// links for its AI. Without `sources`, file names from a template come back
// as a reminder to attach them again.
export const SetupContextSection = ({
  draft,
  onChange,
  open,
  onToggle,
  sources = null,
  publisher = null,
}: ContextProps) => {
  const context = readContext(draft);
  // A link's https problem shows beside the link itself.
  const problems = contextProblems(draft).filter((problem) => !LINK_URL_PATH.test(problem.path));
  const files = asList(draft.contextFiles)
    .map((file) => text(asRecord(file).name))
    .filter(Boolean);
  const save = (next: Partial<typeof context>) => onChange(['sessionContext'], { ...context, ...next });
  const setLink = (index: number, patch: Partial<ContextLink>) =>
    save({ links: context.links.map((link, at) => (at === index ? { ...link, ...patch } : link)) });
  return (
    <SetupSection
      sectionKey="context"
      title="Context"
      summary={summarizeContext(draft)}
      open={open}
      onToggle={onToggle}
      quick={publisher}
    >
      <SetupField id="ce-setup-context-heading" label="Title" help={CONTEXT_HELP}>
        <Input
          id="ce-setup-context-heading"
          value={context.title}
          maxLength={SESSION_CONTEXT_LIMITS.titleChars}
          aria-describedby={setupHelpId('ce-setup-context-heading')}
          onChange={(event) => save({ title: event.target.value })}
        />
      </SetupField>
      {context.paragraphs.map((paragraph, index) => (
        <SetupField
          key={`paragraph-${index}`}
          id={`ce-setup-context-paragraph-${index}`}
          label={`Paragraph ${index + 1}`}
        >
          <Input
            id={`ce-setup-context-paragraph-${index}`}
            type="textarea"
            className={styles.textarea}
            value={paragraph}
            maxLength={SESSION_CONTEXT_LIMITS.paragraphChars}
            onChange={(event) =>
              save({ paragraphs: context.paragraphs.map((entry, at) => (at === index ? event.target.value : entry)) })
            }
          />
          <div className={styles.buttonRow}>
            <button
              type="button"
              className={styles.button}
              onClick={() => save({ paragraphs: context.paragraphs.filter((_entry, at) => at !== index) })}
            >
              Remove paragraph
            </button>
          </div>
        </SetupField>
      ))}
      {context.links.map((link, index) => (
        <div key={`link-${index}`} className={styles.listRow}>
          <div className={styles.listRowBody}>
            <SetupField id={`ce-setup-context-link-label-${index}`} label="Link label">
              <Input
                id={`ce-setup-context-link-label-${index}`}
                value={link.label}
                maxLength={SESSION_CONTEXT_LIMITS.labelChars}
                onChange={(event) => setLink(index, { label: event.target.value })}
              />
            </SetupField>
            <SetupField id={`ce-setup-context-link-url-${index}`} label="Link">
              <Input
                id={`ce-setup-context-link-url-${index}`}
                type="url"
                value={link.url}
                maxLength={SESSION_CONTEXT_LIMITS.urlChars}
                invalid={!!link.url && !isHttpsUrl(link.url.trim())}
                onChange={(event) => setLink(index, { url: event.target.value })}
              />
            </SetupField>
            {link.url && !isHttpsUrl(link.url.trim()) ? (
              <p className={styles.errorText}>Use an https:// link.</p>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.button}
            aria-label={`Remove link ${index + 1}`}
            onClick={() => save({ links: context.links.filter((_entry, at) => at !== index) })}
          >
            Remove
          </button>
        </div>
      ))}
      <div className={styles.buttonRow}>
        <button
          type="button"
          className={styles.button}
          data-testid="ce-setup-context-add-paragraph"
          disabled={context.paragraphs.length >= SESSION_CONTEXT_LIMITS.paragraphs}
          onClick={() => save({ paragraphs: [...context.paragraphs, ''] })}
        >
          Add paragraph
        </button>
        <button
          type="button"
          className={styles.button}
          data-testid="ce-setup-context-add-link"
          disabled={context.links.length >= SESSION_CONTEXT_LIMITS.links}
          onClick={() => save({ links: [...context.links, { label: '', url: '' }] })}
        >
          Add link
        </button>
      </div>
      {problems.length ? (
        <ul className={styles.errorText} role="alert" data-testid="ce-setup-context-problems">
          {problems.map((problem) => (
            <li key={problem.path}>{problem.message}</li>
          ))}
        </ul>
      ) : null}
      {sources ? (
        <>
          <h3 className={styles.subheading}>Files and links for the AI</h3>
          {sources}
        </>
      ) : files.length ? (
        <p className={styles.hint} data-testid="ce-setup-context-files">
          Attach these files again after setup: {files.join(', ')}.
        </p>
      ) : null}
    </SetupSection>
  );
};

export const readSetupQuestions = (draft: SetupSectionProps['draft']): SetupQuestion[] =>
  asList(draft.questions).map((value) => {
    const question = asRecord(value);
    return { ...question, prompt: text(question.prompt), type: text(question.type) || 'binary' } as SetupQuestion;
  });

const splitOptions = (value: string): string[] =>
  value
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);

type QuestionsProps = SetupSectionProps & {
  /** After creation: what adds the questions to the session. */
  publisher?: React.ReactNode;
};

// Questions travel with a template. They're added to the session once it
// exists, as the question editor adds them, so a draft only lists them.
export const SetupQuestionsSection = ({ draft, onChange, open, onToggle, publisher = null }: QuestionsProps) => {
  const questions = readSetupQuestions(draft);
  const [newType, setNewType] = useState('binary');
  const [newPrompt, setNewPrompt] = useState('');
  const [newOptions, setNewOptions] = useState('');
  const save = (next: SetupQuestion[]) => onChange(['questions'], next);
  const update = (index: number, patch: Partial<SetupQuestion>) =>
    save(questions.map((question, at) => (at === index ? { ...question, ...patch } : question)));
  const canAdd = !!newPrompt.trim() && (!setupQuestionUsesOptions(newType) || splitOptions(newOptions).length >= 2);
  const add = () => {
    if (!canAdd) return;
    const question: SetupQuestion = { prompt: newPrompt.trim(), type: newType, tags: [] };
    if (setupQuestionUsesOptions(newType)) question.options = splitOptions(newOptions);
    save([...questions, question]);
    setNewPrompt('');
    setNewOptions('');
  };
  return (
    <SetupSection
      sectionKey="questions"
      title="Questions"
      summary={
        questions.length
          ? `${questions.length} ${questions.length === 1 ? 'question' : 'questions'}`
          : 'No questions yet'
      }
      open={open}
      onToggle={onToggle}
      quick={publisher}
    >
      {questions.map((question, index) => (
        <div key={`question-${index}`} className={styles.listRow} data-testid="ce-setup-question">
          <div className={styles.listRowBody}>
            <span className={styles.questionType}>{setupQuestionTypeLabel(question.type)}</span>
            <Input
              type="textarea"
              aria-label={`Question ${index + 1}`}
              value={question.prompt}
              onChange={(event) => update(index, { prompt: event.target.value })}
            />
            {setupQuestionUsesOptions(question.type) ? (
              <Input
                type="textarea"
                aria-label={`Question ${index + 1} options, one per line`}
                value={(question.options || []).join('\n')}
                onChange={(event) => update(index, { options: event.target.value.split('\n') })}
                onBlur={(event) => update(index, { options: splitOptions(event.target.value) })}
              />
            ) : null}
            {question.scale ? (
              <p className={styles.hint}>
                Scale {question.scale.min} ({question.scale.minLabel}) to {question.scale.max} (
                {question.scale.maxLabel})
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.button}
            aria-label={`Remove question ${index + 1}`}
            onClick={() => save(questions.filter((_entry, at) => at !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      <SetupField id="ce-setup-question-type" label="New question type">
        <Input
          id="ce-setup-question-type"
          type="select"
          value={newType}
          onChange={(event) => setNewType(event.target.value)}
        >
          {SETUP_QUESTION_TYPES.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </Input>
      </SetupField>
      <SetupField id="ce-setup-question-prompt" label="New question">
        <Input
          id="ce-setup-question-prompt"
          type="textarea"
          value={newPrompt}
          data-testid="ce-setup-question-prompt"
          onChange={(event) => setNewPrompt(event.target.value)}
        />
      </SetupField>
      {setupQuestionUsesOptions(newType) ? (
        <SetupField id="ce-setup-question-options" label="Options, one per line">
          <Input
            id="ce-setup-question-options"
            type="textarea"
            value={newOptions}
            onChange={(event) => setNewOptions(event.target.value)}
          />
        </SetupField>
      ) : null}
      <div className={styles.buttonRow}>
        <button
          type="button"
          className={styles.button}
          disabled={!canAdd}
          data-testid="ce-setup-question-add"
          onClick={add}
        >
          Add question
        </button>
      </div>
    </SetupSection>
  );
};

const toLocalDateTime = (value: unknown): string => {
  const raw = text(value).trim();
  const parsed = raw ? new Date(raw) : null;
  return parsed && Number.isFinite(parsed.getTime())
    ? new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
    : raw;
};

export const summarizeParticipation = (draft: SetupSectionProps['draft']): string => {
  const interview = draft.interviewModeEnabled !== false;
  const groups =
    normalizeGroupCreationPolicy(draft.groupCreationPolicy, DEFAULT_NEW_SESSION_GROUP_CREATION_POLICY) === 'admin_only'
      ? 'admins create groups'
      : 'anyone creates groups';
  const endsAt = text(draft.sessionEndsAt).trim();
  const ends = endsAt && Number.isFinite(new Date(endsAt).getTime()) ? `ends ${new Date(endsAt).toLocaleString()}` : '';
  return [interview ? 'Voice interviews and AI prefill on' : 'Voice interviews off', groups, ends]
    .filter(Boolean)
    .join(' · ');
};

type ParticipationProps = SetupSectionProps & {
  /** End times apply only to Worker-hosted sessions. */
  supportsEndTime: boolean;
};

export const SetupParticipationSection = ({ draft, onChange, open, onToggle, supportsEndTime }: ParticipationProps) => (
  <SetupSection
    sectionKey="participation"
    title="Participation"
    summary={summarizeParticipation(draft)}
    open={open}
    onToggle={onToggle}
  >
    <SetupCheck
      id="ce-setup-interviews"
      label="Voice interviews and AI prefill"
      help="People can answer by voice interview, record a group conversation, or prefill answers with their own AI. Voice uses OpenAI."
      checked={draft.interviewModeEnabled !== false}
      testId="ce-setup-interviews"
      onChange={(checked) => onChange(['interviewModeEnabled'], checked)}
    />
    {draft.interviewModeEnabled !== false ? (
      <InterviewSettingsFields
        value={draft.interviewMode}
        onChange={(value) => onChange(['interviewMode'], value)}
        onTurnOnInterviews={() => onChange(['interviewModeEnabled'], true)}
      />
    ) : null}
    <SetupField id="ce-setup-group-creation" label="Who can create groups">
      <Input
        id="ce-setup-group-creation"
        type="select"
        value={normalizeGroupCreationPolicy(draft.groupCreationPolicy, DEFAULT_NEW_SESSION_GROUP_CREATION_POLICY)}
        data-testid={E2E_TESTIDS.WIZARD_GROUP_CREATION_POLICY}
        onChange={(event) => onChange(['groupCreationPolicy'], event.target.value)}
      >
        <option value="participants">Anyone in the session</option>
        <option value="admin_only">Admins only</option>
      </Input>
    </SetupField>
    <SetupField
      id="ce-setup-group-tags"
      label="Group tags"
      help="Suggested when someone creates a group. Separate with commas."
    >
      <Input
        id="ce-setup-group-tags"
        value={text(draft.defaultGroupTags)}
        aria-describedby={setupHelpId('ce-setup-group-tags')}
        onChange={(event) => onChange(['defaultGroupTags'], event.target.value)}
      />
    </SetupField>
    {supportsEndTime ? (
      <SetupField
        id="ce-setup-ends-at"
        label="End time"
        help="Optional. Answers and group changes stop at this time; results stay readable."
      >
        <Input
          id="ce-setup-ends-at"
          type="datetime-local"
          value={toLocalDateTime(draft.sessionEndsAt)}
          aria-describedby={setupHelpId('ce-setup-ends-at')}
          data-testid={E2E_TESTIDS.WIZARD_SESSION_ENDS_AT}
          onChange={(event) => onChange(['sessionEndsAt'], event.target.value)}
        />
      </SetupField>
    ) : null}
  </SetupSection>
);
