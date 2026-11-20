/** @file SessionInterviewUserName.tsx: the optional user-name box under the interview's drafted answers. */
import { useEffect, useId, useState } from 'react';
import { Button, Input } from 'reactstrap';
import { normalizeSessionName, type SessionNames, type SessionNamesSource } from '../../utilities/session/sessionNames';
import styles from './SurveyTool.module.scss';

type SessionInterviewUserNameProps = {
  /** The session's place for names; the box shows only where it keeps them and they are on. */
  source: SessionNamesSource | null;
  names: SessionNames;
  account: string;
  /** A name the imported context carried, offered in the box until the person saves or changes it. */
  suggestion?: string;
  disabled?: boolean;
};

/**
 * A name belongs to the account in this session, never to single answers, so it is set here as it is on the
 * person's own page: same store, same rules, same refusals. Nothing is saved until the checkmark or Enter.
 */
const SessionInterviewUserName = ({
  source,
  names,
  account,
  suggestion = '',
  disabled = false,
}: SessionInterviewUserNameProps) => {
  const inputId = `interview-user-name-${useId().replace(/:/g, '')}`;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // What the last Save stored, shown until the session's names catch up; after any save the imported name is no
  // longer offered.
  const [saved, setSaved] = useState<string | null>(null);
  const [offerSuggestion, setOfferSuggestion] = useState(true);
  const stored = saved ?? (names[account.toLowerCase()] || '');
  const offered = offerSuggestion ? stored || suggestion : stored;
  const [value, setValue] = useState(offered);
  const [touched, setTouched] = useState(false);
  const listed = names[account.toLowerCase()] || '';
  useEffect(() => {
    if (saved !== null && normalizeSessionName(listed) === normalizeSessionName(saved)) setSaved(null);
  }, [listed, saved]);
  // The stored name can arrive after the box, and replaces what it shows until the person types.
  useEffect(() => {
    if (!touched) setValue(offered);
  }, [offered, touched]);

  if (!source?.enabled || !account) return null;
  const typed = normalizeSessionName(value);
  // A checkmark shows only while the box holds something other than the saved name, so an unsaved one is plain.
  const changed = typed !== normalizeSessionName(stored);
  const save = () => {
    setSaving(true);
    setError('');
    source
      .setOwn(typed)
      .then((name) => {
        setSaved(name || '');
        setOfferSuggestion(false);
        setValue(name || '');
        setTouched(false);
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error && reason.message ? reason.message : "The name couldn't be saved.");
      })
      .finally(() => setSaving(false));
  };
  return (
    <section className={styles.sessionInterviewUserName} aria-label="Your username">
      <label htmlFor={inputId}>Username (optional)</label>
      <div className={styles.sessionInterviewUserNameRow}>
        <Input
          id={inputId}
          type="text"
          value={value}
          maxLength={64}
          disabled={disabled || saving}
          aria-describedby={error ? `${inputId}-error` : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            setTouched(true);
            setError('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && changed) save();
          }}
        />
        {changed ? (
          <Button
            type="button"
            className={styles.sessionListeningGenerate}
            aria-label="Save username"
            aria-busy={saving}
            disabled={disabled || saving}
            onClick={save}
          >
            <span aria-hidden="true">✓</span>
          </Button>
        ) : null}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className={styles.sessionInterviewUserNameError} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
};

export default SessionInterviewUserName;
