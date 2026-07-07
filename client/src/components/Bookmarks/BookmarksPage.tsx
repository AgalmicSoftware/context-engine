import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faCheck, faCopy, faSync } from '@fortawesome/free-solid-svg-icons';
import { deserializeFilterState, serializeFilterState } from '../../utilities/survey/filterStateUtils.js';
import { listNamespaceEntriesSync, subscribeCacheUpdates } from '../../utilities/cache/cacheScripts.js';
import { createCacheUpdateCoalescer } from '../../utilities/cache/cacheUpdateCoalescer.js';
import { buildAtlasNodeRoute, readWindowLocationPath } from '../../utilities/ui/publicUrl.js';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { buildQuestionRoutePath } from '../../utilities/survey/questionRouting.js';
import { notify } from '../../utilities/ui/notify.js';
import { sbtBasePath, t } from '../../utilities/ui/terminology.js';
import styles from './BookmarksPage.module.scss';
import { createLogger } from '../../utilities/logging.js';

const log = createLogger('BookmarksPage');

type BookmarkUser = {
  address: string;
  nickname: string;
  username: string;
  networkId: string;
};

type FilterEntry = {
  key: string;
  raw: unknown;
  parsed: Record<string, any>;
};

type SessionBoundBookmark = {
  id: string;
  sessionSlug: string;
};

type BookmarkData = {
  users: BookmarkUser[];
  surveys: SessionBoundBookmark[];
  questions: SessionBoundBookmark[];
  sbts: string[];
  filters: FilterEntry[];
  atlasNodes: string[];
};

type BookmarkSectionKey = keyof BookmarkData;

type SectionConfig = {
  key: BookmarkSectionKey;
  label: string;
  emptyText: string;
};

type CacheEntry = {
  key?: string;
  slug?: string;
  value?: any;
};

type FilterChip = {
  type: string;
  label: string;
};

const emptyData: BookmarkData = {
  users: [],
  surveys: [],
  questions: [],
  sbts: [],
  filters: [],
  atlasNodes: [],
};

const toText = (value: unknown) => (value == null ? '' : String(value)).trim();

const safeParse = (raw: unknown): any => {
  if (!raw) return null;
  try {
    return JSON.parse(typeof raw === 'string' ? raw : String(raw));
  } catch (_) {
    return null;
  }
};

const normalizeList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map(toText).filter(Boolean);
};

const normalizeBookmarkRefs = (value: unknown, fallbackSessionSlug: unknown): SessionBoundBookmark[] => {
  if (!Array.isArray(value)) return [];
  const fallbackSlug = normalizeSessionSlug(fallbackSessionSlug || '');
  return value
    .map((entry) => {
      let id = '';
      let sessionSlug = fallbackSlug;
      if (typeof entry === 'string') {
        id = entry;
      } else if (entry && typeof entry === 'object') {
        const record = entry as Record<string, unknown>;
        id = toText(
          record.id || record.surveyId || record.surveyID || record.questionId || record.questionID || record.value,
        );
        sessionSlug = normalizeSessionSlug(record.sessionSlug ?? record.slug ?? fallbackSlug);
      }
      id = toText(id);
      if (!id) return null;
      return { id, sessionSlug };
    })
    .filter((entry): entry is SessionBoundBookmark => !!entry);
};

const normalizeFilterEntries = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => entry != null && entry !== '');
};

const uniqBy = <T,>(list: T[], keyFn: (item: T) => string): T[] => {
  const seen = new Set();
  const out: T[] = [];
  list.forEach((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
};

const sortAlpha = (list: string[]) => {
  return [...list].sort((a, b) => String(a).localeCompare(String(b)));
};

const sortBookmarkRefs = (list: SessionBoundBookmark[]) =>
  [...list].sort((a, b) => {
    const idCmp = a.id.localeCompare(b.id);
    if (idCmp !== 0) return idCmp;
    return a.sessionSlug.localeCompare(b.sessionSlug);
  });

const shortenId = (value: unknown, lead = 8, tail = 6) => {
  const text = toText(value);
  if (!text) return '';
  if (text.length <= lead + tail + 3) return text;
  return `${text.slice(0, lead)}...${text.slice(-tail)}`;
};

const getBookmarkRefKey = (entry: SessionBoundBookmark) =>
  `${entry.id.toLowerCase()}|${normalizeSessionSlug(entry.sessionSlug).toLowerCase()}`;

const asBookmarkRef = (value: unknown, sessionSlug: unknown = ''): SessionBoundBookmark => {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return {
      id: toText(
        record.id || record.surveyId || record.surveyID || record.questionId || record.questionID || record.value,
      ),
      sessionSlug: normalizeSessionSlug(record.sessionSlug ?? record.slug ?? sessionSlug),
    };
  }
  return {
    id: toText(value),
    sessionSlug: normalizeSessionSlug(sessionSlug || ''),
  };
};

export const buildSurveyBookmarkHref = (survey: unknown, sessionSlug: unknown = '') => {
  const ref = asBookmarkRef(survey, sessionSlug);
  if (!ref.id) return '/surveys';
  const base = `/survey/${encodeURIComponent(ref.id)}`;
  return ref.sessionSlug ? `${base}?session=${encodeURIComponent(ref.sessionSlug)}` : base;
};

export const buildQuestionBookmarkHref = (question: unknown, sessionSlug: unknown = '') => {
  const ref = asBookmarkRef(question, sessionSlug);
  return buildQuestionRoutePath(ref.id, { sessionSlug: ref.sessionSlug });
};

const normalizeUsers = (entries: unknown): BookmarkUser[] => {
  if (!Array.isArray(entries)) return [];
  const seen = new Set();
  const out: BookmarkUser[] = [];
  entries.forEach((entry) => {
    let address = '';
    let nickname = '';
    let username = '';
    let networkId = '';
    if (typeof entry === 'string') {
      address = entry;
    } else if (entry && typeof entry === 'object') {
      address = entry.address || entry.addressLower || '';
      nickname = entry.nickname || '';
      username = entry.username || '';
      networkId = entry.networkId || '';
    }
    address = toText(address);
    if (!address) return;
    const key = address.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      address,
      nickname: toText(nickname),
      username: toText(username),
      networkId: toText(networkId),
    });
  });
  return out;
};

const userLabel = (user: BookmarkUser) => {
  return user.nickname || user.username || shortenId(user.address, 6, 4);
};

const sectionConfigs: SectionConfig[] = [
  { key: 'users', label: 'Users', emptyText: 'No user bookmarks yet.' },
  { key: 'surveys', label: 'Surveys', emptyText: 'No survey bookmarks yet.' },
  { key: 'questions', label: 'Questions', emptyText: 'No question bookmarks yet.' },
  { key: 'sbts', label: t('sbts'), emptyText: `No ${t('sbtLower')} bookmarks yet.` },
  { key: 'filters', label: 'Filters', emptyText: 'No filter bookmarks yet.' },
  { key: 'atlasNodes', label: 'Atlas Nodes', emptyText: 'No atlas bookmarks yet.' },
];

const getFilterCopyValue = (filterEntry: FilterEntry) => {
  if (!filterEntry) return '';
  const raw = filterEntry.raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const parsed = safeParse(trimmed);
      if (parsed && typeof parsed === 'object' && typeof window !== 'undefined') {
        const encoded = serializeFilterState(parsed);
        return encoded || trimmed;
      }
      return trimmed;
    }
    return trimmed;
  }
  if (filterEntry.parsed && typeof filterEntry.parsed === 'object') {
    if (typeof window !== 'undefined') {
      const encoded = serializeFilterState(filterEntry.parsed);
      if (encoded) return encoded;
    }
    try {
      return JSON.stringify(filterEntry.parsed);
    } catch (_) {
      return String(filterEntry.parsed);
    }
  }
  return '';
};

const parseFilterEntry = (entry: unknown): FilterEntry | null => {
  if (entry == null) return null;
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const parsed = safeParse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return { key: trimmed, raw: entry, parsed };
      }
    }
    if (typeof window !== 'undefined') {
      return { key: trimmed, raw: entry, parsed: deserializeFilterState(trimmed) };
    }
    return { key: trimmed, raw: entry, parsed: {} };
  }
  if (typeof entry === 'object') {
    let key = '';
    try {
      key = JSON.stringify(entry);
    } catch (_) {
      key = String(entry);
    }
    return { key, raw: entry, parsed: entry };
  }
  return { key: String(entry), raw: entry, parsed: {} };
};

export const buildBookmarkPageSourceSignature = ({
  bookmarkEntries = [],
  filtersEntries = [],
  legacyBookmarksRaw = '',
  atlasNodesRaw = '',
  getRefId,
}: {
  bookmarkEntries?: CacheEntry[];
  filtersEntries?: CacheEntry[];
  legacyBookmarksRaw?: string;
  atlasNodesRaw?: string;
  getRefId?: (value: unknown) => string;
} = {}) => {
  const resolveRefId =
    typeof getRefId === 'function'
      ? getRefId
      : (value: unknown) => {
          if (!value || typeof value !== 'object') return `p:${String(value)}`;
          return `o:${Object.keys(value).length}`;
        };
  const parts = [
    `bookmarkEntries:${bookmarkEntries.length}`,
    `filtersEntries:${filtersEntries.length}`,
    `legacyRaw:${String(legacyBookmarksRaw || '').length}`,
    `atlasRaw:${String(atlasNodesRaw || '').length}`,
  ];
  bookmarkEntries.forEach((entry, index) => {
    parts.push(`b:${index}:${String(entry?.key || entry?.slug || '')}:${resolveRefId(entry?.value)}`);
  });
  filtersEntries.forEach((entry, index) => {
    parts.push(`f:${index}:${String(entry?.key || entry?.slug || '')}:${resolveRefId(entry?.value)}`);
  });
  if (legacyBookmarksRaw) parts.push(`legacy:${legacyBookmarksRaw}`);
  if (atlasNodesRaw) parts.push(`atlas:${atlasNodesRaw}`);
  return parts.join('|');
};

export const buildBookmarkPageDataSignature = (data: BookmarkData = emptyData) => {
  try {
    return JSON.stringify(data);
  } catch (_) {
    return '';
  }
};

export const readManagedBookmarkPageEntries = () => ({
  bookmarkEntries: listNamespaceEntriesSync('bookmarksCache', { cloneValues: false }) as CacheEntry[],
  filtersEntries: listNamespaceEntriesSync('filters', { cloneValues: false }) as CacheEntry[],
});

const buildFilterChips = (filterState: unknown): FilterChip[] => {
  if (!filterState || typeof filterState !== 'object') return [];
  const state = filterState as Record<string, any>;
  const chips: FilterChip[] = [];

  const top = state.topQuestions;
  if (top !== null && top !== undefined && String(top).trim() !== '') {
    chips.push({ type: 'top', label: `Top ${top}` });
  }

  const types = Array.isArray(state.questionTypes) ? state.questionTypes : [];
  types.forEach((qt) => {
    const label = toText(qt);
    if (label) chips.push({ type: 'type', label });
  });

  const tagSet = new Set<string>();
  const tagSources: unknown[] = [];
  if (Array.isArray(state.selectedTags)) tagSources.push(...state.selectedTags);
  if (Array.isArray(state.tags)) tagSources.push(...state.tags);
  if (Array.isArray(state.includeTags)) tagSources.push(...state.includeTags);
  if (typeof state.tag === 'string') tagSources.push(state.tag);
  tagSources.forEach((tag) => {
    const value = toText(tag);
    if (value) tagSet.add(value);
  });
  tagSet.forEach((tag) => chips.push({ type: 'tag', label: `#${tag}` }));

  const ai = toText(state.aiFilter);
  if (ai) chips.push({ type: 'ai', label: `AI: ${ai}` });

  const sbtFilter = state.sbtFilter || null;
  const sbtChips: FilterChip[] = [];
  const addSbtItems = (prefix: string, entries: unknown) => {
    if (!Array.isArray(entries)) return;
    entries.forEach((entry) => {
      let name = '';
      let address = '';
      if (typeof entry === 'string') {
        address = entry;
      } else if (entry && typeof entry === 'object') {
        name = toText(entry.name || entry.label || entry.title);
        address = toText(entry.address || entry.sbtAddress || entry.id);
      }
      const display = name || shortenId(address, 6, 4) || shortenId(entry, 6, 4);
      if (display) {
        sbtChips.push({ type: 'sbt', label: `${prefix} ${display}`.trim() });
      }
    });
  };

  if (typeof sbtFilter === 'string') {
    const label = toText(sbtFilter);
    if (label) sbtChips.push({ type: 'sbt', label: `${t('sbt')} ${shortenId(label, 6, 4)}` });
  } else if (sbtFilter && typeof sbtFilter === 'object') {
    addSbtItems('Creator+', sbtFilter.selectedSBTGroupsCreator);
    addSbtItems('Creator-', sbtFilter.excludedSBTGroupsCreator);
    addSbtItems('Responder+', sbtFilter.selectedSBTGroupsResponder);
    addSbtItems('Responder-', sbtFilter.excludedSBTGroupsResponder);
    addSbtItems('Include', sbtFilter.selectedSBTGroups);
    addSbtItems('Exclude', sbtFilter.excludedSBTGroups);
    addSbtItems(t('sbt'), sbtFilter.addresses);
  }

  if (state.sbtFilterString) {
    const label = toText(state.sbtFilterString);
    if (label) sbtChips.push({ type: 'sbt', label });
  }

  chips.push(...sbtChips);

  return chips;
};

const BookmarksPage = () => {
  const [data, setData] = useState<BookmarkData>(emptyData);
  const [expandedSections, setExpandedSections] = useState<Record<BookmarkSectionKey, boolean>>(() =>
    sectionConfigs.reduce(
      (acc, section) => {
        acc[section.key] = false;
        return acc;
      },
      {} as Record<BookmarkSectionKey, boolean>,
    ),
  );
  const [copiedFilterKey, setCopiedFilterKey] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRefreshCoalescerRef = useRef<ReturnType<typeof createCacheUpdateCoalescer> | null>(null);
  const sourceSignatureRef = useRef('');
  const dataSignatureRef = useRef('');
  const valueRefMemoRef = useRef<{ map: WeakMap<object, string>; nextId: number }>({
    map: new WeakMap<object, string>(),
    nextId: 1,
  });

  const getValueRefId = useCallback((value: unknown) => {
    if (!value || typeof value !== 'object') return `p:${String(value)}`;
    const memo = valueRefMemoRef.current;
    let refId = memo.map.get(value);
    if (!refId) {
      refId = `o:${memo.nextId}`;
      memo.nextId += 1;
      memo.map.set(value, refId);
    }
    return refId;
  }, []);

  const readBookmarks = useCallback(() => {
    if (typeof window === 'undefined') {
      const emptySig = buildBookmarkPageDataSignature(emptyData);
      if (dataSignatureRef.current !== emptySig) {
        setData(emptyData);
        dataSignatureRef.current = emptySig;
      }
      sourceSignatureRef.current = '';
      return;
    }

    try {
      const { bookmarkEntries, filtersEntries } = readManagedBookmarkPageEntries();
      const legacyBookmarksRaw = window.localStorage?.getItem('bookmarks') || '';
      const atlasNodesRaw = window.localStorage?.getItem('bookmarkedNodes') || '';
      const sourceSignature = buildBookmarkPageSourceSignature({
        bookmarkEntries,
        filtersEntries,
        legacyBookmarksRaw,
        atlasNodesRaw,
        getRefId: getValueRefId,
      });
      if (sourceSignatureRef.current && sourceSignatureRef.current === sourceSignature) {
        return;
      }
      sourceSignatureRef.current = sourceSignature;

      const merged: {
        users: unknown[];
        surveys: SessionBoundBookmark[];
        questions: SessionBoundBookmark[];
        sbts: string[];
        filters: unknown[];
      } = {
        users: [],
        surveys: [],
        questions: [],
        sbts: [],
        filters: [],
      };

      const mergeCache = (obj: any, entrySlug = '') => {
        if (!obj || typeof obj !== 'object') return;
        merged.users.push(...(Array.isArray(obj.users) ? obj.users : []));
        merged.surveys.push(...normalizeBookmarkRefs(obj.surveys, entrySlug));
        merged.questions.push(...normalizeBookmarkRefs(obj.questions, entrySlug));
        merged.sbts.push(...normalizeList(obj.sbts));
        merged.filters.push(...normalizeFilterEntries(obj.filters));
      };

      bookmarkEntries.forEach((entry) => {
        mergeCache(entry?.value, entry?.slug || '');
      });

      const normalizedFiltersFromCache: unknown[] = [];
      filtersEntries.forEach((entry) => {
        const val = entry?.value;
        if (!val || typeof val !== 'object') return;
        normalizedFiltersFromCache.push(...normalizeFilterEntries(val.bookmarkedFilters));
      });

      const legacySbts = normalizeList(safeParse(legacyBookmarksRaw)?.sbts);
      const atlasNodes = normalizeList(safeParse(atlasNodesRaw));

      const users = normalizeUsers(merged.users);
      const sortedUsers = [...users].sort((a, b) => {
        const labelA = userLabel(a);
        const labelB = userLabel(b);
        const labelCmp = labelA.localeCompare(labelB);
        if (labelCmp !== 0) return labelCmp;
        return a.address.localeCompare(b.address);
      });

      const filterEntries = uniqBy(
        [...merged.filters, ...normalizedFiltersFromCache]
          .map(parseFilterEntry)
          .filter((entry): entry is FilterEntry => !!entry),
        (entry) => entry.key,
      );

      const nextData = {
        users: sortedUsers,
        surveys: sortBookmarkRefs(uniqBy(merged.surveys, getBookmarkRefKey)),
        questions: sortBookmarkRefs(uniqBy(merged.questions, getBookmarkRefKey)),
        sbts: sortAlpha(uniqBy([...merged.sbts, ...legacySbts], (v) => v.toLowerCase())),
        filters: filterEntries,
        atlasNodes: sortAlpha(uniqBy(atlasNodes, (v) => v)),
      };
      const nextDataSig = buildBookmarkPageDataSignature(nextData);
      if (nextDataSig === dataSignatureRef.current) return;
      dataSignatureRef.current = nextDataSig;
      setData(nextData);
    } catch (_) {
      const emptySig = buildBookmarkPageDataSignature(emptyData);
      if (dataSignatureRef.current !== emptySig) {
        setData(emptyData);
        dataSignatureRef.current = emptySig;
      }
      sourceSignatureRef.current = '';
    }
  }, [getValueRefId]);

  useEffect(() => {
    const coalescer = createCacheUpdateCoalescer(readBookmarks);
    cacheRefreshCoalescerRef.current = coalescer;
    return () => {
      coalescer.cancel();
      if (cacheRefreshCoalescerRef.current === coalescer) {
        cacheRefreshCoalescerRef.current = null;
      }
    };
  }, [readBookmarks]);

  const scheduleReadBookmarks = useCallback(() => {
    const coalescer = cacheRefreshCoalescerRef.current;
    if (coalescer) {
      coalescer.schedule();
      return;
    }
    readBookmarks();
  }, [readBookmarks]);

  useEffect(() => {
    readBookmarks();
    if (typeof window === 'undefined') return;

    const onStorage = (e: StorageEvent) => {
      if (!e || !e.key) {
        scheduleReadBookmarks();
        return;
      }
      if (e.key === 'bookmarks' || e.key === 'bookmarkedNodes') {
        scheduleReadBookmarks();
      }
    };

    const onCustom = () => scheduleReadBookmarks();
    const unsubscribeCache = subscribeCacheUpdates((evt: any) => {
      const ns = String(evt?.namespace || '');
      if (ns === 'bookmarksCache' || ns === 'filters') {
        scheduleReadBookmarks();
      }
    });

    window.addEventListener('storage', onStorage);
    window.addEventListener('bookmarksCacheUpdated', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('bookmarksCacheUpdated', onCustom);
      try {
        unsubscribeCache();
      } catch (e) {
        log.warn('BookmarksPage: cleanup', e);
      }
    };
  }, [readBookmarks, scheduleReadBookmarks]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const totalCount = useMemo(() => {
    return sectionConfigs.reduce((sum, section) => {
      const value = Array.isArray(data[section.key]) ? data[section.key].length : 0;
      return sum + value;
    }, 0);
  }, [data]);

  const toggleSection = useCallback((key: BookmarkSectionKey) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleRefresh = useCallback(() => {
    readBookmarks();
    setRefreshing(true);
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      setRefreshing(false);
    }, 700);
  }, [readBookmarks]);

  const handleCopyFilter = useCallback((filterEntry: FilterEntry) => {
    const value = getFilterCopyValue(filterEntry);
    if (!value || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(value).then(() => {
      notify.success('Copied to clipboard');
      setCopiedFilterKey(filterEntry.key);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedFilterKey('');
      }, 1200);
    });
  }, []);

  return (
    <div className={styles.bookmarksPage}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Bookmarks</h1>
        </div>
        <button
          type="button"
          className={styles.refreshButton}
          onClick={handleRefresh}
          aria-label="Refresh bookmarks"
          title="Refresh bookmarks"
        >
          <FontAwesomeIcon icon={faSync} spin={refreshing} />
        </button>
      </div>

      <div className={styles.summaryRow}>
        {sectionConfigs.map((section) => {
          const count = Array.isArray(data[section.key]) ? data[section.key].length : 0;
          const isOpen = !!expandedSections[section.key];
          return (
            <div key={section.key} className={styles.summaryCard}>
              <button
                type="button"
                className={styles.summaryHeader}
                onClick={() => toggleSection(section.key)}
                aria-expanded={isOpen}
              >
                <span className={styles.summaryLabel}>{section.label}</span>
                <span className={styles.summaryHeaderRight}>
                  <span className={styles.summaryCount}>{count}</span>
                  <FontAwesomeIcon icon={isOpen ? faCaretUp : faCaretDown} className={styles.summaryCaret} />
                </span>
              </button>
              <div className={`${styles.summaryBody} ${isOpen ? styles.summaryBodyOpen : ''}`}>
                {count === 0 ? (
                  <p className={styles.emptyText}>{section.emptyText}</p>
                ) : (
                  <ul className={styles.list}>
                    {section.key === 'users' &&
                      data.users.map((user) => (
                        <li key={user.address.toLowerCase()} className={styles.listItem}>
                          <div className={styles.itemRow}>
                            <a href={`/u/${user.address}`} className={styles.itemLink}>
                              {userLabel(user)}
                            </a>
                            {user.networkId && <span className={styles.badge}>net {user.networkId}</span>}
                          </div>
                          <div className={styles.itemMeta}>{user.address}</div>
                        </li>
                      ))}
                    {section.key === 'surveys' &&
                      data.surveys.map((survey) => (
                        <li key={getBookmarkRefKey(survey)} className={styles.listItem}>
                          <div className={styles.itemRow}>
                            <a href={buildSurveyBookmarkHref(survey)} className={styles.itemLink}>
                              {shortenId(survey.id)}
                            </a>
                            {survey.sessionSlug && <span className={styles.badge}>{survey.sessionSlug}</span>}
                          </div>
                          <div className={styles.itemMeta}>{survey.id}</div>
                        </li>
                      ))}
                    {section.key === 'questions' &&
                      data.questions.map((question) => (
                        <li key={getBookmarkRefKey(question)} className={styles.listItem}>
                          <div className={styles.itemRow}>
                            <a href={buildQuestionBookmarkHref(question)} className={styles.itemLink}>
                              {shortenId(question.id)}
                            </a>
                            {question.sessionSlug && <span className={styles.badge}>{question.sessionSlug}</span>}
                          </div>
                          <div className={styles.itemMeta}>{question.id}</div>
                        </li>
                      ))}
                    {section.key === 'sbts' &&
                      data.sbts.map((sbtAddress) => (
                        <li key={sbtAddress} className={styles.listItem}>
                          <div className={styles.itemRow}>
                            <a href={`${sbtBasePath()}/${sbtAddress}`} className={styles.itemLink}>
                              {shortenId(sbtAddress, 6, 4)}
                            </a>
                          </div>
                          <div className={styles.itemMeta}>{sbtAddress}</div>
                        </li>
                      ))}
                    {section.key === 'filters' &&
                      data.filters.map((filterEntry, index) => {
                        const chips = buildFilterChips(filterEntry.parsed);
                        const hasChips = chips.length > 0;
                        const isCopied = copiedFilterKey === filterEntry.key;
                        return (
                          <li key={filterEntry.key || `filter-${index}`} className={styles.listItem}>
                            <div className={styles.filterItemHeader}>
                              {hasChips ? (
                                <div className={styles.filterChips}>
                                  {chips.map((chip, chipIndex) => (
                                    <span
                                      key={`${filterEntry.key || index}-${chipIndex}`}
                                      className={`${styles.filterChip} ${styles[`chip${chip.type}`] || ''}`}
                                    >
                                      {chip.label}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div className={styles.itemRow}>
                                  <span className={styles.itemLabel}>Unrecognized filter</span>
                                </div>
                              )}
                              <button
                                type="button"
                                className={`${styles.filterCopyButton} ${isCopied ? styles.filterCopyButtonActive : ''}`}
                                onClick={() => handleCopyFilter(filterEntry)}
                                aria-label="Copy filter code"
                                title="Copy filter code"
                              >
                                <FontAwesomeIcon icon={isCopied ? faCheck : faCopy} />
                              </button>
                            </div>
                            {typeof filterEntry.raw === 'string' && (
                              <div className={styles.itemMeta}>{shortenId(filterEntry.raw, 24, 12)}</div>
                            )}
                          </li>
                        );
                      })}
                    {section.key === 'atlasNodes' &&
                      data.atlasNodes.map((nodeId) => (
                        <li key={nodeId} className={styles.listItem}>
                          <div className={styles.itemRow}>
                            <a
                              href={buildAtlasNodeRoute(nodeId, {
                                returnTo: readWindowLocationPath(),
                              })}
                              className={styles.itemLink}
                            >
                              {shortenId(nodeId)}
                            </a>
                          </div>
                          <div className={styles.itemMeta}>{nodeId}</div>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {totalCount === 0 && (
        <div className={styles.emptyBanner}>
          No bookmarks saved yet. Add a bookmark from any page and it will show up here.
        </div>
      )}
    </div>
  );
};

export default BookmarksPage;
