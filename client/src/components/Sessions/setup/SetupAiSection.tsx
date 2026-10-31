import React from 'react';
import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';
import { Input } from 'reactstrap';

import {
  AI_PROVIDER_OPTIONS,
  getAiModelOptions,
  normalizeAiModelForProvider,
  normalizeAiProvider,
} from '../sessionWizardAiConfig';
import { SetupField, SetupSection, setupHelpId } from './SetupPrimitives';
import { asRecord, text, type SetupSectionProps } from './setupSectionTypes';
import styles from './SessionSetup.module.scss';

const providerLabel = (value: string) => AI_PROVIDER_OPTIONS.find((option) => option.value === value)?.label || value;

const readModels = (draft: SetupSectionProps['draft']) => {
  const models = asRecord(asRecord(draft.ai).models);
  const fast = asRecord(models.fast);
  const thinking = asRecord(models.thinking);
  return {
    provider: normalizeAiProvider(fast.provider || thinking.provider || 'openai'),
    fast: text(fast.model),
    thinking: text(thinking.model),
  };
};

const describeModels = (draft: SetupSectionProps['draft']): string => {
  const { provider, fast, thinking } = readModels(draft);
  const models = fast && thinking && fast !== thinking ? `${fast} and ${thinking}` : fast || thinking;
  return `${providerLabel(provider)} ${models}`.trim();
};

// A published session's public config holds its models but not its effort.
const summarizeAi = (draft: SetupSectionProps['draft'], mode: SetupSectionProps['mode'] = 'create'): string =>
  mode === 'edit'
    ? describeModels(draft)
    : [describeModels(draft), `${text(asRecord(draft.ai).reasoningEffort) || 'low'} effort`].join(' · ');

type AiProps = SetupSectionProps & {
  /** /new: the provider key inputs, which stay visible (keys are never saved). */
  keys?: React.ReactNode;
};

const REASONING_EFFORTS = ['low', 'medium', 'high'];

export const SetupAiSection = ({ draft, onChange, mode, open, onToggle, keys = null }: AiProps) => {
  const { provider, fast, thinking } = readModels(draft);
  const ai = asRecord(draft.ai);
  const setProvider = (next: string) => {
    const models = asRecord(ai.models);
    // Each model moves onto the new provider's list.
    const moved = (role: 'fast' | 'thinking') => {
      const entry = asRecord(models[role]);
      return { ...entry, provider: next, model: normalizeAiModelForProvider(role, next, entry.model) };
    };
    onChange(['ai', 'models'], { ...models, fast: moved('fast'), thinking: moved('thinking') });
  };
  const modelSelect = (role: 'fast' | 'thinking', label: string, value: string, help: string) => {
    const id = `ce-setup-ai-${role}`;
    const options = getAiModelOptions(role, provider);
    return (
      <SetupField id={id} label={label} help={help}>
        <Input
          id={id}
          type="select"
          value={value}
          aria-describedby={setupHelpId(id)}
          data-testid={id}
          onChange={(event) => onChange(['ai', 'models', role, 'model'], event.target.value)}
        >
          {(options.includes(value) || !value ? options : [value, ...options]).map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </Input>
      </SetupField>
    );
  };
  return (
    <SetupSection
      sectionKey="ai"
      title="AI"
      summary={summarizeAi(draft, mode)}
      open={open}
      onToggle={onToggle}
      quick={keys}
    >
      {mode === 'edit' ? (
        // Saving models here would reset the stored effort, which the public config omits.
        <p className={styles.hint} data-testid="ce-setup-ai-fixed">
          {describeModels(draft)}. Models and reasoning effort are set when the session is created.
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
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </Input>
          </SetupField>
          {modelSelect('fast', 'Everyday model', fast, 'Used for quick tasks such as tagging and drafts.')}
          {modelSelect('thinking', 'Thinking model', thinking, 'Used for harder tasks such as analysis.')}
          <SetupField id="ce-setup-ai-effort" label="Reasoning effort">
            <Input
              id="ce-setup-ai-effort"
              type="select"
              value={text(ai.reasoningEffort) || 'low'}
              onChange={(event) => onChange(['ai', 'reasoningEffort'], event.target.value)}
            >
              {REASONING_EFFORTS.map((effort) => (
                <option key={effort} value={effort}>
                  {effort}
                </option>
              ))}
            </Input>
          </SetupField>
        </>
      )}
      <p className={styles.hint}>Transcription uses OpenAI whisper-1.</p>
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

// Voice interviews and group recordings transcribe with OpenAI.
export const SetupVoiceKeyNote = () => (
  <p className={styles.hint} data-testid="ce-setup-voice-openai-note">
    Voice interviews and group recordings transcribe with OpenAI, so they need an OpenAI key too.
  </p>
);
