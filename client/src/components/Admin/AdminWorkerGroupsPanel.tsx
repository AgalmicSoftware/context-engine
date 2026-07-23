import React, { useCallback, useEffect, useState } from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import {
  addWorkerGroupMember,
  createWorkerGroup,
  deleteWorkerGroup,
  listWorkerGroupMembers,
  listWorkerGroupsAdmin,
  normalizeWorkerGroupMembersAdminPayload,
  normalizeWorkerGroupDefaultTags,
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
import { uploadWorkerGroupImage } from '../../domains/worker/workerGroupImageUpload';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import { normalizeWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery.js';
import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl.js';
import WorkerGroupCreateForm from '../Shared/WorkerGroupCreateForm';
import WorkerGroupImage from '../Shared/WorkerGroupImage';
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
  sessionConfig?: unknown;
  sessionSlug: string;
  workerUrl: string;
  workerToken?: string;
  workerAuthContext?: unknown;
  postSignedRequest: PostSignedWorkerGroupRequest;
  autoLoad?: boolean;
  onGroupsChanged?: () => void;
};

const emptyDraft = (adminAddress = '', tags: string[] = []): WorkerGroupDraft => ({
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
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

type LocalGroupUpdater = (groups: WorkerGroup[], result: unknown) => WorkerGroup[];

const AdminWorkerGroupsPanel = ({
  canAdminWorker,
  sessionId,
  sessionConfig,
  sessionSlug,
  workerUrl,
  workerToken = '',
  workerAuthContext = null,
  postSignedRequest,
  autoLoad = false,
  onGroupsChanged,
}: AdminWorkerGroupsPanelProps) => {
  const defaultGroupTags = useMemo(() => normalizeWorkerGroupDefaultTags(sessionConfig), [sessionConfig]);
  const defaultGroupTagsKey = defaultGroupTags.join('\u0000');
  const [groups, setGroups] = useState<WorkerGroup[]>([]);
  const [createDraft, setCreateDraft] = useState<WorkerGroupDraft>(() => emptyDraft('', defaultGroupTags));
  const [editingGroupId, setEditingGroupId] = useState('');
  const [editDraft, setEditDraft] = useState<WorkerGroupDraft>(emptyDraft);
  const [memberGroupId, setMemberGroupId] = useState('');
  const [members, setMembers] = useState<WorkerGroupMember[]>([]);
  const [memberNextCursor, setMemberNextCursor] = useState('');
  const [memberAddressDraft, setMemberAddressDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const signedAccount = String(asRecord(workerAuthContext).account || '').trim();

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
  const targetKey = `${normalizedSessionId}\n${normalizedSessionSlug}\n${normalizedWorkerUrl}\n${defaultGroupTagsKey}`;
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
      const message = error instanceof Error ? error.message : 'Could not load worker groups.';
      setStatus(message);
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
    if (autoLoad) void loadGroups();
  }, [autoLoad, loadGroups]);

  const runMutation = async (
    operation: () => Promise<unknown>,
    success: string,
    updateLocalGroups?: LocalGroupUpdater,
  ): Promise<boolean> => {
    setBusy(true);
    setStatus('');
    try {
      const result = await operation();
      if (updateLocalGroups) setGroups((current) => updateLocalGroups(current, result));
      else await loadGroups();
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
          group: buildGroupInput(createDraft, label),
          sessionId: normalizedSessionId,
          sessionSlug: normalizedSessionSlug,
          postSignedRequest: postExactSignedRequest,
        }),
      'Group created.',
      (current, result) => {
        const created = normalizeWorkerGroupsAdminPayload({ groups: [asRecord(result).group] })[0];
        return created ? [...current.filter((group) => group.groupId !== created.groupId), created] : current;
      },
    ).then((created) => {
      if (created) setCreateDraft(emptyDraft(signedAccount, defaultGroupTags));
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
          group: buildGroupInput(editDraft, label),
          sessionId: normalizedSessionId,
          sessionSlug: normalizedSessionSlug,
          postSignedRequest: postExactSignedRequest,
        }),
      'Group updated.',
      (current, result) => {
        const updated = normalizeWorkerGroupsAdminPayload({ groups: [asRecord(result).group] })[0];
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

  const createForm = (
    <WorkerGroupCreateForm
      busy={busy}
      description={createDraft.description}
      descriptionTestId="ce-admin-worker-group-create-description"
      imageTestId="ce-admin-worker-group-create-image"
      imageUrl={createDraft.imageUrl}
      tags={createDraft.tags}
      documentURLs={createDraft.documentURLs}
      memberLimit={createDraft.memberLimit}
      joinEndsAt={createDraft.joinEndsAt}
      adminAddress={createDraft.adminAddress}
      joinMode={createDraft.joinMode}
      joinModeTestId="ce-admin-worker-group-create-mode"
      label={createDraft.label}
      labelTestId="ce-admin-worker-group-create-label"
      memberVisibility={createDraft.memberVisibility}
      memberVisibilityTestId="ce-admin-worker-group-create-visibility"
      sessionName={sessionName}
      sessionSlug={normalizedSessionSlug}
      status={createOnly ? status : ''}
      submitTestId="ce-admin-worker-group-create-submit"
      onDescriptionChange={(value) => setCreateDraft((draft) => ({ ...draft, description: value }))}
      onDocumentURLsChange={(value) => setCreateDraft((draft) => ({ ...draft, documentURLs: value }))}
      onImageFileUpload={(file) =>
        uploadWorkerGroupImage({
          file,
          sessionSlug: normalizedSessionSlug,
          sessionConfig,
          workerUrl: normalizedWorkerUrl,
          credentialToken: workerToken,
          context: workerAuthContext,
        })
      }
      onImageUrlChange={(value) => setCreateDraft((draft) => ({ ...draft, imageUrl: value }))}
      onJoinEndsAtChange={(value) => setCreateDraft((draft) => ({ ...draft, joinEndsAt: value }))}
      onJoinModeChange={(value) => setCreateDraft((draft) => withJoinMode(draft, value))}
      onLabelChange={(value) => setCreateDraft((draft) => ({ ...draft, label: value }))}
      onMemberLimitChange={(value) => setCreateDraft((draft) => ({ ...draft, memberLimit: value }))}
      onMemberVisibilityChange={(value) =>
        setCreateDraft((draft) => ({
          ...draft,
          memberVisibility: value,
        }))
      }
      onAdminAddressChange={(value) => setCreateDraft((draft) => ({ ...draft, adminAddress: value }))}
      onTagsChange={(value) => setCreateDraft((draft) => ({ ...draft, tags: value }))}
      onReset={() => {
        setCreateDraft(emptyDraft(signedAccount));
        setStatus('');
      }}
      onSubmit={handleCreate}
    />
  );

  if (createOnly) return createForm;

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
            {group.tags?.length ? <span>Tags: {group.tags.join(', ')}</span> : null}
            {group.documentURLs?.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                {url}
              </a>
            ))}
            {group.memberLimit ? (
              <span>Limit: {group.memberLimit} members</span>
            ) : (
              <span>No group-specific member limit</span>
            )}
            {group.joinEndsAt ? <span>Join deadline: {new Date(group.joinEndsAt).toLocaleString()}</span> : null}
            {group.adminAddress ? <span>Group admin: {group.adminAddress}</span> : null}
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
            <Label for="worker-group-edit-member-limit">Member limit</Label>
            <Input
              id="worker-group-edit-member-limit"
              type="number"
              min="1"
              max="1000"
              value={editDraft.memberLimit}
              onChange={(event) => setEditDraft((draft) => ({ ...draft, memberLimit: event.target.value }))}
            />
          </FormGroup>
          <FormGroup>
            <Label for="worker-group-edit-join-end">Join deadline</Label>
            <Input
              id="worker-group-edit-join-end"
              type="datetime-local"
              value={editDraft.joinEndsAt}
              onChange={(event) => setEditDraft((draft) => ({ ...draft, joinEndsAt: event.target.value }))}
            />
          </FormGroup>
          <FormGroup>
            <Label for="worker-group-edit-admin-address">Group admin address</Label>
            <Input
              id="worker-group-edit-admin-address"
              value={editDraft.adminAddress}
              onChange={(event) => setEditDraft((draft) => ({ ...draft, adminAddress: event.target.value }))}
            />
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
