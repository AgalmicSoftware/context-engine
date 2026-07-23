import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import {
  addWorkerGroupMember,
  createWorkerGroup,
  deleteWorkerGroup,
  listWorkerGroupMembers,
  listWorkerGroupsAdmin,
  normalizeWorkerGroupMembersAdminPayload,
  normalizeWorkerGroupsAdminPayload,
  removeWorkerGroupMember,
  sanitizeWorkerGroupRequestError,
  updateWorkerGroup,
  type PostSignedWorkerGroupRequest,
  type WorkerGroup,
  type WorkerGroupJoinMode,
  type WorkerGroupMember,
  type WorkerGroupMemberVisibility,
} from '../../domains/worker/workerGroupPorts';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import { normalizeWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery.js';
import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl.js';
import styles from './AdminPage.module.scss';

type WorkerGroupDraft = {
  label: string;
  description: string;
  imageUrl: string;
  joinMode: WorkerGroupJoinMode;
  memberVisibility: WorkerGroupMemberVisibility;
};

export type AdminWorkerGroupsPanelProps = {
  canAdminWorker: boolean;
  sessionId: string;
  sessionSlug: string;
  workerUrl: string;
  postSignedRequest: PostSignedWorkerGroupRequest;
  autoLoad?: boolean;
  onGroupsChanged?: () => void;
  title?: string;
  description?: string;
};

const emptyDraft = (): WorkerGroupDraft => ({
  label: '',
  description: '',
  imageUrl: '',
  joinMode: 'admin_add',
  memberVisibility: 'admin_only',
});

const withJoinMode = (draft: WorkerGroupDraft, joinMode: WorkerGroupJoinMode): WorkerGroupDraft => ({
  ...draft,
  joinMode,
  memberVisibility: joinMode === 'open' && draft.memberVisibility === 'admin_only' ? 'session' : draft.memberVisibility,
});

const memberAddress = (member: WorkerGroupMember): string => String(member.principal?.address || '').trim();
const memberIdentity = (member: WorkerGroupMember): string =>
  String(member.principalKey || memberAddress(member) || `${member.groupId || ''}\n${member.addedAt || ''}`);
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

type LocalGroupUpdater = (groups: WorkerGroup[], result: unknown) => WorkerGroup[];

const AdminWorkerGroupsPanel = ({
  canAdminWorker,
  sessionId,
  sessionSlug,
  workerUrl,
  postSignedRequest,
  autoLoad = false,
  onGroupsChanged,
  title = 'Worker access groups',
  description = 'Manage the supported open and admin-added authorization groups.',
}: AdminWorkerGroupsPanelProps) => {
  const [groups, setGroups] = useState<WorkerGroup[]>([]);
  const [createDraft, setCreateDraft] = useState<WorkerGroupDraft>(emptyDraft);
  const [editingGroupId, setEditingGroupId] = useState('');
  const [editDraft, setEditDraft] = useState<WorkerGroupDraft>(emptyDraft);
  const [memberGroupId, setMemberGroupId] = useState('');
  const [members, setMembers] = useState<WorkerGroupMember[]>([]);
  const [memberNextCursor, setMemberNextCursor] = useState('');
  const [memberAddressDraft, setMemberAddressDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const normalizedSessionSlug = canonicalizeSessionSlug(sessionSlug);
  const normalizedSessionId = normalizeWorkerCanonicalSessionIdHex(sessionId);
  const normalizedWorkerUrl = normalizeWorkerUrl(workerUrl);
  const postExactSignedRequest = useCallback<PostSignedWorkerGroupRequest>(
    async (args) => {
      try {
        return await postSignedRequest({
          ...args,
          workerUrl: normalizedWorkerUrl,
        });
      } catch (error) {
        throw sanitizeWorkerGroupRequestError(error, 'worker_group_admin_request_failed');
      }
    },
    [normalizedWorkerUrl, postSignedRequest],
  );
  const targetKey = `${normalizedSessionId}\n${normalizedSessionSlug}\n${normalizedWorkerUrl}`;
  const targetGenerationRef = useRef({ key: targetKey, generation: 0 });
  if (targetGenerationRef.current.key !== targetKey) {
    targetGenerationRef.current = {
      key: targetKey,
      generation: targetGenerationRef.current.generation + 1,
    };
  }
  const targetGeneration = targetGenerationRef.current.generation;
  const isCurrentTarget = useCallback(
    (key: string, generation: number) =>
      targetGenerationRef.current.key === key && targetGenerationRef.current.generation === generation,
    [],
  );
  const ready = canAdminWorker && !!normalizedSessionId && !!normalizedSessionSlug && !!normalizedWorkerUrl;

  const loadGroups = useCallback(async () => {
    if (!ready) return false;
    const requestTargetKey = targetKey;
    const requestGeneration = targetGeneration;
    setBusy(true);
    setStatus('');
    try {
      const payload = await listWorkerGroupsAdmin({
        sessionId: normalizedSessionId,
        sessionSlug: normalizedSessionSlug,
        postSignedRequest: postExactSignedRequest,
      });
      if (!isCurrentTarget(requestTargetKey, requestGeneration)) return false;
      setGroups(normalizeWorkerGroupsAdminPayload(payload, normalizedSessionSlug));
      return true;
    } catch (error) {
      if (!isCurrentTarget(requestTargetKey, requestGeneration)) return false;
      setStatus(error instanceof Error ? error.message : 'Could not load worker groups.');
      return false;
    } finally {
      if (isCurrentTarget(requestTargetKey, requestGeneration)) setBusy(false);
    }
  }, [
    isCurrentTarget,
    normalizedSessionId,
    normalizedSessionSlug,
    postExactSignedRequest,
    ready,
    targetGeneration,
    targetKey,
  ]);

  useEffect(() => {
    setGroups([]);
    setCreateDraft(emptyDraft());
    setEditingGroupId('');
    setEditDraft(emptyDraft());
    setMemberGroupId('');
    setMembers([]);
    setMemberNextCursor('');
    setMemberAddressDraft('');
    setBusy(false);
    setStatus('');
    if (autoLoad) void loadGroups();
  }, [autoLoad, loadGroups, targetKey]);

  const runMutation = async (
    operation: () => Promise<unknown>,
    success: string,
    updateLocalGroups?: LocalGroupUpdater,
  ): Promise<boolean> => {
    const requestTargetKey = targetKey;
    const requestGeneration = targetGeneration;
    setBusy(true);
    setStatus('');
    try {
      const result = await operation();
      if (!isCurrentTarget(requestTargetKey, requestGeneration)) return false;
      if (updateLocalGroups) setGroups((current) => updateLocalGroups(current, result));
      else await loadGroups();
      if (!isCurrentTarget(requestTargetKey, requestGeneration)) return false;
      setStatus(success);
      onGroupsChanged?.();
      return true;
    } catch (error) {
      if (!isCurrentTarget(requestTargetKey, requestGeneration)) return false;
      setStatus(error instanceof Error ? error.message : 'Worker group request failed.');
      return false;
    } finally {
      if (isCurrentTarget(requestTargetKey, requestGeneration)) setBusy(false);
    }
  };

  const handleCreate = () => {
    const label = createDraft.label.trim();
    if (!label) {
      setStatus('Group label is required.');
      return;
    }
    void runMutation(
      () =>
        createWorkerGroup({
          group: { ...createDraft, label },
          sessionId: normalizedSessionId,
          sessionSlug: normalizedSessionSlug,
          postSignedRequest: postExactSignedRequest,
        }),
      'Group created.',
      (current, result) => {
        const created = normalizeWorkerGroupsAdminPayload(
          { groups: [asRecord(result).group] },
          normalizedSessionSlug,
        )[0];
        return created ? [...current.filter((group) => group.groupId !== created.groupId), created] : current;
      },
    ).then((created) => {
      if (created) setCreateDraft(emptyDraft());
    });
  };

  const startEdit = (group: WorkerGroup) => {
    setEditingGroupId(group.groupId);
    setEditDraft({
      label: group.label,
      description: group.description || '',
      imageUrl: group.imageUrl || '',
      joinMode: group.joinMode,
      memberVisibility: group.memberVisibility,
    });
  };

  const handleSave = () => {
    const label = editDraft.label.trim();
    if (!editingGroupId || !label) {
      setStatus('Group label is required.');
      return;
    }
    void runMutation(
      () =>
        updateWorkerGroup({
          groupId: editingGroupId,
          group: { ...editDraft, label },
          sessionId: normalizedSessionId,
          sessionSlug: normalizedSessionSlug,
          postSignedRequest: postExactSignedRequest,
        }),
      'Group updated.',
      (current, result) => {
        const updated = normalizeWorkerGroupsAdminPayload(
          { groups: [asRecord(result).group] },
          normalizedSessionSlug,
        )[0];
        return updated ? current.map((group) => (group.groupId === updated.groupId ? updated : group)) : current;
      },
    ).then((updated) => {
      if (updated) setEditingGroupId('');
    });
  };

  const loadMembers = async (
    groupId: string,
    { cursor = '', append = false }: { cursor?: string; append?: boolean } = {},
  ) => {
    const requestTargetKey = targetKey;
    const requestGeneration = targetGeneration;
    setBusy(true);
    setStatus('');
    try {
      const payload = await listWorkerGroupMembers({
        groupId,
        cursor,
        sessionId: normalizedSessionId,
        sessionSlug: normalizedSessionSlug,
        postSignedRequest: postExactSignedRequest,
      });
      if (!isCurrentTarget(requestTargetKey, requestGeneration)) return false;
      const nextMembers = normalizeWorkerGroupMembersAdminPayload(payload, normalizedSessionSlug);
      setMemberGroupId(groupId);
      setMembers((current) => {
        if (!append) return nextMembers;
        const seen = new Set(current.map(memberIdentity));
        return [
          ...current,
          ...nextMembers.filter((candidate) => {
            const identity = memberIdentity(candidate);
            if (seen.has(identity)) return false;
            seen.add(identity);
            return true;
          }),
        ];
      });
      setMemberNextCursor(String(asRecord(payload).nextCursor || ''));
      return true;
    } catch (error) {
      if (!isCurrentTarget(requestTargetKey, requestGeneration)) return false;
      setStatus(error instanceof Error ? error.message : 'Could not load group members.');
      return false;
    } finally {
      if (isCurrentTarget(requestTargetKey, requestGeneration)) setBusy(false);
    }
  };

  const mutateMember = async (mode: 'add' | 'remove', address: string) => {
    const normalizedAddress = address.trim();
    if (!memberGroupId || !/^0x[0-9a-fA-F]{40}$/.test(normalizedAddress)) {
      setStatus('Enter a valid EVM address.');
      return;
    }
    const requestTargetKey = targetKey;
    const requestGeneration = targetGeneration;
    setBusy(true);
    setStatus('');
    try {
      const args = {
        groupId: memberGroupId,
        principal: { kind: 'evm_address' as const, address: normalizedAddress },
        sessionId: normalizedSessionId,
        sessionSlug: normalizedSessionSlug,
        postSignedRequest: postExactSignedRequest,
      };
      if (mode === 'add') await addWorkerGroupMember(args);
      else await removeWorkerGroupMember(args);
      if (!isCurrentTarget(requestTargetKey, requestGeneration)) return;
      setMemberAddressDraft('');
      const refreshed = await loadMembers(memberGroupId);
      if (refreshed && isCurrentTarget(requestTargetKey, requestGeneration)) {
        setStatus(mode === 'add' ? 'Member added.' : 'Member removed.');
      }
    } catch (error) {
      if (!isCurrentTarget(requestTargetKey, requestGeneration)) return;
      setStatus(error instanceof Error ? error.message : 'Worker group member request failed.');
    } finally {
      if (isCurrentTarget(requestTargetKey, requestGeneration)) setBusy(false);
    }
  };

  if (!ready) {
    return (
      <section className={styles.panel} data-testid="ce-admin-worker-groups">
        <div className={styles.panelTitle}>{title}</div>
        <div className={styles.panelSubtitle}>{description}</div>
        <div className={styles.statusNote}>Connect the configured worker admin wallet to manage access groups.</div>
      </section>
    );
  }

  return (
    <section className={styles.panel} data-testid="ce-admin-worker-groups">
      <div className={styles.panelHeader}>
        <div className={styles.panelTitleGroup}>
          <div className={styles.panelTitle}>{title}</div>
          <div className={styles.panelSubtitle}>{description}</div>
        </div>
        <Button size="sm" color="secondary" outline disabled={busy} onClick={() => void loadGroups()}>
          Refresh
        </Button>
      </div>

      <div className={styles.formRow}>
        <FormGroup>
          <Label for="worker-group-create-label">Group label</Label>
          <Input
            id="worker-group-create-label"
            data-testid="ce-admin-worker-group-create-label"
            value={createDraft.label}
            onChange={(event) => setCreateDraft((draft) => ({ ...draft, label: event.target.value }))}
          />
        </FormGroup>
        <FormGroup>
          <Label for="worker-group-create-description">Description</Label>
          <Input
            id="worker-group-create-description"
            type="textarea"
            data-testid="ce-admin-worker-group-create-description"
            value={createDraft.description}
            onChange={(event) => setCreateDraft((draft) => ({ ...draft, description: event.target.value }))}
          />
        </FormGroup>
        <FormGroup>
          <Label for="worker-group-create-image">Image URL</Label>
          <Input
            id="worker-group-create-image"
            type="url"
            data-testid="ce-admin-worker-group-create-image"
            placeholder="https://…"
            value={createDraft.imageUrl}
            onChange={(event) => setCreateDraft((draft) => ({ ...draft, imageUrl: event.target.value }))}
          />
        </FormGroup>
        <FormGroup>
          <Label for="worker-group-create-mode">Join mode</Label>
          <Input
            id="worker-group-create-mode"
            type="select"
            data-testid="ce-admin-worker-group-create-mode"
            value={createDraft.joinMode}
            onChange={(event) =>
              setCreateDraft((draft) => withJoinMode(draft, event.target.value as WorkerGroupJoinMode))
            }
          >
            <option value="admin_add">Admin adds members</option>
            <option value="open">Open self-join</option>
          </Input>
        </FormGroup>
        <FormGroup>
          <Label for="worker-group-create-visibility">Group visibility</Label>
          <Input
            id="worker-group-create-visibility"
            type="select"
            data-testid="ce-admin-worker-group-create-visibility"
            value={createDraft.memberVisibility}
            onChange={(event) =>
              setCreateDraft((draft) => ({
                ...draft,
                memberVisibility: event.target.value as WorkerGroupMemberVisibility,
              }))
            }
          >
            <option value="admin_only">Admins only</option>
            <option value="members">Group members</option>
            <option value="session">All session members</option>
          </Input>
        </FormGroup>
        <Button color="primary" disabled={busy} onClick={handleCreate}>
          Create group
        </Button>
      </div>

      <div className={styles.grid}>
        {groups.map((group) => (
          <div key={group.groupId} className={styles.statusItem}>
            {group.imageUrl ? (
              <img
                src={group.imageUrl}
                alt=""
                className={styles.workerGroupImage}
                data-testid="ce-admin-worker-group-image"
              />
            ) : null}
            <strong>{group.label}</strong>
            <span>{group.description || group.groupId}</span>
            <span>{group.joinMode === 'open' ? 'Open self-join' : 'Admin adds members'}</span>
            <span>Visible to {group.memberVisibility.replace('_', ' ')}</span>
            <div>
              <Button
                size="sm"
                color="secondary"
                outline
                onClick={() => startEdit(group)}
                aria-label={`Edit ${group.label}`}
              >
                Edit
              </Button>{' '}
              <Button
                size="sm"
                color="secondary"
                outline
                onClick={() => void loadMembers(group.groupId)}
                aria-label={`Manage ${group.label} members`}
              >
                Members
              </Button>{' '}
              <Button
                size="sm"
                color="danger"
                outline
                aria-label={`Delete ${group.label}`}
                onClick={() => {
                  if (window.confirm(`Delete ${group.label}?`)) {
                    void runMutation(
                      () =>
                        deleteWorkerGroup({
                          groupId: group.groupId,
                          sessionId: normalizedSessionId,
                          sessionSlug: normalizedSessionSlug,
                          postSignedRequest: postExactSignedRequest,
                        }),
                      'Group deleted.',
                      (current) => current.filter((candidate) => candidate.groupId !== group.groupId),
                    );
                  }
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {editingGroupId ? (
        <div className={styles.formRow}>
          <FormGroup>
            <Label for="worker-group-edit-label">Edit label</Label>
            <Input
              id="worker-group-edit-label"
              data-testid="ce-admin-worker-group-edit-label"
              value={editDraft.label}
              onChange={(event) => setEditDraft((draft) => ({ ...draft, label: event.target.value }))}
            />
          </FormGroup>
          <FormGroup>
            <Label for="worker-group-edit-description">Edit description</Label>
            <Input
              id="worker-group-edit-description"
              type="textarea"
              data-testid="ce-admin-worker-group-edit-description"
              value={editDraft.description}
              onChange={(event) => setEditDraft((draft) => ({ ...draft, description: event.target.value }))}
            />
          </FormGroup>
          <FormGroup>
            <Label for="worker-group-edit-image">Edit image URL</Label>
            <Input
              id="worker-group-edit-image"
              type="url"
              data-testid="ce-admin-worker-group-edit-image"
              value={editDraft.imageUrl}
              onChange={(event) => setEditDraft((draft) => ({ ...draft, imageUrl: event.target.value }))}
            />
          </FormGroup>
          <FormGroup>
            <Label for="worker-group-edit-mode">Join mode</Label>
            <Input
              id="worker-group-edit-mode"
              type="select"
              value={editDraft.joinMode}
              onChange={(event) =>
                setEditDraft((draft) => withJoinMode(draft, event.target.value as WorkerGroupJoinMode))
              }
            >
              <option value="admin_add">Admin adds members</option>
              <option value="open">Open self-join</option>
            </Input>
          </FormGroup>
          <FormGroup>
            <Label for="worker-group-edit-visibility">Group visibility</Label>
            <Input
              id="worker-group-edit-visibility"
              type="select"
              value={editDraft.memberVisibility}
              onChange={(event) =>
                setEditDraft((draft) => ({
                  ...draft,
                  memberVisibility: event.target.value as WorkerGroupMemberVisibility,
                }))
              }
            >
              <option value="admin_only">Admins only</option>
              <option value="members">Group members</option>
              <option value="session">All session members</option>
            </Input>
          </FormGroup>
          <Button color="primary" disabled={busy} onClick={handleSave}>
            Save group
          </Button>
        </div>
      ) : null}

      {memberGroupId ? (
        <div>
          <div className={styles.panelSubtitle}>Members of {memberGroupId}</div>
          <div className={styles.formRow}>
            <Input
              data-testid="ce-admin-worker-group-member-address"
              value={memberAddressDraft}
              placeholder="0x…"
              onChange={(event) => setMemberAddressDraft(event.target.value)}
            />
            <Button color="primary" disabled={busy} onClick={() => void mutateMember('add', memberAddressDraft)}>
              Add member
            </Button>
          </div>
          {members.map((member) => {
            const address = memberAddress(member);
            return (
              <div key={member.principalKey || address} className={styles.statusItem}>
                <span>{address || member.principalKey}</span>
                {address ? (
                  <Button
                    size="sm"
                    color="danger"
                    outline
                    aria-label={`Remove ${address}`}
                    onClick={() => void mutateMember('remove', address)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            );
          })}
          {memberNextCursor ? (
            <Button
              size="sm"
              color="secondary"
              outline
              disabled={busy}
              data-testid="ce-admin-worker-group-members-load-more"
              onClick={() =>
                void loadMembers(memberGroupId, {
                  cursor: memberNextCursor,
                  append: true,
                })
              }
            >
              Load more members
            </Button>
          ) : null}
        </div>
      ) : null}

      {status ? <div className={styles.statusNote}>{status}</div> : null}
    </section>
  );
};

export default AdminWorkerGroupsPanel;
