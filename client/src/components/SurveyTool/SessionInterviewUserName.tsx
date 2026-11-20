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
 * person's own page: same store, same rules, same refusals. Nothing is saved until Save is pressed.
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
  const [note, setNote] = useState('');
  const [failed, setFailed] = useState(false);
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
  const save = () => {
    setSaving(true);
    setNote('');
    setFailed(false);
    source
      .setOwn(typed)
      .then((name) => {
        setSaved(name || '');
        setOfferSuggestion(false);
        setValue(name || '');
        setTouched(false);
        setNote(name ? 'Saved. People in this session see this name.' : 'Your username was removed.');
      })
      .catch((error: unknown) => {
        setFailed(true);
        setNote(error instanceof Error && error.message ? error.message : "The name couldn't be saved.");
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
          aria-describedby={`${inputId}-note`}
          onChange={(event) => {
            setValue(event.target.value);
            setTouched(true);
            setNote('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && typed !== normalizeSessionName(stored)) save();
          }}
        />
        <Button
          type="button"
          className={styles.sessionListeningGenerate}
          disabled={disabled || saving || typed === normalizeSessionName(stored)}
          onClick={save}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
      <p id={`${inputId}-note`} className={failed ? styles.sessionInterviewUserNameError : undefined} role="status">
        {note ||
          // A suggested or typed name is not the stored one until Save, so the box never passes for set.
          (typed !== normalizeSessionName(stored)
            ? typed
              ? 'Not saved yet: press Save to use this name. It is not written into your answers.'
              : 'Not saved yet: press Save to remove your username.'
            : stored
              ? 'People in this session see this name beside your address.'
              : 'Shown to people in this session beside your address. It is not written into your answers.')}
      </p>
    </section>
  );
};

export default SessionInterviewUserName;
