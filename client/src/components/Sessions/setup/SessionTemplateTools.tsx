import React, { useState } from 'react';
import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';
import { Input } from 'reactstrap';

import {
  SESSION_TEMPLATE_FORMAT,
  SESSION_TEMPLATE_MAX_BYTES,
  diffSessionTemplates,
  parseSessionTemplateJson,
  validateSessionTemplate,
  type SessionTemplate,
  type SessionTemplateChange,
  type SessionTemplateError,
  type SessionTemplateResult,
} from '@ce-shared/sessionTemplate.mjs';
import { encodeSessionTemplateLink } from '@ce-shared/sessionTemplateLink.mjs';
import { notify } from '../../../utilities/ui/notify.js';
import { publishSetupQuestions } from './setupQuestionsPublish';
import type { SetupQuestion } from './setupSectionTypes';
import styles from './SessionSetup.module.scss';

const MAX_VALUE_TEXT = 90;

// A short, plain rendering of a template value for the list of differences.
export const describeTemplateValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '(empty)';
  if (Array.isArray(value)) return value.length === 1 ? '1 item' : `${value.length} items`;
  const raw = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return raw.length > MAX_VALUE_TEXT ? `${raw.slice(0, MAX_VALUE_TEXT - 1)}…` : raw;
};

export const downloadSessionTemplate = (template: SessionTemplate, name: string) => {
  const blob = new Blob([`${JSON.stringify(template, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${(name || 'session').replace(/[^\w-]+/g, '-')}.template.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const TemplateErrors = ({ errors }: { errors: SessionTemplateError[] }) =>
  errors.length ? (
    <ul className={styles.errorText} role="alert" data-testid="ce-template-errors">
      {errors.slice(0, 8).map((error) => (
        <li key={`${error.path}:${error.message}`}>{error.message}</li>
      ))}
      {errors.length > 8 ? <li>{`${errors.length - 8} more`}</li> : null}
    </ul>
  ) : null;

export const TemplateChanges = ({ changes }: { changes: SessionTemplateChange[] }) =>
  changes.length ? (
    <ul className={styles.diffList} data-testid={E2E_TESTIDS.SETUP_TEMPLATE_CHANGES}>
      {changes.map((change) => (
        <li key={change.path}>
          <span className={styles.diffPath}>{change.path}</span>: {describeTemplateValue(change.before)} →{' '}
          {describeTemplateValue(change.after)}
        </li>
      ))}
    </ul>
  ) : (
    <p className={styles.hint}>No differences from your draft.</p>
  );

type SessionTemplateActionsProps = {
  /** The current draft as a template (validated). */
  buildTemplate: () => SessionTemplateResult;
  onImport: (template: SessionTemplate) => void;
  /** The draft came from a share link: sharing sends it back with these changes. */
  fromLink: boolean;
  fileName: string;
  /** Where a share link opens: /new on this site. */
  linkBase: string;
};

// Export, Import (upload or paste) and Copy share link. Nothing here reads or
// writes secrets: templates hold portable fields only.
export const SessionTemplateActions = ({
  buildTemplate,
  onImport,
  fromLink,
  fileName,
  linkBase,
}: SessionTemplateActionsProps) => {
  const [importOpen, setImportOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [candidate, setCandidate] = useState<{ template: SessionTemplate; changes: SessionTemplateChange[] } | null>(
    null,
  );
  const [errors, setErrors] = useState<SessionTemplateError[]>([]);
  const [status, setStatus] = useState('');
  const [tooLong, setTooLong] = useState(false);

  const current = () => {
    const result = buildTemplate();
    if (!result.ok) setErrors(result.errors);
    return result.ok ? result.template : null;
  };
  const exportFile = () => {
    setErrors([]);
    const template = current();
    if (!template) return;
    downloadSessionTemplate(template, fileName);
    setStatus('Template downloaded.');
  };
  const share = async () => {
    setErrors([]);
    setTooLong(false);
    const template = current();
    if (!template) return;
    const result = await encodeSessionTemplateLink(template);
    if (!result.ok) {
      if (result.reason === 'too_long') {
        setTooLong(true);
        setStatus(`This draft is too long for a link (${result.length} characters). Download the .json instead.`);
      } else setErrors(result.errors);
      return;
    }
    try {
      await navigator.clipboard.writeText(`${linkBase}${result.fragment}`);
      notify.success('Copied to clipboard');
      setStatus('Share link copied. It carries no keys or tokens.');
    } catch {
      setStatus('Copy failed. Download the .json instead.');
    }
  };
  const check = (json: string) => {
    setStatus('');
    setCandidate(null);
    const result = parseSessionTemplateJson(json);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    const mine = buildTemplate();
    setCandidate({
      template: result.template,
      changes: mine.ok ? diffSessionTemplates(mine.template, result.template) : [],
    });
  };
  const readFile = (file: File | undefined) => {
    if (!file) return;
    // Refused before reading, so an oversized file never loads into memory.
    if (file.size > SESSION_TEMPLATE_MAX_BYTES) {
      setErrors([{ path: '', message: `This template is larger than ${SESSION_TEMPLATE_MAX_BYTES / 1024} KB.` }]);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => check(String(reader.result ?? ''));
    reader.onerror = () => setErrors([{ path: '', message: 'That file could not be read.' }]);
    reader.readAsText(file);
  };

  return (
    <div className={styles.buttonRow} data-testid="ce-template-actions">
      <button
        type="button"
        className={styles.button}
        data-testid={E2E_TESTIDS.SETUP_TEMPLATE_EXPORT}
        onClick={exportFile}
      >
        Export
      </button>
      <button
        type="button"
        className={styles.button}
        data-testid={E2E_TESTIDS.SETUP_TEMPLATE_IMPORT}
        aria-expanded={importOpen}
        onClick={() => setImportOpen((open) => !open)}
      >
        Import
      </button>
      <button
        type="button"
        className={styles.button}
        data-testid={E2E_TESTIDS.SETUP_TEMPLATE_SHARE}
        onClick={() => void share()}
      >
        {fromLink ? 'Copy link with my changes' : 'Copy share link'}
      </button>
      {tooLong ? (
        <button type="button" className={styles.button} data-testid="ce-template-share-download" onClick={exportFile}>
          Download .json
        </button>
      ) : null}
      {status ? (
        <p className={styles.statusText} role="status" data-testid="ce-template-status">
          {status}
        </p>
      ) : null}
      <TemplateErrors errors={errors} />
      {importOpen ? (
        <div className={styles.banner} data-testid="ce-template-import-panel">
          <label className={styles.fieldLabel} htmlFor="ce-template-file">
            Template file
          </label>
          <input
            id="ce-template-file"
            type="file"
            accept=".json,application/json"
            data-testid={E2E_TESTIDS.SETUP_TEMPLATE_FILE}
            onChange={(event) => readFile(event.target.files?.[0])}
          />
          <label className={styles.fieldLabel} htmlFor="ce-template-paste">
            Or paste it
          </label>
          <Input
            id="ce-template-paste"
            type="textarea"
            className={styles.textarea}
            value={pasted}
            data-testid={E2E_TESTIDS.SETUP_TEMPLATE_PASTE}
            onChange={(event) => setPasted(event.target.value)}
          />
          <div className={styles.buttonRow}>
            <button type="button" className={styles.button} disabled={!pasted.trim()} onClick={() => check(pasted)}>
              Check
            </button>
          </div>
          {candidate ? (
            <>
              <p className={styles.bannerTitle}>This template changes:</p>
              <TemplateChanges changes={candidate.changes} />
              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={`${styles.button} ${styles.primaryButton}`}
                  data-testid={E2E_TESTIDS.SETUP_TEMPLATE_IMPORT_APPLY}
                  onClick={() => {
                    onImport(candidate.template);
                    setCandidate(null);
                    setPasted('');
                    setImportOpen(false);
                    setStatus('Template imported. Review the sections, then save or create.');
                  }}
                >
                  Use this template
                </button>
                <button type="button" className={styles.button} onClick={() => setCandidate(null)}>
                  Cancel
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

type SessionTemplateLinkNoticeProps = {
  /** The decoded link, or its errors. */
  result: SessionTemplateResult;
  changes: SessionTemplateChange[];
  /** The link carries this browser's own draft (same draftId). */
  sameDraft: boolean;
  onAccept: (template: SessionTemplate) => void;
  onDismiss: () => void;
};

// Shown before anything from a link is used.
export const SessionTemplateLinkNotice = ({
  result,
  changes,
  sameDraft,
  onAccept,
  onDismiss,
}: SessionTemplateLinkNoticeProps) => (
  <section
    className={styles.banner}
    aria-labelledby="ce-template-link-title"
    data-testid={E2E_TESTIDS.SETUP_TEMPLATE_LINK_NOTICE}
  >
    <p id="ce-template-link-title" className={styles.bannerTitle}>
      This draft came from a link
    </p>
    {result.ok ? (
      <>
        <p className={styles.hint}>
          {sameDraft ? 'Changes from your draft:' : 'It is a different draft. Differences from yours:'}
        </p>
        <TemplateChanges changes={changes} />
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={`${styles.button} ${styles.primaryButton}`}
            data-testid={E2E_TESTIDS.SETUP_TEMPLATE_LINK_ACCEPT}
            onClick={() => onAccept(result.template)}
          >
            Use this draft
          </button>
          <button
            type="button"
            className={styles.button}
            data-testid={E2E_TESTIDS.SETUP_TEMPLATE_LINK_DISMISS}
            onClick={onDismiss}
          >
            Keep mine
          </button>
        </div>
      </>
    ) : (
      <>
        <TemplateErrors errors={result.errors} />
        <p className={styles.hint}>Ask for the template as JSON instead, and paste it under Import → Or paste it.</p>
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.button}
            data-testid={E2E_TESTIDS.SETUP_TEMPLATE_LINK_DISMISS}
            onClick={onDismiss}
          >
            Dismiss
          </button>
        </div>
      </>
    )}
  </section>
);

type SetupQuestionsPublisherProps = {
  questions: SetupQuestion[];
  /** The session's public config once it exists; null before creation. */
  sessionConfig: Record<string, unknown> | null;
  sessionSlug: string;
  account: string;
  provider?: unknown;
  /** Called with the questions the upload held, which edits made while it ran may differ from. */
  onPublished: (published: SetupQuestion[]) => void;
};

// After creation, adds the questions a template brought.
export const SetupQuestionsPublisher = ({
  questions,
  sessionConfig,
  sessionSlug,
  account,
  provider,
  onPublished,
}: SetupQuestionsPublisherProps) => {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState<SessionTemplateError[]>([]);
  if (!questions.length) return status ? <p className={styles.statusText}>{status}</p> : null;
  if (!sessionConfig) {
    return <p className={styles.hint}>These questions are added to the session once it is created.</p>;
  }
  const publish = async () => {
    // Questions edited since import must still pass the template's checks.
    const checked = validateSessionTemplate({ format: SESSION_TEMPLATE_FORMAT, questions });
    setErrors(checked.ok ? [] : checked.errors);
    if (!checked.ok) return;
    setBusy(true);
    setStatus('Adding questions…');
    try {
      const count = await publishSetupQuestions({ questions, sessionConfig, sessionSlug, account, provider });
      setStatus(count === 1 ? 'Added 1 question.' : `Added ${count} questions.`);
      onPublished(questions);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Adding the questions failed. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.buttonRow}>
      <button
        type="button"
        className={`${styles.button} ${styles.primaryButton}`}
        disabled={busy}
        data-testid={E2E_TESTIDS.SETUP_QUESTIONS_PUBLISH}
        onClick={() => void publish()}
      >
        {busy
          ? 'Adding…'
          : `Add ${questions.length === 1 ? '1 question' : `${questions.length} questions`} to the session`}
      </button>
      {status ? (
        <p className={styles.statusText} role="status" data-testid="ce-setup-questions-status">
          {status}
        </p>
      ) : null}
      <TemplateErrors errors={errors} />
    </div>
  );
};
