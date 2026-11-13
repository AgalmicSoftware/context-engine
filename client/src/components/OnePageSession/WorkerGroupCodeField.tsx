import { useId, useState } from 'react';
import { parseGroupInviteToken } from '../../../../shared/workerGroupJoin.mjs';

// Where a person types or pastes a group's password, or the claim code from a one-use link.
export default function WorkerGroupCodeField({
  groupLabel,
  disabled = false,
  formClassName,
  inputClassName,
  buttonClassName,
  onSubmit,
}: {
  groupLabel: string;
  disabled?: boolean;
  formClassName?: string;
  inputClassName?: string;
  buttonClassName?: string;
  onSubmit: (token: string) => void;
}) {
  const [value, setValue] = useState('');
  const [problem, setProblem] = useState('');
  const problemId = useId();
  const submit = () => {
    const kind = parseGroupInviteToken(value)?.kind;
    if (kind === 'invite') setProblem('Invite codes can’t be used yet. Ask for a link or the group password.');
    else if (!kind) setProblem('Enter the group password or claim code.');
    else {
      setProblem('');
      onSubmit(value.trim());
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
      <input
        className={inputClassName}
        type="password"
        value={value}
        placeholder="Group password or claim code"
        aria-label={`Group password or claim code for ${groupLabel}`}
        aria-describedby={problem ? problemId : undefined}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
      />
      <button type="submit" className={buttonClassName} disabled={disabled || !value.trim()}>
        Join
      </button>
      {problem ? (
        <span id={problemId} role="alert">
          {problem}
        </span>
      ) : null}
    </form>
  );
}
