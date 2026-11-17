import { useEffect, useId, useState } from 'react';
import { parseGroupInviteToken } from '../../../../shared/workerGroupJoin.mjs';
import { readWorkerGroupAutoJoinId } from '../../domains/worker/workerGroupAutoJoin';
import { readGroupInviteFragment } from '../../domains/worker/workerGroupAutoJoinIntent';
import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext';
import { buildPublicRoute } from '../../utilities/ui/publicUrl';

/** What a group that needs a secret tells someone who has none yet. */
export const WORKER_GROUP_INVITE_NEEDED = 'Needs an invite link or password from the group’s host.';

// The session an invite link names, '' when its path names none.
const linkSessionSlug = (url: URL): string => {
  const prefix = buildPublicRoute('/session/');
  if (!url.pathname.startsWith(prefix)) return '';
  try {
    return canonicalizeSessionSlug(decodeURIComponent(url.pathname.slice(prefix.length).replace(/\/$/, '')));
  } catch {
    return '';
  }
};

// A pasted invite link gives up the code in its fragment, if it is for this session and group; anything else is
// read as typed. A code sent to the wrong group or session is spent there (a claim code goes to that Worker as is).
const readPastedInvite = (
  text: string,
  groupId: string,
  sessionSlug: string,
): { token: string } | { problem: string } => {
  const value = text.trim();
  if (!/^https?:\/\//i.test(value)) return { token: value };
  try {
    const url = new URL(value);
    const linkSession = linkSessionSlug(url);
    if (sessionSlug && linkSession && linkSession !== canonicalizeSessionSlug(sessionSlug))
      return { problem: 'That invite link is for another session.' };
    const linkGroupId = readWorkerGroupAutoJoinId(url.search);
    if (groupId && linkGroupId && linkGroupId.toLowerCase() !== groupId.toLowerCase())
      return { problem: 'That invite link is for another group.' };
    const token = readGroupInviteFragment(url.hash);
    return token
      ? { token }
      : { problem: 'That link has no invite in it. Ask for the invite link or the group password.' };
  } catch {
    return { problem: 'Paste the whole invite link, or the group password.' };
  }
};

// Where a person pastes a group's invite link or types its password, or the claim code from a one-use link.
export default function WorkerGroupCodeField({
  groupId = '',
  sessionSlug = '',
  groupLabel,
  disabled = false,
  hint = '',
  problem: refusal = '',
  formClassName,
  hintClassName,
  inputClassName,
  buttonClassName,
  onSubmit,
}: {
  groupId?: string;
  sessionSlug?: string;
  groupLabel: string;
  disabled?: boolean;
  /** A line above the field saying what the group needs; none where the page says it already. */
  hint?: string;
  /** Why the last code was refused, from the join. */
  problem?: string;
  formClassName?: string;
  hintClassName?: string;
  inputClassName?: string;
  buttonClassName?: string;
  onSubmit: (token: string) => void;
}) {
  const [value, setValue] = useState('');
  const [problem, setProblem] = useState('');
  // Typing a new code puts away the last refusal; the next one shows again.
  const [setAside, setSetAside] = useState('');
  useEffect(() => {
    if (!refusal) setSetAside('');
  }, [refusal]);
  const hintId = useId();
  const problemId = useId();
  const shownProblem = problem || (refusal !== setAside ? refusal : '');
  const submit = () => {
    if (!value.trim()) return setProblem('Paste the invite link, or type the group password.');
    const pasted = readPastedInvite(value, groupId, sessionSlug);
    if ('problem' in pasted) return setProblem(pasted.problem);
    const kind = parseGroupInviteToken(pasted.token)?.kind;
    if (kind === 'invite') setProblem('Invite codes can’t be used yet. Ask for a link or the group password.');
    else if (!kind) setProblem('Paste the invite link, or type the group password.');
    else {
      setProblem('');
      onSubmit(pasted.token);
      setValue('');
    }
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className={formClassName}
    >
      {hint ? (
        <span id={hintId} className={hintClassName}>
          {hint}
        </span>
      ) : null}
      <input
        className={inputClassName}
        type="password"
        value={value}
        placeholder="Invite link or password"
        aria-label={`Invite link or password for ${groupLabel}`}
        aria-describedby={[hint ? hintId : '', shownProblem ? problemId : ''].filter(Boolean).join(' ') || undefined}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        onChange={(event) => {
          setValue(event.target.value);
          setProblem('');
          setSetAside(refusal);
        }}
      />
      <button
        type="submit"
        className={buttonClassName}
        // Enabled while empty: a Join that does nothing reads as broken, so an empty one says what to give.
        disabled={disabled}
        aria-label={`Join ${groupLabel}`}
      >
        Join
      </button>
      {shownProblem ? (
        <span id={problemId} className={hintClassName} role="alert">
          {shownProblem}
        </span>
      ) : null}
    </form>
  );
}
