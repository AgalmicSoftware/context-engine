import React, { useState } from 'react';
import { Input } from 'reactstrap';

import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';
import {
  AI_PROVIDER_OPTIONS,
  getAiModelOptions,
  normalizeAiModelForProvider,
  normalizeAiProvider,
} from '../sessionWizardAiConfig';
import { SetupField, SetupSection, setupHelpId } from '../setup/SetupPrimitives';
import { asRecord, text, type SetupSectionProps } from '../setup/setupSectionTypes';
import styles from '../setup/SessionSetup.module.scss';

// The tasks the Session Worker lets a session give their own effort.
const AI_TASKS = Object.freeze([
  { key: 'generate', label: 'Writing questions' },
  { key: 'rewrite', label: 'Rewriting' },
  { key: 'summarize', label: 'Summaries' },
  { key: 'rank', label: 'Ranking' },
  { key: 'compare', label: 'Comparing' },
  { key: 'categorize', label: 'Tagging' },
  { key: 'analysis', label: 'Results analysis' },
  { key: 'interview-map', label: 'Interview mapping' },
  { key: 'interview-opening', label: 'Interview opening' },
  { key: 'context-read', label: 'Reading context files' },
]);
const EFFORTS = ['low', 'medium', 'high'];
const taskLabel = (key: string) => AI_TASKS.find((task) => task.key === key)?.label || key;
const providerLabel = (value: string) => AI_PROVIDER_OPTIONS.find((option) => option.value === value)?.label || value;
// A saved value missing from a list stays shown and selected.
const withSaved = (list: readonly string[], value: string) =>
  value && !list.includes(value) ? [value, ...list] : list;

const readAi = (draft: SetupSectionProps['draft']) => {
  const ai = asRecord(draft.ai);
  const models = asRecord(ai.models);
  const fast = asRecord(models.fast);
  const thinking = asRecord(models.thinking);
  return {
    models,
    provider: normalizeAiProvider(fast.provider || thinking.provider || 'openai'),
    fast: text(fast.model),
    thinking: text(thinking.model),
    transcription: text(asRecord(models.transcription).model),
    effort: text(ai.reasoningEffort),
    taskEffort: asRecord(ai.taskReasoningEffort),
  };
};

const describeModels = (draft: SetupSectionProps['draft']): string => {
  const { provider, fast, thinking } = readAi(draft);
  const models = fast && thinking && fast !== thinking ? `${fast} and ${thinking}` : fast || thinking;
  return `${providerLabel(provider)} ${models}`.trim();
};

type Props = Omit<SetupSectionProps, 'mode' | 'conflicts'> & {
  /** Why AI is read-only here, or '' when it can be edited. */
  lockedReason: string;
  /** Where the provider keys are changed. */
  keys?: React.ReactNode;
};

// The settings page's AI section: the same fields setup writes, plus the
// per-task effort and transcription model. A saved model or effort that is
// not offered stays selected, and nothing changes until the admin picks.
export const SettingsAiSection = ({ draft, onChange, open, onToggle, lockedReason, keys = null }: Props) => {
  const { models, provider, fast, thinking, transcription, effort, taskEffort } = readAi(draft);
  const [newTask, setNewTask] = useState('');
  const unusedTasks = AI_TASKS.filter((task) => !(task.key in taskEffort));
  const setProvider = (next: string) => {
    // Each model moves onto the new provider's list.
    const moved = (role: 'fast' | 'thinking') => {
      const entry = asRecord(models[role]);
      return { ...entry, provider: next, model: normalizeAiModelForProvider(role, next, entry.model) };
    };
    onChange(['ai', 'models'], { ...models, fast: moved('fast'), thinking: moved('thinking') });
  };
  const select = (
    id: string,
    label: string,
    value: string,
    choices: readonly string[],
    onPick: (value: string) => void,
    help = '',
  ) => (
    <SetupField id={id} label={label} help={help}>
      <Input
        id={id}
        type="select"
        value={value}
        aria-describedby={help ? setupHelpId(id) : undefined}
        data-testid={id}
        onChange={(event) => onPick(event.target.value)}
      >
        {value ? null : <option value="">Not set</option>}
        {withSaved(choices, value).map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </Input>
    </SetupField>
  );
  const setTranscription = (model: string) => {
    if (model) {
      onChange(['ai', 'models', 'transcription'], { ...asRecord(models.transcription), provider: 'openai', model });
      return;
    }
    const { transcription: _dropped, ...rest } = models;
    onChange(['ai', 'models'], rest);
  };
  const removeTask = (key: string) => {
    const { [key]: _dropped, ...rest } = taskEffort;
    onChange(['ai', 'taskReasoningEffort'], rest);
  };
  const addTask = () => {
    const key = newTask || unusedTasks[0]?.key;
    if (!key) return;
    onChange(['ai', 'taskReasoningEffort'], { ...taskEffort, [key]: effort || 'low' });
    setNewTask('');
  };

  return (
    <SetupSection
      sectionKey="ai"
      title="AI"
      summary={[describeModels(draft), effort ? `${effort} effort` : ''].filter(Boolean).join(' · ')}
      open={open}
      onToggle={onToggle}
      quick={keys}
    >
      {lockedReason ? (
        <p className={styles.hint} data-testid="ce-settings-ai-locked">
          {describeModels(draft)}. {lockedReason}
        </p>
      ) : (
        <>
          <SetupField id="ce-setup-ai-provider" label="Provider">
            <Input
              id="ce-setup-ai-provider"
              type="select"
              value={provider}
              data-testid={E2E_TESTIDS.SETUP_AI_PROVIDER}
              onChange={(event) => setProvider(event.target.value)}
            >
              {AI_PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled && option.value !== provider}>
                  {option.label}
                </option>
              ))}
            </Input>
          </SetupField>
          {select(
            'ce-setup-ai-fast',
            'Everyday model',
            fast,
            getAiModelOptions('fast', provider),
            (model) => onChange(['ai', 'models', 'fast', 'model'], model),
            'Used for quick tasks such as tagging and drafts.',
          )}
          {select(
            'ce-setup-ai-thinking',
            'Thinking model',
            thinking,
            getAiModelOptions('thinking', provider),
            (model) => onChange(['ai', 'models', 'thinking', 'model'], model),
            'Used for harder tasks such as analysis.',
          )}
          {select(
            'ce-setup-ai-effort',
            'Reasoning effort',
            effort,
            EFFORTS,
            (value) => onChange(['ai', 'reasoningEffort'], value),
            'The most effort any AI task may use, unless a task below sets its own.',
          )}
          <h3 className={styles.subheading}>Effort by task</h3>
          {Object.keys(taskEffort).map((key) => (
            <div key={key} className={styles.inlineRow}>
              <label htmlFor={`ce-settings-ai-task-${key}`} className={styles.fieldLabel}>
                {taskLabel(key)}
              </label>
              <Input
                id={`ce-settings-ai-task-${key}`}
                type="select"
                value={text(taskEffort[key])}
                data-testid={`ce-settings-ai-task-${key}`}
                onChange={(event) => onChange(['ai', 'taskReasoningEffort', key], event.target.value)}
              >
                {withSaved(EFFORTS, text(taskEffort[key])).map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </Input>
              <button
                type="button"
                className={styles.button}
                aria-label={`Remove the ${taskLabel(key)} effort`}
                onClick={() => removeTask(key)}
              >
                Remove
              </button>
            </div>
          ))}
          {unusedTasks.length ? (
            <div className={styles.inlineRow}>
              <Input
                type="select"
                aria-label="Task"
                value={newTask || unusedTasks[0].key}
                data-testid="ce-settings-ai-task-new"
                onChange={(event) => setNewTask(event.target.value)}
              >
                {unusedTasks.map((task) => (
                  <option key={task.key} value={task.key}>
                    {task.label}
                  </option>
                ))}
              </Input>
              <button type="button" className={styles.button} data-testid="ce-settings-ai-task-add" onClick={addTask}>
                Add task effort
              </button>
            </div>
          ) : null}
          {select(
            'ce-settings-ai-transcription',
            'Transcription model',
            transcription,
            getAiModelOptions('transcription', 'openai'),
            setTranscription,
            'Turns voice answers and recordings into text. Transcription uses OpenAI.',
          )}
        </>
      )}
      <SetupField
        id="ce-setup-questions-prompt"
        label="Question prompt"
        help="Extra instructions for the AI when it writes questions for this session."
      >
        <Input
          id="ce-setup-questions-prompt"
          type="textarea"
          className={styles.textarea}
          value={text(draft.questionsGenPrompt)}
          aria-describedby={setupHelpId('ce-setup-questions-prompt')}
          onChange={(event) => onChange(['questionsGenPrompt'], event.target.value)}
        />
      </SetupField>
      <SetupField
        id="ce-setup-default-tags"
        label="Tag suggestions"
        help="Suggested tags for AI question tagging. Separate with commas."
      >
        <Input
          id="ce-setup-default-tags"
          value={text(draft.defaultTags)}
          aria-describedby={setupHelpId('ce-setup-default-tags')}
          onChange={(event) => onChange(['defaultTags'], event.target.value)}
        />
      </SetupField>
    </SetupSection>
  );
};
