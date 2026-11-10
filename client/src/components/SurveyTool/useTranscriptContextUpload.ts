import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { participantsMayAddContext } from '@ce-shared/sessionContextSources.mjs';
import { readLinkedWorkerGroupId } from '../../domains/worker/workerGroupAutoJoin';
import { recordingOwner, type RecordingOptions } from '../../utilities/audio/recordingOwner';
import {
  removeContextSource,
  uploadContextFile,
  workerAcceptsParticipantContext,
  workerSupportsContextSources,
  type ContextFileAccess,
} from '../../utilities/docLibrary/contextSources';
import { useContextGroups } from '../../utilities/docLibrary/useContextGroups';
import { supportsContextSources } from '../../utilities/docLibrary/useSessionContextSources';
import { isConfiguredAdmin } from '../../utilities/storage/storageClient';
import { contextAccessKey } from '../Sessions/setup/ContextAccessPicker';

const transcriptFileName = () => {
  const now = new Date();
  const stamp = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return `Group conversation ${stamp.replace('T', ' ').replace(':', '-')}.txt`;
};

type Input = { sessionSlug: string; sessionConfig: unknown; context: unknown; enabled: boolean };
type Target = Pick<Input, 'sessionSlug' | 'sessionConfig' | 'context'>;

// Who a transcript goes up as, and where: the account, and the session on its Worker.
const ownerOf = (target: Target) => {
  const { account, identity } = recordingOwner(target as RecordingOptions);
  return JSON.stringify([identity, account]);
};

const NOTHING_UPLOADED = { text: '', id: '', choice: '', owner: '' };

/**
 * The Group Conversation's "Add transcript to context" choice. The file goes up after the questions submit, as
 * that is when someone has signed in.
 */
export function useTranscriptContextUpload({ sessionSlug, sessionConfig, context, enabled }: Input) {
  const [available, setAvailable] = useState(false);
  const [chosen, setChosen] = useState(false);
  const [access, setAccess] = useState<ContextFileAccess | null>(null);
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
  const account = (context as { account?: unknown } | null)?.account;
  const isAdmin = isConfiguredAdmin(sessionConfig, { account });
  const mayAdd =
    enabled && supportsContextSources(sessionConfig) && (isAdmin || participantsMayAddContext(sessionConfig));
  const latest = useRef({ sessionSlug, sessionConfig, context });
  latest.current = { sessionSlug, sessionConfig, context };
  const uploaded = useRef(NOTHING_UPLOADED);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const groups = useContextGroups({ sessionSlug, sessionConfig, account, enabled: available });

  useEffect(() => {
    if (!mayAdd) {
      setAvailable(false);
      return undefined;
    }
    let current = true;
    void (isAdmin ? workerSupportsContextSources : workerAcceptsParticipantContext)(latest.current).then(
      (accepts) => current && setAvailable(accepts),
    );
    return () => {
      current = false;
    };
  }, [mayAdd, isAdmin, sessionSlug]);

  const linkedGroup = readLinkedWorkerGroupId(sessionSlug);
  // Until someone chooses, the group the page's link joined, or everyone in the session.
  const chosenAccess = useMemo(() => access || (linkedGroup ? { groupIds: [linkedGroup] } : {}), [access, linkedGroup]);
  const choice = contextAccessKey(chosenAccess);

  const upload = useCallback(
    (transcript: string) => {
      const text = transcript.trim();
      if (!chosen || !text) return pending.current;
      // A queued upload goes up as the account, to the session and audience, it was asked for, or not at all.
      const target = latest.current;
      const owner = ownerOf(target);
      pending.current = pending.current.then(async () => {
        // The upload before this one in the queue has finished by now, so it is the one to compare with or replace,
        // if the same account made it there. Another account's copy is theirs.
        const earlier = uploaded.current.owner === owner ? uploaded.current : NOTHING_UPLOADED;
        if (text === earlier.text && choice === earlier.choice) return;
        if (ownerOf(latest.current) !== owner) {
          setStatus('The transcript wasn’t added to context: the account or session changed.');
          return;
        }
        setFailed(false);
        setStatus('Adding the transcript to context…');
        try {
          const id = await uploadContextFile(
            {
              file: new File([text], transcriptFileName(), { type: 'text/plain' }),
              ...chosenAccess,
            },
            target,
          );
          uploaded.current = { text, id, choice, owner };
          // More of this conversation, or a new audience for it, replaces its file. Another conversation keeps its own.
          const replaces = !!earlier.id && text.startsWith(earlier.text);
          let replaced = true;
          if (replaces) {
            await removeContextSource({ id: earlier.id, reading: null }, target).catch(() => {
              replaced = false;
            });
          }
          setStatus(
            replaced
              ? 'Transcript added to context.'
              : 'Transcript added to context, but its earlier copy is still there.',
          );
        } catch (error) {
          setFailed(true);
          setStatus(`The transcript wasn’t added to context: ${error instanceof Error ? error.message : 'try again'}`);
        }
      });
      return pending.current;
    },
    [chosenAccess, choice, chosen],
  );

  return {
    available,
    chosen,
    setChosen,
    access: chosenAccess,
    setAccess,
    groups,
    allowAdminsOnly: isAdmin,
    status,
    failed,
    upload,
    /** Settles once any upload under way has finished, so closing doesn't cut it off. */
    settled: () => pending.current,
  };
}
