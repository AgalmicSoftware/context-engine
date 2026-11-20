import { useCallback, useEffect, useRef, useState } from 'react';
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
import { buildSessionListOptions, sessionListName } from '../../utilities/session/sessionListing';
import styles from '../Account/Account.module.scss';

type GlobalSessionSelectorProps = {
  selection: Partial<GlobalSessionSelection>;
  /** `href` is the picked session's link, with its `?worker=` when the site knows one. */
  onChange: (selection: Partial<GlobalSessionSelection>, picked: { href: string }) => void;
  sessionConfig?: unknown;
  testId: string;
  /** Jump menu: keep the current session and open a picked one in a new tab. */
  opensInNewTab?: boolean;
  /** Offer ALL (every session); a page that shows one session at a time leaves it out. */
  offerAll?: boolean;
  /** Link for the selected session when the page already knows it (keeps its ?worker=). */
  currentHref?: string;
  className?: string;
  labelClassName?: string;
  selectClassName?: string;
};

const GlobalSessionSelector = ({
  selection: selectionIn,
  onChange,
  sessionConfig,
  testId,
  opensInNewTab = false,
  offerAll = true,
  currentHref,
  className = styles.settingsSessionRoute,
  labelClassName = styles.settingsSessionLabel,
  selectClassName = styles.aiSettingsSelect,
}: GlobalSessionSelectorProps) => {
  const selection = normalizeGlobalSessionSelection(selectionIn);
  const requiredSlugsKey = JSON.stringify(['', selection.primarySessionSlug, ...selection.selectedSessionSlugs]);
  const [catalog, setCatalog] = useState<Array<{ slug: string; name: string; href?: string }>>([]);
  const readingCatalog = useRef(false);
  // A browser may block a tab opened from a menu; then offer a real link instead.
  const [blockedOpen, setBlockedOpen] = useState<{ href: string; label: string } | null>(null);
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
  // The current choice stays listed even when the list would leave it off.
  const options = buildSessionListOptions({
    slugs,
    keep: value === allValue || value === listValue ? [] : [value],
    nameOf: (slug) => {
      const supplied =
        sessionConfig &&
        typeof sessionConfig === 'object' &&
        'slug' in sessionConfig &&
        normalizeSessionSlug(sessionConfig.slug) === slug
          ? (sessionConfig as Record<string, unknown>)
          : null;
      return String(supplied?.sessionName || catalog.find((entry) => entry.slug === slug)?.name || '');
    },
  });
  const selectedLabel =
    value === allValue
      ? 'ALL'
      : isListSummary
        ? `Selected sessions (${selection.selectedSessionSlugs.length})`
        : options.find((option) => option.slug === value)?.label || 'General';
  const hasConcreteSelection = selection.selectedSessionScope !== 'all' && !isListSummary;
  const exactConfigEntryFor = (slug: string) =>
    sessionConfig &&
    typeof sessionConfig === 'object' &&
    'slug' in sessionConfig &&
    normalizeSessionSlug(sessionConfig.slug) === slug
      ? buildCommunitySessionCatalog({ entries: [[slug, sessionConfig]] })[0]
      : undefined;
  const hrefFor = (slug: string) => {
    if (!slug) return buildSettingsSessionHref('');
    const exactConfigEntry = exactConfigEntryFor(slug);
    // An explicit Worker route can share a slug with a different cached authority.
    // Only a validated Worker query overrides discovery; partial props retain it.
    const exactWorkerHref =
      exactConfigEntry?.kind === 'centralized' && exactConfigEntry.href.includes('?worker=')
        ? exactConfigEntry.href
        : null;
    return (
      exactWorkerHref ||
      catalog.find((entry) => entry.slug === slug)?.href ||
      exactConfigEntry?.href ||
      buildSettingsSessionHref(slug)
    );
  };
  const labelFor = (slug: string) =>
    sessionListName(slug, exactConfigEntryFor(slug)?.name || catalog.find((entry) => entry.slug === slug)?.name || '');
  const sessionHref = hasConcreteSelection ? currentHref || hrefFor(value) : null;
  const sessionLabel = labelFor(value);
  const openInNewTab = (slug: string) => {
    const target = { href: hrefFor(slug), label: labelFor(slug) };
    const opened = window.open(target.href, '_blank');
    if (opened) opened.opener = null;
    setBlockedOpen(opened ? null : target);
  };

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
            if (opensInNewTab) {
              // The value stays on the current session; the page beneath is left as it is.
              if (nextValue !== value && nextValue !== allValue) openInNewTab(nextValue);
              return;
            }
            if (nextValue === allValue) {
              onChange(
                {
                  primarySessionSlug: selection.primarySessionSlug,
                  primarySessionExplicit: selection.primarySessionExplicit,
                  selectedSessionScope: 'all',
                },
                { href: '' },
              );
            } else {
              onChange(
                { primarySessionSlug: nextValue, selectedSessionScope: nextValue ? 'active' : 'general' },
                { href: hrefFor(nextValue) },
              );
            }
          }}
        >
          {!opensInNewTab && offerAll && <option value={allValue}>ALL</option>}
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
      {blockedOpen ? (
        <a
          href={blockedOpen.href}
          className={styles.globalSessionBlockedLink}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`${testId}-open-new-tab`}
          onClick={() => setBlockedOpen(null)}
        >
          Open {blockedOpen.label} in a new tab
        </a>
      ) : null}
    </div>
  );
};

export default GlobalSessionSelector;
