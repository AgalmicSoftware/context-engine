import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import WorkerGroupCreateForm from '../Shared/WorkerGroupCreateForm';
import styles from './SessionWizard.module.scss';
import type { PendingWorkerGroupDraft } from './sessionWizardPendingWorkerGroups';

type SessionWorkerGroupDraftsPanelProps = {
  drafts?: PendingWorkerGroupDraft[];
  onAdd: (label: string) => void;
  onRemove: (groupId: string) => void;
  onUpdate: (groupId: string, patch: Partial<PendingWorkerGroupDraft>) => void;
};

const SessionWorkerGroupDraftsPanel = ({
  drafts = [],
  onAdd,
  onRemove,
  onUpdate,
}: SessionWorkerGroupDraftsPanelProps) => {
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const addGroup = () => {
    const label = newGroupLabel.trim();
    if (!label) return;
    onAdd(label);
    setNewGroupLabel('');
  };

  return (
    <div className={styles.pendingWorkerGroups} data-testid="ce-new-worker-group-drafts">
      <div className={styles.pendingWorkerGroupsHeader}>
        <div>
          <strong>Groups to create</strong>
          <span>{drafts.length ? `${drafts.length} queued` : 'Optional'}</span>
        </div>
        <p>Draft Groups now; they are created after this session&rsquo;s Worker is deployed and verified.</p>
      </div>

      <div className={styles.pendingWorkerGroupAddRow}>
        <label htmlFor="ce-new-worker-group-name">Group name</label>
        <div>
          <input
            id="ce-new-worker-group-name"
            value={newGroupLabel}
            maxLength={120}
            placeholder="e.g. Research team"
            onChange={(event) => setNewGroupLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addGroup();
              }
            }}
            data-testid="ce-new-worker-group-name"
          />
          <button
            type="button"
            onClick={addGroup}
            disabled={!newGroupLabel.trim() || drafts.length >= 100}
            data-testid="ce-new-worker-group-add"
          >
            <FontAwesomeIcon icon={faPlus} /> Add Group
          </button>
        </div>
      </div>

      {drafts.length ? (
        <div className={styles.pendingWorkerGroupList}>
          {drafts.map((draft, index) => (
            <article
              key={draft.groupId}
              className={styles.pendingWorkerGroupCard}
              data-testid="ce-new-worker-group-draft"
              data-ce-group-index={index}
            >
              <div className={styles.pendingWorkerGroupCardHeader}>
                <strong>Group {index + 1}</strong>
                <button
                  type="button"
                  onClick={() => onRemove(draft.groupId)}
                  aria-label={`Remove ${draft.label || `Group ${index + 1}`}`}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
              <WorkerGroupCreateForm
                embedded={true}
                busy={false}
                description={draft.description}
                descriptionTestId="ce-new-worker-group-draft-description"
                imageFile={draft.imageFile || null}
                imageTestId="ce-new-worker-group-draft-image"
                imageUrl={draft.imageUrl}
                tags={draft.tags}
                documentURLs={draft.documentURLs}
                memberLimit={draft.memberLimit}
                joinEndsAt={draft.joinEndsAt}
                adminAddress={draft.adminAddress}
                joinMode={draft.joinMode}
                joinModeTestId="ce-new-worker-group-draft-join-mode"
                label={draft.label}
                labelTestId="ce-new-worker-group-draft-label"
                memberVisibility={draft.memberVisibility}
                memberVisibilityTestId="ce-new-worker-group-draft-visibility"
                rootTestId="ce-new-worker-group-draft-form"
                sessionSlug="pending-session"
                submitTestId="ce-new-worker-group-draft-submit"
                deferImageUpload={true}
                deferredImageStatusText="Image ready in this tab. It will upload after the session Worker is deployed."
                onDescriptionChange={(description) => onUpdate(draft.groupId, { description })}
                onDocumentURLsChange={(documentURLs) => onUpdate(draft.groupId, { documentURLs })}
                onImageFileChange={(imageFile) => onUpdate(draft.groupId, { imageFile })}
                onImageUrlChange={(imageUrl) => onUpdate(draft.groupId, { imageUrl })}
                onJoinEndsAtChange={(joinEndsAt) => onUpdate(draft.groupId, { joinEndsAt })}
                onJoinModeChange={(joinMode) => onUpdate(draft.groupId, { joinMode })}
                onLabelChange={(label) => onUpdate(draft.groupId, { label })}
                onMemberLimitChange={(memberLimit) => onUpdate(draft.groupId, { memberLimit })}
                onMemberVisibilityChange={(memberVisibility) => onUpdate(draft.groupId, { memberVisibility })}
                onAdminAddressChange={(adminAddress) => onUpdate(draft.groupId, { adminAddress })}
                onTagsChange={(tags) => onUpdate(draft.groupId, { tags })}
                onReset={() => undefined}
                onSubmit={() => undefined}
              />
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default SessionWorkerGroupDraftsPanel;
