import React from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCaretUp,
  faLock,
  faLockOpen,
  faQuestionCircle,
  faSync,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import CETooltip from '../Shared/CETooltip';
import { normalizeWorkerUrl } from './adminPageHelpers';
import {
  ADMIN_SECRET_CARDS,
  filterAdminSecretCards,
  buildAdminSecretRemoveTestId,
  getAdminSecretCardStatus,
  getAdminSecretFieldInputType,
  getAdminSecretFieldLabel,
  getAdminSecretFieldRows,
  getAdminSecretFieldStatusLabel,
  type AdminSecretPresenceStatus,
} from './adminPageSecretCardHelpers';
import { shouldShowInlineResourceSummary } from './adminPageMetadataDraftHelpers';
import type { AdminResourceDisplayState } from './adminPageResourceDisplayHelpers';
import styles from './AdminPage.module.scss';

type AdminSecrets = Record<string, string>;
type AdminSecretKeySet = Set<string>;
type AdminOpenSecretCards = Record<string, boolean>;
type AdminSecretInputChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

type InlineResourceSummaryProps = {
  label: string;
  resource: AdminResourceDisplayState;
  onRefresh: () => void;
  refreshLabel: string;
};

type AdminPageWorkerSecretsPanelProps = {
  workerSecretsOpen: boolean;
  onToggle: () => void;
  canAdminWorker: boolean;
  selectedConfig: unknown;
  workerUrl: string;
  selectedConfigWorkerUrl: string;
  secretPresenceMessage: string;
  secretPresenceStatus: AdminSecretPresenceStatus;
  refreshSecretPresence: () => void;
  openSecretCards: AdminOpenSecretCards;
  setOpenSecretCards: React.Dispatch<React.SetStateAction<AdminOpenSecretCards>>;
  secrets: AdminSecrets;
  clearedSecretKeys: AdminSecretKeySet;
  storedSecretPresence: Record<string, boolean>;
  workerSecretsDirty: boolean;
  handleSecretChange: (key: string, value: string) => void;
  handleClearSecret: (key: string) => void;
  arweaveResource: AdminResourceDisplayState;
  faucetResource: AdminResourceDisplayState;
  litResource: AdminResourceDisplayState;
  litResourceLabel: string;
  refreshArweaveResource: () => void;
  refreshFaucetResource: () => void;
  refreshLitResource: (options?: { includeSignedStatus?: boolean }) => void;
  handleSaveWorkerSecrets: () => void;
  saveStatus: string;
  chainStatus: string;
  visibleCardKeys?: readonly string[];
};

const renderInfoTooltip = (id: string, content: React.ReactNode) => {
  if (!content) return null;
  return (
    <>
      <FontAwesomeIcon icon={faQuestionCircle} className={styles.tooltip} id={id} />
      <CETooltip placement="right" trigger="hover focus click" target={id} className={styles.tooltipBubble}>
        {content}
      </CETooltip>
    </>
  );
};

const InlineResourceSummary = ({ label, resource, onRefresh, refreshLabel }: InlineResourceSummaryProps) => {
  if (!shouldShowInlineResourceSummary(resource)) return null;
  return (
    <div className={styles.inlineResourceCard}>
      <div className={styles.inlineResourceHeader}>
        <div className={styles.resourceLabel}>{label}</div>
        <button
          type="button"
          className={styles.resourceRefreshButton}
          onClick={onRefresh}
          aria-label={refreshLabel}
          title={refreshLabel}
        >
          <FontAwesomeIcon icon={faSync} spin={resource.loading} />
        </button>
      </div>
      <div className={styles.inlineResourceBalance}>{resource.display}</div>
      <div className={styles.inlineResourceStatus}>{resource.meta}</div>
    </div>
  );
};

const AdminPageWorkerSecretsPanel = ({
  workerSecretsOpen,
  onToggle,
  canAdminWorker,
  selectedConfig,
  workerUrl,
  selectedConfigWorkerUrl,
  secretPresenceMessage,
  secretPresenceStatus,
  refreshSecretPresence,
  openSecretCards,
  setOpenSecretCards,
  secrets,
  clearedSecretKeys,
  storedSecretPresence,
  workerSecretsDirty,
  handleSecretChange,
  handleClearSecret,
  arweaveResource,
  faucetResource,
  litResource,
  litResourceLabel,
  refreshArweaveResource,
  refreshFaucetResource,
  refreshLitResource,
  handleSaveWorkerSecrets,
  saveStatus,
  chainStatus,
  visibleCardKeys = ['ai'],
}: AdminPageWorkerSecretsPanelProps) => (
  <section className={`${styles.panel} ${styles.secretsPanel}`}>
    <div className={styles.panelHeader}>
      <div className={styles.panelTitleGroup}>
        <div className={styles.panelTitleRow}>
          <div className={styles.panelTitle}>Worker secrets</div>
          {renderInfoTooltip(
            'admin-worker-secrets-tip',
            'Edit operator credentials without revealing what is already stored in the worker.',
          )}
        </div>
      </div>
      <Button
        size="sm"
        color="secondary"
        outline
        className={styles.collapseToggle}
        onClick={onToggle}
        aria-label="Toggle Worker secrets section"
      >
        <FontAwesomeIcon icon={workerSecretsOpen ? faCaretUp : faCaretDown} />
      </Button>
    </div>
    {workerSecretsOpen && (
      <>
        <div className={styles.secretStatusBar}>
          <div className={styles.statusNote}>
            {secretPresenceMessage ||
              'Stored secret status not checked. Refresh to verify worker-managed secrets without revealing values.'}
          </div>
          <Button
            size="sm"
            color="secondary"
            outline
            className={styles.subtleActionButton}
            onClick={refreshSecretPresence}
            disabled={
              secretPresenceStatus === 'loading' ||
              !selectedConfig ||
              !normalizeWorkerUrl(workerUrl || selectedConfigWorkerUrl)
            }
          >
            <FontAwesomeIcon icon={faSync} style={{ marginRight: 6 }} />
            {secretPresenceStatus === 'loading' ? 'Checking...' : 'Refresh secret status'}
          </Button>
        </div>
        <div className={styles.secretOptionsGrid}>
          {filterAdminSecretCards(visibleCardKeys).map((card) => {
            const isOpen = openSecretCards[card.key];
            const cardStatus = getAdminSecretCardStatus({
              fields: card.fields,
              secrets,
              clearedSecretKeys,
              storedSecretPresence,
              secretPresenceStatus,
              workerSecretsDirty,
            });
            return (
              <div key={card.key} className={`${styles.secretOptionCard}${isOpen ? ` ${styles.activeOption}` : ''}`}>
                <button
                  type="button"
                  className={styles.secretOptionHeader}
                  aria-label={card.label}
                  onClick={() => setOpenSecretCards((previous) => ({ ...previous, [card.key]: !previous[card.key] }))}
                  aria-expanded={isOpen}
                >
                  <FontAwesomeIcon
                    icon={cardStatus.iconLocked ? faLock : faLockOpen}
                    style={{ opacity: cardStatus.iconLocked ? 0.9 : 0.4, marginRight: 8 }}
                  />
                  <span className={styles.secretOptionText}>
                    <span>{card.label}</span>
                    <span className={styles.secretOptionMeta}>{cardStatus.label}</span>
                  </span>
                  <FontAwesomeIcon icon={isOpen ? faCaretUp : faCaretDown} style={{ marginLeft: 'auto' }} />
                </button>
                {isOpen && (
                  <div className={styles.secretOptionBody}>
                    {card.fields.map((fieldKey) => {
                      const secretFieldKey = String(fieldKey);
                      const inputType = getAdminSecretFieldInputType(secretFieldKey);
                      const isTextarea = inputType === 'textarea';
                      const label = getAdminSecretFieldLabel(secretFieldKey);
                      return (
                        <FormGroup key={secretFieldKey}>
                          <Label>{label}</Label>
                          <div
                            className={`${styles.secretInputRow}${
                              isTextarea ? ` ${styles.secretInputRowMultiline}` : ''
                            }`}
                          >
                            <Input
                              type={inputType}
                              rows={getAdminSecretFieldRows(secretFieldKey)}
                              value={secrets[secretFieldKey]}
                              onChange={(event: AdminSecretInputChangeEvent) =>
                                handleSecretChange(secretFieldKey, event.target.value)
                              }
                              className={styles.secretInput}
                            />
                            <button
                              type="button"
                              className={`${styles.secretRemoveButton}${
                                clearedSecretKeys.has(secretFieldKey) ? ` ${styles.secretRemoveButtonActive}` : ''
                              }`}
                              onClick={() => handleClearSecret(secretFieldKey)}
                              title={`Clear ${label} on next save`}
                              aria-label={`Clear ${label}`}
                              data-testid={buildAdminSecretRemoveTestId(secretFieldKey)}
                            >
                              <FontAwesomeIcon icon={faTimes} />
                            </button>
                          </div>
                          <div className={styles.secretFieldStatus}>
                            {getAdminSecretFieldStatusLabel({
                              fieldKey: secretFieldKey,
                              secrets,
                              clearedSecretKeys,
                              storedSecretPresence,
                              secretPresenceStatus,
                              workerSecretsDirty,
                            })}
                          </div>
                          {secretFieldKey === 'litAccountApiKey' ? (
                            <div className={styles.warningNote}>
                              Anyone with this key can create new Lit groups, PKPs, usage keys, and actions inside that
                              bundle-owned Lit account. Use disposable per-bundle accounts instead of a shared
                              deployment account.
                            </div>
                          ) : null}
                        </FormGroup>
                      );
                    })}
                    {card.key === 'arweave' && (
                      <InlineResourceSummary
                        label="Arweave balance"
                        resource={arweaveResource}
                        onRefresh={refreshArweaveResource}
                        refreshLabel="Refresh Arweave balance"
                      />
                    )}
                    {card.key === 'faucet' && (
                      <InlineResourceSummary
                        label="Faucet balance"
                        resource={faucetResource}
                        onRefresh={refreshFaucetResource}
                        refreshLabel="Refresh faucet balance"
                      />
                    )}
                    {card.key === 'lit' && (
                      <InlineResourceSummary
                        label={litResourceLabel}
                        resource={litResource}
                        onRefresh={() => refreshLitResource({ includeSignedStatus: true })}
                        refreshLabel="Refresh Lit status"
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {visibleCardKeys.length < ADMIN_SECRET_CARDS.length ? (
          <div className={styles.statusNote}>
            Chain, Arweave, faucet, and Lit secrets appear only when an enabled Advanced hybrid capability needs them.
          </div>
        ) : null}
        {canAdminWorker && workerSecretsDirty && (
          <Button
            color="primary"
            className={styles.actionButton}
            onClick={handleSaveWorkerSecrets}
            disabled={!canAdminWorker}
          >
            Save worker secrets
          </Button>
        )}
        {saveStatus && <div className={styles.statusNote}>{saveStatus}</div>}
        {chainStatus && <div className={styles.statusNote}>{chainStatus}</div>}
      </>
    )}
  </section>
);

export default AdminPageWorkerSecretsPanel;
