import { Fragment, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { Input } from 'reactstrap';

import { CONTEXT_CARD_COST_USD } from '@ce-shared/contextCards.mjs';
import {
  CONTEXT_SOURCE_LIMITS,
  contextFileIsReadByAi,
  resolveContextFileType,
} from '@ce-shared/sessionContextSources.mjs';
import ContextAccessPicker, { contextGroupsLabel } from './ContextAccessPicker';
import AgentMark from '../../Shared/AgentMark';
import CompactImageChooser from '../../Shared/CompactImageChooser';
import ContextCardChips from '../../OnePageSession/ContextCardChips';
import ContextCardEditor, { CONTEXT_CARD_HELP } from '../../OnePageSession/ContextCardEditor';
import {
  addContextLink,
  checkContextFile,
  contextFileAccept,
  contextAdderLabel,
  contextSourceTakesCard,
  contextSourcesWithoutCards,
  makeContextCard,
  readContextPdf,
  removeContextSource,
  uploadContextFile,
  workerSupportsContextSources,
  type ContextFileAccess,
  type ContextSource,
} from '../../../utilities/docLibrary/contextSources';
import { useContextGroups, type ContextGroup } from '../../../utilities/docLibrary/useContextGroups';
import {
  useSessionContextSources,
  type SessionContextSourcesState,
} from '../../../utilities/docLibrary/useSessionContextSources';
import { SetupCheck, SetupField, SetupHelp, setupHelpId } from './SetupPrimitives';
import styles from './SessionSetup.module.scss';

export const CONTEXT_PRIVACY_HELP =
  'Only session admins can open it, and the session’s AI uses it only when it works for an admin. Everyone else never receives it.';
export const FILE_ACCESS_HELP =
  'A file locked to groups is for their members and the session’s admins; an admins-only file is for admins. The session’s AI uses a file only when it works for someone who may read it.';
/** What the Context cards setting does and costs, on the setup page and in Settings. */
export const CONTEXT_CARDS_HELP =
  'The session’s AI writes a short card for each file or link added: a summary, topic tags and key names. Cards show as tags in the list, and tell the AI and agents what a source covers when there is no room to read it. Images can be added too, and whoever adds a PDF or image can have the AI read it once. Each card and each reading uses the session’s AI key.';
export const CONTEXT_ANALYZE_HELP =
  'Sends the PDF or image to the session’s own AI provider with the session’s key. The text it returns is saved with the file. Unticked, the file is kept but gives the AI no text.';
const LINK_HELP =
  'The Session Worker reads the page now and keeps its text for the session’s AI. Refresh reads it again. Use https:// links to public pages.';
const ADD_HELP = `A link: type or paste its address, then press +. ${LINK_HELP} A file: Upload picks a PDF, a text or data file, or an image where Context cards are on; Add file then adds it.`;
const ACCESS_HELP = `Who may read what you add next. ${FILE_ACCESS_HELP} A link can be for everyone or for admins only: ${CONTEXT_PRIVACY_HELP}`;

const formatDate = (value: string): string => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '';
};

/** What making `count` cards costs, as the estimate an admin sees before any is made. */
export const describeCardCost = (count: number): string => {
  const total = count * CONTEXT_CARD_COST_USD;
  const sum = total < 0.01 ? 'under $0.01' : `about $${total.toFixed(2)}`;
  return (
    `${count === 1 ? '1 item has' : `${count} items have`} no card. ` +
    `Each card is one short call to the session’s AI on the session’s key, about $${CONTEXT_CARD_COST_USD} on the default model: ${sum} in all.`
  );
};

/** True for a PDF or an image: a file whose text is the session’s AI’s reading of it. */
export const isAiReadSource = (source: Pick<ContextSource, 'mime'>) => contextFileIsReadByAi(source.mime);

type DescribeOptions = { groups?: ContextGroup[]; adder?: string };

/** The parts of a source's line: who may read it, who added it when known, and what the AI has of it. */
export const contextSourceParts = (source: ContextSource, { groups = [], adder = '' }: DescribeOptions = {}) => [
  source.adminsOnly
    ? 'Admins only'
    : source.lockedGroupIds.length
      ? contextGroupsLabel(source.lockedGroupIds, groups)
      : 'Everyone in the session',
  ...(adder ? [`Added by ${adder}`] : []),
  source.kind === 'link'
    ? `Read ${formatDate(source.fetchedAt)}`.trim()
    : isAiReadSource(source)
      ? source.reading
        ? `Read by AI (${source.reading.model}, ${formatDate(source.reading.at)})`
        : 'Not read by AI'
      : 'Text file',
];

/** One line about a source, as text. */
export const describeContextSource = (source: ContextSource, options: DescribeOptions = {}): string =>
  contextSourceParts(source, options).join(' · ');

// The robot follows who added the source (or who may read it, when that isn't known), apart from the name, which
// an agent chooses.
const ContextSourceLine = ({ source, ...options }: DescribeOptions & { source: ContextSource }) => {
  const markAfter = options.adder ? 1 : 0;
  return (
    <>
      {contextSourceParts(source, options).map((part, index) => (
        <Fragment key={part}>
          {index ? ' · ' : ''}
          {part}
          {source.addedByAgent && index === markAfter ? <AgentMark /> : null}
        </Fragment>
      ))}
    </>
  );
};

type Props = {
  sessionSlug: string;
  sessionConfig: Record<string, unknown> | null;
  account: string;
  /** The listed sources, for whoever exports a template. */
  onSourcesChange?: (sources: ContextSource[]) => void;
  /** A list the page already reads; the panel then reads none of its own. */
  list?: SessionContextSourcesState;
};

// The session's context files and links: admins add, refresh, read with
// the session's AI and remove them. Changes apply at once, not on Save.
const ContextSourcesPanel = ({ sessionSlug, sessionConfig, account, onSourcesChange, list }: Props) => {
  const own = useSessionContextSources({ sessionSlug, sessionConfig, account, enabled: !list });
  const { sources, loading, error, supported, cardsSupported, reload } = list || own;
  const [workerReady, setWorkerReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  // One choice of audience for whatever is added next, a link or a file.
  const [access, setAccess] = useState<ContextFileAccess>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const groups = useContextGroups({ sessionSlug, sessionConfig, account });
  const [analyze, setAnalyze] = useState(true);
  const [fileKey, setFileKey] = useState(0);
  const [editingCard, setEditingCard] = useState('');
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
  const withoutCards = cardsSupported ? contextSourcesWithoutCards(sources) : [];
  // The count and the cost come first; nothing is spent without a yes.
  const makeMissingCards = () => {
    if (!window.confirm(`${describeCardCost(withoutCards.length)} Make them now?`)) return;
    void run('The session’s AI is writing cards…', async () => {
      let made = 0;
      let problem = '';
      for (const source of withoutCards) {
        try {
          await makeContextCard(source.id, options);
          made += 1;
        } catch (failure) {
          problem ||= failure instanceof Error ? failure.message : 'the session’s AI did not answer.';
        }
      }
      const wrote = made === 1 ? 'Wrote 1 card.' : `Wrote ${made} cards.`;
      return problem ? `${wrote} ${withoutCards.length - made} could not be written: ${problem}` : wrote;
    });
  };
  // One choice serves the link and the file, so each Add says who it is for: a choice changed for one is then
  // seen before the other is added.
  const audience = access.adminsOnly
    ? 'admins only'
    : access.groupIds?.length
      ? contextGroupsLabel(access.groupIds, groups)
      : 'everyone in the session';
  // The Worker keeps a link for everyone or for admins only; groups are for files.
  const linkNeedsOtherAudience = !access.adminsOnly && !!access.groupIds?.length;
  const addLink = () => {
    if (!linkUrl.trim() || linkNeedsOtherAudience) return;
    void run('Reading the page…', async () => {
      await addContextLink({ url: linkUrl.trim(), title: linkTitle.trim(), adminsOnly: !!access.adminsOnly }, options);
      setLinkUrl('');
      setLinkTitle('');
      return 'Link added.';
    });
  };
  const pasteLink = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) setLinkUrl(text.slice(0, CONTEXT_SOURCE_LIMITS.urlChars));
      setStatus(text ? '' : 'Nothing to paste: copy a link first.');
    } catch {
      setStatus('Pasting isn’t allowed here. Click the box and paste into it.');
    }
  };
  const fileProblem = file ? checkContextFile(file, { images: cardsSupported }) : '';
  const fileIsAiRead = !!file && contextFileIsReadByAi(resolveContextFileType(file));

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
                  <ContextSourceLine
                    source={source}
                    groups={groups}
                    adder={contextAdderLabel(source, sessionConfig, account)}
                  />
                </span>
                <ContextCardChips card={source.card} title={source.title || source.url || 'Untitled'} />
                {editingCard === source.id ? (
                  <ContextCardEditor
                    source={source}
                    options={options}
                    onSaved={reload}
                    onClose={() => setEditingCard('')}
                  />
                ) : null}
              </div>
              <div className={styles.buttonRow}>
                {cardsSupported && contextSourceTakesCard(source) ? (
                  <button
                    type="button"
                    className={styles.button}
                    disabled={busy}
                    aria-label={`Edit the card of ${source.title || source.url}`}
                    aria-expanded={editingCard === source.id}
                    onClick={() => setEditingCard((open) => (open === source.id ? '' : source.id))}
                  >
                    Edit card
                  </button>
                ) : null}
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
                {isAiReadSource(source) ? (
                  <button
                    type="button"
                    className={styles.button}
                    disabled={busy}
                    aria-label={`${source.reading ? 'Read again with the session’s AI' : 'Read with the session’s AI'}: ${source.title}`}
                    onClick={() =>
                      void run('The session’s AI is reading the file…', async () => {
                        await readContextPdf(source.id, options);
                        return 'The session’s AI read the file.';
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
      {withoutCards.length ? (
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.button}
            disabled={busy}
            aria-describedby={setupHelpId('ce-context-make-cards')}
            data-testid="ce-context-make-cards"
            onClick={makeMissingCards}
          >
            Make missing cards ({withoutCards.length})
          </button>
          <SetupHelp id="ce-context-make-cards" label="cards" help={CONTEXT_CARD_HELP} />
        </div>
      ) : null}
      {/* The question tools' add row in its own box: one row to add a link or pick a file, then who may read it. */}
      <div className={styles.contextAddBox} data-testid="ce-context-add-box">
        <div className={styles.fieldLabelRow}>
          <span className={styles.fieldLabel}>Add a link or a file</span>
          <SetupHelp id="ce-context-add" label="adding a link or a file" help={ADD_HELP} />
        </div>
        <div className={styles.addSourceControls}>
          <div className={styles.urlInputContainer}>
            <Input
              id="ce-context-link-url"
              type="url"
              value={linkUrl}
              maxLength={CONTEXT_SOURCE_LIMITS.urlChars}
              placeholder="Add URL"
              aria-label="Add a link"
              aria-describedby={setupHelpId('ce-context-add')}
              className={styles.urlInputField}
              data-testid="ce-context-link-url"
              onChange={(event) => setLinkUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                addLink();
              }}
            />
            <CompactImageChooser
              className={styles.inlineImageChooser}
              showUrlModeButton={false}
              isUploadMode
              showUrlInput={false}
              key={fileKey}
              fileInputTestId="ce-context-file"
              accept={contextFileAccept({ images: cardsSupported })}
              uploadAriaLabel="Upload a file to add"
              fileInputRef={fileInput}
              disabled={busy}
              onPaste={() => void pasteLink()}
              onUploadClick={() => fileInput.current?.click()}
              onFileChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <button
              type="button"
              className={styles.internalUrlAddBtn}
              disabled={busy || !linkUrl.trim() || linkNeedsOtherAudience}
              title={`Add link for ${audience}`}
              aria-label={`Add link for ${audience}`}
              data-testid="ce-context-add-link"
              onClick={addLink}
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>
          </div>
        </div>
        {linkUrl.trim() ? (
          <Input
            id="ce-context-link-title"
            value={linkTitle}
            maxLength={CONTEXT_SOURCE_LIMITS.titleChars}
            placeholder="Link title (optional): the page’s own title if left empty"
            aria-label="Link title"
            className={styles.contextAddTitle}
            onChange={(event) => setLinkTitle(event.target.value)}
          />
        ) : null}
        {linkUrl.trim() && !linkNeedsOtherAudience ? (
          <p className={styles.hint} data-testid="ce-context-link-audience">
            This link will be for {audience}.
          </p>
        ) : null}
        {linkUrl.trim() && linkNeedsOtherAudience ? (
          <p className={styles.hint} data-testid="ce-context-link-audience-hint">
            A link can be for everyone or for admins only. Change “Visible to” to add it.
          </p>
        ) : null}
        {file ? (
          <div className={styles.contextAddFile} data-testid="ce-context-chosen-file">
            <span className={styles.readOnlyValue}>{file.name}</span>
            {fileIsAiRead ? (
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
                className={`${styles.button} ${styles.primaryButton}`}
                disabled={busy || !!fileProblem}
                data-testid="ce-context-add-file"
                onClick={() =>
                  void run('Adding the file…', async () => {
                    const id = await uploadContextFile({ file, ...access }, options);
                    setFile(null);
                    setFileKey((key) => key + 1);
                    if (!(analyze && fileIsAiRead)) return 'File added.';
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
                Add file for {audience}
              </button>
              <button
                type="button"
                className={styles.button}
                disabled={busy}
                onClick={() => {
                  setFile(null);
                  setFileKey((key) => key + 1);
                  // The row goes with its buttons, so focus goes back to the box.
                  document.getElementById('ce-context-link-url')?.focus();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        {fileProblem ? <p className={styles.errorText}>{fileProblem}</p> : null}
        <SetupField id="ce-context-file-access" label="Visible to" help={ACCESS_HELP}>
          <ContextAccessPicker
            id="ce-context-file-access"
            value={access}
            groups={groups}
            allowAdminsOnly
            data-testid="ce-context-file-access"
            onChange={setAccess}
          />
        </SetupField>
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
