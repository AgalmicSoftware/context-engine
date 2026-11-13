import React, { useState } from 'react';
import { Input } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';

import InterviewSettingsFields, {
  DRAFT_TEXT_NEEDS_NEWER_WORKER,
  DRAFT_TEXT_NEEDS_WORKER,
} from '../InterviewSettingsFields';
import { SESSION_CONTEXT_LIMITS, isHttpsUrl, validateSessionContext } from '@ce-shared/sessionContext.mjs';
import { WORKER_GROUP_MEMBER_CEILING_DEFAULT, WORKER_GROUP_MEMBER_CEILING_MAX } from '@ce-shared/workerGroupJoin.mjs';
import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';
import {
  DEFAULT_SESSION_COLOR_SCHEME_ID,
  SESSION_COLOR_SCHEME_REGISTRY,
  normalizeSessionColorSchemeId,
} from '../../../utilities/ui/sessionColorSchemes';
import {
  DEFAULT_NEW_SESSION_GROUP_CREATION_POLICY,
  normalizeGroupCreationPolicy,
} from '../../../utilities/session/groupCreationPolicy';
import { SetupCheck, SetupField, SetupSection, setupHelpId } from './SetupPrimitives';
import SetupContextHtmlField from './SetupContextHtmlField';
import SetupAgentInstructionsField from './SetupAgentInstructionsField';
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
  /** /new: the Centralized or Decentralized toggle, first on the page. */
  runsOn?: React.ReactNode;
  /** The session link: a preview while creating, fixed once published. */
  link?: React.ReactNode;
  /** /new passes its header image control (paste, upload); otherwise a URL. */
  headerImage?: React.ReactNode;
};

const NAME_HELP =
  'The session’s title on its page and in lists of sessions. Until the session is created, its link is made from the name.';
const COLORS_HELP =
  'Accent colours on this session’s pages, the same for everyone who opens it. Each person’s site theme stays as they set it.';

export const SetupBasicsSection = ({
  draft,
  onChange,
  runsOn = null,
  link = null,
  headerImage = null,
}: BasicsProps) => {
  const colorSchemeId = normalizeSessionColorSchemeId(asRecord(draft.appearance).colorSchemeId);
  // Starts open when the session already has colours of its own.
  const [appearanceOpen, setAppearanceOpen] = useState(colorSchemeId !== DEFAULT_SESSION_COLOR_SCHEME_ID);
  return (
    <SetupSection sectionKey="basics" title="Basics" alwaysOpen>
      {runsOn}
      <SetupField id="ce-setup-name" label="Name" help={NAME_HELP}>
        <Input
          id="ce-setup-name"
          value={text(draft.sessionName)}
          required
          aria-required="true"
          autoComplete="off"
          aria-describedby={setupHelpId('ce-setup-name')}
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
      <div>
        <button
          type="button"
          className={styles.moreButton}
          aria-expanded={appearanceOpen}
          aria-controls="ce-setup-appearance"
          data-testid="ce-setup-appearance-toggle"
          onClick={() => setAppearanceOpen((open) => !open)}
        >
          <FontAwesomeIcon icon={appearanceOpen ? faCaretUp : faCaretDown} aria-hidden="true" />
          Appearance
        </button>
        {appearanceOpen ? (
          <div id="ce-setup-appearance" className={styles.disclosureBody}>
            <SetupField id="ce-setup-colors" label="Colors" help={COLORS_HELP}>
              <Input
                id="ce-setup-colors"
                type="select"
                value={colorSchemeId}
                aria-describedby={setupHelpId('ce-setup-colors')}
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
          </div>
        ) : null}
      </div>
    </SetupSection>
  );
};

type ContextLink = { label: string; url: string };

const readContext = (draft: SetupSectionProps['draft']) => {
  const context = asRecord(draft.sessionContext);
  return {
    title: text(context.title),
    paragraphs: asList(context.paragraphs).map(text),
    links: asList(context.links).map((link) => ({ label: text(asRecord(link).label), url: text(asRecord(link).url) })),
    html: text(context.html),
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
  const { title, paragraphs, links, html } = readContext(draft);
  if (html.trim()) return title ? `${title}: HTML file` : 'HTML file';
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
const FORMAT_HELP =
  'Text shows the paragraphs and links below. An HTML file replaces them, under the same title. Switching discards the other one, after asking.';
const PARAGRAPH_HELP = `Plain text, up to ${SESSION_CONTEXT_LIMITS.paragraphChars.toLocaleString('en-US')} characters, shown on the session page in this order. The session’s AI reads it too.`;
const LINK_LABEL_HELP = `The words the session page shows for this link, up to ${SESSION_CONTEXT_LIMITS.labelChars} characters.`;
const LINK_URL_HELP =
  'An https:// address, for everyone who can open the session. Its page is read for the AI only if you choose that after Create.';
const LEAVE_TEXT = 'Use an HTML file instead? The paragraphs and links will be removed.';
const LEAVE_HTML = 'Use typed text instead? The HTML file will be removed.';

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
  const hasText =
    context.paragraphs.some((paragraph) => paragraph.trim()) || context.links.some((link) => link.url.trim());
  const [chosenFormat, setChosenFormat] = useState<'text' | 'html'>(context.html ? 'html' : 'text');
  // Stored or imported HTML always shows as the HTML form.
  const format = context.html.trim() ? 'html' : chosenFormat;
  // A link's https problem shows beside the link itself.
  const problems = contextProblems(draft).filter((problem) => !LINK_URL_PATH.test(problem.path));
  const files = asList(draft.contextFiles)
    .map((file) => text(asRecord(file).name))
    .filter(Boolean);
  // A blank html is left out, so a text context keeps its usual shape.
  const save = (next: Partial<typeof context>) => {
    const { html, ...typed } = { ...context, ...next };
    onChange(['sessionContext'], html.trim() ? { ...typed, html } : typed);
  };
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
      <SetupField id="ce-setup-context-format" label="Format" help={FORMAT_HELP}>
        <Input
          id="ce-setup-context-format"
          type="select"
          value={format}
          aria-describedby={setupHelpId('ce-setup-context-format')}
          data-testid="ce-setup-context-format"
          onChange={(event) => {
            const next = event.target.value === 'html' ? 'html' : 'text';
            if (next === format) return;
            if (next === 'html' && hasText && !window.confirm(LEAVE_TEXT)) return;
            if (next === 'text' && context.html.trim() && !window.confirm(LEAVE_HTML)) return;
            setChosenFormat(next);
            save(next === 'html' ? { paragraphs: [], links: [] } : { html: '' });
          }}
        >
          <option value="text">Text</option>
          <option value="html">HTML file</option>
        </Input>
      </SetupField>
      {format === 'html' ? (
        <SetupContextHtmlField
          html={context.html}
          onChange={(html) => save({ html })}
          colorSchemeId={normalizeSessionColorSchemeId(asRecord(draft.appearance).colorSchemeId)}
        />
      ) : null}
      {format === 'text' &&
        context.paragraphs.map((paragraph, index) => (
          <SetupField
            key={`paragraph-${index}`}
            id={`ce-setup-context-paragraph-${index}`}
            label={`Paragraph ${index + 1}`}
            help={PARAGRAPH_HELP}
          >
            <Input
              id={`ce-setup-context-paragraph-${index}`}
              type="textarea"
              className={styles.textarea}
              value={paragraph}
              aria-describedby={setupHelpId(`ce-setup-context-paragraph-${index}`)}
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
      {format === 'text' &&
        context.links.map((link, index) => (
          <div key={`link-${index}`} className={styles.listRow}>
            <div className={styles.listRowBody}>
              <SetupField id={`ce-setup-context-link-label-${index}`} label="Link label" help={LINK_LABEL_HELP}>
                <Input
                  id={`ce-setup-context-link-label-${index}`}
                  value={link.label}
                  aria-describedby={setupHelpId(`ce-setup-context-link-label-${index}`)}
                  maxLength={SESSION_CONTEXT_LIMITS.labelChars}
                  onChange={(event) => setLink(index, { label: event.target.value })}
                />
              </SetupField>
              <SetupField id={`ce-setup-context-link-url-${index}`} label="Link" help={LINK_URL_HELP}>
                <Input
                  id={`ce-setup-context-link-url-${index}`}
                  type="url"
                  value={link.url}
                  aria-describedby={setupHelpId(`ce-setup-context-link-url-${index}`)}
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
      {format === 'text' ? (
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
      ) : null}
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

// Removes one draft per published question, by exact content, so an edit or an
// addition made while the upload ran stays in the draft.
export const withoutPublishedQuestions = (draftQuestions: unknown, published: SetupQuestion[]): unknown[] => {
  const left = new Map<string, number>();
  published.forEach((question) => {
    const key = JSON.stringify(question);
    left.set(key, (left.get(key) ?? 0) + 1);
  });
  const current = asList(draftQuestions);
  const readable = readSetupQuestions({ questions: current });
  return current.filter((_entry, index) => {
    const key = JSON.stringify(readable[index]);
    const count = left.get(key) ?? 0;
    if (count) left.set(key, count - 1);
    return !count;
  });
};

const splitOptions = (value: string): string[] =>
  value
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);

type QuestionsProps = SetupSectionProps & {
  /** After creation: what adds the questions to the session. */
  publisher?: React.ReactNode;
  /** /new: drafts questions from the page's context. */
  suggest?: React.ReactNode;
};

const QUESTION_TYPE_HELP =
  'How people answer: Agree or disagree, an open answer in their own words, a rating, one of several options, or a quadratic vote, where they spread a budget of votes across options.';
const QUESTION_PROMPT_HELP =
  'One statement or question, in plain words. Add question puts it in the list above, where you can still edit it; it reaches the session after Create.';
const QUESTION_OPTIONS_HELP = 'The choices people pick from, at least two, one per line.';

// Questions travel with a template. They're added to the session once it
// exists, as the question editor adds them, so a draft only lists them.
export const SetupQuestionsSection = ({
  draft,
  onChange,
  open,
  onToggle,
  publisher = null,
  suggest = null,
}: QuestionsProps) => {
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
      <SetupField id="ce-setup-question-type" label="New question type" help={QUESTION_TYPE_HELP}>
        <Input
          id="ce-setup-question-type"
          type="select"
          value={newType}
          aria-describedby={setupHelpId('ce-setup-question-type')}
          onChange={(event) => setNewType(event.target.value)}
        >
          {SETUP_QUESTION_TYPES.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </Input>
      </SetupField>
      <SetupField id="ce-setup-question-prompt" label="New question" help={QUESTION_PROMPT_HELP}>
        <Input
          id="ce-setup-question-prompt"
          type="textarea"
          value={newPrompt}
          aria-describedby={setupHelpId('ce-setup-question-prompt')}
          data-testid="ce-setup-question-prompt"
          onChange={(event) => setNewPrompt(event.target.value)}
        />
      </SetupField>
      {setupQuestionUsesOptions(newType) ? (
        <SetupField id="ce-setup-question-options" label="Options, one per line" help={QUESTION_OPTIONS_HELP}>
          <Input
            id="ce-setup-question-options"
            type="textarea"
            value={newOptions}
            aria-describedby={setupHelpId('ce-setup-question-options')}
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
      {suggest}
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

const GROUP_CREATION_HELP =
  'Anyone in the session: every signed-in participant can start a group for others to join. Admins only: only admins start groups, and participants join them.';

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
  /** End times and instructions for AI agents apply only to Worker-hosted sessions. */
  workerHosted: boolean;
  /** False when the session's Worker predates keeping AI draft text for admins. */
  draftTextSupported?: boolean;
  /** False when the session's Worker predates group join choices, which brought the ceiling. */
  groupCeilingSupported?: boolean;
};

export const SetupParticipationSection = ({
  draft,
  onChange,
  open,
  onToggle,
  workerHosted,
  draftTextSupported,
  groupCeilingSupported = true,
}: ParticipationProps) => (
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
        draftTextUnavailable={
          !workerHosted ? DRAFT_TEXT_NEEDS_WORKER : draftTextSupported === false ? DRAFT_TEXT_NEEDS_NEWER_WORKER : ''
        }
      />
    ) : null}
    <SetupField id="ce-setup-group-creation" label="Who can create groups" help={GROUP_CREATION_HELP}>
      <Input
        id="ce-setup-group-creation"
        type="select"
        value={normalizeGroupCreationPolicy(draft.groupCreationPolicy, DEFAULT_NEW_SESSION_GROUP_CREATION_POLICY)}
        aria-describedby={setupHelpId('ce-setup-group-creation')}
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
    {workerHosted ? (
      <>
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
        {groupCeilingSupported ? (
          <SetupField
            id="ce-setup-group-member-ceiling"
            label="Most members in a group"
            help={`The largest any group may be. Leave blank for ${WORKER_GROUP_MEMBER_CEILING_DEFAULT.toLocaleString('en-US')}; up to ${WORKER_GROUP_MEMBER_CEILING_MAX.toLocaleString('en-US')}.`}
          >
            <Input
              id="ce-setup-group-member-ceiling"
              type="number"
              min="1"
              max={WORKER_GROUP_MEMBER_CEILING_MAX}
              step="1"
              placeholder={WORKER_GROUP_MEMBER_CEILING_DEFAULT.toLocaleString('en-US')}
              value={text(draft.groupMemberCeiling)}
              aria-describedby={setupHelpId('ce-setup-group-member-ceiling')}
              onChange={(event) => onChange(['groupMemberCeiling'], event.target.value)}
            />
          </SetupField>
        ) : null}
        <SetupAgentInstructionsField
          value={text(draft.agentInstructions)}
          onChange={(value) => onChange(['agentInstructions'], value)}
        />
      </>
    ) : null}
  </SetupSection>
);
