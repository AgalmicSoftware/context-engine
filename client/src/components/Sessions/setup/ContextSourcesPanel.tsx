import { useEffect, useState } from 'react';
import { Input } from 'reactstrap';

import {
  CONTEXT_FILE_TYPES,
  CONTEXT_SOURCE_LIMITS,
  resolveContextFileType,
} from '@ce-shared/sessionContextSources.mjs';
import ContextAccessSelect, { SESSION_WIDE_ACCESS, contextAccessOf } from './ContextAccessSelect';
import {
  addContextLink,
  checkContextFile,
  contextAdderLabel,
  readContextPdf,
  removeContextSource,
  uploadContextFile,
  workerSupportsContextSources,
  type ContextSource,
} from '../../../utilities/docLibrary/contextSources';
import { useContextGroups, type ContextGroup } from '../../../utilities/docLibrary/useContextGroups';
import {
  useSessionContextSources,
  type SessionContextSourcesState,
} from '../../../utilities/docLibrary/useSessionContextSources';
import { SetupCheck, SetupField, setupHelpId } from './SetupPrimitives';
import styles from './SessionSetup.module.scss';

export const CONTEXT_PRIVACY_HELP =
  'Only session admins can open it, and the session’s AI uses it only when it works for an admin. Everyone else never receives it.';
export const FILE_ACCESS_HELP =
  'A locked file is for that group’s members and the session’s admins; an admins-only file is for admins. The session’s AI uses a file only when it works for someone who may read it.';
export const CONTEXT_ANALYZE_HELP =
  'Sends the PDF to the session’s own AI provider with the session’s key. The text it returns is saved with the PDF. Unticked, the PDF is kept but gives the AI no text.';
const LINK_HELP =
  'The Session Worker reads the page now and keeps its text for the session’s AI. Refresh reads it again. Use https:// links to public pages.';

const formatDate = (value: string): string => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '';
};

export const isContextPdf = (source: Pick<ContextSource, 'mime'>) => source.mime === CONTEXT_FILE_TYPES.pdf;

/** One line about a source: who may read it, who added it, and what the AI has of it. */
export const describeContextSource = (
  source: ContextSource,
  { groups = [], adder = '' }: { groups?: ContextGroup[]; adder?: string } = {},
): string =>
  [
    source.adminsOnly
      ? 'Admins only'
      : source.lockedGroupId
        ? groups.find(({ groupId }) => groupId === source.lockedGroupId)?.label || 'One group'
        : 'Everyone in the session',
    ...(adder ? [`Added by ${adder}`] : []),
    source.kind === 'link'
      ? `Read ${formatDate(source.fetchedAt)}`.trim()
      : isContextPdf(source)
        ? source.reading
          ? `Read by AI (${source.reading.model}, ${formatDate(source.reading.at)})`
          : 'Not read by AI'
        : 'Text file',
  ].join(' · ');

type Props = {
  sessionSlug: string;
  sessionConfig: Record<string, unknown> | null;
  account: string;
  /** The session's page links; "Read the links" adds the unread ones as sources. */
  pageLinks?: Array<{ label: string; url: string }>;
  /** The listed sources, for whoever exports a template. */
  onSourcesChange?: (sources: ContextSource[]) => void;
  /** A list the page already reads; the panel then reads none of its own. */
  list?: SessionContextSourcesState;
};

// The session's context files and links: admins add, refresh, read with
// the session's AI and remove them. Changes apply at once, not on Save.
const ContextSourcesPanel = ({ sessionSlug, sessionConfig, account, pageLinks = [], onSourcesChange, list }: Props) => {
  const own = useSessionContextSources({ sessionSlug, sessionConfig, account, enabled: !list });
  const { sources, loading, error, supported, reload } = list || own;
  const [workerReady, setWorkerReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkPrivate, setLinkPrivate] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileAccess, setFileAccess] = useState(SESSION_WIDE_ACCESS);
  const groups = useContextGroups({ sessionSlug, sessionConfig, account });
  const [analyze, setAnalyze] = useState(true);
  const [fileKey, setFileKey] = useState(0);
  const options = { sessionSlug, sessionConfig, context: { account }, asAdmin: true };

  useEffect(() => {
    if (!supported) return undefined;
    let current = true;
    void workerSupportsContextSources(options).then((ready) => current && setWorkerReady(ready));
    return () => {
      current = false;
    };
    // The Worker's capabilities change only with the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, sessionSlug]);
  useEffect(() => onSourcesChange?.(sources), [sources, onSourcesChange]);

  if (!supported) {
    return (
      <p className={styles.hint} data-testid="ce-context-sources-unsupported">
        Files and links need a session whose storage is on its Session Worker, without Lit encryption.
      </p>
    );
  }
  if (workerReady === false) {
    return (
      <p className={styles.hint} data-testid="ce-context-sources-update-worker">
        Update this session’s Worker to add files and links.
      </p>
    );
  }

  const run = async (working: string, task: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    setStatus(working);
    try {
      setStatus(await task());
      reload();
    } catch (failure) {
      setStatus(failure instanceof Error ? failure.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const unreadLinks = pageLinks.filter(
    (link) => link.url && !sources.some((source) => source.kind === 'link' && source.url === link.url),
  );
  const fileProblem = file ? checkContextFile(file) : '';
  const fileIsPdf = !!file && resolveContextFileType(file) === CONTEXT_FILE_TYPES.pdf;

  return (
    <div className={styles.listRowBody} data-testid="ce-context-sources">
      {loading ? <p className={styles.hint}>Loading files and links…</p> : null}
      {error ? <p className={styles.errorText}>{error}</p> : null}
      {sources.length ? (
        <ul className={styles.listRowBody} aria-label="Context files and links">
          {sources.map((source) => (
            <li key={source.id} className={styles.listRow} data-testid="ce-context-source">
              <div className={styles.listRowBody}>
                <span className={styles.fieldLabel}>{source.title || source.url || 'Untitled'}</span>
                {source.kind === 'link' && source.url ? (
                  <span className={styles.readOnlyValue}>{source.url}</span>
                ) : null}
                <span className={styles.hint}>
                  {describeContextSource(source, {
                    groups,
                    adder: contextAdderLabel(source, sessionConfig, account),
                  })}
                </span>
              </div>
              <div className={styles.buttonRow}>
                {source.kind === 'link' ? (
                  <button
                    type="button"
                    className={styles.button}
                    disabled={busy}
                    aria-label={`Refresh ${source.title || source.url}`}
                    onClick={() =>
                      void run('Reading the page again…', async () => {
                        await addContextLink({ url: source.url, replaces: source.id }, options);
                        return 'Page read again.';
                      })
                    }
                  >
                    Refresh
                  </button>
                ) : null}
                {isContextPdf(source) ? (
                  <button
                    type="button"
                    className={styles.button}
                    disabled={busy}
                    aria-label={`${source.reading ? 'Read again with the session’s AI' : 'Read with the session’s AI'}: ${source.title}`}
                    onClick={() =>
                      void run('The session’s AI is reading the PDF…', async () => {
                        await readContextPdf(source.id, options);
                        return 'The session’s AI read the PDF.';
                      })
                    }
                  >
                    {source.reading ? 'Read again' : 'Read with AI'}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={styles.button}
                  disabled={busy}
                  aria-label={`Remove ${source.title || source.url}`}
                  onClick={() => {
                    if (!window.confirm(`Remove ${source.title || 'this item'} from the session?`)) return;
                    void run('Removing…', async () => {
                      await removeContextSource(source, options);
                      return 'Removed.';
                    });
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <p className={styles.hint}>No files or links yet.</p>
      ) : null}
      {unreadLinks.length ? (
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.button}
            disabled={busy}
            data-testid="ce-context-read-page-links"
            onClick={() =>
              void run('Reading the session’s links…', async () => {
                for (const link of unreadLinks) await addContextLink({ url: link.url, title: link.label }, options);
                return unreadLinks.length === 1 ? 'Read 1 link.' : `Read ${unreadLinks.length} links.`;
              })
            }
          >
            {unreadLinks.length === 1
              ? 'Read the session’s link for the AI'
              : `Read the session’s ${unreadLinks.length} links for the AI`}
          </button>
        </div>
      ) : null}
      <SetupField id="ce-context-link-url" label="Add a link" help={LINK_HELP}>
        <Input
          id="ce-context-link-url"
          type="url"
          value={linkUrl}
          maxLength={CONTEXT_SOURCE_LIMITS.urlChars}
          placeholder="https://"
          aria-describedby={setupHelpId('ce-context-link-url')}
          data-testid="ce-context-link-url"
          onChange={(event) => setLinkUrl(event.target.value)}
        />
      </SetupField>
      <SetupField id="ce-context-link-title" label="Link title">
        <Input
          id="ce-context-link-title"
          value={linkTitle}
          maxLength={CONTEXT_SOURCE_LIMITS.titleChars}
          placeholder="The page’s own title"
          onChange={(event) => setLinkTitle(event.target.value)}
        />
      </SetupField>
      <SetupCheck
        id="ce-context-link-private"
        label="Admins only"
        help={CONTEXT_PRIVACY_HELP}
        checked={linkPrivate}
        onChange={setLinkPrivate}
      />
      <div className={styles.buttonRow}>
        <button
          type="button"
          className={styles.button}
          disabled={busy || !linkUrl.trim()}
          data-testid="ce-context-add-link"
          onClick={() =>
            void run('Reading the page…', async () => {
              await addContextLink({ url: linkUrl.trim(), title: linkTitle.trim(), adminsOnly: linkPrivate }, options);
              setLinkUrl('');
              setLinkTitle('');
              return 'Link added.';
            })
          }
        >
          Add link
        </button>
      </div>
      <SetupField id="ce-context-file" label="Add a file">
        <Input
          key={fileKey}
          id="ce-context-file"
          type="file"
          accept=".pdf,.md,.markdown,.txt,.csv,.json,application/pdf,text/markdown,text/plain,text/csv,application/json"
          data-testid="ce-context-file"
          onChange={(event) => setFile((event.target as HTMLInputElement).files?.[0] || null)}
        />
      </SetupField>
      {fileProblem ? <p className={styles.errorText}>{fileProblem}</p> : null}
      <SetupField id="ce-context-file-access" label="Who can read the file" help={FILE_ACCESS_HELP}>
        <ContextAccessSelect
          id="ce-context-file-access"
          value={fileAccess}
          groups={groups}
          allowAdminsOnly
          data-testid="ce-context-file-access"
          onChange={setFileAccess}
        />
      </SetupField>
      {fileIsPdf ? (
        <SetupCheck
          id="ce-context-file-analyze"
          label="Analyze with the session’s AI"
          help={CONTEXT_ANALYZE_HELP}
          checked={analyze}
          onChange={setAnalyze}
          testId="ce-context-file-analyze"
        />
      ) : null}
      <div className={styles.buttonRow}>
        <button
          type="button"
          className={styles.button}
          disabled={busy || !file || !!fileProblem}
          data-testid="ce-context-add-file"
          onClick={() =>
            void run('Adding the file…', async () => {
              if (!file) return '';
              const id = await uploadContextFile({ file, ...contextAccessOf(fileAccess) }, options);
              setFile(null);
              setFileKey((key) => key + 1);
              if (!(analyze && fileIsPdf)) return 'File added.';
              setStatus('File added. The session’s AI is reading it…');
              try {
                await readContextPdf(id, options);
                return 'File added and read by the session’s AI.';
              } catch (failure) {
                return `File added, but the session’s AI could not read it: ${failure instanceof Error ? failure.message : 'try Read with AI.'}`;
              }
            })
          }
        >
          Add file
        </button>
      </div>
      {status ? (
        <p className={styles.statusText} role="status" data-testid="ce-context-sources-status">
          {status}
        </p>
      ) : null}
    </div>
  );
};

export default ContextSourcesPanel;
