import React from 'react';

import type { ContractViewerContract } from '../DocsPage/ContractViewer';
import SessionHeaderPreviewModal from './SessionHeaderPreviewModal';
import SessionWizardContractViewerModal from './SessionWizardContractViewerModal';
import SessionWizardCreateSbtModal from './SessionWizardCreateSbtModal';

type GateLike = {
  id?: string;
  label?: string;
  color?: string;
  mode?: string;
  sbts?: unknown[];
};

type ContractViewerModalState = {
  open?: boolean;
};

type CreateSbtModalState = {
  open?: boolean;
};

type WizardDraftLike = Record<string, unknown> & {
  contracts?: Record<string, unknown>;
  defaultSbtTags?: string;
};

type SessionWizardModalsProps = {
  account?: string;
  provider?: unknown;
  createSbtModalState: CreateSbtModalState;
  closeCreateSbtModal: () => void;
  createSbtModalNetwork: unknown;
  toggleLoginModal?: (() => void) | null;
  createSbtModalSessionSlug: string;
  draft: WizardDraftLike;
  createSbtModalChainId: number | null;
  createSbtModalArweaveJwkOverride: string;
  encryptionGates: GateLike[];
  normalizeSbtSelection: (value: unknown[]) => Array<{ address?: string }>;
  defaultGateId: string;
  signBootstrapAdminAction: (input: Record<string, unknown>) => unknown;
  handleSavePendingSbtDraft: (draftPayload: unknown) => unknown;
  contractViewerModalState: ContractViewerModalState;
  selectedWizardContract: ContractViewerContract | null;
  closeContractViewerModal: () => void;
  selectedWizardContractHref: string;
  sessionHeaderPreviewModalOpen: boolean;
  onCloseSessionHeaderPreviewModal: () => void;
  sessionHeaderPreviewSrc: string;
  t: (value: string) => string;
};

const SessionWizardModals = ({
  account,
  provider,
  createSbtModalState,
  closeCreateSbtModal,
  createSbtModalNetwork,
  toggleLoginModal,
  createSbtModalSessionSlug,
  draft,
  createSbtModalChainId,
  createSbtModalArweaveJwkOverride,
  encryptionGates,
  normalizeSbtSelection,
  defaultGateId,
  signBootstrapAdminAction,
  handleSavePendingSbtDraft,
  contractViewerModalState,
  selectedWizardContract,
  closeContractViewerModal,
  selectedWizardContractHref,
  sessionHeaderPreviewModalOpen,
  onCloseSessionHeaderPreviewModal,
  sessionHeaderPreviewSrc,
  t,
}: SessionWizardModalsProps) => (
  <>
    <SessionWizardCreateSbtModal
      account={account}
      provider={provider}
      createSbtModalState={createSbtModalState}
      closeCreateSbtModal={closeCreateSbtModal}
      createSbtModalNetwork={createSbtModalNetwork}
      toggleLoginModal={toggleLoginModal}
      createSbtModalSessionSlug={createSbtModalSessionSlug}
      draft={draft}
      createSbtModalChainId={createSbtModalChainId}
      createSbtModalArweaveJwkOverride={createSbtModalArweaveJwkOverride}
      encryptionGates={encryptionGates}
      normalizeSbtSelection={normalizeSbtSelection}
      defaultGateId={defaultGateId}
      signBootstrapAdminAction={signBootstrapAdminAction}
      handleSavePendingSbtDraft={handleSavePendingSbtDraft}
      t={t}
    />

    <SessionWizardContractViewerModal
      contractViewerModalState={contractViewerModalState}
      selectedWizardContract={selectedWizardContract}
      closeContractViewerModal={closeContractViewerModal}
      selectedWizardContractHref={selectedWizardContractHref}
    />

    <SessionHeaderPreviewModal
      isOpen={sessionHeaderPreviewModalOpen}
      onClose={onCloseSessionHeaderPreviewModal}
      previewSrc={sessionHeaderPreviewSrc}
    />
  </>
);

export default SessionWizardModals;
