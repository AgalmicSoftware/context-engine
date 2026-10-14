import { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import {
  buildCommunitySessionCatalog,
  readKnownSessionCatalog,
  type CommunitySessionEntry,
} from '../../utilities/session/sessionCatalog';
import { SESSION_REGISTRY_CACHE_UPDATED_EVENT } from '../../utilities/web3/sessionRegistry';
import { SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT } from '../../utilities/session/sessionWorkerConfigCache';
import { workerGroupNavigationPort } from '../../domains/worker/workerGroupNavigationPort';
import { buildPublicRoute } from '../../utilities/ui/publicUrl';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SBTsList.module.scss';

const WorkerGroupsSessionSelector = ({
  sessionSlug,
  sessionName,
  sessionConfig,
}: {
  sessionSlug: string;
  sessionName: string;
  sessionConfig: Record<string, unknown>;
}) => {
  const [catalog, setCatalog] = useState<CommunitySessionEntry[]>([]);
  const readingCatalog = useRef(false);
  const refresh = useCallback(() => {
    if (readingCatalog.current) return;
    readingCatalog.current = true;
    try {
      setCatalog(readKnownSessionCatalog());
    } finally {
      readingCatalog.current = false;
    }
  }, []);
  useEffect(() => {
    window.addEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, refresh);
    window.addEventListener(SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT, refresh);
    refresh();
    return () => {
      window.removeEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, refresh);
      window.removeEventListener(SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT, refresh);
    };
  }, [refresh]);

  const exactEntry = buildCommunitySessionCatalog({
    entries: [[sessionSlug, { ...sessionConfig, slug: sessionSlug }]],
  })[0];
  const knownEntry = catalog.find((entry) => entry.slug === sessionSlug);
  const sessionHref =
    (exactEntry?.href.includes('?worker=') ? exactEntry.href : knownEntry?.href || exactEntry?.href) ||
    buildPublicRoute(`/session/${encodeURIComponent(sessionSlug)}`);
  const options = [
    { slug: sessionSlug, name: sessionName, href: sessionHref },
    ...catalog.filter((entry) => entry.slug && entry.slug !== sessionSlug),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className={styles.workerRouteSessionHero} data-testid="ce-worker-groups-session-hero">
      <label className={styles.workerRouteSessionEyebrow} htmlFor={E2E_TESTIDS.WORKER_GROUPS_SESSION_SELECT}>
        Active session
      </label>
      <div className={styles.workerRouteSessionName}>
        <select
          id={E2E_TESTIDS.WORKER_GROUPS_SESSION_SELECT}
          data-testid={E2E_TESTIDS.WORKER_GROUPS_SESSION_SELECT}
          className={styles.workerRouteSessionSelect}
          value={sessionSlug}
          title={`${sessionName} (${sessionSlug})`}
          onFocus={refresh}
          onChange={(event) => {
            const next = options.find((entry) => entry.slug === event.target.value);
            if (!next || next.slug === sessionSlug) return;
            // Build from the destination catalog entry: the old route's Worker
            // and group query belong to the old session and must not carry over.
            const workerUrl = new URL(next.href, window.location.origin).searchParams.get('worker') || undefined;
            const path = workerGroupNavigationPort.buildPath({ sessionSlug: next.slug, workerUrl });
            window.history.pushState({}, '', path);
          }}
        >
          {options.map(({ slug, name }) => (
            <option key={slug} value={slug}>
              {name === slug ? name : `${name} (${slug})`}
            </option>
          ))}
        </select>
        <a href={sessionHref} aria-label={`Open session ${sessionName}`} title={`Open session ${sessionName}`}>
          <FontAwesomeIcon
            aria-hidden="true"
            className={styles.workerRouteSessionExternalIcon}
            icon={faExternalLinkAlt}
          />
        </a>
      </div>
    </section>
  );
};

export default WorkerGroupsSessionSelector;
