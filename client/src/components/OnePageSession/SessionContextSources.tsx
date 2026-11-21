import { Suspense, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCaretRight,
  faExternalLinkAlt,
  faEye,
  faFileAlt,
  faFileCode,
  faFileCsv,
  faFilePdf,
  faPlus,
  faQuestionCircle,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';

import { contextGroupsLabel } from '../Sessions/setup/ContextAccessPicker';
import ContextSourcesPanel from '../Sessions/setup/ContextSourcesPanel';
import ContextCardChips from './ContextCardChips';
import ContextCardEditor from './ContextCardEditor';
import SessionContextAddFile from './SessionContextAddFile';
import SessionContextAddLink from './SessionContextAddLink';
import SessionContextAddNote from './SessionContextAddNote';
import setupStyles from '../Sessions/setup/SessionSetup.module.scss';
import {
  contextAdderLabel,
  contextDuplicateIds,
  contextSourceDisplayTitle,
  contextSourceKindLabel,
  contextSourceTakesCard,
  formatContextSize,
  removeContextSource,
  type ContextSource,
} from '../../utilities/docLibrary/contextSources';
import { getWorkerSessionToken } from '../../utilities/worker/workerAuth.js';
import { readCurrentWorkerHint } from '../../utilities/ui/currentWorkerHint';
import { lazyWithRetry } from '../../utilities/ui/lazyImportRetry.js';
import { buildSessionDocLibraryViewerUrl } from '../../utilities/docLibrary/docUploadContracts';
import { useContextGroups } from '../../utilities/docLibrary/useContextGroups';
import type { SessionContextSourcesState } from '../../utilities/docLibrary/useSessionContextSources';
import AgentMark from '../Shared/AgentMark';
import styles from './OnePageSession.module.scss';
import css from './SessionContextSources.module.scss';

// The previews and the viewer load only when someone first opens one.
const ContextInlinePreview = lazyWithRetry(() =>
  import('./SessionContextPreview').then((module) => ({ default: module.ContextInlinePreview })),
);
const ContextViewerModal = lazyWithRetry(() =>
  import('./SessionContextPreview').then((module) => ({ default: module.ContextViewerModal })),
);

type Props = {
  sessionSlug: string;
  sessionConfig: Record<string, unknown> | null;
  account: string;
  /** Only the sources this reader may see; the Worker leaves out the rest. */
  list: SessionContextSourcesState;
  /** The session's page links, which already show above. */
  pageLinks: Array<{ label: string; url: string }>;
  /** The section header's spot for Add and View, as the Tool Explorer has them; without it they show here. */
  headerActionsSlot?: HTMLElement | null;
  /** Opens the login, for someone signed out where they could add once logged in. */
  onRequestLogin?: () => void;
};

const MY_GROUPS_HELP = 'Signs you in to this session, so it can show files locked to your groups, and your own.';
const SIGN_IN_TO_ADD = 'Log in to add a file, a link or a note to this session.';

const KIND_ICONS: Record<string, IconDefinition> = {
  Link: faExternalLinkAlt,
  PDF: faFilePdf,
  CSV: faFileCsv,
  JSON: faFileCode,
};

// The Context section's files and links: the ones this reader may open, who
// added each, and for admins the controls that add, refresh and remove them.
// Others may add files and notes, and links where their Worker takes them, and
// remove their own, unless the session limits that or has ended.
// A file's caret shows its start in place; its name opens it in a dialog.
// Add opens the form, an admin's controls, or for someone signed out the
// login; View shows a signed-out member their groups' files.
// Each source's card shows as its topic tags; whoever added a source may write its card.
const SessionContextSources = ({
  sessionSlug,
  sessionConfig,
  account,
  list,
  pageLinks,
  headerActionsSlot,
  onRequestLogin,
}: Props) => {
  const isAdmin = list.isAdmin && list.supported;
  const canAddFile = !isAdmin && list.participantsCanAdd;
  const signInToAdd = !isAdmin && list.signInToAdd && !!onRequestLogin;
  const groups = useContextGroups({
    sessionSlug,
    sessionConfig,
    account,
    enabled: canAddFile || list.groupFilesHidden || list.sources.length > 0,
  });
  const [removeError, setRemoveError] = useState('');
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [viewing, setViewing] = useState<ContextSource | null>(null);
  const [editingCard, setEditingCard] = useState('');
  const idBase = useId().replace(/:/g, '');
  const myGroupsHelpId = `ce-context-my-groups-help-${idBase}`;
  const addPanelId = `ce-context-add-${idBase}`;
  const actions = (
    <>
      {canAddFile || isAdmin ? (
        <button
          type="button"
          className={`${setupStyles.button} ${adding ? setupStyles.primaryButton : ''} ${styles.contextHeaderButton}`}
          aria-expanded={adding}
          aria-controls={addPanelId}
          data-testid="ce-session-context-add"
          onClick={() => setAdding((open) => !open)}
        >
          <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
          Add
        </button>
      ) : null}
      {signInToAdd ? (
        <>
          <button
            type="button"
            id={`${addPanelId}-login`}
            className={`${setupStyles.button} ${styles.contextHeaderButton}`}
            aria-describedby={`${addPanelId}-login-about`}
            data-testid="ce-session-context-add"
            onClick={onRequestLogin}
          >
            <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
            Add
          </button>
          <span id={`${addPanelId}-login-about`} hidden>
            {SIGN_IN_TO_ADD}
          </span>
          <UncontrolledTooltip target={`${addPanelId}-login`} trigger="hover focus">
            {SIGN_IN_TO_ADD}
          </UncontrolledTooltip>
        </>
      ) : null}
      {list.groupFilesHidden && groups.length > 0 ? (
        <>
          <button
            type="button"
            className={`${setupStyles.button} ${styles.contextHeaderButton}`}
            aria-label="View my groups’ files"
            aria-describedby={`${myGroupsHelpId}-about`}
            data-testid="ce-session-context-view"
            onClick={() => {
              setRemoveError('');
              // The token's arrival lists again.
              void getWorkerSessionToken({ sessionSlug, sessionConfig, context: { account } }).catch(
                (failure: unknown) =>
                  setRemoveError(failure instanceof Error ? failure.message : 'That did not work. Try again.'),
              );
            }}
          >
            <FontAwesomeIcon icon={faEye} aria-hidden="true" />
            View
          </button>
          {/* A tap on View signs in, so its explanation has its own button. */}
          <button
            type="button"
            id={myGroupsHelpId}
            className={`${setupStyles.button} ${styles.contextHeaderButton}`}
            aria-label="About viewing your groups’ files"
            aria-describedby={`${myGroupsHelpId}-about`}
          >
            <FontAwesomeIcon icon={faQuestionCircle} />
          </button>
          <span id={`${myGroupsHelpId}-about`} hidden>
            {MY_GROUPS_HELP}
          </span>
          <UncontrolledTooltip target={myGroupsHelpId} trigger="hover focus" autohide={false}>
            {MY_GROUPS_HELP}
          </UncontrolledTooltip>
        </>
      ) : null}
    </>
  );
  const shown = list.sources.filter(
    (source) => !(source.kind === 'link' && pageLinks.some((link) => link.url === source.url)),
  );
  const repeats = contextDuplicateIds(shown);
  const reader = { sessionSlug, sessionConfig, account };
  // An unlisted session's page is opened with its Worker, which its own pages need too.
  const pageHref = (source: ContextSource) =>
    buildSessionDocLibraryViewerUrl({
      sessionToken: sessionSlug,
      storageRef: source.id,
      storage: 'cloudflare',
      kind: 'file',
      name: source.title,
      workerOrigin: readCurrentWorkerHint(),
    });
  const toggle = (id: string) =>
    setExpanded((open) => {
      const next = new Set(open);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    <>
      {headerActionsSlot ? (
        createPortal(actions, headerActionsSlot)
      ) : (
        <div className={styles.sessionContextActions}>{actions}</div>
      )}
      {shown.length ? (
        <section
          className={styles.sessionContextSection}
          aria-label="Files and links"
          data-testid="ce-session-context-sources"
        >
          <ul className={css.items}>
            {shown.map((source) => {
              const title = contextSourceDisplayTitle(source);
              const kind = contextSourceKindLabel(source);
              const size = source.kind === 'file' ? formatContextSize(source.size) : '';
              const adder = contextAdderLabel(source, sessionConfig, account);
              const isOpen = expanded.has(source.id);
              const previewId = `ce-context-preview-${idBase}-${source.id}`;
              const isMine = !isAdmin && !!account && source.addedBy === account.toLowerCase();
              return (
                <li key={source.id} className={css.item} data-testid="ce-session-context-item">
                  <div className={css.itemHead}>
                    {source.kind === 'file' ? (
                      <button
                        type="button"
                        className={css.caret}
                        aria-expanded={isOpen}
                        aria-controls={previewId}
                        aria-label={`Preview ${title}`}
                        onClick={() => toggle(source.id)}
                      >
                        <FontAwesomeIcon icon={isOpen ? faCaretDown : faCaretRight} fixedWidth />
                      </button>
                    ) : (
                      <span className={css.caretSpace} aria-hidden="true" />
                    )}
                    <FontAwesomeIcon icon={KIND_ICONS[kind] || faFileAlt} fixedWidth aria-hidden="true" />
                    {source.kind === 'link' ? (
                      <a className={css.title} href={source.url} target="_blank" rel="noopener noreferrer">
                        {title}
                      </a>
                    ) : (
                      <button type="button" className={css.title} onClick={() => setViewing(source)}>
                        {title}
                      </button>
                    )}
                  </div>
                  <div className={css.itemMeta}>
                    <span>{size ? `${kind}, ${size}` : kind}</span>
                    {adder ? <span>Added by {adder}</span> : null}
                    {/* Apart from the name, which an agent chooses. */}
                    {source.addedByAgent ? <AgentMark /> : null}
                    {repeats.has(source.id) ? <span className={styles.sessionContextBadge}>Duplicate</span> : null}
                    {isAdmin && source.adminsOnly ? (
                      <span className={styles.sessionContextBadge}>Admins only</span>
                    ) : null}
                    {source.lockedGroupIds.length ? (
                      <span className={styles.sessionContextBadge}>
                        {contextGroupsLabel(source.lockedGroupIds, groups)}
                      </span>
                    ) : null}
                    {isMine && list.cardsSupported && contextSourceTakesCard(source) ? (
                      <button
                        type="button"
                        className={styles.sessionContextRemove}
                        aria-label={`Edit the card of ${title}`}
                        aria-expanded={editingCard === source.id}
                        onClick={() => setEditingCard((open) => (open === source.id ? '' : source.id))}
                      >
                        Edit card
                      </button>
                    ) : null}
                    {isMine ? (
                      <button
                        type="button"
                        className={styles.sessionContextRemove}
                        aria-label={`Remove ${title}`}
                        onClick={() => {
                          if (!window.confirm(`Remove ${title} from the session?`)) return;
                          setRemoveError('');
                          removeContextSource(source, { sessionSlug, sessionConfig, context: { account } }).then(
                            list.reload,
                            (failure: unknown) =>
                              setRemoveError(failure instanceof Error ? failure.message : 'It could not be removed.'),
                          );
                        }}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  {source.card ? (
                    <div className={css.itemCard}>
                      <ContextCardChips card={source.card} title={title} />
                    </div>
                  ) : null}
                  {editingCard === source.id ? (
                    <div className={`${setupStyles.page} ${css.preview}`}>
                      <ContextCardEditor
                        source={source}
                        options={{ sessionSlug, sessionConfig, context: { account } }}
                        onSaved={list.reload}
                        onClose={() => setEditingCard('')}
                      />
                    </div>
                  ) : null}
                  {isOpen ? (
                    <div id={previewId} className={css.preview}>
                      <Suspense fallback={<p className={css.previewStatus}>Loading…</p>}>
                        <ContextInlinePreview source={source} {...reader} onOpen={() => setViewing(source)} />
                      </Suspense>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {viewing ? (
        <Suspense fallback={null}>
          <ContextViewerModal
            source={viewing}
            {...reader}
            pageHref={pageHref(viewing)}
            onClose={() => setViewing(null)}
          />
        </Suspense>
      ) : null}
      {removeError ? <p role="alert">{removeError}</p> : null}
      {/* Kept mounted while closed, as a disclosure is, so a half-filled form survives closing it. */}
      {canAddFile ? (
        <div
          id={addPanelId}
          className={`${setupStyles.page} ${styles.sessionContextManage}`}
          hidden={!adding}
          data-testid="ce-session-context-participant"
        >
          <h3 className={setupStyles.fieldLabel}>Add a file</h3>
          <SessionContextAddFile
            sessionSlug={sessionSlug}
            sessionConfig={sessionConfig}
            account={account}
            groups={groups}
            cardsOn={list.cardsSupported}
            onAdded={list.reload}
          />
          <h3 className={setupStyles.fieldLabel}>Add a note</h3>
          <SessionContextAddNote
            sessionSlug={sessionSlug}
            sessionConfig={sessionConfig}
            account={account}
            groups={groups}
            onAdded={list.reload}
          />
          {list.participantsCanAddLinks ? (
            <>
              <h3 className={setupStyles.fieldLabel}>Add a link</h3>
              <SessionContextAddLink
                sessionSlug={sessionSlug}
                sessionConfig={sessionConfig}
                account={account}
                onAdded={list.reload}
              />
            </>
          ) : null}
        </div>
      ) : null}
      {isAdmin ? (
        <div
          id={addPanelId}
          className={`${setupStyles.page} ${styles.sessionContextManage}`}
          hidden={!adding}
          data-testid="ce-session-context-manage"
        >
          <h3 className={setupStyles.fieldLabel}>Manage files and links</h3>
          <ContextSourcesPanel sessionSlug={sessionSlug} sessionConfig={sessionConfig} account={account} list={list} />
        </div>
      ) : null}
    </>
  );
};

export default SessionContextSources;
