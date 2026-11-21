import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLanguage } from '@fortawesome/free-solid-svg-icons';
import styles from './SurveyTool.module.scss';

// Round flags drawn on a 20×20 grid; each is read out by its language's name, never its country's.
const FLAGS: { language: string; art: React.ReactNode }[] = [
  {
    language: 'English',
    art: (
      <>
        <rect width="20" height="20" fill="#012169" />
        <path d="M0 0 20 20M20 0 0 20" stroke="#fff" strokeWidth="4" />
        <path d="M0 0 20 20M20 0 0 20" stroke="#C8102E" strokeWidth="1.4" />
        <path d="M10 0v20M0 10h20" stroke="#fff" strokeWidth="6" />
        <path d="M10 0v20M0 10h20" stroke="#C8102E" strokeWidth="3.4" />
      </>
    ),
  },
  {
    language: 'Portuguese',
    art: (
      <>
        <rect width="20" height="20" fill="#DA291C" />
        <rect width="8" height="20" fill="#046A38" />
        <circle cx="8" cy="10" r="3.6" fill="#FFE900" />
        <circle cx="8" cy="10" r="1.9" fill="#fff" stroke="#DA291C" strokeWidth="0.9" />
      </>
    ),
  },
  {
    language: 'German',
    art: (
      <>
        <rect width="20" height="20" fill="#FFCE00" />
        <rect width="20" height="13.4" fill="#DD0000" />
        <rect width="20" height="6.7" fill="#000" />
      </>
    ),
  },
  {
    language: 'French',
    art: (
      <>
        <rect width="20" height="20" fill="#fff" />
        <rect width="6.7" height="20" fill="#002654" />
        <rect x="13.3" width="6.7" height="20" fill="#CE1126" />
      </>
    ),
  },
  {
    language: 'Hindi',
    art: (
      <>
        <rect width="20" height="20" fill="#fff" />
        <rect width="20" height="6.7" fill="#FF9933" />
        <rect y="13.3" width="20" height="6.7" fill="#138808" />
        <circle cx="10" cy="10" r="2.4" fill="none" stroke="#000080" strokeWidth="0.8" />
      </>
    ),
  },
  {
    language: 'Japanese',
    art: (
      <>
        <rect width="20" height="20" fill="#fff" />
        <circle cx="10" cy="10" r="5" fill="#BC002D" />
      </>
    ),
  },
  {
    language: 'Korean',
    art: (
      <>
        <rect width="20" height="20" fill="#fff" />
        <g transform="rotate(34 10 10)">
          <path d="M5 10a5 5 0 0 1 10 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 0-5 0" fill="#CD2E3A" />
          <path d="M5 10a5 5 0 0 0 10 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 0-5 0" fill="#0047A0" />
        </g>
        <path
          d="M2.6 6.2 4.6 3.4M14.4 15.4 16.4 12.6M15.4 3.4 17.4 6.2M3.6 13.8 5.6 16.6"
          stroke="#000"
          strokeWidth="1.3"
        />
      </>
    ),
  },
];

/** How long the flags stay after the interview opens, or after the language button brings them back. */
export const LANGUAGE_FLAGS_SHOWN_MS = 10_000;

/**
 * The interview's language control: one pill holding the language button and, while they show, round flags for
 * some of the languages someone can answer in, so the flags plainly belong to the button. The flags show on
 * opening, then go after ten seconds so the title row keeps the status and the close button on a phone. The
 * button brings them back; a pointer over them holds them. The pill sits in the title row where it has room and
 * takes the row under the title where it has not, as the stylesheet decides.
 */
export default function SessionInterviewLanguageMarks() {
  const listId = React.useId();
  const [shown, setShown] = React.useState(true);
  const [held, setHeld] = React.useState(false);
  React.useEffect(() => {
    if (!shown || held) return undefined;
    const timer = window.setTimeout(() => setShown(false), LANGUAGE_FLAGS_SHOWN_MS);
    return () => window.clearTimeout(timer);
  }, [shown, held]);
  return (
    <span className={styles.sessionInterviewLanguageRow} data-open={shown}>
      <span className={styles.sessionInterviewLanguageGroup}>
        <button
          type="button"
          className={`${styles.sessionInterviewHeaderButton} ${styles.sessionInterviewLanguageToggle}`}
          data-ce-control-appearance="frameless"
          aria-label="Languages you can answer in"
          aria-expanded={shown}
          aria-controls={listId}
          onClick={() => {
            // A row hidden under the pointer may never hear it leave.
            setHeld(false);
            setShown((current) => !current);
          }}
        >
          <FontAwesomeIcon icon={faLanguage} />
        </button>
        {/* Spans with list roles: the dialog's title is a heading, which can't hold a real list. */}
        <span
          id={listId}
          role="list"
          aria-label="Some languages you can answer in"
          className={styles.sessionInterviewLanguages}
          hidden={!shown}
          onPointerEnter={() => setHeld(true)}
          onPointerLeave={() => setHeld(false)}
        >
          {FLAGS.map(({ language, art }) => (
            <span role="listitem" key={language}>
              {/* The title names it, on hover too. */}
              <svg viewBox="0 0 20 20" role="img">
                <title>{language}</title>
                {art}
              </svg>
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}
