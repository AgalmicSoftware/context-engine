import { useCallback, useEffect, useRef, useState } from 'react';
import { participantsMayAddContext } from '@ce-shared/sessionContextSources.mjs';
import { readLinkedWorkerGroupId } from '../../domains/worker/workerGroupAutoJoin';
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

/**
 * The Group Conversation's "Add transcript to context" choice. The file goes up after the questions submit, as
 * that is when someone has signed in. A later submit with more transcript replaces it rather than adding another.
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
  const uploaded = useRef({ text: '', id: '' });
  const pending = useRef<Promise<void>>(Promise.resolve());
  const groups = useContextGroups({ sessionSlug, sessionConfig, enabled: available });

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
      if (!chosen || !text || text === uploaded.current.text) return pending.current;
      setFailed(false);
      setStatus('Adding the transcript to context…');
      pending.current = pending.current.then(async () => {
        try {
          const id = await uploadContextFile(
            {
              file: new File([text], transcriptFileName(), { type: 'text/plain' }),
              ...contextAccessOf(choice),
            },
            latest.current,
          );
          const previous = uploaded.current.id;
          uploaded.current = { text, id };
          if (previous)
            await removeContextSource({ id: previous, reading: null }, latest.current).catch(() => undefined);
          setStatus('Transcript added to context.');
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
