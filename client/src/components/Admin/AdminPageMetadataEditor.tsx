import React from 'react';
import { Button, FormGroup, FormText, Input, Label } from 'reactstrap';
import SBTSelector from '../SBTs/SBTSelector';
import { toStr } from '../../utilities/shared/primitives.js';
import { normalizeSlug } from './adminPageHelpers';
import { ADMIN_AI_PROVIDER_OPTIONS, ADMIN_EDITABLE_CONTRACT_KEY_SET } from './adminPageMetadataDraftHelpers';
import { dedupeSbtSelections, type AdminSbtSelection } from './adminPageSbtGateSelectionHelpers';
import styles from './AdminPage.module.scss';

type AdminMetadataBlockLimitsDraft = {
  start: string;
  end: string;
};
type AdminMetadataDraft = Record<string, unknown> & {
  defaultFeaturedSBTs?: unknown;
};
type AdminContractEntry = Record<string, unknown>;
type AdminFormInputElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type AdminFormChangeEvent = React.ChangeEvent<AdminFormInputElement>;

type AdminPageMetadataEditorProps = {
  metadataConfigDraft: AdminMetadataDraft;
  updateMetadataConfigDraft: (key: string, value: unknown) => void;
  metadataAutoFeatureDraft: boolean;
  setMetadataDraftTouched: (value: boolean) => void;
  setMetadataAutoFeatureTouched: (value: boolean) => void;
  setMetadataAutoFeatureDraft: (value: boolean) => void;
  network: unknown;
  relevantSessionChainId: number;
  relevantSessionChainLabel: string;
  relevantRegistryChainLabel: string;
  selectedSlug: string;
  ensureLightSbtUniverse?: () => unknown;
  metadataBlockLimitsDraft: AdminMetadataBlockLimitsDraft;
  setMetadataBlockLimitsDraft: React.Dispatch<React.SetStateAction<AdminMetadataBlockLimitsDraft>>;
  currentBlockSummary: string;
  handleUseCurrentBlockForMetadata: () => void;
  metadataUpdateBusy: boolean;
  metadataLatestBlock: unknown;
  metadataContractsNeedVerification: boolean;
  metadataDefaultedEditableContractKeys: string[];
  metadataContractsVerified: boolean;
  setMetadataContractsVerified: (value: boolean) => void;
  metadataContractsReadyForSave: boolean;
  readonlyMetadataContracts: Array<[string, AdminContractEntry]>;
  visibleMetadataContracts: Array<[string, AdminContractEntry]>;
  handleSaveSessionMetadata: () => void;
  metadataUpdateStatus: string;
  showChainFields?: boolean;
};

const draftValue = (draft: AdminMetadataDraft, key: string): string => toStr(draft[key]);

const draftArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const getInputValue = (event: AdminFormChangeEvent): string => event.target.value;

const AdminPageMetadataEditor = ({
  metadataConfigDraft,
  updateMetadataConfigDraft,
  metadataAutoFeatureDraft,
  setMetadataDraftTouched,
  setMetadataAutoFeatureTouched,
  setMetadataAutoFeatureDraft,
  network,
  relevantSessionChainId,
  relevantSessionChainLabel,
  relevantRegistryChainLabel,
  selectedSlug,
  ensureLightSbtUniverse,
  metadataBlockLimitsDraft,
  setMetadataBlockLimitsDraft,
  currentBlockSummary,
  handleUseCurrentBlockForMetadata,
  metadataUpdateBusy,
  metadataLatestBlock,
  metadataContractsNeedVerification,
  metadataDefaultedEditableContractKeys,
  metadataContractsVerified,
  setMetadataContractsVerified,
  metadataContractsReadyForSave,
  readonlyMetadataContracts,
  visibleMetadataContracts,
  handleSaveSessionMetadata,
  metadataUpdateStatus,
  showChainFields = true,
}: AdminPageMetadataEditorProps) => (
  <div className={styles.metadataEditorCard}>
    <div className={styles.metadataEditorIntro}>
      {showChainFields
        ? 'Publish session defaults and curation metadata here. Block limits, faucet settings, contracts, and registry/RPC context are also synced to worker config when a worker URL is available.'
        : 'Update canonical Session Worker defaults here. This Worker-native save does not require chain defaults, contracts, block limits, a faucet, or Arweave metadata.'}
    </div>
    <div className={styles.metadataSectionGrid}>
      <div className={styles.metadataSectionCard}>
        <div className={styles.panelSubtitle}>Session defaults</div>
        <div className={styles.metadataEditorGrid}>
          <FormGroup>
            <Label>Default tags</Label>
            <Input
              value={draftValue(metadataConfigDraft, 'defaultTags')}
              placeholder="ai, governance, survey"
              onChange={(event: AdminFormChangeEvent) => updateMetadataConfigDraft('defaultTags', getInputValue(event))}
            />
          </FormGroup>
          {showChainFields ? (
            <FormGroup>
              <Label>Default SBT tags</Label>
              <Input
                value={draftValue(metadataConfigDraft, 'defaultSbtTags')}
                placeholder="member, contributor"
                onChange={(event: AdminFormChangeEvent) =>
                  updateMetadataConfigDraft('defaultSbtTags', getInputValue(event))
                }
              />
            </FormGroup>
          ) : null}
        </div>
        <FormGroup className={styles.metadataTextAreaGroup}>
          <Label>Question generation prompt</Label>
          <Input
            type="textarea"
            rows={4}
            value={draftValue(metadataConfigDraft, 'questionsGenPrompt')}
            placeholder="Optional prompt used when auto-generating questions"
            onChange={(event: AdminFormChangeEvent) =>
              updateMetadataConfigDraft('questionsGenPrompt', getInputValue(event))
            }
          />
        </FormGroup>
        <FormGroup className={styles.metadataTextAreaGroup}>
          <Label>Default filter state</Label>
          <Input
            type="textarea"
            rows={4}
            value={draftValue(metadataConfigDraft, 'defaultFilterState')}
            placeholder='{"sort":"recent"} or tag=ai&sort=recent'
            onChange={(event: AdminFormChangeEvent) =>
              updateMetadataConfigDraft('defaultFilterState', getInputValue(event))
            }
          />
        </FormGroup>
        {showChainFields ? (
          <FormGroup check className={styles.metadataToggle}>
            <Label check className={styles.metadataToggleLabel}>
              <Input
                type="checkbox"
                checked={metadataAutoFeatureDraft}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  setMetadataDraftTouched(true);
                  setMetadataAutoFeatureTouched(true);
                  setMetadataAutoFeatureDraft(!!event.target.checked);
                }}
              />
              Auto-feature by session slug
            </Label>
          </FormGroup>
        ) : null}
        {showChainFields ? (
          <FormGroup className={styles.metadataSelectorGroup}>
            <Label>Default featured SBTs</Label>
            <SBTSelector
              id="admin-default-featured-sbts"
              label=""
              selectedSBTs={metadataConfigDraft.defaultFeaturedSBTs}
              onAddSBT={(sbt: unknown) => {
                updateMetadataConfigDraft(
                  'defaultFeaturedSBTs',
                  dedupeSbtSelections([...draftArray(metadataConfigDraft.defaultFeaturedSBTs), sbt]),
                );
              }}
              onRemoveSBT={(address: string) => {
                updateMetadataConfigDraft(
                  'defaultFeaturedSBTs',
                  dedupeSbtSelections(metadataConfigDraft.defaultFeaturedSBTs).filter(
                    (entry: AdminSbtSelection) => toStr(entry.address).toLowerCase() !== toStr(address).toLowerCase(),
                  ),
                );
              }}
              network={network}
              chainId={relevantSessionChainId || asRecord(network).id || null}
              sessionSlug={normalizeSlug(selectedSlug)}
              variant="admin"
              ensureLightSbtUniverse={ensureLightSbtUniverse}
              defaultFeaturedSBTs={draftArray(metadataConfigDraft.defaultFeaturedSBTs).map((entry) =>
                toStr(asRecord(entry).address),
              )}
            />
          </FormGroup>
        ) : null}
      </div>

      <div className={styles.metadataSectionCard}>
        <div className={styles.panelSubtitle}>AI defaults</div>
        <div className={styles.metadataEditorGrid}>
          <FormGroup>
            <Label>Fast provider</Label>
            <Input
              type="select"
              value={draftValue(metadataConfigDraft, 'aiFastProvider')}
              onChange={(event: AdminFormChangeEvent) =>
                updateMetadataConfigDraft('aiFastProvider', getInputValue(event))
              }
            >
              {ADMIN_AI_PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Input>
          </FormGroup>
          <FormGroup>
            <Label>Fast model</Label>
            <Input
              value={draftValue(metadataConfigDraft, 'aiFastModel')}
              onChange={(event: AdminFormChangeEvent) => updateMetadataConfigDraft('aiFastModel', getInputValue(event))}
            />
          </FormGroup>
          <FormGroup>
            <Label>Thinking provider</Label>
            <Input
              type="select"
              value={draftValue(metadataConfigDraft, 'aiThinkingProvider')}
              onChange={(event: AdminFormChangeEvent) =>
                updateMetadataConfigDraft('aiThinkingProvider', getInputValue(event))
              }
            >
              {ADMIN_AI_PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Input>
          </FormGroup>
          <FormGroup>
            <Label>Thinking model</Label>
            <Input
              value={draftValue(metadataConfigDraft, 'aiThinkingModel')}
              onChange={(event: AdminFormChangeEvent) =>
                updateMetadataConfigDraft('aiThinkingModel', getInputValue(event))
              }
            />
          </FormGroup>
          <FormGroup>
            <Label>Transcription provider</Label>
            <Input
              type="select"
              value={draftValue(metadataConfigDraft, 'aiTranscriptionProvider')}
              onChange={(event: AdminFormChangeEvent) =>
                updateMetadataConfigDraft('aiTranscriptionProvider', getInputValue(event))
              }
            >
              <option value="openai">OpenAI</option>
            </Input>
          </FormGroup>
          <FormGroup>
            <Label>Transcription model</Label>
            <Input
              value={draftValue(metadataConfigDraft, 'aiTranscriptionModel')}
              onChange={(event: AdminFormChangeEvent) =>
                updateMetadataConfigDraft('aiTranscriptionModel', getInputValue(event))
              }
            />
          </FormGroup>
        </div>
      </div>

      {showChainFields ? (
        <div className={styles.metadataSectionCard}>
          <div className={styles.panelSubtitle}>Runtime sync</div>
          <div className={styles.metadataEditorGrid}>
            <FormGroup>
              <Label>Start block</Label>
              <Input
                type="number"
                value={metadataBlockLimitsDraft.start}
                onChange={(event: AdminFormChangeEvent) => {
                  setMetadataDraftTouched(true);
                  setMetadataBlockLimitsDraft((prev) => ({
                    ...(prev || {}),
                    start: getInputValue(event),
                  }));
                }}
              />
            </FormGroup>
            <FormGroup>
              <Label>End block</Label>
              <Input
                type="number"
                value={metadataBlockLimitsDraft.end}
                placeholder="Optional"
                onChange={(event: AdminFormChangeEvent) => {
                  setMetadataDraftTouched(true);
                  setMetadataBlockLimitsDraft((prev) => ({
                    ...(prev || {}),
                    end: getInputValue(event),
                  }));
                }}
              />
            </FormGroup>
            <FormGroup>
              <Label>Faucet amount (ETH)</Label>
              <Input
                value={draftValue(metadataConfigDraft, 'faucetAmountEth')}
                placeholder="0.0002"
                onChange={(event: AdminFormChangeEvent) =>
                  updateMetadataConfigDraft('faucetAmountEth', getInputValue(event))
                }
              />
            </FormGroup>
            <FormGroup>
              <Label>Faucet threshold (ETH)</Label>
              <Input
                value={draftValue(metadataConfigDraft, 'faucetBalanceThresholdEth')}
                placeholder="0.001"
                onChange={(event: AdminFormChangeEvent) =>
                  updateMetadataConfigDraft('faucetBalanceThresholdEth', getInputValue(event))
                }
              />
            </FormGroup>
          </div>
          {currentBlockSummary && <div className={styles.statusNote}>{currentBlockSummary}</div>}
          <Button
            size="sm"
            color="secondary"
            outline
            className={styles.actionButton}
            onClick={handleUseCurrentBlockForMetadata}
            disabled={metadataUpdateBusy || !metadataLatestBlock}
          >
            Use current block
          </Button>
        </div>
      ) : null}

      {showChainFields ? (
        <div className={styles.metadataSectionCard}>
          <div className={styles.panelSubtitle}>Contracts</div>
          <div className={styles.metadataEditorGrid}>
            <FormGroup>
              <Label>Surveys contract</Label>
              <Input
                value={draftValue(metadataConfigDraft, 'contractSurveysAddress')}
                placeholder="0x..."
                onChange={(event: AdminFormChangeEvent) =>
                  updateMetadataConfigDraft('contractSurveysAddress', getInputValue(event))
                }
              />
              <FormText color="muted">Chain: {relevantSessionChainLabel || 'Uses session chain'}</FormText>
            </FormGroup>
            <FormGroup>
              <Label>SBT factory contract</Label>
              <Input
                value={draftValue(metadataConfigDraft, 'contractSbtFactoryAddress')}
                placeholder="0x..."
                onChange={(event: AdminFormChangeEvent) =>
                  updateMetadataConfigDraft('contractSbtFactoryAddress', getInputValue(event))
                }
              />
              <FormText color="muted">Chain: {relevantSessionChainLabel || 'Uses session chain'}</FormText>
            </FormGroup>
            <FormGroup>
              <Label>SessionRegistry contract</Label>
              <Input
                value={draftValue(metadataConfigDraft, 'contractSessionRegistryAddress')}
                placeholder="0x..."
                onChange={(event: AdminFormChangeEvent) =>
                  updateMetadataConfigDraft('contractSessionRegistryAddress', getInputValue(event))
                }
              />
              <FormText color="muted">
                Chain: {relevantRegistryChainLabel || relevantSessionChainLabel || 'Uses registry chain'}
              </FormText>
            </FormGroup>
          </div>
          {metadataContractsNeedVerification && metadataDefaultedEditableContractKeys.length > 0 && (
            <FormGroup check className={styles.metadataToggle}>
              <Label check className={styles.metadataToggleLabel}>
                <Input
                  type="checkbox"
                  checked={metadataContractsVerified}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setMetadataContractsVerified(!!event.target.checked)
                  }
                />
                I verified these fallback defaults and want to publish them if I save metadata
              </Label>
            </FormGroup>
          )}
          {metadataContractsNeedVerification && !metadataContractsReadyForSave && (
            <div className={styles.warningNote}>
              Saving is blocked until you verify or edit the synthesized contract addresses above.
            </div>
          )}
          {readonlyMetadataContracts.length ? (
            <div className={styles.metadataReadonlyGrid}>
              {readonlyMetadataContracts.map(([key, value]) => (
                <div key={key} className={styles.metadataReadonlyItem}>
                  <span>{key}</span>
                  <strong>{toStr(value.address).trim() || '—'}</strong>
                  <span>{toStr(value.chainId).trim() || '—'}</span>
                </div>
              ))}
            </div>
          ) : null}
          {!visibleMetadataContracts.length && (
            <div className={styles.statusNote}>No contract metadata found for this session.</div>
          )}
        </div>
      ) : null}
    </div>

    <div className={styles.metadataSectionCard}>
      <div className={styles.panelSubtitle}>Curated lists</div>
      <div className={styles.metadataSectionGrid}>
        <FormGroup className={styles.metadataTextAreaGroup}>
          <Label>Highlighted question IDs</Label>
          <Input
            type="textarea"
            rows={3}
            value={draftValue(metadataConfigDraft, 'highlightedQuestionIds')}
            placeholder="One question id per line"
            onChange={(event: AdminFormChangeEvent) =>
              updateMetadataConfigDraft('highlightedQuestionIds', getInputValue(event))
            }
          />
        </FormGroup>
        <FormGroup className={styles.metadataTextAreaGroup}>
          <Label>Blocked question IDs</Label>
          <Input
            type="textarea"
            rows={3}
            value={draftValue(metadataConfigDraft, 'blockedQuestionIds')}
            placeholder="One question id per line"
            onChange={(event: AdminFormChangeEvent) =>
              updateMetadataConfigDraft('blockedQuestionIds', getInputValue(event))
            }
          />
        </FormGroup>
        <FormGroup className={styles.metadataTextAreaGroup}>
          <Label>Highlighted survey IDs</Label>
          <Input
            type="textarea"
            rows={3}
            value={draftValue(metadataConfigDraft, 'highlightedSurveyIds')}
            placeholder="One survey id per line"
            onChange={(event: AdminFormChangeEvent) =>
              updateMetadataConfigDraft('highlightedSurveyIds', getInputValue(event))
            }
          />
        </FormGroup>
        <FormGroup className={styles.metadataTextAreaGroup}>
          <Label>Blocked survey IDs</Label>
          <Input
            type="textarea"
            rows={3}
            value={draftValue(metadataConfigDraft, 'blockedSurveyIds')}
            placeholder="One survey id per line"
            onChange={(event: AdminFormChangeEvent) =>
              updateMetadataConfigDraft('blockedSurveyIds', getInputValue(event))
            }
          />
        </FormGroup>
        {showChainFields ? (
          <FormGroup className={styles.metadataTextAreaGroup}>
            <Label>Ignored SBT list</Label>
            <Input
              type="textarea"
              rows={3}
              value={draftValue(metadataConfigDraft, 'ignoredSbtsList')}
              placeholder="One SBT address per line"
              onChange={(event: AdminFormChangeEvent) =>
                updateMetadataConfigDraft('ignoredSbtsList', getInputValue(event))
              }
            />
          </FormGroup>
        ) : null}
        {showChainFields ? (
          <FormGroup className={styles.metadataTextAreaGroup}>
            <Label>Featured SBT list</Label>
            <Input
              type="textarea"
              rows={3}
              value={draftValue(metadataConfigDraft, 'featuredSbtsList')}
              placeholder="One SBT address per line"
              onChange={(event: AdminFormChangeEvent) =>
                updateMetadataConfigDraft('featuredSbtsList', getInputValue(event))
              }
            />
          </FormGroup>
        ) : null}
      </div>
    </div>

    <div className={styles.metadataEditorActions}>
      <Button
        color="primary"
        className={styles.actionButton}
        onClick={handleSaveSessionMetadata}
        disabled={metadataUpdateBusy}
      >
        {metadataUpdateBusy ? 'Updating metadata…' : 'Update metadata'}
      </Button>
    </div>
    {metadataUpdateStatus && <div className={styles.statusNote}>{metadataUpdateStatus}</div>}
  </div>
);

export default AdminPageMetadataEditor;
