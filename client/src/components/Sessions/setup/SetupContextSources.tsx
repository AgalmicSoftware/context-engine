import { useCallback, useState } from 'react';
import { Input } from 'reactstrap';

import { CONTEXT_FILE_TYPES, resolveContextFileType } from '@ce-shared/sessionContextSources.mjs';
import {
  addContextLink,
  checkContextFile,
  readContextPdf,
  uploadContextFile,
} from '../../../utilities/docLibrary/contextSources';
import { CONTEXT_ANALYZE_HELP, FILE_ACCESS_HELP } from './ContextSourcesPanel';
import { SetupCheck, SetupField } from './SetupPrimitives';
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

type ContextFileEntry = { name: string; adminsOnly: boolean; groupId?: string };
export const readContextFiles = (draft: SetupDraft): ContextFileEntry[] =>
  asList(draft.contextFiles)
    .map((value) => {
      const entry = asRecord(value);
      const groupId = text(entry.groupId).trim();
      return { name: text(entry.name).trim(), adminsOnly: entry.adminsOnly === true, ...(groupId ? { groupId } : {}) };
    })
    .filter((entry) => entry.name);

/** A group set up before Create, which Create makes before the files are added. */
export type SetupGroupOption = { groupId: string; label: string };

const FILE_VISIBILITY_HELP = `${FILE_ACCESS_HELP} Groups set up under Access and identity are made at Create, before these files are added.`;

// A file locked to a group that is no longer set up stays with admins, never wider.
const visibilityOf = (entry: ContextFileEntry, groups: SetupGroupOption[]): string => {
  if (entry.groupId)
    return groups.some((group) => group.groupId === entry.groupId) ? `group:${entry.groupId}` : 'admins';
  return entry.adminsOnly ? 'admins' : 'everyone';
};
const withVisibility = ({ groupId: _previous, ...entry }: ContextFileEntry, value: string): ContextFileEntry =>
  value.startsWith('group:')
    ? { ...entry, adminsOnly: false, groupId: value.slice('group:'.length) }
    : { ...entry, adminsOnly: value === 'admins' };

const isPdf = (file: File) => resolveContextFileType(file) === CONTEXT_FILE_TYPES.pdf;

type FilesProps = {
  draft: SetupDraft;
  onChange: (path: string[], value: unknown) => void;
  pending: PendingContextFiles;
  /** Before Create, the groups set up so far; after it, the groups Create made. */
  groups?: SetupGroupOption[];
};

// Before Create: the files to add. A name without its file (from a template
// or a reload) asks for the file again.
export const SetupContextFiles = ({ draft, onChange, pending, groups = [] }: FilesProps) => {
  const entries = readContextFiles(draft);
  const named = groups.filter((group) => group.label.trim());
  const [problem, setProblem] = useState('');
  const save = (next: ContextFileEntry[]) => onChange(['contextFiles'], next);
  const attach = (file: File | undefined, replacing = '') => {
    if (!file) return;
    const reason = checkContextFile(file);
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
                <SetupField id={`ce-setup-context-file-again-${index}`} label="Attach again">
                  <Input
                    id={`ce-setup-context-file-again-${index}`}
                    type="file"
                    onChange={(event) => attach((event.target as HTMLInputElement).files?.[0], entry.name)}
                  />
                </SetupField>
              )}
              <SetupField id={`ce-setup-context-file-access-${index}`} label="Visible to" help={FILE_VISIBILITY_HELP}>
                <Input
                  id={`ce-setup-context-file-access-${index}`}
                  type="select"
                  value={visibilityOf(entry, named)}
                  data-testid="ce-setup-context-file-access"
                  onChange={(event) =>
                    save(
                      entries.map((other) =>
                        other.name === entry.name ? withVisibility(other, event.target.value) : other,
                      ),
                    )
                  }
                >
                  <option value="everyone">Everyone in the session</option>
                  <option value="admins">Admins only</option>
                  {named.map((group) => (
                    <option key={group.groupId} value={`group:${group.groupId}`}>
                      {group.label.trim()}
                    </option>
                  ))}
                </Input>
              </SetupField>
              {chosen && isPdf(chosen.file) ? (
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
      <SetupField id="ce-setup-context-file" label="Add a file">
        <Input
          id="ce-setup-context-file"
          type="file"
          accept=".pdf,.md,.markdown,.txt,.csv,.json,application/pdf,text/markdown,text/plain,text/csv,application/json"
          data-testid="ce-setup-context-file-input"
          onChange={(event) => {
            attach((event.target as HTMLInputElement).files?.[0]);
            (event.target as HTMLInputElement).value = '';
          }}
        />
      </SetupField>
      {problem ? <p className={styles.errorText}>{problem}</p> : null}
    </div>
  );
};

type PublisherProps = FilesProps & {
  /** The session's public config once it exists; null before creation. */
  sessionConfig: Record<string, unknown> | null;
  sessionSlug: string;
  account: string;
};

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
  const [readLinks, setReadLinks] = useState(true);
  const [readUrls, setReadUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const entries = readContextFiles(draft).filter((entry) => pending.files[entry.name]);
  // A retry skips the links already read, so none is added twice.
  const links = asList(asRecord(draft.sessionContext).links)
    .map((link) => ({ label: text(asRecord(link).label).trim(), url: text(asRecord(link).url).trim() }))
    .filter((link) => link.url && !readUrls.includes(link.url));
  if (!entries.length && !(readLinks && links.length)) {
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
      // A file meant for a group that Create didn't make stays with admins, never wider.
      const access = entry.groupId
        ? made.has(entry.groupId)
          ? { groupId: entry.groupId }
          : { adminsOnly: true }
        : { adminsOnly: entry.adminsOnly };
      try {
        const id = await uploadContextFile({ file: chosen.file, ...access }, options);
        added.push(entry.name);
        pending.set(entry.name, null);
        if (chosen.analyze && isPdf(chosen.file)) {
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
      {links.length ? (
        <SetupCheck
          id="ce-setup-context-read-links"
          label="Read the linked pages for the AI"
          help="The Session Worker reads each link’s page and keeps its text for the session’s AI."
          checked={readLinks}
          onChange={setReadLinks}
        />
      ) : null}
      <div className={styles.buttonRow}>
        <button
          type="button"
          className={`${styles.button} ${styles.primaryButton}`}
          disabled={busy || (!entries.length && !readLinks)}
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
