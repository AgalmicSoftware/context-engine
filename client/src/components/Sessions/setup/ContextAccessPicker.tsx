/** @file ContextAccessPicker.tsx: who may read a context file being added. */
import { useEffect, useRef, useState } from 'react';

import { CONTEXT_SOURCE_LIMITS } from '@ce-shared/sessionContextSources.mjs';
import type { ContextFileAccess } from '../../../utilities/docLibrary/contextSources';
import type { ContextGroup } from '../../../utilities/docLibrary/useContextGroups';
import styles from './ContextAccessPicker.module.scss';

const EVERYONE = 'Everyone in the session';
const ADMINS = 'Admins only';
// The Worker checks each group as someone reads, so a lock names at most this many.
const MAX_GROUPS = CONTEXT_SOURCE_LIMITS.lockedGroups;

const chosenGroupsOf = (access: ContextFileAccess) => (access.adminsOnly ? [] : access.groupIds || []);

/** Names the groups a file is locked to, as far as the list knows them. */
export const contextGroupsLabel = (groupIds: string[], groups: ContextGroup[]): string => {
  const named = groupIds.flatMap((id) => groups.find(({ groupId }) => groupId === id)?.label || []);
  const others = groupIds.length - named.length;
  if (!named.length) return others === 1 ? 'One group' : `${others} groups`;
  if (!others) return named.join(', ');
  return `${named.join(', ')} and ${others === 1 ? 'one other group' : `${others} other groups`}`;
};

/** The same choice always gives the same key, so two choices can be compared. */
export const contextAccessKey = (access: ContextFileAccess): string => {
  const groupIds = chosenGroupsOf(access);
  if (access.adminsOnly) return 'admins';
  return groupIds.length ? `groups:${[...groupIds].sort().join(',')}` : 'everyone';
};

type Props = {
  id: string;
  value: ContextFileAccess;
  groups: ContextGroup[];
  /** Only admins see this one: nobody else could open what they had added. */
  allowAdminsOnly?: boolean;
  disabled?: boolean;
  className?: string;
  onChange: (access: ContextFileAccess) => void;
  'aria-label'?: string;
  'data-testid'?: string;
};

// A dropdown of toggles, like the question filter's tags: everyone in the session,
// admins only, or any of the session's groups, whose members and the admins may read
// the file. Taking off the last group leaves it for everyone again.
const ContextAccessPicker = ({ id, value, groups, allowAdminsOnly, disabled, className, onChange, ...rest }: Props) => {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  // A dialog around it closes on Escape's keyup, so the keyup of an Escape that closed the choices stops here too.
  const escaped = useRef(false);
  const chosen = chosenGroupsOf(value);
  const full = chosen.length >= MAX_GROUPS;
  // A group chosen before the list loads, or that it doesn't name, still shows, so it can be taken off.
  const shown = [
    ...groups,
    ...chosen
      .filter((groupId) => !groups.some((group) => group.groupId === groupId))
      .map((groupId) => ({ groupId, label: 'This group' })),
  ];
  const summary = value.adminsOnly ? ADMINS : chosen.length ? contextGroupsLabel(chosen, groups) : EVERYONE;

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const toggleGroup = (groupId: string) => {
    const taken = chosen.includes(groupId);
    // Taking off a group the list doesn't name removes its button, so focus moves to the toggle first.
    if (taken && !groups.some((group) => group.groupId === groupId)) toggle.current?.focus();
    const next = taken ? chosen.filter((chosenId) => chosenId !== groupId) : [...chosen, groupId];
    onChange(next.length ? { groupIds: next } : {});
  };
  const choice = (key: string, label: string, pressed: boolean, choose: () => void, unavailable = false) => (
    <button
      key={key}
      type="button"
      className={[styles.choice, pressed ? styles.chosen : ''].filter(Boolean).join(' ')}
      aria-pressed={pressed}
      disabled={unavailable}
      onClick={choose}
    >
      {label}
    </button>
  );

  return (
    <div
      ref={wrapper}
      className={[styles.picker, className].filter(Boolean).join(' ')}
      onBlur={(event) => {
        // Only a move to somewhere else closes it: some browsers don't focus a button on click.
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        // Escape closes the choices, not a dialog around them.
        event.stopPropagation();
        escaped.current = true;
        setOpen(false);
        toggle.current?.focus();
      }}
      onKeyUp={(event) => {
        if (event.key !== 'Escape' || !escaped.current) return;
        escaped.current = false;
        event.stopPropagation();
      }}
    >
      <button
        ref={toggle}
        id={id}
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={`${id}-choices`}
        aria-describedby={`${id}-summary`}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        {...rest}
      >
        <span id={`${id}-summary`} className={styles.summary}>
          {summary}
        </span>
        <span className={styles.caret} aria-hidden="true" />
      </button>
      {open ? (
        <div id={`${id}-choices`} className={styles.choices} role="group" aria-labelledby={id}>
          {choice('everyone', EVERYONE, !value.adminsOnly && !chosen.length, () => onChange({}))}
          {allowAdminsOnly ? choice('admins', ADMINS, !!value.adminsOnly, () => onChange({ adminsOnly: true })) : null}
          {shown.map(({ groupId, label }) =>
            choice(
              `group:${groupId}`,
              label,
              chosen.includes(groupId),
              () => toggleGroup(groupId),
              full && !chosen.includes(groupId),
            ),
          )}
          {full ? <span className={styles.limit}>Up to {MAX_GROUPS} groups.</span> : null}
        </div>
      ) : null}
    </div>
  );
};

export default ContextAccessPicker;
