import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';
import styles from './Account.module.scss';

type AiSettingsRecord = Record<string, unknown> & {
  mode?: unknown;
  models?: Record<string, unknown>;
  providers?: Record<string, unknown>;
  taskReasoningEffort?: Record<string, unknown>;
  transcription?: Record<string, unknown>;
};

type AiPresetOption = {
  key: string;
  label: string;
};

type AiTaskReasoningRow = {
  key: string;
  label: string;
  hint: string;
};

type LoginSettingsAiConfigContentProps = {
  aiDisplay: AiSettingsRecord;
  aiPresetKey: string;
  aiPresetOptions: readonly AiPresetOption[];
  aiProviderLabel: string;
  aiSettingsDirty: boolean;
  aiSettingsStatus: string;
  handleAiModeChange: React.ChangeEventHandler<HTMLSelectElement>;
  handleAiPresetChange: React.ChangeEventHandler<HTMLSelectElement>;
  handleAiToggleLocal: React.ChangeEventHandler<HTMLInputElement>;
  handleClearAiSettings: () => void;
  handleSaveAiSettings: () => void;
  isAdvancedOpen: boolean;
  isPerTaskOpen: boolean;
  keyPlaceholder: string;
  localProvider: string;
  providerKeyHint: string;
  providerLocalEntry: Record<string, unknown>;
  reasoningEffort: string;
  sessionDefaultBadgeText: string;
  showCustomFields: boolean;
  showCustomTranscription: boolean;
  showReasoningControls: boolean;
  taskReasoningEffort: Record<string, unknown>;
  taskReasoningRows: readonly AiTaskReasoningRow[];
  reasoningLevels: readonly string[];
  toggleAiSettingsSection: (key: string) => void;
  updateAiModelField: (modelKey: string, value: string) => void;
  updateAiProviderField: (provider: string, field: string, value: string) => void;
  updateAiSettings: (updater: (settings: AiSettingsRecord) => AiSettingsRecord) => void;
  updateAiTaskReasoningField: (key: string, value: string) => void;
  updateAiTranscriptionField: (field: string, value: string) => void;
  useLocalAi: boolean;
  usingSessionDefaultsLabel: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const nestedRecord = (source: unknown, key: string): Record<string, unknown> => asRecord(asRecord(source)[key]);

const inputValue = (value: unknown): string => (value == null ? '' : String(value));

const LoginSettingsAiConfigContent = ({
  aiDisplay,
  aiPresetKey,
  aiPresetOptions,
  aiProviderLabel,
  aiSettingsDirty,
  aiSettingsStatus,
  handleAiModeChange,
  handleAiPresetChange,
  handleAiToggleLocal,
  handleClearAiSettings,
  handleSaveAiSettings,
  isAdvancedOpen,
  isPerTaskOpen,
  keyPlaceholder,
  localProvider,
  providerKeyHint,
  providerLocalEntry,
  reasoningEffort,
  sessionDefaultBadgeText,
  showCustomFields,
  showCustomTranscription,
  showReasoningControls,
  taskReasoningEffort,
  taskReasoningRows,
  reasoningLevels,
  toggleAiSettingsSection,
  updateAiModelField,
  updateAiProviderField,
  updateAiSettings,
  updateAiTaskReasoningField,
  updateAiTranscriptionField,
  useLocalAi,
  usingSessionDefaultsLabel,
}: LoginSettingsAiConfigContentProps) => {
  const models = asRecord(aiDisplay.models);
  const providers = asRecord(aiDisplay.providers);
  const customProvider = nestedRecord(providers, 'custom');
  const transcription = asRecord(aiDisplay.transcription);

  return (
    <>
      <label className={styles.aiSettingsInlineToggle}>
        <input type="checkbox" checked={useLocalAi} onChange={handleAiToggleLocal} />
        <span>Use local override</span>
      </label>
      <div className={styles.aiSessionDefault}>
        <span>{sessionDefaultBadgeText}</span>
        {useLocalAi ? (
          <Button size="sm" color="secondary" outline onClick={handleClearAiSettings}>
            Clear
          </Button>
        ) : null}
      </div>
      <div className={styles.aiSettingsGrid}>
        <div className={styles.aiSettingsRow}>
          <label className={styles.aiSettingsLabel}>Model preset</label>
          <select
            className={`${styles.aiSettingsSelect} ${styles.aiPresetSelect}`}
            value={aiPresetKey}
            onChange={handleAiPresetChange}
            disabled={!useLocalAi}
          >
            {aiPresetOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <div className={styles.aiSettingsHint}>
            Presets keep provider and model selection in sync. Choose Custom to edit provider/model details directly.
          </div>
        </div>

        <div className={styles.aiSettingsRow}>
          <label className={styles.aiSettingsLabel}>API key ({aiProviderLabel})</label>
          <input
            className={styles.aiSettingsInput}
            type="password"
            value={useLocalAi ? inputValue(providerLocalEntry.apiKey) : ''}
            placeholder={keyPlaceholder}
            onChange={(event) => updateAiProviderField(localProvider, 'apiKey', event.target.value)}
            disabled={!useLocalAi}
          />
          {providerKeyHint ? <div className={styles.aiSettingsHint}>{providerKeyHint}</div> : null}
        </div>
      </div>

      {showReasoningControls && (
        <>
          <div className={styles.aiReasoningControl}>
            <label className={styles.aiSettingsLabel}>Reasoning effort</label>
            <div className={styles.aiReasoningButtons}>
              {reasoningLevels.map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`${styles.aiReasoningBtn} ${reasoningEffort === level ? styles.aiReasoningBtnActive : ''}`}
                  onClick={() => updateAiSettings((settings) => ({ ...settings, reasoningEffort: level }))}
                  disabled={!useLocalAi}
                  aria-pressed={reasoningEffort === level}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
            <div className={styles.aiSettingsHint}>Applied only to GPT-5 and OpenAI-compatible reasoning models.</div>
          </div>

          <div className={styles.aiPerTaskSection}>
            <button
              type="button"
              className={styles.aiAdvancedToggle}
              onClick={() => toggleAiSettingsSection('aiPerTask')}
              aria-expanded={isPerTaskOpen}
            >
              <span>Per-Task Reasoning</span>
              <FontAwesomeIcon icon={isPerTaskOpen ? faCaretUp : faCaretDown} className={styles.aiSettingsToggleIcon} />
            </button>
            {isPerTaskOpen && (
              <div className={styles.aiSettingsGrid}>
                {taskReasoningRows.map((row) => (
                  <div key={row.key} className={styles.aiPerTaskRow}>
                    <div>
                      <label className={styles.aiSettingsLabel}>{row.label}</label>
                      <div className={styles.aiSettingsHint}>{row.hint}</div>
                    </div>
                    <select
                      className={styles.aiSettingsSelect}
                      value={inputValue(taskReasoningEffort[row.key])}
                      onChange={(event) => updateAiTaskReasoningField(row.key, event.target.value)}
                      disabled={!useLocalAi}
                    >
                      <option value="">Global default</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div>
        <button
          type="button"
          className={styles.aiAdvancedToggle}
          onClick={() => toggleAiSettingsSection('aiAdvanced')}
          aria-expanded={isAdvancedOpen}
        >
          <span>Advanced</span>
          <FontAwesomeIcon icon={isAdvancedOpen ? faCaretUp : faCaretDown} className={styles.aiSettingsToggleIcon} />
        </button>
        {isAdvancedOpen && (
          <div className={styles.aiSettingsGrid}>
            <div className={styles.aiSettingsRow}>
              <label className={styles.aiSettingsLabel}>Provider</label>
              <select
                className={styles.aiSettingsSelect}
                value={inputValue(aiDisplay.mode || 'openai')}
                onChange={handleAiModeChange}
                disabled={!useLocalAi}
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="openrouter">OpenRouter</option>
                <option value="custom">Custom RPC</option>
              </select>
            </div>

            <div className={styles.aiSettingsRow}>
              <label className={styles.aiSettingsLabel}>Fast model</label>
              <input
                className={styles.aiSettingsInput}
                type="text"
                value={inputValue(models.fast)}
                onChange={(event) => updateAiModelField('fast', event.target.value)}
                disabled={!useLocalAi}
              />
            </div>

            <div className={styles.aiSettingsRow}>
              <label className={styles.aiSettingsLabel}>Thinking model</label>
              <input
                className={styles.aiSettingsInput}
                type="text"
                value={inputValue(models.thinking)}
                onChange={(event) => updateAiModelField('thinking', event.target.value)}
                disabled={!useLocalAi}
              />
            </div>

            {showCustomFields && (
              <>
                <div className={styles.aiSettingsRow}>
                  <label className={styles.aiSettingsLabel}>Custom RPC URL</label>
                  <input
                    className={styles.aiSettingsInput}
                    type="text"
                    value={inputValue(customProvider.rpcUrl)}
                    onChange={(event) => updateAiProviderField('custom', 'rpcUrl', event.target.value)}
                    disabled={!useLocalAi}
                  />
                </div>
                <div className={`${styles.aiSettingsRow} ${styles.aiSettingsRowFull}`}>
                  <label className={styles.aiSettingsLabel}>Functions JSON</label>
                  <textarea
                    className={styles.aiSettingsTextarea}
                    value={inputValue(customProvider.functions)}
                    onChange={(event) => updateAiProviderField('custom', 'functions', event.target.value)}
                    disabled={!useLocalAi}
                  />
                </div>
              </>
            )}

            <div className={styles.aiSettingsRow}>
              <label className={styles.aiSettingsLabel}>Transcription provider</label>
              <select
                className={styles.aiSettingsSelect}
                value={inputValue(transcription.provider || 'openai')}
                onChange={(event) => updateAiTranscriptionField('provider', event.target.value)}
                disabled={!useLocalAi}
              >
                <option value="openai">OpenAI</option>
                <option value="custom">Custom RPC</option>
                <option value="local">Local (future)</option>
              </select>
            </div>

            <div className={styles.aiSettingsRow}>
              <label className={styles.aiSettingsLabel}>Transcription model</label>
              <input
                className={styles.aiSettingsInput}
                type="text"
                value={inputValue(transcription.model)}
                onChange={(event) => updateAiTranscriptionField('model', event.target.value)}
                disabled={!useLocalAi}
              />
            </div>

            {showCustomTranscription && (
              <div className={styles.aiSettingsRow}>
                <label className={styles.aiSettingsLabel}>Transcription RPC URL</label>
                <input
                  className={styles.aiSettingsInput}
                  type="text"
                  value={inputValue(transcription.rpcUrl)}
                  onChange={(event) => updateAiTranscriptionField('rpcUrl', event.target.value)}
                  disabled={!useLocalAi}
                />
              </div>
            )}
          </div>
        )}
      </div>
      <div className={styles.aiSettingsFooterRow}>
        <div className={styles.aiSettingsStatus}>
          {usingSessionDefaultsLabel}
          {aiSettingsStatus ? ` ${aiSettingsStatus}` : ''}
        </div>
        <div className={styles.aiSettingsActions}>
          <Button size="sm" color="info" onClick={handleSaveAiSettings} disabled={!aiSettingsDirty}>
            Save
          </Button>
          <Button size="sm" color="secondary" outline onClick={handleClearAiSettings}>
            Clear local
          </Button>
        </div>
      </div>
    </>
  );
};

export default LoginSettingsAiConfigContent;
