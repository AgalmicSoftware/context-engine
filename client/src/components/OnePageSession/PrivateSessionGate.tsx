import { useEffect, useRef, useState } from 'react';
import { Input } from 'reactstrap';

import {
  followPastedPrivateInvite,
  keepPrivateSessionProof,
  readHeldPrivateInvite,
  readPastedPrivateInvite,
  replaceRefusedPrivateProof,
  type PrivateInvite,
} from '../../domains/worker/privateSessionAccess';
import type { PrivateSessionShell } from '../../utilities/session/sessionWorkerDiscovery';
import { heldSessionToken } from '../../utilities/worker/workerAuthTokenCache';
import { subscribeWorkerGroupsChanged } from '../../utilities/worker/workerGroupChangeEvents';
import { SetupField } from '../Sessions/setup/SetupPrimitives';
import setupStyles from '../Sessions/setup/SessionSetup.module.scss';

export type PrivateSessionGateProps = {
  sessionSlug: string;
  sessionId: string;
  workerUrl: string;
  /** Why the Worker sent only the shell: no proof came, or the one this browser sent doesn't admit. */
  shell: PrivateSessionShell;
  /** The shell config, enough to sign in to the Worker. */
  sessionConfig: object;
  account: unknown;
  provider?: unknown;
  toggleLoginModal?: unknown;
  /** Reads the session again; the page reloads by default. */
  reread?: () => void;
};

type Phase = 'opening' | 'checking' | 'locked' | 'invalid' | 'joinedLocked' | 'unsupported' | 'unkept';

const ABOUT_LINK = 'The link from your host or its QR code. It stays in this browser and is never sent in an address.';
// A sign-in, a join or a proof that comes back to the private page twice in a minute isn't going to open it by
// reloading again: a proof this browser couldn't keep would otherwise reload forever.
const REREAD_KEY = 'ce:private-session-reread:v1';
const REREAD_WINDOW_MS = 60_000;
const SIGN_IN = 'sign-in';
type Reread = { sessionSlug: string; reason: string; at: number };
let lastReread: Reread | null = null;

const rereadAllowed = (sessionSlug: string, reason: string): boolean => {
  let last: Reread | null;
  try {
    last = JSON.parse(sessionStorage.getItem(REREAD_KEY) || 'null');
  } catch {
    // Without storage the guard lasts as long as the page.
    last = lastReread;
  }
  if (last?.sessionSlug === sessionSlug && last.reason === reason && Date.now() - Number(last.at) < REREAD_WINDOW_MS)
    return false;
  lastReread = { sessionSlug, reason, at: Date.now() };
  try {
    sessionStorage.setItem(REREAD_KEY, JSON.stringify(lastReread));
  } catch {
    /* Kept in memory alone. */
  }
  return true;
};

// A proof's tail names it in the guard; the proof itself stays where it is kept.
const proofReason = (header: string) => `proof:${header.slice(-16)}`;

const MESSAGES: Record<Phase, string> = {
  opening: 'Opening your invite…',
  checking: 'Checking your account…',
  locked: 'Open it from your invite link.',
  invalid: 'This invite no longer works. Ask the host for a new link.',
  joinedLocked: 'You joined the group, but the session didn’t open. Reload in a moment, or ask the host.',
  unsupported: 'This browser can’t open the invite. Try another browser.',
  // The same proof came back within a minute: a browser that won't keep site data, or a link that just stopped working.
  unkept: 'The invite didn’t open the session. If this browser blocks site data, allow it; otherwise ask the host.',
};

/**
 * What a private session shows a visitor it can't admit: never its name or contents, only a way in. An invite this
 * tab holds becomes a read proof; one the Worker has stopped accepting is forgotten and said so plainly.
 */
export default function PrivateSessionGate({
  sessionSlug,
  sessionId,
  workerUrl,
  shell,
  sessionConfig,
  account,
  provider,
  toggleLoginModal,
  reread = () => window.location.reload(),
}: PrivateSessionGateProps) {
  const session = { sessionSlug, sessionId, workerUrl };
  const [phase, setPhase] = useState<Phase>('locked');
  const [pasted, setPasted] = useState('');
  const [pasteError, setPasteError] = useState('');
  const rereadRef = useRef(reread);
  rereadRef.current = reread;
  const signedIn = !!String(account || '').trim();
  // The page was read with this tab's sign-in, if it held one: reading again with the same one changes nothing.
  const [readSignedIn] = useState(() => !!heldSessionToken(workerUrl, sessionSlug));

  const readWith = (header: string) => {
    if (rereadAllowed(sessionSlug, proofReason(header))) rereadRef.current();
    else setPhase('unkept');
  };

  const open = async (invite: PrivateInvite) => {
    setPhase('opening');
    try {
      readWith(await keepPrivateSessionProof({ ...session, ...invite }));
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : '';
      setPhase(/WebCrypto|crypto\.subtle/i.test(message) ? 'unsupported' : 'invalid');
    }
  };

  useEffect(() => {
    let active = true;
    // The proof this browser sent no longer works (a changed password, a group taken off the session), unless the tab
    // holds a newer link than the one that made it.
    if (shell === 'invite_invalid') {
      setPhase('opening');
      void replaceRefusedPrivateProof(session).then((header) => {
        if (!active) return;
        if (header) readWith(header);
        else setPhase('invalid');
      });
      return () => {
        active = false;
      };
    }
    const held = readHeldPrivateInvite(session);
    if (held) void open(held);
    return () => {
      active = false;
    };
    // Runs once per session shown; the invite is read from the tab, not from props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionSlug, sessionId, workerUrl, shell]);

  // Members and admins read by their sign-in: once signed in here, sign in to the Worker and read the session again.
  useEffect(() => {
    if (!signedIn || readSignedIn || shell === 'invite_invalid' || readHeldPrivateInvite(session)) return;
    let active = true;
    setPhase('checking');
    void (async () => {
      try {
        const { getWorkerSessionToken } = await import('../../utilities/worker/workerAuth');
        await getWorkerSessionToken({
          sessionConfig,
          sessionSlug,
          workerUrl,
          context: { account, providerLike: provider },
        });
        if (!active) return;
        if (rereadAllowed(sessionSlug, SIGN_IN)) rereadRef.current();
        else setPhase('locked');
      } catch {
        if (active) setPhase('locked');
      }
    })();
    return () => {
      active = false;
    };
    // Runs when this page learns who is signed in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, account]);

  // A join (from the link's invitation at sign-in) may admit the visitor: read the session again, once.
  useEffect(
    () =>
      subscribeWorkerGroupsChanged((detail) => {
        if (detail.sessionSlug !== sessionSlug) return;
        if (rereadAllowed(sessionSlug, SIGN_IN)) rereadRef.current();
        else setPhase('joinedLocked');
      }),
    [sessionSlug],
  );

  const submit = () => {
    setPasteError('');
    try {
      const invite = readPastedPrivateInvite(pasted, sessionSlug);
      followPastedPrivateInvite(invite, session);
      setPasted('');
      void open(invite);
    } catch (failure) {
      setPasteError(failure instanceof Error ? failure.message : 'That link didn’t work.');
    }
  };

  const showLogin = !signedIn && typeof toggleLoginModal === 'function';
  return (
    <section
      className={`${setupStyles.banner} ${setupStyles.pageBanner}`}
      data-testid="ce-private-session-gate"
      data-phase={phase}
      aria-labelledby="ce-private-session-title"
    >
      <h2 id="ce-private-session-title" className={setupStyles.bannerTitle}>
        Private session
      </h2>
      <p role={phase === 'invalid' || phase === 'unsupported' || phase === 'unkept' ? 'alert' : 'status'}>
        {MESSAGES[phase]}
      </p>
      {signedIn && phase === 'locked' ? <p>Your account isn’t in a group that can see it yet.</p> : null}
      {phase !== 'opening' && phase !== 'checking' ? (
        <form
          className={setupStyles.listRowBody}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <SetupField id="ce-private-session-invite" label="Invite link" help={ABOUT_LINK}>
            <Input
              id="ce-private-session-invite"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={pasted}
              invalid={!!pasteError}
              aria-describedby={pasteError ? 'ce-private-session-invite-error' : undefined}
              onChange={(event) => setPasted(event.target.value)}
            />
          </SetupField>
          {pasteError ? (
            <p id="ce-private-session-invite-error" className={setupStyles.statusText} role="alert">
              {pasteError}
            </p>
          ) : null}
          <div className={setupStyles.buttonRow}>
            <button type="submit" className={setupStyles.button} disabled={!pasted.trim()}>
              Open
            </button>
            {showLogin ? (
              <button
                type="button"
                className={setupStyles.button}
                onClick={() => (toggleLoginModal as (open: boolean) => void)(true)}
              >
                Log in
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
