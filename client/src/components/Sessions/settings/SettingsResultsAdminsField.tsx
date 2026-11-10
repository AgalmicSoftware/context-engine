import React, { useState } from 'react';
import { Input } from 'reactstrap';
import { MAX_RESULTS_ADMINS } from '@ce-shared/sessionConfigEdits.mjs';

import { SetupField, setupHelpId } from '../setup/SetupPrimitives';
import styles from '../setup/SessionSetup.module.scss';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const ID = 'ce-setting-results-admins';

// People an admin adds here may build debate atlases in Results, and nothing
// else; the list saves with the rest of the page.
export default function SettingsResultsAdminsField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const add = () => {
    const next = address.trim().toLowerCase();
    const problem = !ADDRESS.test(next)
      ? 'Enter an address: 0x and 40 hex digits.'
      : value.includes(next)
        ? 'That address is already a results admin.'
        : value.length >= MAX_RESULTS_ADMINS
          ? `A session has at most ${MAX_RESULTS_ADMINS} results admins.`
          : '';
    setError(problem);
    if (problem) return;
    onChange([...value, next]);
    setAddress('');
  };

  return (
    <SetupField
      id={ID}
      label="Results admins"
      help="They can build debate atlases in Results. Only this session's admins change its settings, this list included."
    >
      {value.length ? (
        <ul className={styles.listRowBody} aria-label="Results admins" data-testid="ce-setting-results-admins-list">
          {value.map((entry) => (
            <li key={entry} className={styles.listRow}>
              <span className={`${styles.listRowBody} ${styles.readOnlyValue}`}>{entry}</span>
              <button
                type="button"
                className={styles.button}
                aria-label={`Remove ${entry}`}
                onClick={() => onChange(value.filter((other) => other !== entry))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className={styles.inlineRow}>
        <Input
          id={ID}
          value={address}
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={setupHelpId(ID)}
          aria-invalid={error ? true : undefined}
          data-testid={ID}
          onChange={(event) => setAddress(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            add();
          }}
        />
        <button type="button" className={styles.button} data-testid={`${ID}-add`} onClick={add}>
          Add
        </button>
      </div>
      {error ? (
        <p className={styles.hint} role="alert">
          {error}
        </p>
      ) : null}
    </SetupField>
  );
}
