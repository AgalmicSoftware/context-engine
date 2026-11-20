/** @file CompareAddresses.tsx */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Collapse } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import styles from './UserPage.module.scss';
import presentationStyles from './ComparePresentation.module.scss';
import { getShortenedAddress } from 'utilities/ui/displayHelpers.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  buildCompareClassName,
  resolveCompareAddressBlockieStyle,
  resolveCompareAddressPillContentStyle,
  resolveCompareBookmarksHeaderStyle,
  resolveCompareBookmarksListStyle,
  resolveCompareErrorStyle,
} from './compareAddressStyles';
import ComparePresentation, { type ComparisonGeneration } from './ComparePresentation';
import { buildUserPageAnalysisErrorPresentation, normalizeUserAnalysisResult } from './userPageAnalysisStateHelpers';

// NEW: blockie data URL generator (tiny, deterministic)
import { generateBlockieDataUrl } from 'utilities/ui/blockieAvatars.js';

// AI comparison sections use the toolkit; drilldown stays local to cached comparison data.
import { runCompareToolkit } from 'utilities/ai/aiClient.js';
import { normalizeCompareBullets } from 'utilities/ai/aiCompareContracts.js';

// Keep small deterministic helpers (labels/bookmarks/builders) from utilities
import {
  readBookmarksNormalized,
  deriveUserLabels,
  fallbackBullets,
  pcaLiteCompass,
  sanitizeCompass,
} from 'utilities/survey/compareUsers.js';

import { createLogger } from 'utilities/logging.js';
import { listNamespaceEntriesSync, subscribeCacheUpdates } from '../../utilities/cache/cacheScripts.js';
import { createCacheUpdateCoalescer } from '../../utilities/cache/cacheUpdateCoalescer.js';
import {
  resolveCompareSessionScope,
  type CompareSessionScope,
  resolveCompareRunLabel,
  runCompareSectionTasks,
  scanCompareAddressesSequentially,
  selectCompareCacheValues,
} from './compareSessionRuntime';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { buildNicknameByAddressMap, type CompareBookmark } from './compareMembershipPresentation';
import ElapsedLoadingLabel from '../Shared/ElapsedLoadingLabel';
import { useCompareSessionData } from './useCompareSessionData';
import CompareSubjectInputList from './CompareSubjectInputList';
import CompareSubjectNameSearch, { resolveTypedCompareNames } from './CompareSubjectNameSearch';
import { useSessionNames } from '../../utilities/session/useSessionNames';
import ShowSessionNames from '../Shared/ShowSessionNames';
import CompareSubjectParticipants from './CompareSubjectParticipants';
import {
  buildCompareSubjectsRoutePath,
  compareSubjectsNeedSessionCaches,
  normalizeCompareSubjects,
  parseCompareSubject,
  resolveCompareRouteSubjects,
  selectScannableCompareSubjectAddresses,
} from './compareSubjectContract';
import {
  analyzeCompareSubjectCompatibility,
  resolveCompareSubjects,
  type CompareSubjectCompatibility,
} from './compareSubjectAdapters';

const accountLog = createLogger('account');

export {
  buildCompareClassName,
  buildCompareProfileHref,
  resolveCompareAddressBlockieStyle,
  resolveCompareAddressPillContentStyle,
  resolveCompareBookmarksHeaderStyle,
  resolveCompareBookmarksListStyle,
  resolveCompareClickableResultItemStyle,
  resolveCompareCompassLegendStyle,
  resolveCompareCompassLegendSwatchStyle,
  resolveCompareCompassScrollStyle,
  resolveCompareDrillBodyStyle,
  resolveCompareErrorStyle,
  resolveCompareLoadingTextStyle,
  resolveCompareUnsureHeaderStyle,
  resolveCompareUnsureMoreStyle,
  resolveCompareUnsurePanelStyle,
  resolveCompareVisualSectionStyle,
} from './compareAddressStyles';

type UnknownRecord = Record<string, unknown>;
type CompareGlobalThis = typeof globalThis & {
  CE_E2E_AI_MOCK?: boolean;
};
type CompareRunComparison = (subjects: string[], options?: { skipNavigate?: boolean }) => Promise<void>;

interface CompareSbt {
  name?: string;
  image?: string | null;
  imageUrl?: string | null;
  sbtInfo?: {
    image?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface CompareQuestion {
  id?: string;
  questionID?: string;
  questionId?: string;
  qId?: string;
  prompt?: string;
  title?: string;
  text?: string;
  type?: string;
  answer?: unknown;
  additionalComment?: string;
  options?: unknown;
  [key: string]: unknown;
}

interface CompareUser {
  address?: string;
  addressLower?: string;
  label?: string;
  sbts?: CompareSbt[];
  questions?: CompareQuestion[];
  surveys?: unknown[];
  supportsMembership?: boolean;
  subjectKind?: string;
  subjectToken?: string;
  profileHref?: string;
  provenance?: unknown;
  [key: string]: unknown;
}

interface ComparisonBullets {
  agreements: string[];
  disagreements: string[];
}

interface CompareCompassAxis {
  id?: string;
  label?: string;
  description?: string;
  negativeLabel?: string;
  positiveLabel?: string;
  [key: string]: unknown;
}

interface CompareCompassPoint {
  address?: string;
  x: number;
  y: number;
  [key: string]: unknown;
}

interface CompareCompassData {
  axes?: CompareCompassAxis[];
  points?: CompareCompassPoint[];
  evidence?: {
    x?: unknown;
    y?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface CompareCoalescer {
  schedule: () => boolean;
  cancel: () => void;
  flushNow: () => boolean;
  isQueued: () => boolean;
}

interface CompareAddressProps {
  activeSessionSlug?: string;
  /** The session settings the page already holds, so AI requests go to that session's Worker. */
  sessionConfig?: unknown;
  firstAddress?: string;
  account?: string;
  sessionCachesReady?: boolean;
  sessionCacheError?: string;
  loadSessionData?: () => Promise<unknown>;
  scanSpecificUserProfile?: (address: string) => Promise<unknown> | unknown;
}

const AI_REPLY_UNREADABLE = 'The AI reply could not be read.';

/** Why the AI summary is missing, in the words the profile analysis uses for the same failures. */
export const describeCompareAiFailure = (error: unknown): string => {
  const { message } = buildUserPageAnalysisErrorPresentation(error);
  return /worker url is not configured/i.test(message) ? 'This page has no AI service for this session.' : message;
};

const EMPTY_SUBJECT_COMPATIBILITY: CompareSubjectCompatibility = {
  membershipComparable: false,
  notice: '',
  opinionComparable: false,
  sharedQuestionIds: [],
  summaryComparable: false,
};

export const readDgObjectValues = (name: string, scope: CompareSessionScope): UnknownRecord[] =>
  selectCompareCacheValues(listNamespaceEntriesSync(name, { cloneValues: false }), scope);

const CompareAddress = ({
  activeSessionSlug: activeSessionSlugProp,
  sessionConfig,
  firstAddress,
  account,
  sessionCachesReady,
  sessionCacheError,
  loadSessionData,
  scanSpecificUserProfile,
}: CompareAddressProps) => {
  const [compareAddresses, setCompareAddresses] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bulletsLoading, setBulletsLoading] = useState(false);
  const [compassLoading, setCompassLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState('');
  // A typed name Compare couldn't settle on one account for; cleared as soon as a box changes.
  const [nameProblem, setNameProblem] = useState('');
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [generation, setGeneration] = useState<ComparisonGeneration | null>(null);
  const [aiUnavailableReason, setAiUnavailableReason] = useState('');
  const [axesSource, setAxesSource] = useState<'ai' | 'fallback' | 'mock'>('fallback');

  // Bullets + visuals fed by the unified bundle
  const [comparisonResult, setComparisonResult] = useState<ComparisonBullets | null>(null);
  const [compassData, setCompassData] = useState<CompareCompassData | null>(null);
  const [subjectCompatibility, setSubjectCompatibility] =
    useState<CompareSubjectCompatibility>(EMPTY_SUBJECT_COMPATIBILITY);

  // Dynamic bookmarks that react to cache changes
  const [bookmarks, setBookmarks] = useState<CompareBookmark[]>([]);
  const bookmarksSigRef = useRef('');
  const bookmarksRefreshCoalescerRef = useRef<CompareCoalescer | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const activeSessionScope = useMemo(
    () =>
      resolveCompareSessionScope({
        activeSessionSlug: activeSessionSlugProp,
        pathname: location.pathname,
        search: location.search,
      }),
    [activeSessionSlugProp, location.pathname, location.search],
  );
  const activeSessionSlug = activeSessionScope.slug;
  const lastAutoKeyRef = useRef('');
  const deepScanSeenRef = useRef<Set<string>>(new Set());
  const compareRunIdRef = useRef(0);
  const pendingComparisonRef = useRef<{ subjects: string[]; skipNavigate: boolean } | null>(null);
  const waitForSessionData = useCompareSessionData({
    sessionSlug: activeSessionSlug,
    ready: sessionCachesReady,
    error: sessionCacheError,
    load: loadSessionData,
  });
  useEffect(
    () => () => {
      compareRunIdRef.current += 1;
      pendingComparisonRef.current = null;
    },
    [activeSessionSlug],
  );

  // Only the names the session's Worker shows this viewer; none where the session keeps no names.
  const { names: sessionNames, signIn: signInForNames } = useSessionNames({
    sessionSlug: activeSessionSlug,
    sessionConfig,
    account: account || '',
  });

  // Keep the exact user payloads used for the latest comparison (for drill-down + viz)
  const [currentUsers, setCurrentUsers] = useState<CompareUser[]>([]);

  const runComparisonRef = useRef<CompareRunComparison | null>(null);

  useEffect(() => {
    const routeSubjects = resolveCompareRouteSubjects({
      firstSubject: firstAddress,
      pathname: location.pathname,
      search: location.search,
    });
    const pathSubjects = routeSubjects.map((subject) => subject.token);

    if (pathSubjects.length > 0) {
      setCompareAddresses(pathSubjects);
      const hasTwo = pathSubjects.length > 1;
      setShowComparison(hasTwo || location.pathname.includes('&'));

      // Auto-run when URL already has at least two canonical subjects.
      if (hasTwo) {
        const key = `${activeSessionSlug}:${routeSubjects.map((subject) => subject.key).join('&')}`;
        if (key && key !== lastAutoKeyRef.current) {
          lastAutoKeyRef.current = key;
          runComparisonRef.current?.(pathSubjects, { skipNavigate: true });
        }
      }
    } else {
      setCompareAddresses([firstAddress || '', '']);
      setShowComparison(false);
    }
  }, [firstAddress, location.pathname, location.search, activeSessionSlug]);

  const isE2eAutofillDisabled = React.useCallback(() => {
    try {
      if (globalThis && (globalThis as CompareGlobalThis).CE_E2E_AI_MOCK === true) return true;
    } catch (e) {
      void e; /* fallback: agent/e2e mock detection. */
    }
    try {
      const qp = new URLSearchParams(String(window?.location?.search || ''));
      if (qp.get('agent') === '1' || qp.get('aiMock') === '1') return true;
    } catch (e) {
      void e; /* fallback: agent/e2e mock detection. */
    }
    try {
      if (localStorage.getItem('ce-agent-enabled') === '1') return true;
      if (localStorage.getItem('ce-e2e-ai-mock') === '1') return true;
    } catch (e) {
      void e; /* fallback: agent/e2e mock detection. */
    }
    return false;
  }, []);

  // Auto-fill logic — populate second input with connected account if empty
  useEffect(() => {
    if (!account) return;
    if (isE2eAutofillDisabled()) return;
    setCompareAddresses((prev) => {
      const accLower = account.toLowerCase();
      const accountToken = `wallet:${accLower}`;
      const next = Array.isArray(prev) && prev.length > 0 ? [...prev] : [firstAddress || '', ''];
      if (next.length < 2) next.push('');
      const alreadyHasAccount = next.some((value) => parseCompareSubject(value)?.key === accountToken);
      if (!alreadyHasAccount && String(next[1] || '').trim() === '') {
        next[1] = accountToken;
        return next;
      }
      return prev;
    });
  }, [account, firstAddress, isE2eAutofillDisabled]);

  // Bookmarks (read + listen for changes)
  const readBookmarks = React.useCallback(() => {
    const mergedByLower = new Map();
    const upsert = (item: CompareBookmark) => {
      const lower = String(item?.addressLower || '').toLowerCase();
      if (!lower) return;
      const nickname = typeof item?.nickname === 'string' ? item.nickname.trim() : '';
      const next = {
        ...item,
        addressLower: lower,
        nickname,
      };
      const existing = mergedByLower.get(lower);
      if (!existing) {
        mergedByLower.set(lower, next);
        return;
      }
      if (!existing.nickname && nickname) {
        mergedByLower.set(lower, {
          ...existing,
          nickname,
          label: nickname || existing.label,
        });
      }
    };
    listNamespaceEntriesSync('bookmarksCache', { cloneValues: false }).forEach((entry) => {
      const nicknameByAddress = new Map();
      const users = Array.isArray(entry?.value?.users) ? entry.value.users : [];
      users.forEach((user: CompareUser) => {
        const lower = String(user?.address || '')
          .toLowerCase()
          .trim();
        const nickname = typeof user?.nickname === 'string' ? user.nickname.trim() : '';
        if (!lower || !nickname || nicknameByAddress.has(lower)) return;
        nicknameByAddress.set(lower, nickname);
      });
      const normalized = readBookmarksNormalized(entry?.value || null);
      normalized.forEach((bookmark: CompareBookmark) => {
        const lower = String(bookmark?.addressLower || '')
          .toLowerCase()
          .trim();
        upsert({
          ...bookmark,
          nickname: nicknameByAddress.get(lower) || '',
        });
      });
    });
    const list = Array.from(mergedByLower.values());
    const sig = JSON.stringify(
      list.map((bookmark) => [bookmark.addressLower, bookmark.label, bookmark.nickname || '']),
    );
    if (sig !== bookmarksSigRef.current) {
      bookmarksSigRef.current = sig;
      setBookmarks(list);
    }
  }, []);
  useEffect(() => {
    const coalescer = createCacheUpdateCoalescer(readBookmarks);
    bookmarksRefreshCoalescerRef.current = coalescer as CompareCoalescer;
    return () => {
      coalescer.cancel();
      if (bookmarksRefreshCoalescerRef.current === coalescer) {
        bookmarksRefreshCoalescerRef.current = null;
      }
    };
  }, [readBookmarks]);
  const scheduleBookmarksRefresh = React.useCallback(() => {
    const coalescer = bookmarksRefreshCoalescerRef.current;
    if (coalescer) {
      coalescer.schedule();
      return;
    }
    readBookmarks();
  }, [readBookmarks]);
  useEffect(() => {
    readBookmarks();
  }, [readBookmarks]);
  useEffect(() => {
    const unsubscribe = subscribeCacheUpdates((event: { namespace?: string } | null) => {
      if (event?.namespace === 'bookmarksCache') scheduleBookmarksRefresh();
    });
    const onCustom = () => scheduleBookmarksRefresh();
    window.addEventListener('bookmarksCacheUpdated', onCustom);
    return () => {
      unsubscribe();
      window.removeEventListener('bookmarksCacheUpdated', onCustom);
    };
  }, [scheduleBookmarksRefresh]);

  // Bookmark pill click → insert into inputs
  const onBookmarkClick = (bookmarkAddress: string) => {
    const lower = String(bookmarkAddress || '').toLowerCase();
    if (!lower) return;
    const bookmarkToken = `wallet:${lower}`;

    setCompareAddresses((prev) => {
      const current = Array.isArray(prev) ? [...prev] : [];
      const exists = current.some((value) => parseCompareSubject(value)?.key === bookmarkToken);
      if (exists) return prev;

      const emptyIdx = current.findIndex((a) => !a || String(a).trim() === '');
      if (emptyIdx > -1) {
        const next = [...current];
        next[emptyIdx] = bookmarkToken;
        return next;
      }
      return [...current, bookmarkToken];
    });
  };

  const runComparison = async (subjectValues: string[], { skipNavigate = false }: { skipNavigate?: boolean } = {}) => {
    const subjects = normalizeCompareSubjects(subjectValues);
    const subjectTokens = subjects.map((subject) => subject.token);
    const runId = ++compareRunIdRef.current;
    const isStale = () => compareRunIdRef.current !== runId;

    if (subjects.length < 2) {
      pendingComparisonRef.current = null;
      setLoading(false);
      setBulletsLoading(false);
      setCompassLoading(false);
      setComparisonError('Enter at least two valid subjects (wallet, Worker, or simulated).');
      return;
    }

    lastAutoKeyRef.current = `${activeSessionSlug}:${subjects.map((subject) => subject.key).join('&')}`;
    if (!skipNavigate)
      navigate(
        buildCompareSubjectsRoutePath({
          subjects: subjectTokens,
          sessionSlug: activeSessionSlug,
          search: location.search,
        }),
      );

    setComparisonError('');
    setLoading(true);
    setBulletsLoading(true);
    setCompassLoading(true);
    setShowComparison(true);

    // Clear prior-run slices before either waiting for caches or resolving the new subjects.
    setComparisonResult(null);
    setGeneration(null);
    setAiUnavailableReason('');
    setAxesSource('fallback');
    setCompassData(null);
    setCurrentUsers([]);
    setSubjectCompatibility(EMPTY_SUBJECT_COMPATIBILITY);

    if (compareSubjectsNeedSessionCaches(subjects)) {
      pendingComparisonRef.current = sessionCachesReady === false ? { subjects: subjectTokens, skipNavigate } : null;
      try {
        await waitForSessionData();
      } catch (error) {
        if (isStale()) return;
        pendingComparisonRef.current = null;
        setComparisonError(error instanceof Error ? error.message : 'Could not load session data. Please retry.');
        setLoading(false);
        setBulletsLoading(false);
        setCompassLoading(false);
        return;
      }
      if (isStale()) return;
    }
    pendingComparisonRef.current = null;

    const scanFailures = await scanCompareAddressesSequentially({
      addresses: selectScannableCompareSubjectAddresses(subjects),
      sessionSlug: activeSessionSlug,
      scanSpecificUserProfile,
      seen: deepScanSeenRef.current,
    });
    scanFailures.forEach(({ address, error }) => {
      accountLog.warn('[CompareAddresses] deep scan failed:', address, error);
    });
    if (isStale()) return;

    // Read caches via component-level helper (side-effect)
    const sbtCaches = readDgObjectValues('sbtCache', activeSessionScope);
    const questionsCaches = readDgObjectValues('questionsCache', activeSessionScope);
    const surveysCaches = readDgObjectValues('surveysCache', activeSessionScope);

    // Normalize cache-backed and simulated subjects into one comparison payload contract.
    const resolution = resolveCompareSubjects({
      questionsCaches,
      sbtCaches,
      sessionSlug: activeSessionSlug,
      subjects: subjectTokens,
      surveysCaches,
    });
    const users = resolution.users;
    if (users.length < 2) {
      if (!isStale()) {
        setComparisonError(
          resolution.errors.map((error) => error.message).join(' ') || 'Fewer than two subjects resolved.',
        );
        setBulletsLoading(false);
        setCompassLoading(false);
        setLoading(false);
      }
      return;
    }
    const compatibility = analyzeCompareSubjectCompatibility(users);
    setSubjectCompatibility(compatibility);
    if (resolution.errors.length > 0) {
      setComparisonError(resolution.errors.map((error) => error.message).join(' '));
    }
    setCurrentUsers(users);

    // These sections are independent; let each render as soon as its own result is ready.
    // A session's short name alone finds no Worker for a session this browser has not listed, so
    // the settings the page resolved go with it, when they are that session's.
    const settingsSlug = normalizeSessionSlug((sessionConfig as { slug?: unknown } | null | undefined)?.slug);
    const aiScope = {
      sessionSlug: activeSessionScope.slug,
      ...(settingsSlug && settingsSlug === activeSessionScope.slug ? { sessionConfig } : {}),
    };
    const addrOrder = users.map((u) => u.address);

    const bulletsTask = async () => {
      if (!compatibility.summaryComparable) {
        if (!isStale()) {
          setComparisonResult({ agreements: [], disagreements: [] });
          setBulletsLoading(false);
        }
        return;
      }
      try {
        const bulletsRaw: UnknownRecord | null = await runCompareToolkit(
          'compare',
          { users, ...aiScope },
          { throwOnError: true },
        );
        const validSummary =
          bulletsRaw &&
          Array.isArray(bulletsRaw.agreements) &&
          Array.isArray(bulletsRaw.disagreements) &&
          [...bulletsRaw.agreements, ...bulletsRaw.disagreements].every((item) => typeof item === 'string');
        const bullets = normalizeCompareBullets(validSummary ? bulletsRaw : null, fallbackBullets(users), 3);
        if (!isStale()) {
          setComparisonResult(bullets);
          if (!validSummary) setAiUnavailableReason(AI_REPLY_UNREADABLE);
          const metadata = validSummary && bulletsRaw && 'generation' in bulletsRaw ? bulletsRaw.generation : null;
          setGeneration(
            metadata && typeof metadata === 'object' && 'source' in metadata && metadata.source === 'mock'
              ? { model: 'Preview', provider: 'mock', source: 'mock' }
              : normalizeUserAnalysisResult({ generation: metadata }).generation || null,
          );
        }
      } catch (err) {
        accountLog.error('compare bullets failed:', err);
        const fallback = fallbackBullets(users);
        if (!isStale()) {
          setAiUnavailableReason(describeCompareAiFailure(err));
          setComparisonResult({
            agreements: (fallback.agreements || []).slice(0, 12),
            disagreements: (fallback.disagreements || []).slice(0, 12),
          });
        }
      } finally {
        if (!isStale()) setBulletsLoading(false);
      }
    };

    const compassTask = async () => {
      if (!compatibility.opinionComparable) {
        if (!isStale()) {
          setCompassData(null);
          setCompassLoading(false);
        }
        return;
      }
      try {
        let compass = null;
        try {
          const axesRaw = await runCompareToolkit('axes', { users, ...aiScope });
          const validAxes =
            axesRaw &&
            Array.isArray(axesRaw.axes) &&
            axesRaw.axes.length === 2 &&
            axesRaw.axes.every(
              (axis: unknown) =>
                axis &&
                typeof axis === 'object' &&
                'label' in axis &&
                typeof axis.label === 'string' &&
                axis.label.trim(),
            );
          const validPoints =
            axesRaw &&
            Array.isArray(axesRaw.points) &&
            addrOrder.every((address) =>
              (axesRaw.points as Array<{ address?: string; x?: number; y?: number }>).some(
                (point) =>
                  String(point.address).toLowerCase() === String(address).toLowerCase() &&
                  Number.isFinite(point.x) &&
                  Number.isFinite(point.y),
              ),
            );
          compass = validAxes && validPoints ? (sanitizeCompass(axesRaw, addrOrder) as CompareCompassData) : null;
          if (compass && !isStale()) setAxesSource(axesRaw?.generation?.source === 'mock' ? 'mock' : 'ai');
        } catch (err) {
          accountLog.error('compare axes failed:', err);
        }
        if (!compass) {
          compass = sanitizeCompass(pcaLiteCompass(users), addrOrder) as CompareCompassData;
        }
        if (!isStale()) setCompassData(compass);
      } finally {
        if (!isStale()) setCompassLoading(false);
      }
    };

    const sectionResults = await runCompareSectionTasks([bulletsTask, compassTask]);
    sectionResults.forEach((result) => {
      if (result.status === 'rejected') accountLog.error('compare section failed:', result.reason);
    });

    if (!isStale()) setLoading(false);
  };
  runComparisonRef.current = runComparison;

  const performComparison = async () => {
    const typed = resolveTypedCompareNames(compareAddresses, sessionNames);
    setCompareAddresses(typed.values);
    setNameProblem(typed.problem);
    return typed.problem ? undefined : runComparison(typed.values, { skipNavigate: false });
  };

  // Not trimmed while typing, so a name can have a space in it; subjects are trimmed when read.
  const handleCompareAddressChange = (index: number, value: string) => {
    let newCompareAddresses = [...compareAddresses];
    newCompareAddresses[index] = value;
    setCompareAddresses(newCompareAddresses);
    setNameProblem('');
    // A picked name turns the box into a pill; the keyboard's place moves to that pill's clear button.
    if (parseCompareSubject(value)) {
      setTimeout(() => sectionRef.current?.querySelector<HTMLElement>(`[data-compare-clear="${index}"]`)?.focus());
    }
  };

  const addCompareAddress = () => setCompareAddresses([...(compareAddresses || []), '']);

  const clearAddressAt = (index: number) => {
    const next = [...compareAddresses];
    next[index] = '';
    setCompareAddresses(next);
  };

  const renderInputOrYouPill = (address: string, index: number) => {
    const parsedSubject = parseCompareSubject(address);
    const walletId = parsedSubject?.kind === 'wallet' ? parsedSubject.id : '';
    const isSelf = !!account && !!walletId && walletId.toLowerCase() === account.toLowerCase();
    if (isSelf) {
      const short = getShortenedAddress(walletId, false);
      const blockieUrl = generateBlockieDataUrl(walletId.toLowerCase(), 8, 4);
      const title = `You (${short})`;
      return (
        <div className={styles.youPill} title={title} aria-label={title}>
          <span style={resolveCompareAddressPillContentStyle()}>
            <img
              src={blockieUrl}
              alt=""
              width={18}
              height={18}
              style={resolveCompareAddressBlockieStyle()}
              aria-hidden="true"
            />
            <span>
              You <span className={styles.pillAddress}>({short})</span>
            </span>
          </span>
          <button
            type="button"
            className={styles.youPillClear}
            onClick={() => clearAddressAt(index)}
            data-compare-clear={index}
            aria-label="Clear this subject"
          >
            ×
          </button>
        </div>
      );
    }

    // Your private label for a bookmarked account comes first, then the name they set in this session.
    const walletLower = String(walletId || '')
      .trim()
      .toLowerCase();
    const privateLabel = nicknameByAddress.get(walletLower) || '';
    const nickname = privateLabel || sessionNames[walletLower] || '';

    if (walletId) {
      const shortened = String(getShortenedAddress(walletId, false) || '').replace('...', '…');
      const title = nickname ? `${nickname} (${shortened})${privateLabel ? ', your private label' : ''}` : shortened;
      const blockieUrl = generateBlockieDataUrl(walletId.toLowerCase(), 8, 4);
      return (
        <div className={styles.youPill} title={title} aria-label={title}>
          <span style={resolveCompareAddressPillContentStyle()}>
            <img
              src={blockieUrl}
              alt=""
              width={18}
              height={18}
              style={resolveCompareAddressBlockieStyle()}
              aria-hidden="true"
            />
            <span>
              {nickname || shortened} {nickname && <span className={styles.pillAddress}>({shortened})</span>}
              {privateLabel && <span className={styles.visuallyHidden}>, your private label</span>}
            </span>
          </span>
          <button
            type="button"
            className={styles.youPillClear}
            onClick={() => clearAddressAt(index)}
            data-compare-clear={index}
            aria-label="Clear this subject"
          >
            ×
          </button>
        </div>
      );
    }

    return (
      <CompareSubjectNameSearch
        index={index}
        names={sessionNames}
        onChange={(value) => handleCompareAddressChange(index, value)}
        taken={compareAddresses.map((value) => parseCompareSubject(value)?.id.toLowerCase() || '')}
        value={address}
      />
    );
  };

  const nicknameByAddress = useMemo(() => buildNicknameByAddressMap(bookmarks), [bookmarks]);

  // Labels (nickname/username/shortened)
  const userLabels = useMemo(
    () =>
      deriveUserLabels(currentUsers, bookmarks).map((label, index) => {
        const lower = String(currentUsers[index]?.address || '').toLowerCase();
        return nicknameByAddress.get(lower) || sessionNames[lower] || label;
      }),
    [currentUsers, bookmarks, nicknameByAddress, sessionNames],
  );

  return (
    <div className={styles.compareSection} ref={sectionRef}>
      <details className={presentationStyles.participantControls} open={!showComparison || !!comparisonError}>
        <summary>Change participants</summary>
        {bookmarks.length > 0 && (
          <div className={styles.bookmarkedUsersSection}>
            <div style={resolveCompareBookmarksHeaderStyle()}>Bookmarked Users:</div>
            <div style={resolveCompareBookmarksListStyle()}>
              {bookmarks.map((b) => {
                const short = getShortenedAddress(b.address, false);
                const blockieUrl = generateBlockieDataUrl(
                  String(b.addressLower || b.address || '').toLowerCase(),
                  8,
                  4,
                );
                const labelForTitle = b.label || short;
                const title = `${labelForTitle} (${short})`;
                return (
                  <button
                    key={b.addressLower}
                    type="button"
                    className={buildCompareClassName(styles.resultBadge, styles.bookmarkPill)}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (b.address) onBookmarkClick(b.address);
                    }}
                    title={title}
                    aria-label={`Insert ${labelForTitle} (${short})`}
                    style={resolveCompareAddressPillContentStyle()}
                  >
                    <img
                      src={blockieUrl}
                      alt=""
                      width={16}
                      height={16}
                      style={resolveCompareAddressBlockieStyle()}
                      aria-hidden="true"
                    />
                    <span>{b.label || short}</span>
                    {/* <span style={{ opacity: 0.9 }}>({short})</span> */}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <ShowSessionNames signIn={signInForNames} />
        <CompareSubjectInputList
          onAddSubject={addCompareAddress}
          renderSubjectInput={renderInputOrYouPill}
          subjectValues={compareAddresses}
        />

        <button
          className={styles.compareAction}
          onClick={performComparison}
          disabled={loading}
          data-testid={E2E_TESTIDS.COMPARE_RUN}
        >
          {loading ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin />
              &nbsp;
              <ElapsedLoadingLabel
                key={compareRunIdRef.current}
                label={
                  pendingComparisonRef.current ? resolveCompareRunLabel(sessionCachesReady) : 'Comparing subjects...'
                }
              />
            </>
          ) : (
            'Compare Views & Activity'
          )}
        </button>
      </details>
      {nameProblem && (
        <div className={styles.comparisonError} role="alert" style={resolveCompareErrorStyle()}>
          {nameProblem}
        </div>
      )}
      {comparisonError && (
        <div className={styles.comparisonError} role="alert" style={resolveCompareErrorStyle()}>
          {comparisonError}
          {!loading && currentUsers.length === 0 && (
            <button type="button" className={styles.addAddressBtn} onClick={performComparison} disabled={loading}>
              Retry loading session data
            </button>
          )}
        </div>
      )}

      {/* RESULTS */}
      <Collapse isOpen={showComparison && (!comparisonError || currentUsers.length > 0)} mountOnEnter unmountOnExit>
        <div
          className={presentationStyles.resultShell}
          data-testid={E2E_TESTIDS.COMPARE_RESULT}
          hidden={!!comparisonError && currentUsers.length === 0}
        >
          {subjectCompatibility.notice && (
            <div className={styles.placeholderNote} role="status">
              {subjectCompatibility.notice}
            </div>
          )}
          <CompareSubjectParticipants activeSessionSlug={activeSessionSlug} labels={userLabels} users={currentUsers} />

          <ComparePresentation
            key={compareRunIdRef.current}
            users={currentUsers}
            labels={userLabels}
            result={comparisonResult}
            compass={compassData}
            axesSource={axesSource}
            generation={generation}
            aiUnavailableReason={aiUnavailableReason}
            bulletsLoading={bulletsLoading}
            compassLoading={compassLoading}
            opinionComparable={subjectCompatibility.opinionComparable}
          />
        </div>
      </Collapse>
    </div>
  );
};

export { OpinionCompass2D } from './ComparePresentation';

export default CompareAddress;
