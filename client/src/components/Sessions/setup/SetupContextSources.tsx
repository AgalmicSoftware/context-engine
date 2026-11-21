import { useCallback, useEffect, useState } from 'react';
import { Input } from 'reactstrap';

import { contextCardsOn, contextFileIsReadByAi, resolveContextFileType } from '@ce-shared/sessionContextSources.mjs';
import {
  addContextLink,
  workerReadsSessionLinks,
  checkContextFile,
  contextFileAccept,
  readContextPdf,
  uploadContextFile,
  type ContextFileAccess,
} from '../../../utilities/docLibrary/contextSources';
import ContextAccessPicker from './ContextAccessPicker';
import { CONTEXT_ANALYZE_HELP, CONTEXT_CARDS_HELP, FILE_ACCESS_HELP } from './ContextSourcesPanel';
import { SetupCheck, SetupField, setupHelpId } from './SetupPrimitives';
import { asList, asRecord, text, type SetupDraft } from './setupSectionTypes';
import styles from './SessionSetup.module.scss';

/** A file chosen in setup; it is uploaded once the session exists. */
type PendingFile = { file: File; analyze: boolean };
export type PendingContextFiles = {
  files: Record<string, PendingFile>;
  set: (name: string, entry: PendingFile | null) => void;
};

// Files stay in memory only: a reload keeps their names, to attach again.
export const usePendingContextFiles = (): PendingContextFiles => {
  const [files, setFiles] = useState<Record<string, PendingFile>>({});
  const set = useCallback(
    (name: string, entry: PendingFile | null) =>
      setFiles((current) => {
        const next = { ...current };
        if (entry) next[name] = entry;
        else delete next[name];
        return next;
      }),
    [],
  );
  return { files, set };
};

type ContextFileEntry = { name: string; adminsOnly: boolean; groupIds?: string[] };
export const readContextFiles = (draft: SetupDraft): ContextFileEntry[] =>
  asList(draft.contextFiles)
    .map((value) => {
      const entry = asRecord(value);
      const groupIds = asList(entry.groupIds)
        .map((groupId) => text(groupId).trim())
        .filter(Boolean);
      return {
        name: text(entry.name).trim(),
        adminsOnly: entry.adminsOnly === true,
        ...(groupIds.length ? { groupIds } : {}),
      };
    })
    .filter((entry) => entry.name);

/** A group set up before Create, which Create makes before the files are added. */
export type SetupGroupOption = { groupId: string; label: string };

const FILE_VISIBILITY_HELP = `${FILE_ACCESS_HELP} Groups set up under Access and identity are made at Create, before these files are added.`;

const ATTACH_AGAIN_HELP =
  'The page holds chosen files only until it reloads. Choose this file again so Create can add it.';

// What a file's Visible to shows. One locked to groups no longer set up stays with admins, never wider.
const accessOf = (entry: ContextFileEntry, groups: SetupGroupOption[]): ContextFileAccess => {
  if (!entry.groupIds?.length) return entry.adminsOnly ? { adminsOnly: true } : {};
  const known = entry.groupIds.filter((groupId) => groups.some((group) => group.groupId === groupId));
  return known.length ? { groupIds: known } : { adminsOnly: true };
};
// A locked file is marked admins-only too, so whatever keeps only that flag, such
// as a template, keeps the file narrow.
const withAccess = (entry: ContextFileEntry, access: ContextFileAccess): ContextFileEntry => {
  const groupIds = access.adminsOnly ? [] : access.groupIds || [];
  return {
    name: entry.name,
    adminsOnly: !!access.adminsOnly || groupIds.length > 0,
    ...(groupIds.length ? { groupIds } : {}),
  };
};

// A PDF or an image: a file the session's AI reads to give its text.
const isAiRead = (file: File) => contextFileIsReadByAi(resolveContextFileType(file));

type FilesProps = {
  draft: SetupDraft;
  onChange: (path: string[], value: unknown) => void;
  pending: PendingContextFiles;
  /** Before Create, the groups set up so far; after it, the groups Create made. */
  groups?: SetupGroupOption[];
  /** The session's public config once it exists: its Context cards setting then decides, not the draft's. */
  sessionConfig?: Record<string, unknown> | null;
};

export const SETUP_CONTEXT_FILE_INPUT_ID = 'ce-setup-context-file';

// Before Create: the files to add. A name without its file (from a template
// or a reload) asks for the file again.
export const SetupContextFiles = ({ draft, onChange, pending, groups = [], sessionConfig = null }: FilesProps) => {
  const entries = readContextFiles(draft);
  // As the session will: images only with Context cards on. Once it exists, Settings changes the setting.
  const cards = sessionConfig ? contextCardsOn(sessionConfig) : draft.contextCardsEnabled === true;
  const named = groups.flatMap(({ groupId, label }) => (label.trim() ? [{ groupId, label: label.trim() }] : []));
  const [problem, setProblem] = useState('');
  const save = (next: ContextFileEntry[]) => onChange(['contextFiles'], next);
  const attach = (file: File | undefined, replacing = '') => {
    if (!file) return;
    const reason = checkContextFile(file, { images: cards });
    setProblem(reason);
    if (reason) return;
    if (replacing && replacing !== file.name) pending.set(replacing, null);
    pending.set(file.name, { file, analyze: pending.files[replacing]?.analyze ?? true });
    const kept = entries.filter((entry) => entry.name !== file.name && entry.name !== replacing);
    const previous = entries.find((entry) => entry.name === (replacing || file.name));
    save([...kept, { ...(previous || { adminsOnly: false }), name: file.name }]);
  };
  return (
    <div className={styles.listRowBody} data-testid="ce-setup-context-files">
      {entries.map((entry, index) => {
        const chosen = pending.files[entry.name];
        return (
          <div key={entry.name} className={styles.listRow} data-testid="ce-setup-context-file">
            <div className={styles.listRowBody}>
              <span className={styles.fieldLabel}>{entry.name}</span>
              {chosen ? (
                <span className={styles.hint}>Added to the session after Create.</span>
              ) : (
                <SetupField id={`ce-setup-context-file-again-${index}`} label="Attach again" help={ATTACH_AGAIN_HELP}>
                  <Input
                    id={`ce-setup-context-file-again-${index}`}
                    type="file"
                    aria-describedby={setupHelpId(`ce-setup-context-file-again-${index}`)}
                    onChange={(event) => attach((event.target as HTMLInputElement).files?.[0], entry.name)}
                  />
                </SetupField>
              )}
              <SetupField id={`ce-setup-context-file-access-${index}`} label="Visible to" help={FILE_VISIBILITY_HELP}>
                <ContextAccessPicker
                  id={`ce-setup-context-file-access-${index}`}
                  value={accessOf(entry, named)}
                  groups={named}
                  allowAdminsOnly
                  data-testid="ce-setup-context-file-access"
                  onChange={(access) =>
                    save(entries.map((other) => (other.name === entry.name ? withAccess(other, access) : other)))
                  }
                />
              </SetupField>
              {chosen && isAiRead(chosen.file) ? (
                <SetupCheck
                  id={`ce-setup-context-file-analyze-${index}`}
                  label="Analyze with the session’s AI"
                  help={CONTEXT_ANALYZE_HELP}
                  checked={chosen.analyze}
                  onChange={(analyze) => pending.set(entry.name, { ...chosen, analyze })}
                />
              ) : null}
            </div>
            <button
              type="button"
              className={styles.button}
              aria-label={`Remove ${entry.name}`}
              onClick={() => {
                pending.set(entry.name, null);
                save(entries.filter((other) => other.name !== entry.name));
              }}
            >
              Remove
            </button>
          </div>
        );
      })}
      {/* The Context section's "Add file" button opens this picker. */}
      <input
        id={SETUP_CONTEXT_FILE_INPUT_ID}
        type="file"
        className={styles.srOnly}
        tabIndex={-1}
        aria-hidden="true"
        accept={contextFileAccept({ images: cards })}
        data-testid="ce-setup-context-file-input"
        onChange={(event) => {
          attach(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {problem ? (
        <p className={styles.errorText} role="alert">
          {problem}
        </p>
      ) : null}
      <SetupCheck
        id="ce-setup-context-cards"
        label="AI analyze"
        help={
          sessionConfig ? `${CONTEXT_CARDS_HELP} The session is made: change this in its Settings.` : CONTEXT_CARDS_HELP
        }
        checked={cards}
        disabled={!!sessionConfig}
        testId="ce-setup-context-cards"
        onChange={(checked) => onChange(['contextCardsEnabled'], checked)}
      />
    </div>
  );
};

type PublisherProps = Omit<FilesProps, 'sessionConfig'> & {
  /** The session's public config once it exists; null before creation. */
  sessionConfig: Record<string, unknown> | null;
  sessionSlug: string;
  account: string;
};

const WORKER_READS_LINKS = 'The session reads its linked pages for the AI by itself.';
const LINKS_NOT_READ_HERE =
  'The session could not be asked whether it reads its linked pages by itself, so they are not read from here. If they do not appear among its files, add them there.';

// After Create: uploads the chosen files (reading PDFs when asked) and reads
// the session's links for its AI, as the Context section on its page does.
export const SetupContextPublisher = ({
  draft,
  onChange,
  pending,
  sessionConfig,
  sessionSlug,
  account,
  groups = [],
}: PublisherProps) => {
  const [askedToRead, setReadLinks] = useState(true);
  // Whether the new session's Worker reads its links by itself (it then does so right after Create, and a second
  // read from here could store a page twice): 'asking' until it answers, then yes, no, or 'unknown' where it
  // could not be asked. Only a plain no reads links from here.
  const [workerReads, setWorkerReads] = useState<'asking' | 'unknown' | boolean>('asking');
  const created = !!sessionConfig;
  useEffect(() => {
    setWorkerReads('asking');
    if (!created) return undefined;
    let current = true;
    void workerReadsSessionLinks({ sessionSlug, sessionConfig, context: { account }, asAdmin: true }).then(
      (reads) => current && setWorkerReads(reads === null ? 'unknown' : reads),
    );
    return () => {
      current = false;
    };
    // The Worker's capabilities change only with the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created, sessionSlug]);
  const readLinks = askedToRead && workerReads === false;
  const [readUrls, setReadUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const entries = readContextFiles(draft).filter((entry) => pending.files[entry.name]);
  // A retry skips the links already read, so none is added twice.
  const links = asList(asRecord(draft.sessionContext).links)
    .map((link) => ({ label: text(asRecord(link).label).trim(), url: text(asRecord(link).url).trim() }))
    .filter((link) => link.url && !readUrls.includes(link.url));
  if (!entries.length && !(readLinks && links.length)) {
    // With nothing left to add from here, a session that reads its own links says so once it exists.
    if (!status && created && links.length && (workerReads === true || workerReads === 'unknown')) {
      return (
        <p className={styles.hint} data-testid="ce-setup-context-links-read-by-worker">
          {workerReads === true ? WORKER_READS_LINKS : LINKS_NOT_READ_HERE}
        </p>
      );
    }
    return status ? (
      <p className={styles.statusText} role="status" data-testid="ce-setup-context-status">
        {status}
      </p>
    ) : null;
  }
  if (!sessionConfig) {
    return (
      <p className={styles.hint}>
        {entries.length
          ? 'Files are added to the session once it is created.'
          : 'Links can be read for the AI once the session is created.'}
      </p>
    );
  }
  const options = { sessionSlug, sessionConfig, context: { account }, asAdmin: true };
  const publish = async () => {
    setBusy(true);
    const problems: string[] = [];
    const added: string[] = [];
    const made = new Set(groups.map((group) => group.groupId));
    for (const entry of entries) {
      const chosen = pending.files[entry.name];
      setStatus(`Adding ${entry.name}…`);
      // A file meant for groups Create didn't make goes to those it made, or stays with admins, never wider.
      const lockedTo = (entry.groupIds || []).filter((groupId) => made.has(groupId));
      const access = entry.groupIds?.length
        ? lockedTo.length
          ? { groupIds: lockedTo }
          : { adminsOnly: true }
        : { adminsOnly: entry.adminsOnly };
      try {
        const id = await uploadContextFile({ file: chosen.file, ...access }, options);
        added.push(entry.name);
        pending.set(entry.name, null);
        if (chosen.analyze && isAiRead(chosen.file)) {
          setStatus(`The session’s AI is reading ${entry.name}…`);
          await readContextPdf(id, options).catch((error: unknown) =>
            problems.push(
              `${entry.name} was added, but the AI could not read it: ${error instanceof Error ? error.message : ''}`,
            ),
          );
        }
      } catch (error) {
        problems.push(`${entry.name}: ${error instanceof Error ? error.message : 'could not be added.'}`);
      }
    }
    if (readLinks) {
      for (const link of links) {
        setStatus(`Reading ${link.url}…`);
        try {
          await addContextLink({ url: link.url, title: link.label }, options);
          setReadUrls((done) => [...done, link.url]);
        } catch (error) {
          problems.push(`${link.url}: ${error instanceof Error ? error.message : 'could not be read.'}`);
        }
      }
    }
    onChange(
      ['contextFiles'],
      readContextFiles(draft).filter((entry) => !added.includes(entry.name)),
    );
    setStatus(problems.length ? problems.join(' ') : 'Context added to the session.');
    setBusy(false);
  };
  return (
    <div className={styles.listRowBody} data-testid="ce-setup-context-publisher">
      {links.length && workerReads === false ? (
        <SetupCheck
          id="ce-setup-context-read-links"
          label="Read the linked pages for the AI"
          help="The Session Worker reads each link’s page and keeps its text for the session’s AI."
          checked={askedToRead}
          onChange={setReadLinks}
        />
      ) : null}
      {links.length && (workerReads === true || workerReads === 'unknown') ? (
        <p className={styles.hint} data-testid="ce-setup-context-links-read-by-worker">
          {workerReads === true ? WORKER_READS_LINKS : LINKS_NOT_READ_HERE}
        </p>
      ) : null}
      <div className={styles.buttonRow}>
        <button
          type="button"
          className={`${styles.button} ${styles.primaryButton}`}
          disabled={busy || (!entries.length && !readLinks) || (links.length > 0 && workerReads === 'asking')}
          data-testid="ce-setup-context-publish"
          onClick={() => void publish()}
        >
          {busy ? 'Adding…' : 'Add context to the session'}
        </button>
      </div>
      {status ? (
        <p className={styles.statusText} role="status" data-testid="ce-setup-context-status">
          {status}
        </p>
      ) : null}
    </div>
  );
};
