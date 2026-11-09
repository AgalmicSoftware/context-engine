import { useCallback, useEffect, useRef, useState } from 'react';
import { participantsMayAddContext } from '@ce-shared/sessionContextSources.mjs';
import { readLinkedWorkerGroupId } from '../../domains/worker/workerGroupAutoJoin';
import { recordingOwner, type RecordingOptions } from '../../utilities/audio/recordingOwner';
import {
  removeContextSource,
  uploadContextFile,
  workerAcceptsParticipantContext,
  workerSupportsContextSources,
} from '../../utilities/docLibrary/contextSources';
import { useContextGroups } from '../../utilities/docLibrary/useContextGroups';
import { supportsContextSources } from '../../utilities/docLibrary/useSessionContextSources';
import { isConfiguredAdmin } from '../../utilities/storage/storageClient';
import { SESSION_WIDE_ACCESS, contextAccessOf, contextGroupChoice } from '../Sessions/setup/ContextAccessSelect';

const transcriptFileName = () => {
  const now = new Date();
  const stamp = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return `Group conversation ${stamp.replace('T', ' ').replace(':', '-')}.txt`;
};

type Input = { sessionSlug: string; sessionConfig: unknown; context: unknown; enabled: boolean };
type Target = Pick<Input, 'sessionSlug' | 'sessionConfig' | 'context'>;

// The same account, and the same session on the same Worker.
const sameOwner = (left: Target, right: Target) => {
  const [a, b] = [left, right].map((target) => recordingOwner(target as RecordingOptions));
  return a.account === b.account && a.identity === b.identity;
};

/**
 * The Group Conversation's "Add transcript to context" choice. The file goes up after the questions submit, as
 * that is when someone has signed in.
 */
export function useTranscriptContextUpload({ sessionSlug, sessionConfig, context, enabled }: Input) {
  const [available, setAvailable] = useState(false);
  const [chosen, setChosen] = useState(false);
  const [access, setAccess] = useState('');
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
  const account = (context as { account?: unknown } | null)?.account;
  const isAdmin = isConfiguredAdmin(sessionConfig, { account });
  const mayAdd =
    enabled && supportsContextSources(sessionConfig) && (isAdmin || participantsMayAddContext(sessionConfig));
  const latest = useRef({ sessionSlug, sessionConfig, context });
  latest.current = { sessionSlug, sessionConfig, context };
  const uploaded = useRef({ text: '', id: '', choice: '' });
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
  const choice = access || (linkedGroup ? contextGroupChoice(linkedGroup) : SESSION_WIDE_ACCESS);

  const upload = useCallback(
    (transcript: string) => {
      const text = transcript.trim();
      const earlier = uploaded.current;
      if (!chosen || !text || (text === earlier.text && choice === earlier.choice)) return pending.current;
      // A queued upload goes up as the account, to the session and audience, it was asked for, or not at all.
      const target = latest.current;
      setFailed(false);
      setStatus('Adding the transcript to context…');
      pending.current = pending.current.then(async () => {
        if (!sameOwner(target, latest.current)) {
          setStatus('The transcript wasn’t added to context: the account or session changed.');
          return;
        }
        try {
          const id = await uploadContextFile(
            {
              file: new File([text], transcriptFileName(), { type: 'text/plain' }),
              ...contextAccessOf(choice),
            },
            target,
          );
          uploaded.current = { text, id, choice };
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
    [choice, chosen],
  );

  return {
    available,
    chosen,
    setChosen,
    choice,
    setChoice: setAccess,
    groups,
    allowAdminsOnly: isAdmin,
    status,
    failed,
    upload,
    /** Settles once any upload under way has finished, so closing doesn't cut it off. */
    settled: () => pending.current,
  };
}
