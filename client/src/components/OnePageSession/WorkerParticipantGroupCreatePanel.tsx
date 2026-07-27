import React, { useEffect, useRef, useState } from 'react';
import { Button, FormGroup, Input, Label } from 'reactstrap';
import { createWorkerGroupAsParticipant } from '../../domains/worker/workerGroupPorts';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext.js';
import { normalizeWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery.js';
import { normalizeWorkerUrl } from '../../utilities/worker/workerUrl.js';
import styles from './OnePageSession.module.scss';

export type WorkerParticipantGroupCreatePanelProps = {
  sessionId: string;
  sessionSlug: string;
  workerToken: string;
  workerUrl: string;
  fetchImpl?: typeof fetch;
  onGroupsChanged?: () => void;
};

const WorkerParticipantGroupCreatePanel = ({
  sessionId,
  sessionSlug,
  workerToken,
  workerUrl,
  fetchImpl = fetch,
  onGroupsChanged,
}: WorkerParticipantGroupCreatePanelProps) => {
  const normalizedSessionId = normalizeWorkerCanonicalSessionIdHex(sessionId);
  const normalizedSessionSlug = canonicalizeSessionSlug(sessionSlug);
  const normalizedWorkerUrl = normalizeWorkerUrl(workerUrl);
  const targetKey = `${normalizedSessionId}\n${normalizedSessionSlug}\n${normalizedWorkerUrl}\n${workerToken}`;
  const targetKeyRef = useRef(targetKey);
  targetKeyRef.current = targetKey;
  const requestIdRef = useRef(0);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    requestIdRef.current += 1;
    setLabel('');
    setDescription('');
    setImageUrl('');
    setBusy(false);
    setStatus('');
  }, [targetKey]);

  const createGroup = async () => {
    const nextLabel = label.trim();
    if (!nextLabel) {
      setStatus('Group label is required.');
      return;
    }
    const requestTargetKey = targetKey;
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
          imageUrl: imageUrl.trim(),
        },
        fetchImpl,
      });
      if (targetKeyRef.current !== requestTargetKey || requestIdRef.current !== requestId) return;
      setLabel('');
      setDescription('');
      setImageUrl('');
      setStatus('Group created. It is open to session participants.');
      onGroupsChanged?.();
    } catch (error) {
      if (targetKeyRef.current !== requestTargetKey || requestIdRef.current !== requestId) return;
      setStatus(error instanceof Error ? error.message : 'Worker group request failed.');
    } finally {
      if (targetKeyRef.current === requestTargetKey && requestIdRef.current === requestId) setBusy(false);
    }
  };

  return (
    <section className={styles.workerGroupsPanel} data-testid={E2E_TESTIDS.SESSION_WORKER_PARTICIPANT_GROUP_CREATE}>
      <h3>Create a group</h3>
      <p className={styles.workerGroupNotice}>
        This session lets every participant create groups. Participant-created groups are open and visible to the
        session; admins retain update and membership controls.
      </p>
      <FormGroup>
        <Label for="ce-participant-worker-group-label">Group name</Label>
        <Input
          id="ce-participant-worker-group-label"
          data-testid={E2E_TESTIDS.SESSION_WORKER_PARTICIPANT_GROUP_LABEL}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={120}
        />
      </FormGroup>
      <FormGroup>
        <Label for="ce-participant-worker-group-description">Description</Label>
        <Input
          id="ce-participant-worker-group-description"
          data-testid="ce-session-worker-participant-group-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
        />
      </FormGroup>
      <FormGroup>
        <Label for="ce-participant-worker-group-image">Image URL (optional)</Label>
        <Input
          id="ce-participant-worker-group-image"
          type="url"
          data-testid="ce-session-worker-participant-group-image"
          value={imageUrl}
          onChange={(event) => setImageUrl(event.target.value)}
          maxLength={2048}
        />
      </FormGroup>
      <Button
        type="button"
        color="primary"
        data-testid={E2E_TESTIDS.SESSION_WORKER_PARTICIPANT_GROUP_SUBMIT}
        disabled={busy || !normalizedSessionId || !normalizedSessionSlug || !normalizedWorkerUrl || !workerToken}
        onClick={() => void createGroup()}
      >
        {busy ? 'Creating…' : 'Create group'}
      </Button>
      {status ? (
        <div role="status" className={styles.workerGroupNotice}>
          {status}
        </div>
      ) : null}
    </section>
  );
};

export default WorkerParticipantGroupCreatePanel;
