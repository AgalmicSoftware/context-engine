import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
import WorkerGroupCreateForm from '../Shared/WorkerGroupCreateForm';
import styles from './SessionWizard.module.scss';
import { SetupHelp, setupHelpId } from './setup/SetupPrimitives';
import { MAX_PENDING_WORKER_GROUP_DRAFTS, type PendingWorkerGroupDraft } from './sessionWizardPendingWorkerGroups';

const GROUPS_HELP =
  'Each group gets the same choices and fields as when you create one on the session page. Groups are made after this session’s Worker is deployed and verified.';

type SessionWorkerGroupDraftsPanelProps = {
  drafts?: PendingWorkerGroupDraft[];
  memberCeiling: number;
  /** Adds an empty group, named in its own form. */
  onAdd: (label: string) => void;
  onRemove: (groupId: string) => void;
  onUpdate: (groupId: string, patch: Partial<PendingWorkerGroupDraft>) => void;
};

const getDraftTitle = (draft: PendingWorkerGroupDraft, index: number): string =>
  draft.label.trim() ? `Group ${index + 1}: ${draft.label.trim()}` : `Group ${index + 1}`;

const getDraftDomId = (groupId: string, index: number): string => {
  const safeGroupId = groupId.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `ce-new-worker-group-draft-${safeGroupId || index + 1}`;
};

const SessionWorkerGroupDraftsPanel = ({
  drafts = [],
  memberCeiling,
  onAdd,
  onRemove,
  onUpdate,
}: SessionWorkerGroupDraftsPanelProps) => {
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const activeGroupIds = new Set(drafts.map((draft) => draft.groupId));
    setCollapsedGroupIds((current) => {
      const next = new Set([...current].filter((groupId) => activeGroupIds.has(groupId)));
      return next.size === current.size ? current : next;
    });
  }, [drafts]);

  // After Create group, the new group's name, so the next step is where focus lands.
  const [focusNewest, setFocusNewest] = useState(false);
  useEffect(() => {
    if (!focusNewest || !drafts.length) return;
    setFocusNewest(false);
    const newest = drafts.length - 1;
    document.getElementById(`${getDraftDomId(drafts[newest].groupId, newest)}-input`)?.focus();
  }, [drafts, focusNewest]);

  const toggleDraftCollapsed = (groupId: string) => {
    setCollapsedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  return (
    <div className={styles.pendingWorkerGroups} data-testid="ce-new-worker-group-drafts">
      <div className={styles.pendingWorkerGroupsHeader}>
        <div>
          <span className={styles.pendingWorkerGroupsTitle}>
            <strong>Groups to create</strong>
            <SetupHelp id="ce-new-worker-groups" label="Groups to create" help={GROUPS_HELP} />
          </span>
          <span>{drafts.length ? `${drafts.length} queued` : 'Optional'}</span>
        </div>
      </div>

      <div className={styles.pendingWorkerGroupAddRow}>
        <button
          type="button"
          onClick={() => {
            onAdd('');
            setFocusNewest(true);
          }}
          disabled={drafts.length >= MAX_PENDING_WORKER_GROUP_DRAFTS}
          aria-describedby={setupHelpId('ce-new-worker-groups')}
          data-testid="ce-new-worker-group-add"
        >
          <FontAwesomeIcon icon={faPlus} aria-hidden="true" /> Create group
        </button>
      </div>

      {drafts.length ? (
        <div className={styles.pendingWorkerGroupList}>
          {drafts.map((draft, index) => {
            const title = getDraftTitle(draft, index);
            const draftDomId = getDraftDomId(draft.groupId, index);
            const titleId = `${draftDomId}-title`;
            const bodyId = `${draftDomId}-body`;
            const collapsed = collapsedGroupIds.has(draft.groupId);
            return (
              <article
                key={draft.groupId}
                className={styles.pendingWorkerGroupCard}
                data-testid="ce-new-worker-group-draft"
                data-ce-group-index={index}
                aria-labelledby={titleId}
              >
                <div className={styles.pendingWorkerGroupCardHeader}>
                  <div className={styles.pendingWorkerGroupCardTitleWrap}>
                    <h4 id={titleId}>{title}</h4>
                  </div>
                  <div className={styles.pendingWorkerGroupCardActions}>
                    <button
                      type="button"
                      className={styles.pendingWorkerGroupIconButton}
                      onClick={() => toggleDraftCollapsed(draft.groupId)}
                      aria-expanded={!collapsed}
                      aria-controls={bodyId}
                      aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${title}`}
                      data-ce-control-appearance="frameless"
                    >
                      <FontAwesomeIcon icon={collapsed ? faCaretDown : faCaretUp} />
                    </button>
                    <button
                      type="button"
                      className={styles.pendingWorkerGroupIconButton}
                      onClick={() => onRemove(draft.groupId)}
                      aria-label={`Remove ${draft.label || `Group ${index + 1}`}`}
                      data-ce-control-appearance="frameless"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
                <div id={bodyId} className={styles.pendingWorkerGroupCardBody} hidden={collapsed}>
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
                    memberLimitMax={memberCeiling}
                    joinEndsAt={draft.joinEndsAt}
                    adminAddress={draft.adminAddress}
                    joinMode={draft.joinMode}
                    joinModeTestId="ce-new-worker-group-draft-join-mode"
                    label={draft.label}
                    labelTestId="ce-new-worker-group-draft-label"
                    idPrefix={draftDomId}
                    memberVisibility={draft.memberVisibility}
                    memberVisibilityTestId="ce-new-worker-group-draft-visibility"
                    removalAuth={draft.removalAuth}
                    removalAuthTestId="ce-new-worker-group-draft-removal-auth"
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
                    onRemovalAuthChange={(removalAuth) => onUpdate(draft.groupId, { removalAuth })}
                    onAdminAddressChange={(adminAddress) => onUpdate(draft.groupId, { adminAddress })}
                    onTagsChange={(tags) => onUpdate(draft.groupId, { tags })}
                    onReset={() => undefined}
                    onSubmit={() => undefined}
                  />
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default SessionWorkerGroupDraftsPanel;
