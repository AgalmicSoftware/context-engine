import React from 'react';
import styles from './Account.module.scss';

type LoginPreLoginConfigPanelProps = {
  anthropicApiKey: string;
  customRpcUrl: string;
  onAiEndpointChange: React.ChangeEventHandler<HTMLInputElement>;
  onAiProviderKeyChange: (provider: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  openAiApiKey: string;
  sessionSettings: React.ReactNode;
};

const LoginPreLoginConfigPanel = ({
  anthropicApiKey,
  customRpcUrl,
  onAiEndpointChange,
  onAiProviderKeyChange,
  openAiApiKey,
  sessionSettings,
}: LoginPreLoginConfigPanelProps) => (
  <div className={styles.preLoginSettingsConfigPanel} data-testid="ce-prelogin-config-panel">
    {sessionSettings}
    <div className={styles.preLoginSettingsTitle}>AI settings</div>
    <label className={styles.preLoginSettingsField}>
      <span className={styles.preLoginSettingsLabel}>OpenAI API key</span>
      <input
        type="password"
        className={styles.preLoginSettingsInput}
        value={openAiApiKey}
        onChange={(event) => onAiProviderKeyChange('openai', event)}
        placeholder="sk-..."
      />
    </label>
    <label className={styles.preLoginSettingsField}>
      <span className={styles.preLoginSettingsLabel}>Anthropic API key</span>
      <input
        type="password"
        className={styles.preLoginSettingsInput}
        value={anthropicApiKey}
        onChange={(event) => onAiProviderKeyChange('anthropic', event)}
        placeholder="sk-ant-..."
      />
    </label>
    <label className={styles.preLoginSettingsField}>
      <span className={styles.preLoginSettingsLabel}>AI endpoint</span>
      <input
        type="text"
        className={styles.preLoginSettingsInput}
        value={customRpcUrl}
        onChange={onAiEndpointChange}
        placeholder="https://your-ai-endpoint.example/v1"
      />
    </label>
    <div className={styles.preLoginSettingsHint}>
      Anthropic powers local text tasks here. Audio and transcription still use local OpenAI, session defaults, or a
      custom endpoint until downloadable local transcription lands.
    </div>
  </div>
);

export default LoginPreLoginConfigPanel;
