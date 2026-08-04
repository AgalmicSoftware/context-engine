/** @file CompareAddresses.tsx */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Collapse } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSpinner, faDownload } from '@fortawesome/free-solid-svg-icons';
import styles from './UserPage.module.scss';
import { getShortenedAddress } from 'utilities/ui/displayHelpers.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
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
  resolveCompareVennNoteStyle,
  resolveCompareVennSbtImageStyle,
  resolveCompareVennSbtRowStyle,
  resolveCompareVennTooltipListStyle,
  resolveCompareVennTooltipStyle,
  resolveCompareVennWrapStyle,
  resolveCompareVisualSectionStyle,
} from './compareAddressStyles';

// NEW: blockie data URL generator (tiny, deterministic)
import { generateBlockieDataUrl } from 'utilities/ui/blockieAvatars.js';

// NEW: single public entry for comparison bundle + drilldown stays on toolkit path
import { runCompareToolkit } from 'utilities/ai/aiClient.js';
import {
  mergeCompareVennWithEvidence,
  normalizeCompareBullets,
  type CompareVennResult as AiCompareVennResult,
} from 'utilities/ai/aiCompareContracts.js';

// Keep small deterministic helpers (labels/bookmarks/builders) from utilities
import {
  readBookmarksNormalized,
  deriveUserLabels,
  fallbackBullets,
  pcaLiteCompass,
  computeVennEvidence,
  sanitizeCompass,
  computeOverlapMatrix,
} from 'utilities/survey/compareUsers.js';

import { createLogger } from 'utilities/logging.js';
import { listNamespaceEntriesSync, subscribeCacheUpdates } from '../../utilities/cache/cacheScripts.js';
import { createCacheUpdateCoalescer } from '../../utilities/cache/cacheUpdateCoalescer.js';
import {
  COMPARE_GRAPHIC_FILENAME,
  resolveCompareSessionSlug,
  resolveCompareRunLabel,
  runCompareSectionTasks,
  scanCompareAddressesSequentially,
  selectCompareCacheValues,
} from './compareSessionRuntime';
import {
  buildCompareSbtKeySets,
  buildNicknameByAddressMap,
  type CompareBookmark,
} from './compareMembershipPresentation';
import CompareVenn from './CompareVenn';
import CompareSubjectInputList from './CompareSubjectInputList';
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
  resolveCompareVennNoteStyle,
  resolveCompareVennSbtImageStyle,
  resolveCompareVennSbtRowStyle,
  resolveCompareVennTooltipListStyle,
  resolveCompareVennTooltipStyle,
  resolveCompareVennWrapStyle,
  resolveCompareVisualSectionStyle,
} from './compareAddressStyles';

type CompareQuestionType = 'binary' | 'rating' | 'multichoice' | 'freeform' | 'unknown';
type CompareDrillTone = 'agree' | 'disagree' | 'unsure' | 'info' | 'muted';
type CompareSectionKey = 'agree' | 'dis';
type ComparisonTone = 'agreement' | 'disagreement';
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

interface CompareQuestionResponse {
  userIndex: number;
  label: string;
  address: string;
  answer: unknown;
  comment: string | null;
}

interface CompareQuestionEntry {
  id: string;
  prompt: string;
  type: CompareQuestionType;
  responses: CompareQuestionResponse[];
}

interface ComparisonBullets {
  agreements: string[];
  disagreements: string[];
}

interface CompareCompassAxis {
  id?: string;
  label?: string;
  description?: string;
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

type CompareVennResult = AiCompareVennResult;

interface CompareMatrixData {
  mode?: string;
  columns?: Array<{ key: string; label: string }>;
  rows?: unknown[];
  [key: string]: unknown;
}

interface CompareDrillParticipant {
  label: string;
  response?: unknown;
  responseFull?: string;
  comment?: string | null;
  commentFull?: string | null;
  userIndex?: number;
}

interface CompareDrillBadge {
  text: string;
  tone?: CompareDrillTone;
}

interface CompareDrillNode {
  label?: string;
  badges?: Array<string | CompareDrillBadge>;
  summary?: string;
  detail?: string;
  participants?: CompareDrillParticipant[];
  children?: CompareDrillNode[];
}

interface CompareDrillTree {
  title?: string;
  nodes: CompareDrillNode[];
}

interface CompareUnsureQuestion {
  id: string;
  prompt: string;
}

interface CompareDrillStateEntry {
  open: boolean;
  loading: boolean;
  error: string;
  text: string;
  tree: CompareDrillTree | null;
  unsureQuestions?: CompareUnsureQuestion[] | null;
}

type CompareDrillStateMap = Record<string, CompareDrillStateEntry>;

interface CompareCoalescer {
  schedule: () => boolean;
  cancel: () => void;
  flushNow: () => boolean;
  isQueued: () => boolean;
}

interface CompareAddressProps {
  activeSessionSlug?: string;
  firstAddress?: string;
  account?: string;
  sessionCachesReady?: boolean;
  scanSpecificUserProfile?: (address: string) => Promise<unknown> | unknown;
}

interface CompareNodeBuilderResult {
  node: CompareDrillNode;
  aligned: boolean;
  split: boolean;
  respondedCount: number;
  score: number;
}

interface OpinionCompassProps {
  users?: CompareUser[];
  labels?: string[];
  precomputed?: CompareCompassData | null;
}

const isUnknownRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toUnknownRecord = (value: unknown): UnknownRecord => (isUnknownRecord(value) ? value : {});

const readRecordProperty = (record: UnknownRecord, key: string): UnknownRecord => toUnknownRecord(record[key]);

const EMPTY_SUBJECT_COMPATIBILITY: CompareSubjectCompatibility = {
  membershipComparable: false,
  notice: '',
  opinionComparable: false,
  sharedQuestionIds: [],
  summaryComparable: false,
};

export const readDgObjectValues = (name: string, sessionSlug: string = ''): UnknownRecord[] =>
  selectCompareCacheValues(listNamespaceEntriesSync(name, { cloneValues: false }), sessionSlug);

// NEW HELPERS FOR VENN TOOLTIPS (updated to scan all group-scoped caches)
const getQuestionPrompt = (questionId: string, sessionSlug: string = ''): string => {
  try {
    const qidLower = String(questionId || '').toLowerCase();
    const questionsCaches = readDgObjectValues('questionsCache', sessionSlug);
    for (const cacheObj of questionsCaches) {
      // Read all top-level keys (string or legacy numeric)
      for (const netKey of Object.keys(cacheObj || {})) {
        const qMap = readRecordProperty(readRecordProperty(cacheObj, netKey), 'questions');
        const hit = qMap[qidLower] || qMap[String(qidLower)];
        if (hit && typeof hit === 'object') {
          return String(toUnknownRecord(hit).prompt || 'Unknown Question');
        }
      }
    }
  } catch (e) {
    accountLog.error('CompareAddresses: getQuestionPrompt failed:', e);
  }
  return 'Unknown Question';
};

const shortenQuestionId = (qid: string): string => {
  const s = String(qid || '').trim();
  if (!s) return '';
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
};

const normalizeBinaryAnswer = (answerValue: unknown): 1 | 0 | -1 | null => {
  if (answerValue === null || answerValue === undefined) return null;
  if (typeof answerValue === 'number') return answerValue > 0 ? 1 : answerValue < 0 ? -1 : 0;
  if (typeof answerValue === 'boolean') return answerValue ? 1 : -1;
  const s = String(answerValue).trim().toLowerCase();
  if (['1', 'agree', 'strongly agree', 'yes', 'true'].includes(s)) return 1;
  if (['-1', 'disagree', 'strongly disagree', 'no', 'false'].includes(s)) return -1;
  if (['0', 'unsure', 'neutral', 'skip', 'n/a', 'unknown'].includes(s)) return 0;
  return null;
};

const getCommonUnsureQuestions = (users: CompareUser[] = [], sessionSlug: string = ''): CompareUnsureQuestion[] => {
  const arr = Array.isArray(users) ? users : [];
  if (arr.length < 2) return [];
  const count = arr.length;
  const byQid = new Map<string, { id: string; prompt: string; stances: Array<1 | 0 | -1 | null> }>();

  arr.forEach((u, idx) => {
    (Array.isArray(u?.questions) ? u.questions : []).forEach((q) => {
      const qid = String(q?.id || q?.questionID || q?.questionId || '').toLowerCase();
      if (!qid) return;
      const type = String(q?.type || '').toLowerCase();
      const rawAnswer = q?.answer;
      if (type && type !== 'binary') return;
      if (!type) {
        const isBinaryish = typeof rawAnswer === 'string' || typeof rawAnswer === 'boolean';
        if (!isBinaryish) return;
      }
      const stance = normalizeBinaryAnswer(rawAnswer);
      if (stance === null) return;

      const existing = byQid.get(qid) || {
        id: qid,
        prompt: String(q?.prompt || '').trim() || getQuestionPrompt(qid, sessionSlug) || 'Unknown Question',
        stances: Array(count).fill(null),
      };
      existing.stances[idx] = stance;
      if (!existing.prompt) existing.prompt = getQuestionPrompt(qid, sessionSlug) || 'Unknown Question';
      byQid.set(qid, existing);
    });
  });

  const out: CompareUnsureQuestion[] = [];
  byQid.forEach((entry) => {
    if (!Array.isArray(entry.stances) || entry.stances.length !== count) return;
    if (entry.stances.some((s) => s === null)) return;
    if (entry.stances.every((s) => s === 0)) {
      out.push({ id: entry.id, prompt: entry.prompt || 'Unknown Question' });
    }
  });

  return out;
};

const MAX_DRILL_QUESTIONS = 6;
const MAX_DRILL_OPTIONS = 6;

const unwrapAnswerValue = (answer: unknown): unknown => {
  if (isUnknownRecord(answer) && 'value' in answer) return answer.value;
  return answer;
};

const normalizeQuestionType = (rawType: unknown): CompareQuestionType => {
  const t = String(rawType || '')
    .trim()
    .toLowerCase();
  if (!t) return 'unknown';
  if (['multi', 'multiple', 'multi-choice', 'multi_choice', 'multi_select', 'multi-select'].includes(t)) {
    return 'multichoice';
  }
  if (['text', 'open', 'open-ended', 'open_ended'].includes(t)) return 'freeform';
  if (['scale', 'likert'].includes(t)) return 'rating';
  if (['binary', 'rating', 'multichoice', 'freeform'].includes(t)) return t as CompareQuestionType;
  return 'unknown';
};

const toCleanText = (val: unknown): string => {
  const text = val == null ? '' : String(val);
  const trimmed = text.trim();
  return trimmed === '*' ? '' : trimmed;
};

const toAnswerArray = (value: unknown): string[] => {
  const raw = unwrapAnswerValue(value);
  if (Array.isArray(raw)) {
    return raw.map((v) => toCleanText(v)).filter(Boolean);
  }
  if (raw == null) return [];
  const s = toCleanText(raw);
  return s ? [s] : [];
};

const truncateText = (val: unknown, maxLen = 140): string => {
  const text = toCleanText(val);
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 3))}...`;
};

const guessRatingScale = (values: number[] = []): number | null => {
  const max = Math.max(...values);
  if (!isFinite(max) || max <= 0) return null;
  if (max <= 1) return 1;
  if (max <= 5) return 5;
  if (max <= 7) return 7;
  if (max <= 10) return 10;
  return Math.round(max);
};

const formatRatingValue = (val: unknown, scale: number | null): string => {
  const raw = Number(val);
  if (!isFinite(raw)) return '';
  const rounded = Number.isInteger(raw) ? String(raw) : raw.toFixed(2).replace(/\.0+$/, '');
  return scale ? `${rounded}/${scale}` : rounded;
};

const buildQuestionEntries = (
  users: CompareUser[] = [],
  labels: string[] = [],
  sessionSlug: string = '',
): CompareQuestionEntry[] => {
  const map = new Map<string, CompareQuestionEntry>();
  (users || []).forEach((u, idx) => {
    const label = String(labels[idx] || getShortenedAddress(u?.address || '', false) || `User ${idx + 1}`);
    (Array.isArray(u?.questions) ? u.questions : []).forEach((q) => {
      const qidRaw = q?.id || q?.questionID || q?.questionId || q?.qId;
      if (!qidRaw) return;
      const qidLower = String(qidRaw || '').toLowerCase();
      const prompt = toCleanText(q?.prompt) || getQuestionPrompt(qidLower, sessionSlug) || 'Unknown Question';
      const type = normalizeQuestionType(q?.type || '');
      const entry = map.get(qidLower) || {
        id: qidRaw,
        prompt,
        type,
        responses: [],
      };
      if (!entry.prompt) entry.prompt = prompt;
      if (entry.type === 'unknown' && type !== 'unknown') entry.type = type;
      const answer = unwrapAnswerValue(q?.answer);
      const comment = toCleanText(q?.additionalComment);
      entry.responses.push({
        userIndex: idx,
        label,
        address: u?.address || '',
        answer,
        comment: comment || null,
      });
      map.set(qidLower, entry);
    });
  });
  return Array.from(map.values());
};

const CompareAddress = ({
  activeSessionSlug: activeSessionSlugProp,
  firstAddress,
  account,
  sessionCachesReady,
  scanSpecificUserProfile,
}: CompareAddressProps) => {
  const [compareAddresses, setCompareAddresses] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bulletsLoading, setBulletsLoading] = useState(false);
  const [compassLoading, setCompassLoading] = useState(false);
  const [vennLoading, setVennLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState('');

  // Bullets + visuals fed by the unified bundle
  const [comparisonResult, setComparisonResult] = useState<ComparisonBullets | null>(null);
  const [compassData, setCompassData] = useState<CompareCompassData | null>(null);
  const [vennResult, setVennResult] = useState<CompareVennResult | null>(null);
  const [matrixData, setMatrixData] = useState<CompareMatrixData | null>(null);
  const [subjectCompatibility, setSubjectCompatibility] =
    useState<CompareSubjectCompatibility>(EMPTY_SUBJECT_COMPATIBILITY);

  // Dynamic bookmarks that react to cache changes
  const [bookmarks, setBookmarks] = useState<CompareBookmark[]>([]);
  const bookmarksSigRef = useRef('');
  const bookmarksRefreshCoalescerRef = useRef<CompareCoalescer | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const activeSessionSlug = useMemo(
    () =>
      resolveCompareSessionSlug({
        activeSessionSlug: activeSessionSlugProp,
        pathname: location.pathname,
        search: location.search,
      }),
    [activeSessionSlugProp, location.pathname, location.search],
  );
  const lastAutoKeyRef = useRef('');
  const deepScanSeenRef = useRef<Set<string>>(new Set());
  const compareRunIdRef = useRef(0);
  const pendingComparisonRef = useRef<{ subjects: string[]; skipNavigate: boolean } | null>(null);

  // Viz mode (Compass-first; Matrix is behind “More visuals”)
  const [vizMode, setVizMode] = useState<'summary' | 'compass' | 'venn' | 'matrix'>('compass');
  const [showMoreViz, setShowMoreViz] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 720);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Keep the exact user payloads used for the latest comparison (for drill-down + viz)
  const [currentUsers, setCurrentUsers] = useState<CompareUser[]>([]);

  // per-item drill-down state map: { 'agree-0': {open, loading, error, text, tree?}, ... }
  const [drillState, setDrillState] = useState<CompareDrillStateMap>({});
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
        const key = routeSubjects.map((subject) => subject.key).join('&');
        if (key && key !== lastAutoKeyRef.current) {
          lastAutoKeyRef.current = key;
          runComparisonRef.current?.(pathSubjects, { skipNavigate: true });
        }
      }
    } else {
      setCompareAddresses([firstAddress || '', '']);
      setShowComparison(false);
    }
  }, [firstAddress, location.pathname, location.search]);

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
      if (!alreadyHasAccount && (next[1] || '') === '') {
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
      setVennLoading(false);
      setComparisonError('Enter at least two valid subjects (wallet, Worker, or simulated).');
      return;
    }

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
    setVennLoading(true);
    setShowComparison(true);

    // Clear prior-run slices before either waiting for caches or resolving the new subjects.
    setComparisonResult(null);
    setCompassData(null);
    setVennResult(null);
    setMatrixData(null);
    setCurrentUsers([]);
    setSubjectCompatibility(EMPTY_SUBJECT_COMPATIBILITY);
    setDrillState({});
    setVizMode('compass');

    if (sessionCachesReady === false && compareSubjectsNeedSessionCaches(subjects)) {
      pendingComparisonRef.current = { subjects: subjectTokens, skipNavigate };
      setComparisonError('');
      return;
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
    const sbtCaches = readDgObjectValues('sbtCache', activeSessionSlug);
    const questionsCaches = readDgObjectValues('questionsCache', activeSessionSlug);
    const surveysCaches = readDgObjectValues('surveysCache', activeSessionSlug);

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
        setVennLoading(false);
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

    // Guard viz modes
    const n = users.length;
    if (vizMode === 'venn' && (n < 2 || n > 3)) setVizMode('summary');
    if (vizMode === 'matrix' && (n < 2 || n > 10)) setVizMode('summary');
    if (n >= 2 && n <= 10) setVizMode('compass');

    // These sections are independent; let each render as soon as its own result is ready.
    const aiScope = activeSessionSlug ? { sessionSlug: activeSessionSlug } : {};
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
        const bulletsRaw = await runCompareToolkit('compare', { users, ...aiScope });
        const bullets = normalizeCompareBullets(bulletsRaw, fallbackBullets(users));
        if (!isStale()) setComparisonResult(bullets);
      } catch (err) {
        accountLog.error('compare bullets failed:', err);
        const fallback = fallbackBullets(users);
        if (!isStale()) {
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
          compass = axesRaw ? (sanitizeCompass(axesRaw, addrOrder) as CompareCompassData) : null;
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

    const vennTask = async () => {
      if (!compatibility.summaryComparable) {
        if (!isStale()) {
          setVennResult(null);
          setVennLoading(false);
        }
        return;
      }
      try {
        if (users.length === 2 || users.length === 3) {
          let venn = null;
          if (users.length === 3) {
            try {
              const vennRaw = await runCompareToolkit('venn', { users, ...aiScope });
              venn = mergeCompareVennWithEvidence(vennRaw, computeVennEvidence(users));
            } catch (err) {
              accountLog.error('compare venn failed:', err);
            }
          }
          if (!venn) venn = computeVennEvidence(users);
          if (!isStale()) setVennResult(venn);
        }
      } finally {
        if (!isStale()) setVennLoading(false);
      }
    };

    const sectionResults = await runCompareSectionTasks([bulletsTask, compassTask, vennTask]);
    sectionResults.forEach((result) => {
      if (result.status === 'rejected') accountLog.error('compare section failed:', result.reason);
    });

    if (!isStale()) setLoading(false);
  };
  runComparisonRef.current = runComparison;

  useEffect(() => {
    if (sessionCachesReady === false) return;
    const pending = pendingComparisonRef.current;
    if (!pending) return;
    pendingComparisonRef.current = null;
    void runComparisonRef.current?.(pending.subjects, { skipNavigate: pending.skipNavigate });
  }, [sessionCachesReady]);

  // If user toggles “More visuals” after initial run and we don't have a matrix yet,
  // ask just for the matrix using the same users (avoid recomputing others).
  useEffect(() => {
    if (!showMoreViz) return;
    if (!currentUsers || currentUsers.length < 2 || currentUsers.length > 10) return;
    if (matrixData) return;

    try {
      const res = computeOverlapMatrix(currentUsers, 20);
      setMatrixData(res || null);
    } catch (e) {
      setMatrixData(null);
    }
  }, [showMoreViz, currentUsers, matrixData]);

  const performComparison = async () => runComparison(compareAddresses, { skipNavigate: false });

  const handleCompareAddressChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    let newCompareAddresses = [...compareAddresses];
    newCompareAddresses[index] = event.target.value.trim();
    setCompareAddresses(newCompareAddresses);
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
            aria-label="Clear this subject"
          >
            ×
          </button>
        </div>
      );
    }

    // Nickname pill (bookmarked user with nickname)
    const nickname =
      nicknameByAddress.get(
        String(walletId || '')
          .trim()
          .toLowerCase(),
      ) || '';

    if (nickname) {
      const shortened = String(getShortenedAddress(walletId, false) || '').replace('...', '…');
      const title = `${nickname} (${shortened})`;
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
              {nickname} <span className={styles.pillAddress}>({shortened})</span>
            </span>
          </span>
          <button
            type="button"
            className={styles.youPillClear}
            onClick={() => clearAddressAt(index)}
            aria-label="Clear this subject"
          >
            ×
          </button>
        </div>
      );
    }

    return (
      <input
        type="text"
        data-testid={
          index === 0 ? E2E_TESTIDS.COMPARE_ADDRESS_A : index === 1 ? E2E_TESTIDS.COMPARE_ADDRESS_B : undefined
        }
        placeholder="wallet:0x…, worker:…, or sim:…"
        value={address}
        onChange={(e) => handleCompareAddressChange(index, e)}
      />
    );
  };

  // Derived SBT name sets (fallback for Venn only)
  const sbtSetsMemo = useMemo(() => buildCompareSbtKeySets(currentUsers), [currentUsers]);
  const vennQuestionCaches = useMemo(
    () => (currentUsers.length > 0 ? readDgObjectValues('questionsCache', activeSessionSlug) : []),
    [activeSessionSlug, currentUsers],
  );

  const nicknameByAddress = useMemo(() => buildNicknameByAddressMap(bookmarks), [bookmarks]);

  // Labels (nickname/username/shortened)
  const userLabels = useMemo(() => deriveUserLabels(currentUsers, bookmarks), [currentUsers, bookmarks]);

  const questionEntries = useMemo(
    () => buildQuestionEntries(currentUsers, userLabels, activeSessionSlug),
    [activeSessionSlug, currentUsers, userLabels],
  );

  const buildDrillTree = React.useCallback(
    (pointText: string, type: ComparisonTone): CompareDrillTree => {
      const totalUsers = currentUsers.length;
      const labelForIndex = (idx: number) => userLabels[idx] || `User ${idx + 1}`;
      const makeMissingParticipants = (respondedSet: Set<number>): CompareDrillParticipant[] => {
        const missing: CompareDrillParticipant[] = [];
        for (let i = 0; i < totalUsers; i += 1) {
          if (!respondedSet.has(i)) {
            missing.push({ label: labelForIndex(i), response: 'No response' });
          }
        }
        return missing;
      };

      const buildBinaryNode = (entry: CompareQuestionEntry): CompareNodeBuilderResult => {
        const groups: Record<'agree' | 'disagree' | 'unsure' | 'other', CompareDrillParticipant[]> = {
          agree: [],
          disagree: [],
          unsure: [],
          other: [],
        };
        const responded = new Set<number>();
        const stanceValues: Array<1 | 0 | -1> = [];
        entry.responses.forEach((r) => {
          responded.add(r.userIndex);
          const stance = normalizeBinaryAnswer(r.answer);
          const comment = r.comment || null;
          const label = r.label || labelForIndex(r.userIndex);
          if (stance === 1) {
            groups.agree.push({ label, comment });
            stanceValues.push(1);
          } else if (stance === -1) {
            groups.disagree.push({ label, comment });
            stanceValues.push(-1);
          } else if (stance === 0) {
            groups.unsure.push({ label, comment });
            stanceValues.push(0);
          } else {
            const responseText = truncateText(r.answer, 120);
            groups.other.push({
              label,
              response: responseText || 'Other',
              responseFull: toCleanText(r.answer),
              comment,
            });
          }
        });

        const unique = new Set(stanceValues);
        const aligned = stanceValues.length >= 2 && unique.size === 1;
        const split = unique.size >= 2;

        const summaryParts = [];
        if (groups.agree.length) summaryParts.push(`Agree: ${groups.agree.length}`);
        if (groups.disagree.length) summaryParts.push(`Disagree: ${groups.disagree.length}`);
        if (groups.unsure.length) summaryParts.push(`Unsure: ${groups.unsure.length}`);
        if (groups.other.length) summaryParts.push(`Other: ${groups.other.length}`);
        const summary = summaryParts.join(' · ');

        const children: CompareDrillNode[] = [];
        if (groups.agree.length)
          children.push({ label: 'Agree', badges: [{ text: 'agree', tone: 'agree' }], participants: groups.agree });
        if (groups.disagree.length)
          children.push({
            label: 'Disagree',
            badges: [{ text: 'disagree', tone: 'disagree' }],
            participants: groups.disagree,
          });
        if (groups.unsure.length)
          children.push({ label: 'Unsure', badges: [{ text: 'unsure', tone: 'unsure' }], participants: groups.unsure });
        if (groups.other.length)
          children.push({
            label: 'Other answers',
            badges: [{ text: 'other', tone: 'muted' }],
            participants: groups.other,
          });
        const missing = makeMissingParticipants(responded);
        if (missing.length)
          children.push({
            label: 'No response',
            badges: [{ text: 'no response', tone: 'muted' }],
            participants: missing,
          });

        const respondedCount = responded.size;
        return {
          node: {
            label: entry.prompt,
            badges: [{ text: `Q ${shortenQuestionId(entry.id)}`, tone: 'muted' }],
            summary,
            children,
          },
          aligned,
          split,
          respondedCount,
          score: respondedCount,
        };
      };

      const buildRatingNode = (entry: CompareQuestionEntry): CompareNodeBuilderResult => {
        const participants: CompareDrillParticipant[] = [];
        const other: CompareDrillParticipant[] = [];
        const responded = new Set<number>();
        const values: number[] = [];
        entry.responses.forEach((r) => {
          responded.add(r.userIndex);
          const raw = unwrapAnswerValue(r.answer);
          const num = typeof raw === 'number' ? raw : Number(raw);
          const comment = r.comment || null;
          const label = r.label || labelForIndex(r.userIndex);
          if (isFinite(num)) {
            values.push(num);
            participants.push({ label, response: num, comment });
          } else {
            other.push({
              label,
              response: truncateText(raw, 120) || 'Other',
              responseFull: toCleanText(raw),
              comment,
            });
          }
        });

        const scale = values.length ? guessRatingScale(values) : null;
        const displayParticipants = participants.map((p) => ({
          ...p,
          response: formatRatingValue(p.response, scale),
          responseFull: formatRatingValue(p.response, scale),
        }));
        const summary =
          values.length > 0
            ? `Range ${formatRatingValue(Math.min(...values), scale)}-${formatRatingValue(Math.max(...values), scale)} · Avg ${formatRatingValue(values.reduce((a, b) => a + b, 0) / values.length, scale)}`
            : 'No rating values found';

        const threshold = scale ? scale * 0.2 : 0;
        const range = values.length ? Math.max(...values) - Math.min(...values) : 0;
        const aligned = values.length >= 2 && range <= threshold;
        const split = values.length >= 2 && range > threshold;

        const children: CompareDrillNode[] = [];
        if (displayParticipants.length) {
          children.push({
            label: 'Ratings',
            badges: [{ text: 'ratings', tone: 'info' }],
            participants: displayParticipants,
          });
        }
        if (other.length)
          children.push({ label: 'Other answers', badges: [{ text: 'other', tone: 'muted' }], participants: other });
        const missing = makeMissingParticipants(responded);
        if (missing.length)
          children.push({
            label: 'No response',
            badges: [{ text: 'no response', tone: 'muted' }],
            participants: missing,
          });

        const respondedCount = responded.size;
        return {
          node: {
            label: entry.prompt,
            badges: [{ text: `Q ${shortenQuestionId(entry.id)}`, tone: 'muted' }],
            summary,
            children,
          },
          aligned,
          split,
          respondedCount,
          score: respondedCount,
        };
      };

      const buildMultichoiceNode = (entry: CompareQuestionEntry): CompareNodeBuilderResult => {
        const responseMap = new Map<
          number,
          { userIndex: number; label: string; options: string[]; comment: string | null }
        >();
        const responded = new Set<number>();
        entry.responses.forEach((r) => {
          responded.add(r.userIndex);
          const options = toAnswerArray(r.answer);
          responseMap.set(r.userIndex, {
            userIndex: r.userIndex,
            label: r.label || labelForIndex(r.userIndex),
            options,
            comment: r.comment || null,
          });
        });

        const responders = Array.from(responseMap.values()).filter((r) => r.options.length > 0);
        const responderKeys = responders.map((r) => r.options.slice().sort().join('|'));
        const unique = new Set(responderKeys);
        const aligned = responderKeys.length >= 2 && unique.size === 1;
        const split = unique.size >= 2;

        const optionMap = new Map<string, Array<{ label: string; comment: string | null; userIndex: number }>>();
        responders.forEach((r) => {
          r.options.forEach((optRaw) => {
            const opt = toCleanText(optRaw);
            if (!opt) return;
            if (!optionMap.has(opt)) optionMap.set(opt, []);
            optionMap.get(opt)?.push({
              label: r.label,
              comment: r.comment,
              userIndex: r.userIndex,
            });
          });
        });

        const optionEntries = Array.from(optionMap.entries())
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, MAX_DRILL_OPTIONS);

        const optionNodes: CompareDrillNode[] = optionEntries.map(([opt, selected]) => {
          const selectedIdx = new Set(selected.map((p) => p.userIndex));
          const notSelected = responders
            .filter((r) => !selectedIdx.has(r.userIndex))
            .map((r) => ({ label: r.label, comment: r.comment, userIndex: r.userIndex }));
          const children: CompareDrillNode[] = [];
          if (selected.length)
            children.push({ label: 'Selected', badges: [{ text: 'agree', tone: 'agree' }], participants: selected });
          if (notSelected.length)
            children.push({
              label: 'Not selected',
              badges: [{ text: 'disagree', tone: 'disagree' }],
              participants: notSelected,
            });
          return {
            label: opt,
            badges: [
              { text: 'option', tone: 'info' },
              { text: `${selected.length}/${responders.length}`, tone: 'muted' },
            ],
            children,
          };
        });

        const missing = makeMissingParticipants(responded);
        if (missing.length) {
          optionNodes.push({
            label: 'No response',
            badges: [{ text: 'no response', tone: 'muted' }],
            participants: missing,
          });
        }

        const optionSummary = optionEntries
          .slice(0, 3)
          .map(([opt, list]) => `${truncateText(opt, 24)} (${list.length})`)
          .join(' · ');

        const respondedCount = responded.size;
        return {
          node: {
            label: entry.prompt,
            badges: [{ text: `Q ${shortenQuestionId(entry.id)}`, tone: 'muted' }],
            summary: optionSummary || `${responders.length} respondents`,
            children: optionNodes,
          },
          aligned,
          split,
          respondedCount,
          score: respondedCount,
        };
      };

      const buildFreeformNode = (entry: CompareQuestionEntry): CompareNodeBuilderResult => {
        const responses: CompareDrillParticipant[] = [];
        const responded = new Set<number>();
        entry.responses.forEach((r) => {
          responded.add(r.userIndex);
          const answerText = toCleanText(r.answer);
          if (!answerText) return;
          responses.push({
            label: r.label || labelForIndex(r.userIndex),
            response: truncateText(answerText, 140),
            responseFull: answerText,
            comment: r.comment || null,
            userIndex: r.userIndex,
          });
        });

        const normalized = responses.map((r) => (r.responseFull || '').trim().toLowerCase()).filter(Boolean);
        const unique = new Set(normalized);
        const aligned = normalized.length >= 2 && unique.size === 1;
        const split = normalized.length >= 2 && unique.size >= 2;

        const children: CompareDrillNode[] = [];
        if (responses.length)
          children.push({ label: 'Responses', badges: [{ text: 'response', tone: 'info' }], participants: responses });
        const missing = makeMissingParticipants(responded);
        if (missing.length)
          children.push({
            label: 'No response',
            badges: [{ text: 'no response', tone: 'muted' }],
            participants: missing,
          });

        const respondedCount = responded.size;
        return {
          node: {
            label: entry.prompt,
            badges: [{ text: `Q ${shortenQuestionId(entry.id)}`, tone: 'muted' }],
            summary: `${responses.length} response${responses.length === 1 ? '' : 's'}`,
            children,
          },
          aligned,
          split,
          respondedCount,
          score: respondedCount,
        };
      };

      const isAgreement = String(type || '').toLowerCase() === 'agreement';
      const sections = [
        { key: 'binary', label: 'Binary questions', builder: buildBinaryNode },
        { key: 'rating', label: 'Rating questions', builder: buildRatingNode },
        { key: 'multichoice', label: 'Multichoice questions', builder: buildMultichoiceNode },
        { key: 'freeform', label: 'Freeform questions', builder: buildFreeformNode },
      ];

      const mappedNodes = sections.map<CompareDrillNode | null>((section) => {
        const entries = questionEntries.filter((e) => normalizeQuestionType(e.type) === section.key);
        const built = entries
          .map(section.builder)
          .filter((res) => (isAgreement ? res.aligned : res.split) && res.respondedCount === totalUsers)
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_DRILL_QUESTIONS);

        if (built.length === 0) return null;
        const children = built.map((res) => res.node);
        return {
          label: section.label,
          badges: [{ text: section.key, tone: 'muted' }],
          summary: `${built.length} question${built.length === 1 ? '' : 's'}`,
          children,
        };
      });
      const nodes = mappedNodes.filter(Boolean) as CompareDrillNode[];

      if (nodes.length === 0) {
        return {
          nodes: [
            {
              label: 'No questions answered by all participants found in cached data.',
              badges: [{ text: 'note', tone: 'muted' }],
            },
          ],
        };
      }

      return { nodes };
    },
    [currentUsers, questionEntries, userLabels],
  );

  const toggleDrillDown = (sectionKey: CompareSectionKey, idx: number, pointText: string, type: ComparisonTone) => {
    const key = `${sectionKey}-${idx}`;
    const existing: CompareDrillStateEntry = drillState[key] || {
      open: false,
      loading: false,
      error: '',
      text: '',
      tree: null,
    };
    const nextOpen = !existing.open;

    // Optimistically toggle
    setDrillState((prev) => ({ ...prev, [key]: { ...existing, open: nextOpen } }));
    if (!nextOpen) return; // collapsing
    if (existing.text || existing.tree) return; // already cached
    if (existing.loading) return;

    const hasUnsureHint = /\bunsure\b/i.test(String(pointText || ''));
    const unsureQuestions = hasUnsureHint ? getCommonUnsureQuestions(currentUsers, activeSessionSlug) : null;
    const tree = buildDrillTree(pointText, type);

    setDrillState((prev) => ({
      ...prev,
      [key]: { ...existing, open: true, loading: false, error: '', tree, unsureQuestions },
    }));
  };

  const renderTree = (tree: CompareDrillTree | null) => {
    if (!tree || !Array.isArray(tree.nodes)) return null;

    const toneClassFor = (tone?: CompareDrillTone) => {
      switch (tone) {
        case 'agree':
          return styles.drillBadgeAgree;
        case 'disagree':
          return styles.drillBadgeDisagree;
        case 'unsure':
          return styles.drillBadgeUnsure;
        case 'info':
          return styles.drillBadgeInfo;
        case 'muted':
          return styles.drillBadgeMuted;
        default:
          return '';
      }
    };

    const renderBadges = (badges: Array<string | CompareDrillBadge> = []) => {
      if (!Array.isArray(badges) || badges.length === 0) return null;
      return (
        <span className={styles.drillBadgeRow}>
          {badges.map((badge, idx) => {
            const text = typeof badge === 'string' ? badge : badge?.text;
            if (!text) return null;
            const tone = typeof badge === 'string' ? null : badge?.tone;
            const toneClass = tone ? toneClassFor(tone) : '';
            return (
              <span key={`${text}-${idx}`} className={buildCompareClassName(styles.drillBadge, toneClass)}>
                {text}
              </span>
            );
          })}
        </span>
      );
    };

    const getBadgeTexts = (badges: Array<string | CompareDrillBadge> = []) =>
      (Array.isArray(badges) ? badges : [])
        .map((badge) => (typeof badge === 'string' ? badge : badge?.text))
        .filter(Boolean)
        .map((text) => String(text).trim().toLowerCase());

    const renderParticipants = (participants?: CompareDrillParticipant[]) => {
      if (!Array.isArray(participants) || participants.length === 0) return null;
      return (
        <div className={styles.drillParticipants}>
          {participants.map((p, idx) => {
            const response = toCleanText(p?.response);
            const responseFull = toCleanText(p?.responseFull || p?.response);
            const comment = toCleanText(p?.comment);
            const commentFull = toCleanText(p?.commentFull || p?.comment);
            return (
              <div className={styles.drillParticipantRow} key={`${p?.label || 'participant'}-${idx}`}>
                <div className={styles.drillParticipantHeader}>
                  <span className={styles.drillParticipantName}>{p?.label || 'Unknown'}</span>
                  {response && (
                    <span className={styles.drillParticipantResponse} title={responseFull}>
                      {response}
                    </span>
                  )}
                </div>
                {comment && (
                  <div className={styles.drillParticipantComment} title={commentFull}>
                    &quot;{comment}&quot;
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    const Node = ({ node, path, depth = 0 }: { node: CompareDrillNode; path: string; depth?: number }) => {
      const hasChildren = Array.isArray(node.children) && node.children.length > 0;
      const [open, setOpen] = useState(depth < 1);
      const toggleOpen = () => {
        if (hasChildren) setOpen((prev) => !prev);
      };
      const badgeTexts = getBadgeTexts(node.badges);
      const labelText = String(node.label || '').trim();
      const showLabel = labelText && !badgeTexts.includes(labelText.toLowerCase());

      return (
        <li className={buildCompareClassName(styles.drillNode, styles.drillConnector)} key={path}>
          <div className={styles.drillNodeHeader}>
            {hasChildren && (
              <button
                type="button"
                className={styles.drillToggle}
                onClick={toggleOpen}
                aria-label={`${open ? 'Collapse' : 'Expand'} ${labelText || 'details'}`}
                aria-expanded={open ? 'true' : 'false'}
              >
                {open ? '-' : '+'}
              </button>
            )}
            {renderBadges(node.badges)}
            {showLabel && <strong>{node.label}</strong>}
          </div>

          {node.summary && <div className={styles.drillSummary}>{node.summary}</div>}
          {node.detail && <div className={styles.drillDetail}>{node.detail}</div>}
          {renderParticipants(node.participants)}

          {hasChildren && open && (
            <ul
              className={styles.drillTree}
              role="group"
              aria-label={labelText ? `Details for ${labelText}` : 'Details'}
            >
              {(node.children || []).map((ch, i) => (
                <Node node={ch} path={`${path}.${i}`} key={`${path}.${i}`} depth={depth + 1} />
              ))}
            </ul>
          )}
        </li>
      );
    };

    return (
      <div className={styles.drillDownPanel}>
        {tree.title && <div className={styles.drillTitle}>{tree.title}</div>}
        <ul className={styles.drillTree} role="tree" aria-label={tree.title || 'Drill-down'}>
          {tree.nodes.map((n, i) => (
            <Node node={n} path={String(i)} key={String(i)} />
          ))}
        </ul>
      </div>
    );
  };

  const renderUnsureList = (items?: CompareUnsureQuestion[] | null) => {
    if (!Array.isArray(items)) return null;
    const limited = items.slice(0, 12);
    const more = Math.max(items.length - limited.length, 0);
    return (
      <div className={styles.drillDownPanel} style={resolveCompareUnsurePanelStyle()}>
        <div style={resolveCompareUnsureHeaderStyle()}>Unsure overlaps</div>
        {limited.length === 0 ? (
          <div className={styles.placeholderNote}>No shared Unsure responses found in cached data.</div>
        ) : (
          <>
            <ul className={styles.drillList}>
              {limited.map((q) => (
                <li key={q.id}>
                  <span className={styles.drillBadge} aria-hidden="true">
                    unsure
                  </span>{' '}
                  <strong>Q {shortenQuestionId(q.id)}</strong> {q.prompt}
                </li>
              ))}
            </ul>
            {more > 0 && <div style={resolveCompareUnsureMoreStyle()}>...and {more} more</div>}
          </>
        )}
      </div>
    );
  };

  // Visualization capability flags
  const participantsCount = currentUsers.length;
  const canShowVenn = (participantsCount === 2 || participantsCount === 3) && subjectCompatibility.summaryComparable;
  const canShowMatrix = participantsCount >= 2 && participantsCount <= 10;

  useEffect(() => {
    if (vizMode === 'venn' && !canShowVenn) setVizMode('summary');
    if (vizMode === 'matrix' && !canShowMatrix) setVizMode('summary');
    if (
      vizMode === 'compass' &&
      (!(participantsCount >= 2 && participantsCount <= 10) || !subjectCompatibility.opinionComparable)
    )
      setVizMode('summary');
  }, [canShowMatrix, canShowVenn, participantsCount, subjectCompatibility.opinionComparable, vizMode]);

  return (
    <div className={styles.compareSection}>
      {bookmarks.length > 0 && (
        <div className={styles.bookmarkedUsersSection}>
          <div style={resolveCompareBookmarksHeaderStyle()}>Bookmarked Users:</div>
          <div style={resolveCompareBookmarksListStyle()}>
            {bookmarks.map((b) => {
              const short = getShortenedAddress(b.address, false);
              const blockieUrl = generateBlockieDataUrl(String(b.addressLower || b.address || '').toLowerCase(), 8, 4);
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

      <CompareSubjectInputList
        onAddSubject={addCompareAddress}
        renderSubjectInput={renderInputOrYouPill}
        subjectValues={compareAddresses}
      />

      <button onClick={performComparison} disabled={loading} data-testid={E2E_TESTIDS.COMPARE_RUN}>
        {loading ? (
          <>
            <FontAwesomeIcon icon={faSpinner} spin />
            &nbsp;
            {pendingComparisonRef.current ? resolveCompareRunLabel(sessionCachesReady) : 'Comparing subjects...'}
          </>
        ) : (
          'Compare Views & Activity'
        )}
      </button>

      {comparisonError && (
        <div className={styles.comparisonError} role="alert" style={resolveCompareErrorStyle()}>
          {comparisonError}
        </div>
      )}

      {/* RESULTS */}
      <Collapse isOpen={showComparison}>
        <div className={styles.comparisonSummary} data-testid={E2E_TESTIDS.COMPARE_RESULT}>
          {subjectCompatibility.notice && (
            <div className={styles.placeholderNote} role="status">
              {subjectCompatibility.notice}
            </div>
          )}
          <CompareSubjectParticipants activeSessionSlug={activeSessionSlug} labels={userLabels} users={currentUsers} />

          {/* Visuals + Bullets in responsive two-column split */}
          <div className={styles.compareSplit} aria-live="polite">
            {/* Left: Visuals (Compass → Venn (if 3) → optional Matrix) */}
            <div className={styles.visualCol}>
              <div style={resolveCompareVisualSectionStyle()}>
                {compassLoading ? (
                  <div
                    className={styles.placeholderNote}
                    style={{
                      minHeight: 220,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <FontAwesomeIcon icon={faSpinner} spin />
                    <span>Loading chart...</span>
                  </div>
                ) : subjectCompatibility.opinionComparable ? (
                  <OpinionCompass2D
                    key={(currentUsers || []).map((u) => u.address).join(',')}
                    users={currentUsers}
                    labels={userLabels}
                    precomputed={compassData}
                  />
                ) : (
                  <div className={styles.placeholderNote}>
                    Opinion compass unavailable: these subjects have no shared canonical question IDs.
                  </div>
                )}
              </div>

              {canShowVenn && participantsCount === 2 && (
                <div style={resolveCompareVisualSectionStyle()}>
                  {vennLoading ? (
                    <div className={styles.placeholderNote}>
                      <FontAwesomeIcon icon={faSpinner} spin />
                      <span style={resolveCompareLoadingTextStyle()}>Loading overlap...</span>
                    </div>
                  ) : (
                    <CompareVenn
                      dimension={2}
                      users={currentUsers.slice(0, 2)}
                      sets={sbtSetsMemo.slice(0, 2)}
                      labels={userLabels.slice(0, 2)}
                      questionCaches={vennQuestionCaches}
                      preCounts={vennResult?.counts || null}
                      evidence={vennResult?.evidenceMap || null}
                      semantics={vennResult?.semantics || null}
                    />
                  )}
                </div>
              )}
              {canShowVenn && participantsCount === 3 && (
                <div style={resolveCompareVisualSectionStyle()}>
                  {vennLoading ? (
                    <div className={styles.placeholderNote}>
                      <FontAwesomeIcon icon={faSpinner} spin />
                      <span style={resolveCompareLoadingTextStyle()}>Loading overlap...</span>
                    </div>
                  ) : (
                    <CompareVenn
                      dimension={3}
                      users={currentUsers.slice(0, 3)}
                      sets={sbtSetsMemo.slice(0, 3)}
                      labels={userLabels.slice(0, 3)}
                      questionCaches={vennQuestionCaches}
                      preCounts={vennResult?.counts || null}
                      evidence={vennResult?.evidenceMap || null}
                      semantics={vennResult?.semantics || null}
                    />
                  )}
                </div>
              )}

              {/* “More visuals” toggle (Matrix) — kept inside visualCol */}
              {/* <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setShowMoreViz((v) => !v)}
                  aria-expanded={showMoreViz ? 'true' : 'false'}
                  className={styles.resultBadge}
                  style={{ padding: '4px 8px' }}
                >
                  {showMoreViz ? 'Fewer visuals' : 'More visuals'}
                </button>
                {showMoreViz && canShowMatrix && isNarrow && (
                  <span className={styles.vizNote} style={{ marginLeft: 4 }}>
                    Matrix hidden; too wide for current viewport. Use export or filter.
                  </span>
                )}
              </div> */}

              {showMoreViz && canShowMatrix && !isNarrow && (
                <div style={resolveCompareVisualSectionStyle()}>
                  {/* <OverlapMatrix users={currentUsers} labels={userLabels} precomputed={matrixData} /> */}
                </div>
              )}
            </div>

            {/* Right: Lists (Agreements / Disagreements) */}
            <div className={styles.listsCol}>
              <div className={styles.comparisonResults}>
                <div className={styles.agreementSection} data-testid={E2E_TESTIDS.COMPARE_AGREEMENTS}>
                  <h5>Agreements</h5>
                  <ul className={styles.resultList}>
                    {bulletsLoading ? (
                      <li className={styles.resultItem}>
                        <FontAwesomeIcon icon={faSpinner} spin />
                        <span style={resolveCompareLoadingTextStyle()}>Loading...</span>
                      </li>
                    ) : (comparisonResult?.agreements || []).length === 0 ? (
                      <li className={styles.resultEmpty}>No agreements found yet.</li>
                    ) : (
                      (comparisonResult?.agreements || []).map((pt, i) => (
                        <li
                          key={`ag-${i}`}
                          className={styles.resultItem}
                          onClick={() => toggleDrillDown('agree', i, pt, 'agreement')}
                          style={resolveCompareClickableResultItemStyle()}
                        >
                          <span className={styles.resultPlus} aria-hidden="true">
                            <FontAwesomeIcon icon={faPlus} />
                          </span>
                          <span className={styles.resultText}>{pt}</span>
                          {drillState[`agree-${i}`]?.open && (
                            <div style={resolveCompareDrillBodyStyle()}>
                              {drillState[`agree-${i}`]?.loading && (
                                <span className={styles.drillSpinner}>Loading…</span>
                              )}
                              {drillState[`agree-${i}`]?.error && (
                                <span className={styles.comparisonError}>{drillState[`agree-${i}`].error}</span>
                              )}
                              {typeof drillState[`agree-${i}`]?.tree === 'object' &&
                                renderTree(drillState[`agree-${i}`]?.tree)}
                              {drillState[`agree-${i}`]?.text && (
                                <div className={styles.placeholderNote}>{drillState[`agree-${i}`]?.text}</div>
                              )}
                              {renderUnsureList(drillState[`agree-${i}`]?.unsureQuestions)}
                            </div>
                          )}
                        </li>
                      ))
                    )}
                  </ul>
                </div>

                <div className={styles.disagreementSection} data-testid={E2E_TESTIDS.COMPARE_DISAGREEMENTS}>
                  <h5>Disagreements</h5>
                  <ul className={styles.resultList}>
                    {bulletsLoading ? (
                      <li className={styles.resultItem}>
                        <FontAwesomeIcon icon={faSpinner} spin />
                        <span style={resolveCompareLoadingTextStyle()}>Loading...</span>
                      </li>
                    ) : (comparisonResult?.disagreements || []).length === 0 ? (
                      <li className={styles.resultEmpty}>No disagreements found yet.</li>
                    ) : (
                      (comparisonResult?.disagreements || []).map((pt, i) => (
                        <li
                          key={`dis-${i}`}
                          className={styles.resultItem}
                          onClick={() => toggleDrillDown('dis', i, pt, 'disagreement')}
                          style={resolveCompareClickableResultItemStyle()}
                        >
                          <span className={styles.resultPlus} aria-hidden="true">
                            <FontAwesomeIcon icon={faPlus} />
                          </span>
                          <span className={styles.resultText}>{pt}</span>
                          {drillState[`dis-${i}`]?.open && (
                            <div style={resolveCompareDrillBodyStyle()}>
                              {drillState[`dis-${i}`]?.loading && <span className={styles.drillSpinner}>Loading…</span>}
                              {drillState[`dis-${i}`]?.error && (
                                <span className={styles.comparisonError}>{drillState[`dis-${i}`].error}</span>
                              )}
                              {typeof drillState[`dis-${i}`]?.tree === 'object' &&
                                renderTree(drillState[`dis-${i}`]?.tree)}
                              {drillState[`dis-${i}`]?.text && (
                                <div className={styles.placeholderNote}>{drillState[`dis-${i}`]?.text}</div>
                              )}
                              {renderUnsureList(drillState[`dis-${i}`]?.unsureQuestions)}
                            </div>
                          )}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Collapse>
    </div>
  );
};

export function OpinionCompass2D({ users = [], labels = [], precomputed = null }: OpinionCompassProps) {
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  if (!users || users.length < 2) {
    return <div className={styles.placeholderNote}>Need at least 2 participants for the compass.</div>;
  }
  if (!precomputed || !Array.isArray(precomputed.points) || precomputed.points.length === 0) {
    return <div className={styles.placeholderNote}>No placement available.</div>;
  }

  // Compact chart to help fit on a single 1080p page
  const width = 420,
    height = 420,
    pad = 46;
  const cx = width / 2,
    cy = height / 2;
  const r = Math.min(width, height) / 2 - pad; // plotting radius
  const toX = (v: number) => cx + r * Number(v || 0);
  const toY = (v: number) => cy - r * Number(v || 0);
  const ticks = [-1, -0.5, 0, 0.5, 1];

  const colorFor = (i: number) => `hsl(${(i * 50) % 360}, 70%, 50%)`;

  const addrIdx = new Map((users || []).map((u, i) => [String(u?.address || '').toLowerCase(), i]));
  const pointsOrdered = precomputed.points
    .map((p) => ({ ...p, i: addrIdx.get(String(p.address || '').toLowerCase()) ?? -1 }))
    .filter((p) => p.i >= 0)
    .sort((a, b) => a.i - b.i);

  const formatAxisLabel = (axisName: string, rawLabel: unknown): string => {
    const label = String(rawLabel || '').trim();
    if (!label || label.toLowerCase() === axisName.toLowerCase()) return axisName;
    return `${axisName}: ${label}`;
  };
  const xLabel = formatAxisLabel('Axis 1', precomputed.axes?.[0]?.label);
  const yLabel = formatAxisLabel('Axis 2', precomputed.axes?.[1]?.label);
  const xDesc = precomputed.axes?.[0]?.description || 'First principal direction of encoded opinions.';
  const yDesc = precomputed.axes?.[1]?.description || 'Second principal direction of encoded opinions.';

  // PNG export of current SVG (reuse existing handler)
  const exportPNG = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const svg64 = btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    const vb =
      svg.viewBox && svg.viewBox.baseVal
        ? svg.viewBox.baseVal
        : { width: svg.clientWidth, height: svg.clientHeight, x: 0, y: 0 };
    const W = Math.max(1, vb.width);
    const H = Math.max(1, vb.height);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 2; // retina-ish export
      canvas.width = W * scale;
      canvas.height = H * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const a = document.createElement('a');
      a.download = COMPARE_GRAPHIC_FILENAME;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + svg64;
  };

  return (
    <>
      {/* Keep ONLY the compass legend (no Venn legend elsewhere) */}
      <div style={resolveCompareCompassLegendStyle()}>
        {users.map((u, i) => (
          <div
            key={String(u?.address || i)}
            className={styles.resultBadge}
            aria-label={`Legend item for ${labels[i] || `User ${i + 1}`}`}
          >
            <span style={resolveCompareCompassLegendSwatchStyle(colorFor(i))} />
            {labels[i] || `User ${i + 1}`}
          </div>
        ))}
      </div>
      <div className={styles.compassFigure}>
        <button
          type="button"
          className={styles.compassExportBtn}
          onClick={exportPNG}
          aria-label="Export PNG"
          title="Export PNG"
        >
          <FontAwesomeIcon icon={faDownload} />
        </button>

        <div style={resolveCompareCompassScrollStyle()}>
          <svg
            ref={svgRef}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="2D opinion compass plot"
          >
            {/* Background quadrants */}
            <rect x="0" y="0" width={width} height={height} fill="transparent" />
            <rect x={cx} y={cy} width={width - cx} height={height - cy} fill="rgba(255,255,255,0.04)" />
            <rect x={0} y={cy} width={cx} height={height - cy} fill="rgba(255,255,255,0.04)" />
            <rect x={0} y={0} width={cx} height={cy} fill="rgba(255,255,255,0.05)" />
            <rect x={cx} y={0} width={width - cx} height={cy} fill="rgba(255,255,255,0.05)" />

            {/* Subtle grid */}
            {ticks.map((t) => (
              <g key={`v-${t}`}>
                <line
                  x1={toX(t)}
                  y1={cy - r}
                  x2={toX(t)}
                  y2={cy + r}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="1"
                  strokeDasharray={t === 0 ? '0' : '3,4'}
                />
                <text x={toX(t)} y={cy + r + 16} fontSize="11" textAnchor="middle" fill="#fff" opacity="0.8">
                  {t}
                </text>
              </g>
            ))}
            {ticks.map((t) => (
              <g key={`h-${t}`}>
                <line
                  x1={cx - r}
                  y1={toY(t)}
                  x2={cx + r}
                  y2={toY(t)}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="1"
                  strokeDasharray={t === 0 ? '0' : '3,4'}
                />
                <text x={cx - r - 16} y={toY(t) + 4} fontSize="11" textAnchor="end" fill="#fff" opacity="0.8">
                  {t}
                </text>
              </g>
            ))}

            {/* Axes */}
            <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
            <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke="rgba(255,255,255,0.6)" strokeWidth="2" />

            {/* Axis labels (titles as tooltips) */}
            <text x={cx + r} y={cy + 30} fontSize="13" textAnchor="end" fill="#fff" opacity="0.95">
              <title>{xDesc}</title>
              {xLabel}
            </text>
            <text
              x={cx - 30}
              y={cy - r}
              fontSize="13"
              textAnchor="end"
              fill="#fff"
              opacity="0.95"
              transform={`rotate(-90 ${cx - 30},${cy - r})`}
            >
              <title>{yDesc}</title>
              {yLabel}
            </text>

            {/* Points + labels */}
            {pointsOrdered.map((p) => {
              const i = p.i;
              const px = toX(p.x);
              const py = toY(p.y);
              const color = colorFor(i);
              const label = labels[i] || `User ${i + 1}`;
              const dx = 8 + (i % 2) * 4;
              const dy = (i % 3) - 1; // -1,0,1
              return (
                <g key={`pt-${i}`} aria-label={`${label} at (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`}>
                  <circle cx={px} cy={py} r="5.5" fill={color} stroke="rgba(255,255,255,0.9)" strokeWidth="1" />
                  <title>{`${label} • x=${p.x.toFixed(2)}, y=${p.y.toFixed(2)}`}</title>
                  <text x={px + dx} y={py + dy * 3} fontSize="12" fill="#fff" opacity="0.95">
                    {label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </>
  );
}

export default CompareAddress;
