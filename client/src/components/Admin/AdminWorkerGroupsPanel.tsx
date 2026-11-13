import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import {
  addWorkerGroupMember,
  createWorkerGroup,
  deleteWorkerGroup,
  isWorkerGroupListed,
  listWorkerGroupMembers,
  listWorkerGroupsAdmin,
  normalizeWorkerGroupMembersAdminPayload,
  normalizeWorkerGroupDefaultTags,
  normalizeWorkerGroupsAdminPayload,
  removeWorkerGroupMember,
  sanitizeWorkerGroupRequestError,
  updateWorkerGroup,
  workerGroupAdminsMayRemove,
  workerGroupNeedsSecret,
  type PostSignedWorkerGroupRequest,
  type WorkerGroup,
  type WorkerGroupJoinMode,
  type WorkerGroupMember,
  type WorkerGroupMemberVisibility,
  type WorkerGroupRemovalAuth,
} from '../../domains/worker/workerGroupPorts';
import { uploadWorkerGroupImage } from '../../domains/worker/workerGroupImageUpload';
import { saveWorkerGroupPassword } from '../../domains/worker/workerGroupSecrets';
import { readWorkerGroupMemberCeiling, workerOffersGroupJoinChoices } from '../../../../shared/workerGroupJoin.mjs';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import { normalizeWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery.js';
import { getWorkerAuthRemoteErrorMessage } from '../../utilities/worker/workerAuthRemoteError';
import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl.js';
import WorkerGroupCreateForm from '../Shared/WorkerGroupCreateForm';
import WorkerGroupImage from '../Shared/WorkerGroupImage';
import {
  ALL_WORKER_GROUP_JOIN_MODES,
  BASIC_WORKER_GROUP_JOIN_MODES,
  WORKER_GROUP_JOIN_LABELS,
  WorkerGroupJoinModeHelp,
  WorkerGroupJoinModeOptions,
  WorkerGroupListedHelp,
} from '../Shared/WorkerGroupJoinChoiceHelp';
import WorkerGroupRemovalAuthHelp, {
  WORKER_GROUP_REMOVAL_AUTH_LABELS,
  WorkerGroupRemovalAuthOptions,
  withRemovalAuthNotice,
} from '../Shared/WorkerGroupRemovalAuthHelp';
import WorkerGroupInvitesPanel from './WorkerGroupInvitesPanel';
import WorkerGroupPasswordReveal from './WorkerGroupPasswordReveal';
import styles from './AdminPage.module.scss';

type WorkerGroupDraft = {
  label: string;
  description: string;
  imageUrl: string;
  tags: string[];
  documentURLs: string[];
  memberLimit: string;
  joinEndsAt: string;
  adminAddress: string;
  joinMode: WorkerGroupJoinMode;
  listed: boolean;
  /** Only while creating a Group Password group; never sent with the group. */
  groupPassword: string;
  memberVisibility: WorkerGroupMemberVisibility;
  removalAuth: WorkerGroupRemovalAuth;
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
  createOnly?: boolean;
  onGroupsChanged?: () => void;
  title?: string;
  description?: string;
  sessionName?: string;
};

const emptyDraft = (adminAddress = '', tags: string[] = []): WorkerGroupDraft => ({
  label: '',
  description: '',
  imageUrl: '',
  tags: [...tags],
  documentURLs: [],
  memberLimit: '',
  joinEndsAt: '',
  adminAddress,
  // Open to anyone who can see the session: everyone on a public session, participants on a private one.
  joinMode: 'open',
  listed: true,
  groupPassword: '',
  memberVisibility: 'session',
  removalAuth: 'both',
});

const toLocalDateTimeInput = (value: unknown): string => {
  const date = new Date(String(value || ''));
  if (!Number.isFinite(date.getTime())) return '';
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 19);
};

// A Worker without join choices knows nothing of listing; a Public URL group is always listed.
const buildGroupInput = (draft: WorkerGroupDraft, label: string, offersChoices: boolean) => ({
  label,
  description: draft.description.trim(),
  imageUrl: draft.imageUrl.trim(),
  tags: draft.tags,
  documentURLs: draft.documentURLs,
  memberLimit: draft.memberLimit.trim() ? Number(draft.memberLimit) : 0,
  joinEndsAt: draft.joinEndsAt ? new Date(draft.joinEndsAt).toISOString() : '',
  adminAddress: draft.adminAddress.trim(),
  joinMode: draft.joinMode,
  ...(offersChoices ? { listed: draft.joinMode === 'open' || draft.listed } : {}),
  memberVisibility: draft.memberVisibility,
  removalAuth: draft.removalAuth,
});

// A group admins fill by hand keeps its roster with them, so choosing it never leaves the list open to the session.
const withJoinMode = (draft: WorkerGroupDraft, joinMode: WorkerGroupJoinMode): WorkerGroupDraft => {
  const { memberVisibility } = draft;
  if (joinMode === 'open' && memberVisibility === 'admin_only') {
    return { ...draft, joinMode, memberVisibility: 'session' };
  }
  if (joinMode === 'admin_add' && memberVisibility === 'session') {
    return { ...draft, joinMode, memberVisibility: 'admin_only' };
  }
  return { ...draft, joinMode };
};

const memberAddress = (member: WorkerGroupMember): string => {
  const principal = member.principal;
  return principal?.kind === 'evm_address' || principal?.kind === 'passkey_account'
    ? String(principal.address || '').trim()
    : '';
};
const memberIdentity = (member: WorkerGroupMember): string =>
  String(member.principalKey || memberAddress(member) || `${member.groupId || ''}\n${member.addedAt || ''}`);
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

type LocalGroupUpdater = (groups: WorkerGroup[], result: unknown) => WorkerGroup[];
const savedGroup = (result: unknown): Partial<WorkerGroup> => asRecord(asRecord(result).group);

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
  createOnly = false,
  onGroupsChanged,
  title = 'Worker access groups',
  description = 'Manage each group, who can join it and its members.',
  sessionName,
}: AdminWorkerGroupsPanelProps) => {
  const defaultGroupTags = useMemo(() => normalizeWorkerGroupDefaultTags(sessionConfig), [sessionConfig]);
  const offersChoices = workerOffersGroupJoinChoices(sessionConfig);
  const joinModes = offersChoices ? ALL_WORKER_GROUP_JOIN_MODES : BASIC_WORKER_GROUP_JOIN_MODES;
  const memberLimitMax = readWorkerGroupMemberCeiling(sessionConfig);
  const defaultGroupTagsKey = defaultGroupTags.join('\u0000');
  const [groups, setGroups] = useState<WorkerGroup[]>([]);
  const [createDraft, setCreateDraft] = useState<WorkerGroupDraft>(() => emptyDraft('', defaultGroupTags));
  const [editingGroupId, setEditingGroupId] = useState('');
  const [editDraft, setEditDraft] = useState<WorkerGroupDraft>(emptyDraft);
  const [memberGroupId, setMemberGroupId] = useState('');
  const [members, setMembers] = useState<WorkerGroupMember[]>([]);
  const [memberNextCursor, setMemberNextCursor] = useState('');
  const [memberAddressDraft, setMemberAddressDraft] = useState('');
  const [invitesGroupId, setInvitesGroupId] = useState('');
  const [revealed, setRevealed] = useState<{ group: WorkerGroup; password: string } | null>(null);
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
        // Signing can fail before the Worker's group route runs, as when sign-ins are rate limited.
        const signingFailure = getWorkerAuthRemoteErrorMessage(error);
        if (signingFailure) throw new Error(signingFailure);
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
    setGroups([]);
    setCreateDraft(emptyDraft(signedAccount, defaultGroupTags));
    setEditingGroupId('');
    setEditDraft(emptyDraft());
    setMemberGroupId('');
    setMembers([]);
    setMemberNextCursor('');
    setMemberAddressDraft('');
    setInvitesGroupId('');
    setRevealed(null);
    setBusy(false);
    setStatus('');
    if (autoLoad && !createOnly) void loadGroups();
  }, [autoLoad, createOnly, defaultGroupTags, loadGroups, signedAccount, targetKey]); // targetKey includes normalized defaults.

  const runMutation = async (
    operation: () => Promise<unknown>,
    success: string | ((result: unknown) => string),
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
      setStatus(typeof success === 'function' ? success(result) : success);
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
    const { removalAuth } = createDraft;
    const password = offersChoices && createDraft.joinMode === 'group_password' ? createDraft.groupPassword : '';
    let passwordSaved: WorkerGroup | null = null;
    void runMutation(
      async () => {
        const result = await createWorkerGroup({
          group: buildGroupInput(createDraft, label, offersChoices),
          sessionId: normalizedSessionId,
          sessionSlug: normalizedSessionSlug,
          postSignedRequest: postExactSignedRequest,
        });
        if (!password) return result;
        // The group exists before its password does; until the password is set, it admits no one.
        try {
          passwordSaved = await saveWorkerGroupPassword({
            password,
            groupId: String(savedGroup(result).groupId),
            sessionId: normalizedSessionId,
            sessionSlug: normalizedSessionSlug,
            postSignedRequest: postExactSignedRequest,
          });
          return { ...result, group: passwordSaved };
        } catch {
          return result;
        }
      },
      (result) =>
        password && !passwordSaved
          ? 'Group created, but its password wasn’t set. Use Password on the group to set it.'
          : withRemovalAuthNotice('Group created.', removalAuth, savedGroup(result).removalAuth),
      (current, result) => {
        const created = normalizeWorkerGroupsAdminPayload(
          { groups: [asRecord(result).group] },
          normalizedSessionSlug,
        )[0];
        return created ? [...current.filter((group) => group.groupId !== created.groupId), created] : current;
      },
    ).then((created) => {
      if (!created) return;
      setCreateDraft(emptyDraft(signedAccount, defaultGroupTags));
      if (passwordSaved) setRevealed({ group: passwordSaved, password });
    });
  };

  const startEdit = (group: WorkerGroup) => {
    setEditingGroupId(group.groupId);
    setEditDraft({
      label: group.label,
      description: group.description || '',
      imageUrl: group.imageUrl || '',
      tags: group.tags || [],
      documentURLs: group.documentURLs || [],
      memberLimit: group.memberLimit ? String(group.memberLimit) : '',
      joinEndsAt: toLocalDateTimeInput(group.joinEndsAt),
      adminAddress: group.adminAddress || '',
      joinMode: group.joinMode,
      listed: isWorkerGroupListed(group),
      groupPassword: '',
      memberVisibility: group.memberVisibility,
      removalAuth: group.removalAuth || 'both',
    });
  };

  const patchGroup = (patch: Partial<WorkerGroup> & { groupId: string }) =>
    setGroups((current) => current.map((group) => (group.groupId === patch.groupId ? { ...group, ...patch } : group)));

  const handleSave = () => {
    const label = editDraft.label.trim();
    if (!editingGroupId || !label) {
      setStatus('Group label is required.');
      return;
    }
    const { removalAuth } = editDraft;
    void runMutation(
      () =>
        updateWorkerGroup({
          groupId: editingGroupId,
          group: buildGroupInput(editDraft, label, offersChoices),
          sessionId: normalizedSessionId,
          sessionSlug: normalizedSessionSlug,
          postSignedRequest: postExactSignedRequest,
        }),
      (result) => withRemovalAuthNotice('Group updated.', removalAuth, savedGroup(result).removalAuth),
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

  const memberGroupRemovalAuth = groups.find((group) => group.groupId === memberGroupId)?.removalAuth || 'both';
  const adminsMayRemoveMembers = workerGroupAdminsMayRemove({ removalAuth: memberGroupRemovalAuth });

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
      joinModes={joinModes}
      listed={createDraft.listed}
      onListedChange={offersChoices ? (value) => setCreateDraft((draft) => ({ ...draft, listed: value })) : undefined}
      groupPassword={createDraft.groupPassword}
      onGroupPasswordChange={
        offersChoices ? (value) => setCreateDraft((draft) => ({ ...draft, groupPassword: value })) : undefined
      }
      memberLimitMax={memberLimitMax}
      label={createDraft.label}
      labelTestId="ce-admin-worker-group-create-label"
      memberVisibility={createDraft.memberVisibility}
      memberVisibilityTestId="ce-admin-worker-group-create-visibility"
      removalAuth={createDraft.removalAuth}
      removalAuthTestId="ce-admin-worker-group-create-removal-auth"
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
      onRemovalAuthChange={(value) => setCreateDraft((draft) => ({ ...draft, removalAuth: value }))}
      onAdminAddressChange={(value) => setCreateDraft((draft) => ({ ...draft, adminAddress: value }))}
      onTagsChange={(value) => setCreateDraft((draft) => ({ ...draft, tags: value }))}
      onReset={() => {
        setCreateDraft(emptyDraft(signedAccount));
        setStatus('');
      }}
      onSubmit={handleCreate}
    />
  );

  const reveal = revealed ? (
    <WorkerGroupPasswordReveal
      group={revealed.group}
      password={revealed.password}
      sessionSlug={normalizedSessionSlug}
      workerUrl={normalizedWorkerUrl}
      onDone={() => setRevealed(null)}
    />
  ) : null;

  if (createOnly)
    return (
      <>
        {createForm}
        {reveal}
      </>
    );

  return (
    <section className={styles.panel} data-testid="ce-admin-worker-groups">
      <div className={styles.panelHeader}>
        <div className={styles.panelTitleGroup}>
          <div className={styles.panelTitle}>{title}</div>
          <div className={styles.panelSubtitle}>{description}</div>
        </div>
        <Button
          className={styles.subtleActionButton}
          size="sm"
          color="secondary"
          outline
          disabled={busy}
          onClick={() => void loadGroups()}
        >
          Refresh
        </Button>
      </div>

      {createForm}
      {reveal}

      <div className={styles.grid}>
        {groups.map((group) => (
          <div key={group.groupId} className={styles.statusItem}>
            {group.imageUrl ? (
              <WorkerGroupImage
                src={group.imageUrl}
                alt=""
                className={styles.workerGroupImage}
                context={workerAuthContext}
                sessionConfig={sessionConfig}
                sessionSlug={normalizedSessionSlug}
                testId="ce-admin-worker-group-image"
                workerToken={workerToken}
                workerUrl={normalizedWorkerUrl}
              />
            ) : null}
            <strong>{group.label}</strong>
            <span>{group.description || group.groupId}</span>
            <span>{WORKER_GROUP_JOIN_LABELS[group.joinMode]}</span>
            {isWorkerGroupListed(group) ? null : <span>Not in the group list</span>}
            {group.joinMode === 'group_password' && group.passwordSet === false ? (
              <span>No password yet: no one can join.</span>
            ) : null}
            {group.joinMode === 'one_use' && group.invites ? (
              <span>
                Links: {group.invites.unused} unused, {group.invites.used} used
              </span>
            ) : null}
            {group.guessLimited ? <span role="alert">Too many wrong passwords in the last hour.</span> : null}
            <span>Visible to {group.memberVisibility.replace('_', ' ')}</span>
            <span>Who can remove members: {WORKER_GROUP_REMOVAL_AUTH_LABELS[group.removalAuth || 'both']}</span>
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
                className={styles.subtleActionButton}
                size="sm"
                color="secondary"
                outline
                onClick={() => startEdit(group)}
                aria-label={`Edit ${group.label}`}
              >
                Edit
              </Button>{' '}
              <Button
                className={styles.subtleActionButton}
                size="sm"
                color="secondary"
                outline
                onClick={() => void loadMembers(group.groupId)}
                aria-label={`Manage ${group.label} members`}
              >
                Members
              </Button>{' '}
              {offersChoices && workerGroupNeedsSecret(group) ? (
                <>
                  <Button
                    className={styles.subtleActionButton}
                    size="sm"
                    color="secondary"
                    outline
                    aria-expanded={invitesGroupId === group.groupId}
                    aria-label={`${group.joinMode === 'one_use' ? 'Invites' : 'Password'} for ${group.label}`}
                    onClick={() => setInvitesGroupId((current) => (current === group.groupId ? '' : group.groupId))}
                  >
                    {group.joinMode === 'one_use' ? 'Invites' : 'Password'}
                  </Button>{' '}
                </>
              ) : null}
              <Button
                className={styles.dangerActionButton}
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

      {(() => {
        const group = groups.find((candidate) => candidate.groupId === invitesGroupId);
        return group && workerGroupNeedsSecret(group) ? (
          <WorkerGroupInvitesPanel
            key={`${group.groupId}\n${group.joinMode}`}
            group={group}
            sessionId={normalizedSessionId}
            sessionSlug={normalizedSessionSlug}
            workerUrl={normalizedWorkerUrl}
            postSignedRequest={postExactSignedRequest}
            onGroupChanged={patchGroup}
          />
        ) : null;
      })()}

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
            <Label for="worker-group-edit-tags">Tags</Label>
            <Input
              id="worker-group-edit-tags"
              value={editDraft.tags.join(', ')}
              placeholder="research, reviewers"
              onChange={(event) =>
                setEditDraft((draft) => ({
                  ...draft,
                  tags: event.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                    .slice(0, 20),
                }))
              }
            />
          </FormGroup>
          <FormGroup>
            <Label for="worker-group-edit-document-urls">Reference URLs</Label>
            <Input
              id="worker-group-edit-document-urls"
              type="textarea"
              value={editDraft.documentURLs.join('\n')}
              placeholder="One HTTPS URL per line"
              onChange={(event) =>
                setEditDraft((draft) => ({
                  ...draft,
                  documentURLs: event.target.value
                    .split(/\r?\n/)
                    .map((url) => url.trim())
                    .filter(Boolean)
                    .slice(0, 10),
                }))
              }
            />
          </FormGroup>
          <FormGroup>
            <Label for="worker-group-edit-mode">Who can join</Label>
            <WorkerGroupJoinModeHelp modes={joinModes} />
            <Input
              id="worker-group-edit-mode"
              type="select"
              value={editDraft.joinMode}
              onChange={(event) =>
                setEditDraft((draft) => withJoinMode(draft, event.target.value as WorkerGroupJoinMode))
              }
            >
              <WorkerGroupJoinModeOptions modes={joinModes} />
            </Input>
          </FormGroup>
          {offersChoices && editDraft.joinMode !== 'open' ? (
            <FormGroup check>
              <Input
                id="worker-group-edit-listed"
                type="checkbox"
                checked={editDraft.listed}
                onChange={(event) => setEditDraft((draft) => ({ ...draft, listed: event.target.checked }))}
              />{' '}
              <Label check for="worker-group-edit-listed">
                Show in the group list
              </Label>
              <WorkerGroupListedHelp />
            </FormGroup>
          ) : null}
          <FormGroup>
            <Label for="worker-group-edit-member-limit">Member limit</Label>
            <Input
              id="worker-group-edit-member-limit"
              type="number"
              min="1"
              max={memberLimitMax}
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
          <FormGroup>
            <Label for="worker-group-edit-removal-auth">Who can remove members</Label>
            <WorkerGroupRemovalAuthHelp />
            <Input
              id="worker-group-edit-removal-auth"
              type="select"
              data-testid="ce-admin-worker-group-edit-removal-auth"
              value={editDraft.removalAuth}
              onChange={(event) =>
                setEditDraft((draft) => ({ ...draft, removalAuth: event.target.value as WorkerGroupRemovalAuth }))
              }
            >
              <WorkerGroupRemovalAuthOptions />
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
          {adminsMayRemoveMembers ? null : (
            <div className={styles.panelSubtitle} data-testid="ce-admin-worker-group-members-removal-auth">
              Who can remove members: {WORKER_GROUP_REMOVAL_AUTH_LABELS[memberGroupRemovalAuth]}
            </div>
          )}
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
                {address && adminsMayRemoveMembers ? (
                  <Button
                    className={styles.dangerActionButton}
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
              className={styles.subtleActionButton}
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
