import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import { buildSettingsSessionHref } from '../Account/loginSettingsRouteHelpers';
import { getSessionConfigBySlug } from '../../utilities/web3/chainGateway';
import { buildCommunitySessionCatalog, readKnownSessionCatalog } from '../../utilities/session/sessionCatalog';
import { SESSION_REGISTRY_CACHE_UPDATED_EVENT } from '../../utilities/web3/sessionRegistry';
import { SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT } from '../../utilities/session/sessionWorkerConfigCache';
import {
  normalizeGlobalSessionSelection,
  type GlobalSessionSelection,
} from '../../utilities/session/globalSessionState';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming';
import styles from '../Account/Account.module.scss';

type GlobalSessionSelectorProps = {
  selection: Partial<GlobalSessionSelection>;
  onChange: (selection: Partial<GlobalSessionSelection>) => void;
  sessionConfig?: unknown;
  testId: string;
  className?: string;
  labelClassName?: string;
  selectClassName?: string;
};

const GlobalSessionSelector = ({
  selection: selectionIn,
  onChange,
  sessionConfig,
  testId,
  className = styles.settingsSessionRoute,
  labelClassName = styles.settingsSessionLabel,
  selectClassName = styles.aiSettingsSelect,
}: GlobalSessionSelectorProps) => {
  const selection = normalizeGlobalSessionSelection(selectionIn);
  const requiredSlugsKey = JSON.stringify(['', selection.primarySessionSlug, ...selection.selectedSessionSlugs]);
  const [catalog, setCatalog] = useState<Array<{ slug: string; name: string; href?: string }>>([]);
  const readingCatalog = useRef(false);
  const refresh = useCallback(() => {
    // Registry reads may hydrate caches and notify other mounted views. Keep
    // them outside render and ignore nested notifications from this same read.
    if (readingCatalog.current) return;
    readingCatalog.current = true;
    try {
      const known = readKnownSessionCatalog();
      const slugs = [
        ...new Set([...JSON.parse(requiredSlugsKey), ...known.map(({ slug }) => slug)].map(normalizeSessionSlug)),
      ];
      const next = slugs.map((slug) => ({
        slug,
        href: known.find((entry) => entry.slug === slug)?.href,
        name:
          known.find((entry) => entry.slug === slug)?.name ||
          String(getSessionConfigBySlug(slug)?.sessionName || '').trim(),
      }));
      setCatalog((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
    } finally {
      readingCatalog.current = false;
    }
  }, [requiredSlugsKey]);
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
      ['', selection.primarySessionSlug, ...selection.selectedSessionSlugs, ...catalog.map(({ slug }) => slug)].map(
        normalizeSessionSlug,
      ),
    ),
  );
  const options = slugs
    .map((slug) => {
      const supplied =
        sessionConfig &&
        typeof sessionConfig === 'object' &&
        'slug' in sessionConfig &&
        normalizeSessionSlug(sessionConfig.slug) === slug
          ? (sessionConfig as Record<string, unknown>)
          : null;
      const registeredName = catalog.find((entry) => entry.slug === slug)?.name;
      const name = slug ? String(supplied?.sessionName || registeredName || '').trim() || slug : 'General';
      return { slug, label: slug && name.toLowerCase() !== slug ? `${name} (${slug})` : name };
    })
    .sort((a, b) => (!a.slug ? -1 : !b.slug ? 1 : a.label.localeCompare(b.label)));
  // Sentinels must not hide real sessions with the same slug.
  let allValue = '__ce_all_sessions__';
  while (slugs.includes(allValue)) allValue += '_';
  let listValue = '__ce_selected_sessions__';
  while (slugs.includes(listValue)) listValue += '_';
  const isListSummary = selection.selectedSessionScope === 'list' && selection.selectedSessionSlugs.length !== 1;
  const value =
    selection.selectedSessionScope === 'all'
      ? allValue
      : selection.selectedSessionScope === 'general'
        ? ''
        : isListSummary
          ? listValue
          : selection.selectedSessionScope === 'list'
            ? selection.selectedSessionSlugs[0]
            : selection.primarySessionSlug;
  const selectedLabel =
    value === allValue
      ? 'ALL'
      : isListSummary
        ? `Selected sessions (${selection.selectedSessionSlugs.length})`
        : options.find((option) => option.slug === value)?.label || 'General';
  const hasConcreteSelection = selection.selectedSessionScope !== 'all' && !isListSummary;
  const exactConfigEntry =
    sessionConfig &&
    typeof sessionConfig === 'object' &&
    'slug' in sessionConfig &&
    normalizeSessionSlug(sessionConfig.slug) === value
      ? buildCommunitySessionCatalog({ entries: [[value, sessionConfig]] })[0]
      : undefined;
  // An explicit Worker route can share a slug with a different cached authority.
  // Only a validated Worker query overrides discovery; partial props retain it.
  const exactWorkerHref =
    exactConfigEntry?.kind === 'centralized' && exactConfigEntry.href.includes('?worker=')
      ? exactConfigEntry.href
      : null;
  const sessionHref = hasConcreteSelection
    ? value
      ? exactWorkerHref ||
        catalog.find((entry) => entry.slug === value)?.href ||
        exactConfigEntry?.href ||
        buildSettingsSessionHref(value)
      : buildSettingsSessionHref('')
    : null;
  const sessionLabel = value
    ? exactConfigEntry?.name || catalog.find((entry) => entry.slug === value)?.name || value
    : 'General';

  return (
    <div className={`${styles.globalSessionSelector} ${className}`}>
      <span className={labelClassName}>Session</span>
      <span className={styles.globalSessionSelectField} data-selected-label={selectedLabel}>
        <select
          aria-label="Session"
          className={selectClassName}
          data-testid={testId}
          value={value}
          onFocus={refresh}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (nextValue === listValue) return;
            if (nextValue === allValue) {
              onChange({
                primarySessionSlug: selection.primarySessionSlug,
                primarySessionExplicit: selection.primarySessionExplicit,
                selectedSessionScope: 'all',
              });
            } else {
              onChange({ primarySessionSlug: nextValue, selectedSessionScope: nextValue ? 'active' : 'general' });
            }
          }}
        >
          <option value={allValue}>ALL</option>
          {isListSummary && (
            <option value={listValue}>Selected sessions ({selection.selectedSessionSlugs.length})</option>
          )}
          {options.map(({ slug, label }) => (
            <option key={slug} value={slug}>
              {label}
            </option>
          ))}
        </select>
      </span>
      {sessionHref ? (
        <a
          href={sessionHref}
          className={styles.globalSessionLink}
          aria-label={`Open session ${sessionLabel}`}
          title={`Open session ${sessionLabel}`}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`${testId}-link`}
        >
          <FontAwesomeIcon icon={faExternalLinkAlt} />
        </a>
      ) : (
        <button
          type="button"
          className={styles.globalSessionLink}
          disabled
          aria-label="Select one session to open its page"
          title="Select one session to open its page"
          data-testid={`${testId}-link`}
        >
          <FontAwesomeIcon icon={faExternalLinkAlt} />
        </button>
      )}
    </div>
  );
};

export default GlobalSessionSelector;
