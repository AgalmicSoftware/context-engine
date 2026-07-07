import React from 'react';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';

import styles from './SessionWizard.module.scss';
import CreateSBTGroup from '../SBTs/CreateSBTGroup';

type GateLike = {
  id?: string;
  label?: string;
  color?: string;
  mode?: string;
  sbts?: unknown[];
};

type CreateSbtModalState = {
  open?: boolean;
};

type WizardDraftLike = Record<string, unknown> & {
  contracts?: Record<string, unknown>;
  defaultSbtTags?: string;
};

export type SessionWizardCreateSbtModalProps = {
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
  t: (value: string) => string;
};

const SessionWizardCreateSbtModal = ({
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
  t,
}: SessionWizardCreateSbtModalProps) => (
  <Modal
    isOpen={createSbtModalState.open}
    toggle={closeCreateSbtModal}
    className={styles.createSbtModal}
    size="xl"
    scrollable
  >
    <ModalHeader toggle={closeCreateSbtModal} className={styles.createSbtModalHeader}>
      {`Add ${t('sbt')} to Session`}
    </ModalHeader>
    <ModalBody className={styles.createSbtModalBody}>
      <CreateSBTGroup
        account={account}
        provider={provider}
        network={createSbtModalNetwork}
        loginComplete={!!account}
        toggleLoginModal={toggleLoginModal}
        sessionSlug={createSbtModalSessionSlug}
        sessionConfigOverride={{
          ...(draft && typeof draft === 'object' ? draft : {}),
          slug: createSbtModalSessionSlug,
          networkChainId: createSbtModalChainId,
          contracts: draft && typeof draft.contracts === 'object' ? draft.contracts : {},
        }}
        arweaveJwkOverride={createSbtModalArweaveJwkOverride}
        encryptionGates={encryptionGates.map((gate) => ({
          id: gate.id,
          gateId: gate.id,
          label: gate.label,
          name: gate.label,
          color: gate.color,
          mode: gate.mode,
          requireAll: gate.mode === 'all',
          sbtAddresses: normalizeSbtSelection(gate.sbts || []).map((entry) => entry.address),
          chainId: createSbtModalChainId,
        }))}
        defaultGateId={defaultGateId || encryptionGates[0]?.id || ''}
        defaultSbtTags={draft?.defaultSbtTags || ''}
        deferredDeploy={true}
        attemptImmediateDeferredUpload={false}
        hideNetworkSelector={true}
        signAdminAction={signBootstrapAdminAction}
        onSaveDraft={handleSavePendingSbtDraft}
      />
    </ModalBody>
  </Modal>
);

export default SessionWizardCreateSbtModal;
