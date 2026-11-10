import React, { Suspense, useState } from 'react';
import { Input } from 'reactstrap';

import { SESSION_CONTEXT_LIMITS } from '@ce-shared/sessionContext.mjs';
import LazyFallback from '../../Shared/LazyFallback';
import { SetupField, setupHelpId } from './SetupPrimitives';
import styles from './SessionSetup.module.scss';

// The sanitizer and the page view load only when someone uses an HTML page.
const SessionContextHtml = React.lazy(() => import('../../OnePageSession/SessionContextHtml'));
const loadCleaner = () => import('../../../utilities/session/contextHtml');

const MAX_FILE_BYTES = 1024 * 1024;
// FileReader, as the client's other uploads use.
const readFileText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('The file could not be read.'));
    reader.readAsText(file);
  });
const FILE_HELP =
  'One .html file. Scripts, styles, classes, frames and forms are removed before it is saved, and the site’s theme styles the rest. Everyone who can open the session sees it, and the session’s AI reads its words.';

type Props = {
  html: string;
  onChange: (html: string) => void;
  /** The draft's colour scheme, so the preview looks as the session page will. */
  colorSchemeId: string;
};

// The context section's HTML form: upload a file, see it as the session page
// will show it, and what cleaning took out of it.
const SetupContextHtmlField = ({ html, onChange, colorSchemeId }: Props): React.ReactElement => {
  const [removed, setRemoved] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const choose = async (file: File | undefined) => {
    setError('');
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError('The file is larger than 1 MB.');
      return;
    }
    let cleaned;
    try {
      const [{ cleanContextHtml }, source] = await Promise.all([loadCleaner(), readFileText(file)]);
      cleaned = cleanContextHtml(source);
    } catch {
      setError('This file couldn’t be read.');
      return;
    }
    if (!cleaned.html) {
      setError('Nothing in this file can be shown.');
      return;
    }
    if (cleaned.html.length > SESSION_CONTEXT_LIMITS.htmlChars) {
      setError(
        `The cleaned page is longer than ${SESSION_CONTEXT_LIMITS.htmlChars.toLocaleString('en-US')} characters.`,
      );
      return;
    }
    setRemoved(cleaned.removed);
    onChange(cleaned.html);
  };
  return (
    <>
      <SetupField id="ce-setup-context-html-file" label={html ? 'Replace HTML file' : 'HTML file'} help={FILE_HELP}>
        <Input
          id="ce-setup-context-html-file"
          type="file"
          accept=".html,.htm,text/html"
          aria-describedby={setupHelpId('ce-setup-context-html-file')}
          data-testid="ce-setup-context-html-file"
          onChange={(event) => {
            const input = event.currentTarget;
            void choose(input.files?.[0]).finally(() => {
              input.value = '';
            });
          }}
        />
      </SetupField>
      {error ? (
        <p className={styles.errorText} role="alert" data-testid="ce-setup-context-html-error">
          {error}
        </p>
      ) : null}
      {html ? (
        <div data-testid="ce-setup-context-html-preview">
          <h3 className={styles.subheading}>Preview</h3>
          <Suspense fallback={<LazyFallback label="Loading preview..." minHeight="8vh" />}>
            <SessionContextHtml html={html} framed colorSchemeId={colorSchemeId} testId="ce-setup-context-html-shown" />
          </Suspense>
          {removed ? (
            <p className={styles.hint} role="status" data-testid="ce-setup-context-html-removed">
              {removed.length ? `Removed from the file: ${removed.join(', ')}.` : 'Nothing was removed from the file.'}
            </p>
          ) : null}
          <div className={styles.buttonRow}>
            <button
              type="button"
              className={styles.button}
              data-testid="ce-setup-context-html-remove"
              onClick={() => {
                setRemoved(null);
                onChange('');
              }}
            >
              Remove HTML file
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default SetupContextHtmlField;
