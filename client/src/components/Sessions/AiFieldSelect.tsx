import React from 'react';
import { FormGroup, Input, Label } from 'reactstrap';

import { toStr } from '../../utilities/shared/primitives.js';
import styles from './SessionWizard.module.scss';
import {
  AI_PROVIDER_OPTIONS,
  getAiModelOptions,
  normalizeAiModelForProvider,
  normalizeAiProvider,
} from './sessionWizardAiConfig';

type AiModelDraft = {
  model?: unknown;
  provider?: unknown;
};

type AiDraft = {
  ai?: {
    mode?: string;
    models?: {
      fast?: AiModelDraft;
      thinking?: AiModelDraft;
      transcription?: AiModelDraft;
      [key: string]: AiModelDraft | undefined;
    };
  };
};

type GateLike = {
  id: string;
  label?: string;
  color?: string;
};

export type RenderAiOrGateSelectParams = {
  keyString: string;
  value: unknown;
  currentPath: string[];
  displayLabelText: string;
  fieldTooltipControl: React.ReactNode;
  onUpdateDraftValue: (path: string[], value: string) => void;
  draft?: AiDraft | null;
  encryptionGates: GateLike[];
  defaultGateId: string;
  onSetDefaultGateId: (id: string) => void;
};

const renderSelectField = ({
  keyString,
  displayLabelText,
  fieldTooltipControl,
  children,
}: {
  keyString: string;
  displayLabelText: string;
  fieldTooltipControl: React.ReactNode;
  children: React.ReactNode;
}) => (
  <FormGroup key={keyString} className={styles.fieldGroup}>
    <div className={styles.fieldHeader}>
      <div className={styles.fieldLabelRow}>
        <Label>{displayLabelText}</Label>
        {fieldTooltipControl}
      </div>
    </div>
    {children}
  </FormGroup>
);

export const renderAiOrGateSelect = ({
  keyString,
  value,
  currentPath,
  displayLabelText,
  fieldTooltipControl,
  onUpdateDraftValue,
  draft,
  encryptionGates,
  defaultGateId,
  onSetDefaultGateId,
}: RenderAiOrGateSelectParams): React.ReactElement | null => {
  if (keyString === 'ai.models.transcription.provider') {
    return renderSelectField({
      keyString,
      displayLabelText,
      fieldTooltipControl,
      children: (
        <Input
          type="select"
          value={toStr(value).trim() || 'openai'}
          onChange={(e) => onUpdateDraftValue(currentPath, e.target.value)}
        >
          <option value="openai">OpenAI</option>
          <option value="local" disabled>
            Local (coming soon)
          </option>
        </Input>
      ),
    });
  }

  if (keyString === 'ai.models.fast.provider' || keyString === 'ai.models.thinking.provider') {
    const aiProviderModelType = keyString === 'ai.models.fast.provider' ? 'fast' : 'thinking';
    return renderSelectField({
      keyString,
      displayLabelText,
      fieldTooltipControl,
      children: (
        <Input
          type="select"
          value={normalizeAiProvider(value)}
          onChange={(e) => {
            const nextProvider = normalizeAiProvider(e.target.value, 'openai');
            onUpdateDraftValue(currentPath, nextProvider);
            const currentModel = toStr(draft?.ai?.models?.[aiProviderModelType]?.model).trim();
            const nextModel = normalizeAiModelForProvider(aiProviderModelType, nextProvider, currentModel);
            if (nextModel !== currentModel) {
              onUpdateDraftValue(['ai', 'models', aiProviderModelType, 'model'], nextModel);
            }
          }}
        >
          {AI_PROVIDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value} disabled={!!option.disabled}>
              {option.label}
            </option>
          ))}
        </Input>
      ),
    });
  }

  const modelType =
    keyString === 'ai.models.fast.model'
      ? 'fast'
      : keyString === 'ai.models.thinking.model'
        ? 'thinking'
        : keyString === 'ai.models.transcription.model'
          ? 'transcription'
          : null;
  if (modelType) {
    const providerMode =
      modelType === 'transcription'
        ? 'openai'
        : normalizeAiProvider(draft?.ai?.models?.[modelType]?.provider || 'openai');
    const modelOptions =
      modelType === 'transcription'
        ? getAiModelOptions('transcription', 'openai')
        : getAiModelOptions(modelType, providerMode);
    if (!modelOptions.length) return null;
    const options = Array.from(new Set(modelOptions.filter(Boolean)));
    const selectedModel = normalizeAiModelForProvider(modelType, providerMode, value);
    return renderSelectField({
      keyString,
      displayLabelText,
      fieldTooltipControl,
      children: (
        <Input type="select" value={selectedModel} onChange={(e) => onUpdateDraftValue(currentPath, e.target.value)}>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Input>
      ),
    });
  }

  if (keyString === 'lit.defaultGateId' || keyString === 'lit.defaultGate') {
    const activeGate = encryptionGates.find((gate) => gate.id === defaultGateId) || encryptionGates[0] || null;
    const gateValue = activeGate?.id || '';
    return renderSelectField({
      keyString,
      displayLabelText,
      fieldTooltipControl,
      children: (
        <div className={styles.defaultGateControl}>
          {activeGate && <span className={styles.gateColor} style={{ background: activeGate.color }} />}
          <Input
            type="select"
            className={styles.defaultGateSelect}
            value={gateValue}
            onChange={(e) => onSetDefaultGateId(e.target.value)}
            disabled={!encryptionGates.length}
          >
            {encryptionGates.map((gate) => (
              <option key={gate.id} value={gate.id}>
                {gate.label || gate.id}
              </option>
            ))}
          </Input>
        </div>
      ),
    });
  }

  return null;
};
