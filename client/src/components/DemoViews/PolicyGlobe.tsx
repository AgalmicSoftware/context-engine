import React, { useMemo, useState } from 'react';

import styles from './PolicyGlobe.module.scss';

export const POLICY_FILTERS = {
  live: 'live',
  proposed: 'proposed',
  inactive: 'inactive',
  all: 'all',
} as const;

export type PolicyFilterId = (typeof POLICY_FILTERS)[keyof typeof POLICY_FILTERS];

export type PolicyEntry = {
  id?: string | number;
  title?: string;
  status?: string;
  jurisdiction?: string;
  date_enacted?: string | number;
  date?: string | number;
  created_at?: string | number;
  updated_at?: string | number;
  year?: string | number;
  [key: string]: unknown;
};

type JurisdictionAnchor =
  | 'us'
  | 'canada'
  | 'uk'
  | 'eu'
  | 'china'
  | 'southKorea'
  | 'japan'
  | 'india'
  | 'australia'
  | 'brazil'
  | 'asean'
  | 'africa'
  | 'international';

type JurisdictionRule = {
  anchor: JurisdictionAnchor;
  flag: string;
  patterns: RegExp[];
};

type GlobeCoordinates = {
  x: number;
  y: number;
};

export type PolicyGlobeRenderProps = {
  filteredEntries: PolicyEntry[];
  filterStatus: PolicyFilterId;
  setFilterStatus: React.Dispatch<React.SetStateAction<PolicyFilterId>>;
  GlobeElement: React.ReactNode;
  FilterControlsElement: React.ReactNode;
};

export type PolicyGlobeProps = {
  entries?: PolicyEntry[];
  children?: React.ReactNode | ((props: PolicyGlobeRenderProps) => React.ReactNode);
};

const FILTER_OPTIONS: Array<{ id: PolicyFilterId; label: string }> = [
  { id: POLICY_FILTERS.live, label: 'Live' },
  { id: POLICY_FILTERS.proposed, label: 'Proposed' },
  { id: POLICY_FILTERS.inactive, label: 'Inactive' },
  { id: POLICY_FILTERS.all, label: 'All' },
];

const FILTER_STYLE_CLASS_BY_ID: Record<PolicyFilterId, string> = {
  [POLICY_FILTERS.live]: styles.filterButtonLiveOption,
  [POLICY_FILTERS.proposed]: styles.filterButtonProposedOption,
  [POLICY_FILTERS.inactive]: styles.filterButtonInactiveOption,
  [POLICY_FILTERS.all]: styles.filterButtonAllOption,
};

const FILTER_SWATCH_CLASS_BY_ID: Record<PolicyFilterId, string> = {
  [POLICY_FILTERS.live]: styles.filterSwatchLive,
  [POLICY_FILTERS.proposed]: styles.filterSwatchProposed,
  [POLICY_FILTERS.inactive]: styles.filterSwatchInactive,
  [POLICY_FILTERS.all]: styles.filterSwatchAll,
};

const LIVE_STATUS_MATCHERS = [
  'live',
  'enacted',
  'active',
  'adopted',
  'approved',
  'effective',
  'implemented',
  'in force',
  'framework',
  'voluntary',
  'guidance',
  'guideline',
];

const PROPOSED_STATUS_MATCHERS = [
  'proposed',
  'pending',
  'draft',
  'bill',
  'committee',
  'consultation',
  'under review',
  'planned',
];

const INACTIVE_STATUS_MATCHERS = ['vetoed', 'withdrawn', 'rejected', 'failed', 'expired'];

const JURISDICTION_RULES: JurisdictionRule[] = [
  {
    anchor: 'us',
    flag: '🇺🇸',
    patterns: [/\bunited states\b/, /\busa\b/, /\bu\.s\.\b/, /\bus\b/],
  },
  {
    anchor: 'canada',
    flag: '🇨🇦',
    patterns: [/\bcanada\b/],
  },
  {
    anchor: 'uk',
    flag: '🇬🇧',
    patterns: [/\bunited kingdom\b/, /\bbritain\b/, /\buk\b/, /\bgreat britain\b/],
  },
  {
    anchor: 'eu',
    flag: '🇪🇺',
    patterns: [/\beuropean union\b/, /\beu\b/, /\bcouncil of europe\b/],
  },
  {
    anchor: 'china',
    flag: '🇨🇳',
    patterns: [/\bchina\b/, /\bhong kong\b/],
  },
  {
    anchor: 'southKorea',
    flag: '🇰🇷',
    patterns: [/\bsouth korea\b/, /\brepublic of korea\b/],
  },
  {
    anchor: 'japan',
    flag: '🇯🇵',
    patterns: [/\bjapan\b/],
  },
  {
    anchor: 'india',
    flag: '🇮🇳',
    patterns: [/\bindia\b/],
  },
  {
    anchor: 'australia',
    flag: '🇦🇺',
    patterns: [/\baustralia\b/],
  },
  {
    anchor: 'brazil',
    flag: '🇧🇷',
    patterns: [/\bbrazil\b/],
  },
  {
    anchor: 'asean',
    flag: '🌐',
    patterns: [/\basean\b/],
  },
  {
    anchor: 'africa',
    flag: '🌐',
    patterns: [/\bafrican union\b/],
  },
  {
    anchor: 'international',
    flag: '🌐',
    patterns: [
      /\binternational\b/,
      /\bmulti-national\b/,
      /\bmultinational\b/,
      /\bunited nations\b/,
      /\bunesco\b/,
      /\bwipo\b/,
      /\bg7\b/,
      /\bg20\b/,
      /\boecd\b/,
      /\bibero-american\b/,
      /\bglobal\b/,
      /\bworld\b/,
    ],
  },
];

const GLOBE_COORDINATES: Record<JurisdictionAnchor, GlobeCoordinates> = {
  us: { x: -54, y: -12 },
  canada: { x: -60, y: -36 },
  uk: { x: -18, y: -36 },
  eu: { x: -2, y: -28 },
  china: { x: 48, y: -10 },
  southKorea: { x: 58, y: -2 },
  japan: { x: 68, y: -8 },
  india: { x: 32, y: 16 },
  australia: { x: 58, y: 54 },
  brazil: { x: -26, y: 40 },
  asean: { x: 42, y: 16 },
  africa: { x: 4, y: 18 },
  international: { x: 0, y: 2 },
};

const normalizeText = (value: string | number = '') => String(value).trim().toLowerCase();
const normalizePolicyStatus = (value: string | number = '') => normalizeText(value).replace(/[_-]+/g, ' ');

const matchesPattern = (value: string, patterns: RegExp[] = []) => patterns.some((pattern) => pattern.test(value));

const getJurisdictionRule = (jurisdiction: string | number = ''): JurisdictionRule => {
  const normalizedJurisdiction = normalizeText(jurisdiction);
  return (
    JURISDICTION_RULES.find((rule) => matchesPattern(normalizedJurisdiction, rule.patterns)) || {
      anchor: 'international',
      flag: '🌐',
      patterns: [],
    }
  );
};

export const getPolicyJurisdictionAnchor = (jurisdiction: string | number = '') =>
  getJurisdictionRule(jurisdiction).anchor;

const getPolicyTimestamp = (entry: PolicyEntry = {}) => {
  const datedValue = entry.date_enacted || entry.date || entry.created_at || entry.updated_at || entry.year;

  if (!datedValue) return Number.NEGATIVE_INFINITY;
  if (typeof datedValue === 'number') {
    const normalizedYear = String(datedValue).length === 4 ? Date.parse(`${datedValue}-01-01T00:00:00Z`) : datedValue;
    return Number.isNaN(normalizedYear) ? Number.NEGATIVE_INFINITY : normalizedYear;
  }

  const parsedTimestamp = Date.parse(String(datedValue));
  if (!Number.isNaN(parsedTimestamp)) return parsedTimestamp;

  const yearMatch = String(datedValue).match(/\b(19|20)\d{2}\b/);
  if (!yearMatch) return Number.NEGATIVE_INFINITY;

  const fallbackTimestamp = Date.parse(`${yearMatch[0]}-01-01T00:00:00Z`);
  return Number.isNaN(fallbackTimestamp) ? Number.NEGATIVE_INFINITY : fallbackTimestamp;
};

export const getPolicyStatusGroup = (entry: PolicyEntry = {}): PolicyFilterId => {
  const normalizedStatus = normalizePolicyStatus(entry.status);

  if (INACTIVE_STATUS_MATCHERS.some((status) => normalizedStatus.includes(status))) {
    return POLICY_FILTERS.inactive;
  }

  if (PROPOSED_STATUS_MATCHERS.some((status) => normalizedStatus.includes(status))) {
    return POLICY_FILTERS.proposed;
  }

  if (LIVE_STATUS_MATCHERS.some((status) => normalizedStatus.includes(status))) {
    return POLICY_FILTERS.live;
  }

  if (entry.date_enacted) return POLICY_FILTERS.live;

  return POLICY_FILTERS.live;
};

const getPolicySortRank = (entry: PolicyEntry = {}) => {
  const statusGroup = getPolicyStatusGroup(entry);

  if (statusGroup === POLICY_FILTERS.live) return 0;
  if (statusGroup === POLICY_FILTERS.proposed) return 1;
  if (statusGroup === POLICY_FILTERS.inactive) return 2;
  return 3;
};

const formatStatusLabel = (status: string | number = '') => {
  const cleanedStatus = String(status || '').trim();
  if (!cleanedStatus) return '';

  return cleanedStatus
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

export const getPolicyStatusLabel = (entry: PolicyEntry = {}) => {
  const normalizedStatus = formatStatusLabel(entry.status);

  if (normalizedStatus) return normalizedStatus;
  return getPolicyStatusGroup(entry) === POLICY_FILTERS.proposed ? 'Proposed' : 'Live';
};

const getPolicyDotOffset = (statusGroup: PolicyFilterId): GlobeCoordinates => {
  if (statusGroup === POLICY_FILTERS.proposed) return { x: 8, y: 6 };
  if (statusGroup === POLICY_FILTERS.inactive) return { x: -8, y: 6 };
  return { x: 0, y: 0 };
};

const getPolicyGroupTitle = (statusGroup: PolicyFilterId) => {
  if (statusGroup === POLICY_FILTERS.proposed) return 'Proposed / Pending';
  if (statusGroup === POLICY_FILTERS.inactive) return 'Inactive / Blocked';
  return 'Live / Enacted';
};

export const getJurisdictionFlag = (jurisdiction: string | number = '') => getJurisdictionRule(jurisdiction).flag;

export const sortPolicyEntries = (entries: PolicyEntry[] = []) =>
  [...entries].sort((entryA, entryB) => {
    const sortRankDifference = getPolicySortRank(entryA) - getPolicySortRank(entryB);
    if (sortRankDifference !== 0) return sortRankDifference;

    const timestampDifference = getPolicyTimestamp(entryB) - getPolicyTimestamp(entryA);
    if (timestampDifference !== 0) return timestampDifference;

    return String(entryA.title || entryA.id || '').localeCompare(String(entryB.title || entryB.id || ''));
  });

type GlobeDot = {
  key: string;
  group: PolicyFilterId;
  labels: string[];
  x: number;
  y: number;
};

const buildGlobeDots = (entries: PolicyEntry[] = []) => {
  const dotsByKey = new Map<string, GlobeDot>();

  entries.forEach((entry) => {
    const statusGroup = getPolicyStatusGroup(entry);
    const jurisdictionRule = getJurisdictionRule(entry.jurisdiction);
    const baseCoordinates = GLOBE_COORDINATES[jurisdictionRule.anchor] || GLOBE_COORDINATES.international;
    const positionOffset = getPolicyDotOffset(statusGroup);
    const dotKey = `${jurisdictionRule.anchor}-${statusGroup}`;
    const label = entry.jurisdiction || 'International';

    if (!dotsByKey.has(dotKey)) {
      dotsByKey.set(dotKey, {
        key: dotKey,
        group: statusGroup,
        labels: [label],
        x: baseCoordinates.x + positionOffset.x,
        y: baseCoordinates.y + positionOffset.y,
      });
      return;
    }

    const dot = dotsByKey.get(dotKey);
    if (dot) dot.labels.push(String(label));
  });

  return Array.from(dotsByKey.values()).map((dot) => ({
    ...dot,
    title: `${Array.from(new Set(dot.labels)).join(', ')} • ${getPolicyGroupTitle(dot.group)}`,
  }));
};

const PolicyGlobe = ({ entries = [], children }: PolicyGlobeProps) => {
  const [filterStatus, setFilterStatus] = useState<PolicyFilterId>(POLICY_FILTERS.all);

  const sortedEntries = useMemo(() => sortPolicyEntries(entries), [entries]);

  const filteredEntries = useMemo(() => {
    if (filterStatus === POLICY_FILTERS.all) return sortedEntries;
    return sortedEntries.filter((entry) => getPolicyStatusGroup(entry) === filterStatus);
  }, [filterStatus, sortedEntries]);

  const globeDots = useMemo(() => buildGlobeDots(filteredEntries), [filteredEntries]);

  const FilterControlsElement = (
    <div className={styles.filterRow} data-testid="ce-policy-filter-row" role="group" aria-label="Policy status filter">
      {FILTER_OPTIONS.map((option) => {
        const isActive = option.id === filterStatus;

        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={isActive}
            data-testid={`ce-policy-filter-${option.id}`}
            className={`${styles.filterButton} ${FILTER_STYLE_CLASS_BY_ID[option.id] || ''} ${isActive ? styles.filterButtonActive : ''}`.trim()}
            onClick={() => setFilterStatus(option.id)}
          >
            <span
              className={`${styles.filterSwatch} ${FILTER_SWATCH_CLASS_BY_ID[option.id] || ''}`.trim()}
              aria-hidden="true"
            />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );

  const GlobeElement = (
    <section className={styles.globeWrapper} data-testid="ce-policy-globe" aria-label="Policy status globe">
      {FilterControlsElement}

      <div className={styles.globe} aria-hidden="true">
        <span className={`${styles.globeRing} ${styles.globeRingMeridian}`.trim()} />
        <span className={`${styles.globeRing} ${styles.globeRingMeridianWide}`.trim()} />
        <span className={`${styles.globeRing} ${styles.globeRingLatitude}`.trim()} />
        <span className={`${styles.globeRing} ${styles.globeRingLatitudeLow}`.trim()} />

        {globeDots.map((dot) => (
          <span
            key={dot.key}
            className={`${styles.dot} ${
              dot.group === POLICY_FILTERS.proposed
                ? styles.dotAmber
                : dot.group === POLICY_FILTERS.inactive
                  ? styles.dotRose
                  : styles.dotGreen
            }`.trim()}
            style={{ transform: `translate(-50%, -50%) translate(${dot.x}px, ${dot.y}px)` }}
            title={dot.title}
          />
        ))}
      </div>
    </section>
  );

  if (typeof children === 'function') {
    return children({
      filteredEntries,
      filterStatus,
      setFilterStatus,
      GlobeElement,
      FilterControlsElement,
    });
  }

  return GlobeElement;
};

export default PolicyGlobe;
