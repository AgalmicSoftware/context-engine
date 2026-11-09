import { useId, useState } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt, faFileAlt, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

import ContextSourcesPanel from '../Sessions/setup/ContextSourcesPanel';
import SessionContextAddFile from './SessionContextAddFile';
import setupStyles from '../Sessions/setup/SessionSetup.module.scss';
import { contextAdderLabel, removeContextSource } from '../../utilities/docLibrary/contextSources';
import { getWorkerSessionToken } from '../../utilities/worker/workerAuth.js';
import { buildSessionDocLibraryViewerUrl } from '../../utilities/docLibrary/docUploadContracts';
import { useContextGroups } from '../../utilities/docLibrary/useContextGroups';
import type { SessionContextSourcesState } from '../../utilities/docLibrary/useSessionContextSources';
import styles from './OnePageSession.module.scss';

type Props = {
  sessionSlug: string;
  sessionConfig: Record<string, unknown> | null;
  account: string;
  /** Only the sources this reader may see; the Worker leaves out the rest. */
  list: SessionContextSourcesState;
  /** The session's page links, which already show above. */
  pageLinks: Array<{ label: string; url: string }>;
};

const MY_GROUPS_HELP = 'Signs you in to this session, so it can show files locked to your groups, and your own.';

// The Context section's files and links: the ones this reader may open, who
// added each, and for admins the controls that add, refresh and remove them.
// Others may add files and remove their own, unless the session limits that.
const SessionContextSources = ({ sessionSlug, sessionConfig, account, list, pageLinks }: Props) => {
  const isAdmin = list.isAdmin && list.supported;
  const canAddFile = !isAdmin && list.participantsCanAdd;
  const groups = useContextGroups({
    sessionSlug,
    sessionConfig,
    account,
    enabled: canAddFile || list.groupFilesHidden || list.sources.length > 0,
  });
  const [removeError, setRemoveError] = useState('');
  const myGroupsHelpId = `ce-context-my-groups-help-${useId().replace(/:/g, '')}`;
  const shown = list.sources.filter(
    (source) => !(source.kind === 'link' && pageLinks.some((link) => link.url === source.url)),
  );
  return (
    <>
      {shown.length ? (
        <section
          className={styles.sessionContextSection}
          aria-label="Files and links"
          data-testid="ce-session-context-sources"
        >
          <div className={styles.sessionContextLinks}>
            {shown.map((source) => {
              const href =
                source.kind === 'link'
                  ? source.url
                  : buildSessionDocLibraryViewerUrl({
                      sessionToken: sessionSlug,
                      storageRef: source.id,
                      storage: 'cloudflare',
                      kind: 'file',
                      name: source.title,
                    });
              const group = groups.find(({ groupId }) => groupId === source.lockedGroupId);
              const adder = contextAdderLabel(source, sessionConfig, account);
              return (
                <span key={source.id} className={styles.sessionContextItem}>
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    <FontAwesomeIcon icon={source.kind === 'link' ? faExternalLinkAlt : faFileAlt} />
                    <span>{source.title || source.url}</span>
                    {isAdmin && source.adminsOnly ? (
                      <span className={styles.sessionContextBadge}>Admins only</span>
                    ) : null}
                    {source.lockedGroupId ? (
                      <span className={styles.sessionContextBadge}>{group?.label || 'One group'}</span>
                    ) : null}
                  </a>
                  {adder ? <span className={styles.sessionContextAdder}>Added by {adder}</span> : null}
                  {!isAdmin && account && source.addedBy === account.toLowerCase() ? (
                    <button
                      type="button"
                      className={styles.sessionContextRemove}
                      aria-label={`Remove ${source.title || 'this file'}`}
                      onClick={() => {
                        if (!window.confirm(`Remove ${source.title || 'this file'} from the session?`)) return;
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
                </span>
              );
            })}
          </div>
        </section>
      ) : null}
      {removeError ? <p role="alert">{removeError}</p> : null}
      {list.groupFilesHidden && groups.length > 0 ? (
        <div className={`${setupStyles.page} ${styles.sessionContextManage}`}>
          <div className={setupStyles.buttonRow}>
            <button
              type="button"
              className={setupStyles.button}
              onClick={() => {
                setRemoveError('');
                // The token's arrival lists again.
                void getWorkerSessionToken({ sessionSlug, sessionConfig, context: { account } }).catch(
                  (failure: unknown) =>
                    setRemoveError(failure instanceof Error ? failure.message : 'That did not work. Try again.'),
                );
              }}
            >
              Show my groups’ files
            </button>
            <button
              type="button"
              id={myGroupsHelpId}
              className={styles.sessionContextHelp}
              aria-label="About showing your groups’ files"
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
          </div>
        </div>
      ) : null}
      {canAddFile ? (
        <details
          className={`${setupStyles.page} ${styles.sessionContextManage}`}
          data-testid="ce-session-context-participant"
        >
          <summary className={setupStyles.fieldLabel}>Add a file</summary>
          <SessionContextAddFile
            sessionSlug={sessionSlug}
            sessionConfig={sessionConfig}
            account={account}
            groups={groups}
            onAdded={list.reload}
          />
        </details>
      ) : null}
      {isAdmin ? (
        <details
          className={`${setupStyles.page} ${styles.sessionContextManage}`}
          data-testid="ce-session-context-manage"
        >
          <summary className={setupStyles.fieldLabel}>Manage files and links</summary>
          <ContextSourcesPanel
            sessionSlug={sessionSlug}
            sessionConfig={sessionConfig}
            account={account}
            pageLinks={pageLinks}
            list={list}
          />
        </details>
      ) : null}
    </>
  );
};

export default SessionContextSources;
