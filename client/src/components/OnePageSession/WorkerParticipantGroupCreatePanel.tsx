import React, { useEffect, useMemo, useRef, useState } from 'react';
import { uploadWorkerGroupImage } from '../../domains/worker/workerGroupImageUpload';
import {
  createWorkerGroupAsParticipant,
  normalizeWorkerGroupDefaultTags,
} from '../../domains/worker/workerGroupPorts';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import { normalizeWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery.js';
import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl.js';
import WorkerGroupCreateForm from '../Shared/WorkerGroupCreateForm';

export type WorkerParticipantGroupCreatePanelProps = {
  sessionId: string;
  sessionConfig?: unknown;
  sessionSlug: string;
  sessionName?: string;
  participantAddress?: string;
  workerToken: string;
  workerUrl: string;
  authenticationRequired?: boolean;
  authenticationBusy?: boolean;
  fetchImpl?: typeof fetch;
  onGroupsChanged?: () => void;
  onRequestAuthentication?: () => void;
};

const WorkerParticipantGroupCreatePanel = ({
  sessionId,
  sessionConfig,
  sessionSlug,
  sessionName,
  participantAddress = '',
  workerToken,
  workerUrl,
  authenticationRequired = false,
  authenticationBusy = false,
  fetchImpl = fetch,
  onGroupsChanged,
  onRequestAuthentication,
}: WorkerParticipantGroupCreatePanelProps) => {
  const normalizedSessionId = normalizeWorkerCanonicalSessionIdHex(sessionId);
  const normalizedSessionSlug = canonicalizeSessionSlug(sessionSlug);
  const normalizedWorkerUrl = normalizeWorkerUrl(workerUrl);
  const defaultTags = useMemo(() => normalizeWorkerGroupDefaultTags(sessionConfig), [sessionConfig]);
  const defaultTagsKey = defaultTags.join('\u0000');
  const draftTargetKey = `${normalizedSessionId}\n${normalizedSessionSlug}\n${normalizedWorkerUrl}\n${defaultTagsKey}`;
  const requestTargetKey = `${draftTargetKey}\n${workerToken}\n${participantAddress.toLowerCase()}`;
  const requestTargetKeyRef = useRef(requestTargetKey);
  requestTargetKeyRef.current = requestTargetKey;
  const requestIdRef = useRef(0);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [tags, setTags] = useState<string[]>(defaultTags);
  const [documentURLs, setDocumentURLs] = useState<string[]>([]);
  const [memberLimit, setMemberLimit] = useState('');
  const [joinEndsAt, setJoinEndsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    requestIdRef.current += 1;
    setLabel('');
    setDescription('');
    setImageUrl('');
    setTags(defaultTags);
    setDocumentURLs([]);
    setMemberLimit('');
    setJoinEndsAt('');
    setBusy(false);
    setStatus('');
  }, [defaultTags, draftTargetKey]); // The draft survives authentication changes within one session.

  const createGroup = async (preparedImageUrl?: string) => {
    const nextLabel = label.trim();
    if (!nextLabel) {
      setStatus('Group label is required.');
      return;
    }
    if (authenticationRequired || !workerToken) {
      setStatus('Sign in to create this group. Your draft will stay here.');
      onRequestAuthentication?.();
      return;
    }
    const activeRequestTargetKey = requestTargetKey;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setBusy(true);
    setStatus('');
    try {
      await createWorkerGroupAsParticipant({
        workerUrl: normalizedWorkerUrl,
        credentialToken: workerToken,
        sessionId: normalizedSessionId,
        sessionSlug: normalizedSessionSlug,
        group: {
          label: nextLabel,
          description: description.trim(),
          imageUrl: String(preparedImageUrl || imageUrl).trim(),
          tags,
          documentURLs,
          memberLimit: memberLimit.trim() ? Number(memberLimit) : undefined,
          joinEndsAt: joinEndsAt ? new Date(joinEndsAt).toISOString() : undefined,
          adminAddress: participantAddress.trim() || undefined,
        },
        fetchImpl,
      });
      if (requestTargetKeyRef.current !== activeRequestTargetKey || requestIdRef.current !== requestId) return;
      setLabel('');
      setDescription('');
      setImageUrl('');
      setTags(defaultTags);
      setDocumentURLs([]);
      setMemberLimit('');
      setJoinEndsAt('');
      setStatus('Group created. It is open to session participants.');
      onGroupsChanged?.();
    } catch (error) {
      if (requestTargetKeyRef.current !== activeRequestTargetKey || requestIdRef.current !== requestId) return;
      setStatus(error instanceof Error ? error.message : 'Worker group request failed.');
    } finally {
      if (requestTargetKeyRef.current === activeRequestTargetKey && requestIdRef.current === requestId) setBusy(false);
    }
  };

  return (
    <div data-testid={E2E_TESTIDS.SESSION_WORKER_PARTICIPANT_GROUP_CREATE}>
      <WorkerGroupCreateForm
        busy={busy}
        description={description}
        descriptionTestId="ce-session-worker-participant-group-description"
        imageTestId="ce-session-worker-participant-group-image"
        imageUrl={imageUrl}
        tags={tags}
        documentURLs={documentURLs}
        memberLimit={memberLimit}
        joinEndsAt={joinEndsAt}
        adminAddress={participantAddress}
        adminAddressReadOnly={true}
        label={label}
        labelTestId={E2E_TESTIDS.SESSION_WORKER_PARTICIPANT_GROUP_LABEL}
        participantDefaults={true}
        sessionName={sessionName}
        sessionSlug={normalizedSessionSlug}
        status={status}
        deferImageUpload={authenticationRequired}
        submitDisabled={!normalizedSessionId || !normalizedSessionSlug || !normalizedWorkerUrl || authenticationBusy}
        submitLabel={
          authenticationBusy ? 'Authenticating…' : authenticationRequired ? 'Sign in & create' : 'Create Group'
        }
        submitTestId={E2E_TESTIDS.SESSION_WORKER_PARTICIPANT_GROUP_SUBMIT}
        onDescriptionChange={setDescription}
        onDocumentURLsChange={setDocumentURLs}
        onImageFileUpload={
          workerToken
            ? (file) =>
                uploadWorkerGroupImage({
                  file,
                  sessionSlug: normalizedSessionSlug,
                  sessionConfig,
                  workerUrl: normalizedWorkerUrl,
                  credentialToken: workerToken,
                  fetchImpl,
                })
            : undefined
        }
        onImageUrlChange={setImageUrl}
        onJoinEndsAtChange={setJoinEndsAt}
        onLabelChange={setLabel}
        onMemberLimitChange={setMemberLimit}
        onAdminAddressChange={() => {}}
        onTagsChange={setTags}
        onReset={() => {
          setLabel('');
          setDescription('');
          setImageUrl('');
          setTags(defaultTags);
          setDocumentURLs([]);
          setMemberLimit('');
          setJoinEndsAt('');
          setStatus('');
        }}
        onSubmit={(preparedImageUrl) => void createGroup(preparedImageUrl)}
      />
    </div>
  );
};

export default WorkerParticipantGroupCreatePanel;
