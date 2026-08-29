import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';
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
            <article key={draft.groupId} className={styles.pendingWorkerGroupCard}>
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
              <label>
                Name
                <input
                  value={draft.label}
                  maxLength={120}
                  required
                  onChange={(event) => onUpdate(draft.groupId, { label: event.target.value })}
                />
              </label>
              <label>
                Description <span>optional</span>
                <textarea
                  value={draft.description}
                  maxLength={500}
                  rows={2}
                  onChange={(event) => onUpdate(draft.groupId, { description: event.target.value })}
                />
              </label>
              <div className={styles.pendingWorkerGroupOptions}>
                <label>
                  Joining
                  <select
                    value={draft.joinMode}
                    onChange={(event) =>
                      onUpdate(draft.groupId, {
                        joinMode: event.target.value === 'admin_add' ? 'admin_add' : 'open',
                      })
                    }
                  >
                    <option value="open">Open join</option>
                    <option value="admin_add">Admin adds members</option>
                  </select>
                </label>
                <label>
                  Visible to
                  <select
                    value={draft.memberVisibility}
                    onChange={(event) =>
                      onUpdate(draft.groupId, {
                        memberVisibility:
                          event.target.value === 'members' || event.target.value === 'admin_only'
                            ? event.target.value
                            : 'session',
                      })
                    }
                  >
                    <option value="session">Session participants</option>
                    <option value="members">Group members</option>
                    {draft.joinMode === 'admin_add' ? <option value="admin_only">Admins only</option> : null}
                  </select>
                </label>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default SessionWorkerGroupDraftsPanel;
