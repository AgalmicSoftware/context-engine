import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { getAllSessionSlugs, getSessionConfigBySlug } from '../../utilities/web3/chainGateway.js';
import { SESSION_REGISTRY_CACHE_UPDATED_EVENT } from '../../utilities/web3/sessionRegistry.js';
import {
  buildCommunitySessionCatalog,
  readKnownSessionCatalog,
  type CommunitySessionEntry,
} from '../../utilities/session/sessionCatalog';
import { SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT } from '../../utilities/session/sessionWorkerConfigCache';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildSettingsSessionHref } from '../Account/loginSettingsRouteHelpers';
import accountStyles from '../Account/Account.module.scss';
import styles from './ToolExplorer.module.scss';

export const resolveToolSessionConfig = (slug: string, supplied: unknown): Record<string, unknown> | null => {
  if (supplied && typeof supplied === 'object' && 'slug' in supplied && normalizeSessionSlug(supplied.slug) === slug) {
    return supplied as Record<string, unknown>;
  }
  return getSessionConfigBySlug(slug) || null;
};

const ToolExplorerSessionControl = ({
  activeSessionSlug,
  sessionConfig,
  inheritedSessionSlug,
  onUseInheritedSession,
  onChange,
}: {
  activeSessionSlug: string;
  sessionConfig: unknown;
  inheritedSessionSlug?: string;
  onUseInheritedSession?: () => void;
  onChange: (slug: string) => void;
}) => {
  const [catalog, setCatalog] = useState<CommunitySessionEntry[]>([]);
  const readingCatalog = useRef(false);
  const refresh = useCallback(() => {
    if (readingCatalog.current) return;
    readingCatalog.current = true;
    try {
      // Cache hydration can notify mounted views; keep discovery outside render.
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

  const slugs = Array.from(
    new Set(
      [
        activeSessionSlug,
        inheritedSessionSlug ?? '',
        '',
        ...(getAllSessionSlugs({ includeEmpty: true }) || []),
        ...catalog.map(({ slug }) => slug),
      ].map(normalizeSessionSlug),
    ),
  );
  const options = slugs.map((slug) => {
    const config = resolveToolSessionConfig(slug, slug === activeSessionSlug ? sessionConfig : null);
    const name = slug
      ? toStr(config?.sessionName).trim() || catalog.find((entry) => entry.slug === slug)?.name || slug
      : 'General';
    const description = slug ? `${name} (${slug})` : name;
    return { slug, name, description };
  });

  let inheritedOptionValue = '__ce_inherited_session__';
  while (slugs.includes(inheritedOptionValue)) inheritedOptionValue += '_';
  const inheritedSessionDescription = options.find((option) => option.slug === inheritedSessionSlug)?.description;
  const activeDescription = options.find((option) => option.slug === activeSessionSlug)?.description;
  const activeConfig = resolveToolSessionConfig(activeSessionSlug, sessionConfig);
  const exactEntry = activeConfig
    ? buildCommunitySessionCatalog({ entries: [[activeSessionSlug, activeConfig]] })[0]
    : undefined;
  // A route's exact Worker origin wins a same-slug cached authority; partial
  // configs keep the catalog's validated discovery query.
  const exactWorkerHref =
    exactEntry?.kind === 'centralized' && exactEntry.href.includes('?worker=') ? exactEntry.href : null;
  const sessionHref = activeSessionSlug
    ? exactWorkerHref ||
      catalog.find((entry) => entry.slug === activeSessionSlug)?.href ||
      exactEntry?.href ||
      buildSettingsSessionHref(activeSessionSlug)
    : buildSettingsSessionHref('');

  return (
    <div
      className={`${accountStyles.globalSessionSelector} ${accountStyles.settingsSessionRoute} ${styles.activeSessionControl}`}
    >
      <span className={accountStyles.settingsSessionLabel}>SESSION</span>
      <span className={accountStyles.globalSessionSelectField} data-selected-label={activeDescription}>
        <select
          className={`${accountStyles.settingsSessionName} ${styles.activeSessionSelect}`}
          aria-label="Active session"
          data-testid={E2E_TESTIDS.TOOL_EXPLORER_ACTIVE_SESSION}
          value={activeSessionSlug}
          title={activeDescription}
          onFocus={refresh}
          onChange={(event) => {
            if (onUseInheritedSession && event.target.value === inheritedOptionValue) onUseInheritedSession();
            else onChange(event.target.value);
          }}
        >
          {onUseInheritedSession && (
            <option value={inheritedOptionValue}>Use global default: {inheritedSessionDescription}</option>
          )}
          {options.map((option) => (
            <option key={option.slug || 'general'} value={option.slug}>
              {option.description}
            </option>
          ))}
        </select>
      </span>
      <a
        href={sessionHref}
        className={accountStyles.globalSessionLink}
        aria-label={`Open session ${activeDescription}`}
        title={`Open session ${activeDescription}`}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={E2E_TESTIDS.TOOL_EXPLORER_ACTIVE_SESSION_LINK}
      >
        <FontAwesomeIcon icon={faExternalLinkAlt} />
      </a>
    </div>
  );
};

export default ToolExplorerSessionControl;
