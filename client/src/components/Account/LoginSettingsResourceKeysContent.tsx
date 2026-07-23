import React from 'react';
import { Button } from 'reactstrap';
import styles from './Account.module.scss';

type ResourceKeysRecord = Record<string, unknown> & {
  arweave?: Record<string, unknown>;
  rpc?: Record<string, unknown>;
};

type LoginSettingsResourceKeysContentProps = {
  formatResourceSponsorHint: (args: {
    resourceKey: string;
    resourceLabel: string;
    sponsoredKeys: Record<string, unknown>;
    sponsorSessions: unknown;
  }) => React.ReactNode;
  handleClearResourceKeys: () => void;
  handleResourceToggleLocal: (resource: string, event: React.ChangeEvent<HTMLInputElement>) => void;
  handleSaveResourceKeys: () => void;
  resourceKeys: ResourceKeysRecord;
  resourceKeysDirty: boolean;
  resourceKeysStatus: string;
  sponsorSessions: unknown;
  sponsoredKeys: Record<string, unknown>;
  updateResourceKeyField: (resource: string, field: string, value: string) => void;
  useLocalArweave: boolean;
  useLocalRpc: boolean;
  visibleResources?: readonly string[];
};

const inputValue = (value: unknown): string => (value == null ? '' : String(value));

const LoginSettingsResourceKeysContent = ({
  formatResourceSponsorHint,
  handleClearResourceKeys,
  handleResourceToggleLocal,
  handleSaveResourceKeys,
  resourceKeys,
  resourceKeysDirty,
  resourceKeysStatus,
  sponsorSessions,
  sponsoredKeys,
  updateResourceKeyField,
  useLocalArweave,
  useLocalRpc,
  visibleResources = [],
}: LoginSettingsResourceKeysContentProps) => (
  <>
    <div className={styles.aiSettingsGrid}>
      {visibleResources.includes('rpc') ? (
        <div className={styles.aiSettingsRow}>
          <label className={styles.aiSettingsLabel}>RPC API key</label>
          <input
            className={styles.aiSettingsInput}
            type="password"
            value={useLocalRpc ? inputValue(resourceKeys.rpc?.apiKey) : ''}
            onChange={(event) => updateResourceKeyField('rpc', 'apiKey', event.target.value)}
            disabled={!useLocalRpc}
            placeholder={
              useLocalRpc
                ? 'Enter RPC API key'
                : sponsoredKeys.rpc
                  ? 'Sponsored key configured'
                  : 'No sponsored key set'
            }
          />
          <label className={styles.aiSettingsInlineToggle}>
            <input
              type="checkbox"
              checked={useLocalRpc}
              onChange={(event) => handleResourceToggleLocal('rpc', event)}
            />
            <span>Use local override</span>
          </label>
          <div className={styles.aiSettingsHint}>
            {formatResourceSponsorHint({
              resourceKey: 'rpc',
              resourceLabel: 'RPC',
              sponsoredKeys,
              sponsorSessions,
            })}
          </div>
        </div>
      ) : null}

      {visibleResources.includes('arweave') ? (
        <div className={`${styles.aiSettingsRow} ${styles.aiSettingsRowFull}`}>
          <label className={styles.aiSettingsLabel}>Arweave JWK (JSON)</label>
          <textarea
            className={styles.aiSettingsTextarea}
            value={useLocalArweave ? inputValue(resourceKeys.arweave?.jwk) : ''}
            onChange={(event) => updateResourceKeyField('arweave', 'jwk', event.target.value)}
            disabled={!useLocalArweave}
            placeholder={
              useLocalArweave
                ? '{ "kty": "...", ... }'
                : sponsoredKeys.arweave
                  ? 'Sponsored key configured'
                  : 'No sponsored key set'
            }
          />
          <label className={styles.aiSettingsInlineToggle}>
            <input
              type="checkbox"
              checked={useLocalArweave}
              onChange={(event) => handleResourceToggleLocal('arweave', event)}
            />
            <span>Use local override</span>
          </label>
          <div className={styles.aiSettingsHint}>
            {formatResourceSponsorHint({
              resourceKey: 'arweave',
              resourceLabel: 'Arweave',
              sponsoredKeys,
              sponsorSessions,
            })}
          </div>
        </div>
      ) : null}
    </div>
    <div className={styles.aiSettingsFooterRow}>
      <div className={styles.aiSettingsStatus}>
        {resourceKeysStatus || 'Stored locally; only sent on the request that needs them.'}
      </div>
      <div className={styles.aiSettingsActions}>
        <Button size="sm" color="info" onClick={handleSaveResourceKeys} disabled={!resourceKeysDirty}>
          Save keys
        </Button>
        <Button size="sm" color="secondary" outline onClick={handleClearResourceKeys}>
          Clear keys
        </Button>
      </div>
    </div>
  </>
);

export default LoginSettingsResourceKeysContent;
