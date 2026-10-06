import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';
import { Modal, ModalBody, ModalHeader } from 'reactstrap';
import type { WorkerGroup, WorkerGroupMember } from '../../domains/worker/workerGroupPorts';
import { generateBlockieDataUrl } from '../../utilities/ui/blockieAvatars.js';
import { getShortenedAddress } from '../../utilities/ui/displayHelpers.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import sbtPageStyles from '../SBTs/SBTPage.module.scss';

export const workerGroupPrincipalIdentity = (member: WorkerGroupMember): string => {
  const principal = member.principal;
  if (!principal) return '';
  if (principal.kind === 'evm_address' || principal.kind === 'passkey_account') return principal.address;
  if (principal.kind === 'telegram') return principal.principalId;
  return principal.kind === 'agent' ? principal.grantId : '';
};

const workerGroupPrincipalKindLabel = (member: WorkerGroupMember): string => {
  const kind = member.principal?.kind;
  if (kind === 'passkey_account') return 'Passkey';
  if (kind === 'telegram') return 'Telegram';
  if (kind === 'agent') return 'Agent';
  return '';
};

type WorkerGroupMembersModalProps = {
  error: string;
  group: WorkerGroup;
  isOpen: boolean;
  memberCount?: number;
  members: WorkerGroupMember[];
  nextCursor: string;
  onClose: () => void;
  onLoadMore: () => void;
  status: 'idle' | 'loading' | 'ready' | 'error';
};

const WorkerGroupMembersModal = ({
  error,
  group,
  isOpen,
  memberCount,
  members,
  nextCursor,
  onClose,
  onLoadMore,
  status,
}: WorkerGroupMembersModalProps) => {
  const closeButton = (
    <button type="button" className={sbtPageStyles.modalCloseButton} onClick={onClose} aria-label="Close members">
      <FontAwesomeIcon icon={faTimes} />
    </button>
  );
  const showCount = Number.isSafeInteger(memberCount) && Number(memberCount) >= 0;
  const memberDirectoryUnavailable = error === 'worker_group_member_directory_unavailable';

  return (
    <Modal
      isOpen={isOpen}
      toggle={onClose}
      className={sbtPageStyles.modal}
      contentClassName={sbtPageStyles.modalContent}
      size="lg"
      centered
    >
      <ModalHeader toggle={onClose} close={closeButton} className={sbtPageStyles.modalHeader}>
        <div className={sbtPageStyles.modalTitleStack}>
          <div className={sbtPageStyles.modalTitleRow}>
            <span className={sbtPageStyles.modalTitle}>
              {group.label} members
              {showCount ? <span className={sbtPageStyles.modalTitleCount}>({memberCount})</span> : null}
            </span>
          </div>
        </div>
      </ModalHeader>
      <ModalBody className={sbtPageStyles.modalBody}>
        <div className={sbtPageStyles.userList}>
          {status === 'loading' && members.length === 0 ? (
            <div className={sbtPageStyles.emptyState}>
              <FontAwesomeIcon icon={faSpinner} spin size="2x" aria-label="Loading members" />
            </div>
          ) : null}
          {status === 'error' ? (
            <div className={sbtPageStyles.emptyState}>
              {memberDirectoryUnavailable
                ? 'Individual members are not available from this session’s current Worker. The total member count is still available.'
                : `Members could not be loaded (${error}).`}
            </div>
          ) : null}
          {status === 'ready' && members.length === 0 ? (
            <div className={sbtPageStyles.emptyState}>No members found.</div>
          ) : null}
          {members.map((member) => {
            const identity = workerGroupPrincipalIdentity(member);
            const kindLabel = workerGroupPrincipalKindLabel(member);
            const isAddress = member.principal?.kind === 'evm_address' || member.principal?.kind === 'passkey_account';
            const blockieUrl = generateBlockieDataUrl(
              `${member.principal?.kind || 'member'}:${identity}`.toLowerCase(),
              8,
              4,
            );
            return (
              <div key={`${member.principal?.kind || 'member'}:${identity}`} className={sbtPageStyles.userItem}>
                <div className={sbtPageStyles.userItemLeft}>
                  {blockieUrl ? <img src={blockieUrl} alt="" className={sbtPageStyles.userBlockie} /> : null}
                  {isAddress ? (
                    <a
                      href={buildPublicRoute(`/u/${identity}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={sbtPageStyles.userAddressLink}
                      title={identity}
                    >
                      {kindLabel ? `${kindLabel} · ` : ''}
                      {getShortenedAddress(identity, false)}
                    </a>
                  ) : (
                    <span className={sbtPageStyles.userAddressLink} title={identity}>
                      {kindLabel ? `${kindLabel} · ` : ''}
                      {identity}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {nextCursor ? (
            <button type="button" onClick={onLoadMore} disabled={status === 'loading'}>
              {status === 'loading' ? 'Loading…' : 'Load more'}
            </button>
          ) : null}
        </div>
      </ModalBody>
    </Modal>
  );
};

export default WorkerGroupMembersModal;
