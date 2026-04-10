import React, { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBook,
  faBrain,
  faChartBar,
  faExternalLinkAlt,
  faFileAlt,
  faGavel,
  faLink,
  faMicrophone,
} from '@fortawesome/free-solid-svg-icons';
import { faGithub, faTwitter } from '@fortawesome/free-brands-svg-icons';

import corpusSample from '../../variables/demo/corpus_sample.json';
import styles from './CorpusViewer.module.scss';
import ArxivCard from './ArxivCard.jsx';
import InsiderCard from './InsiderCard.jsx';
import TagModal from '../TagPage/TagModal.jsx';
import WorldResultsMap from './DemoAnalysis/WorldResultsMap.jsx';
import PolicyGlobe, {
  getPolicyJurisdictionAnchor,
  getJurisdictionFlag,
  POLICY_FILTERS,
  getPolicyStatusGroup,
  getPolicyStatusLabel,
} from './PolicyGlobe.jsx';
import policyStyles from './PolicyGlobe.module.scss';
import TweetCard, { DebateMapSection, ExternalSourceLink } from './TweetCard.jsx';

// Hidden tabs — restore by adding 'cross_corpus' or 'lesswrong_posts' back to this array
const CORPUS_ORDER = [
  'tweets',
  'ai_laws_policy',
  'arxiv_ai_safety',
  'dwarkesh_lab_insiders',
  'ai_scifi_books',
  'metr_evals_metrics',
];

const ICONS = {
  bird: faTwitter,
  gavel: faGavel,
  'file-text': faFileAlt,
  brain: faBrain,
  mic: faMicrophone,
  book: faBook,
  chart: faChartBar,
  link: faLink,
};

const ICON_FALLBACKS = {
  bird: '🐦',
  gavel: '⚖️',
  'file-text': '📄',
  brain: '🧠',
  mic: '🎙️',
  book: '📚',
  chart: '📊',
  link: '🔗',
};

const TAB_LABELS = {
  tweets: 'Tweets',
  ai_laws_policy: 'Laws & Policy',
  arxiv_ai_safety: 'Papers',
  lesswrong_posts: 'LessWrong',
  dwarkesh_lab_insiders: 'Insider Interviews',
  ai_scifi_books: 'Sci-Fi',
  metr_evals_metrics: 'Metrics',
  cross_corpus: 'Cross-Corpus',
};

const POLICY_ANCHOR_TO_ISO_A3 = Object.freeze({
  africa: ['ZAF', 'EGY', 'NGA', 'KEN', 'ETH'],
  asean: ['IDN', 'MYS', 'PHL', 'SGP', 'THA', 'VNM'],
  australia: ['AUS'],
  brazil: ['BRA'],
  canada: ['CAN'],
  china: ['CHN'],
  eu: ['FRA', 'DEU', 'ITA', 'POL', 'ESP', 'NLD', 'BEL', 'IRL', 'AUT', 'SWE', 'DNK', 'FIN', 'GRC', 'PRT', 'ROU', 'CZE', 'HUN'],
  india: ['IND'],
  japan: ['JPN'],
  southKorea: ['KOR'],
  uk: ['GBR'],
  us: ['USA'],
});

const mergePolicyMapStatus = (currentStatus = '', nextStatus = '') => {
  if (!currentStatus) return nextStatus;
  if (!nextStatus || currentStatus === nextStatus) return currentStatus;
  return 'mixed';
};

const buildPolicyMapState = (entries = []) => {
  const mapData = {};
  let globalStatus = '';

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const statusGroup = getPolicyStatusGroup(entry);
    const anchor = getPolicyJurisdictionAnchor(entry?.jurisdiction);

    if (anchor === 'international') {
      globalStatus = mergePolicyMapStatus(globalStatus, statusGroup);
      return;
    }

    (POLICY_ANCHOR_TO_ISO_A3[anchor] || []).forEach((isoCode) => {
      mapData[isoCode] = mergePolicyMapStatus(mapData[isoCode], statusGroup);
    });
  });

  return { globalStatus, mapData };
};

const getPolicyMapFill = (status = '', isFallback = false) => {
  switch (status) {
    case 'live':
      return isFallback ? 'rgba(77,255,164,0.16)' : 'rgba(77,255,164,0.56)';
    case 'proposed':
      return isFallback ? 'rgba(255,179,71,0.16)' : 'rgba(255,179,71,0.56)';
    case 'inactive':
      return isFallback ? 'rgba(255,122,158,0.16)' : 'rgba(255,122,158,0.52)';
    case 'mixed':
      return isFallback ? 'rgba(122,140,255,0.16)' : 'rgba(122,140,255,0.52)';
    default:
      return 'rgba(226,232,255,0.06)';
  }
};

const buildPolicyMapSubtitle = ({ filterStatus, filteredEntries, globalStatus }) => {
  const count = Array.isArray(filteredEntries) ? filteredEntries.length : 0;

  if (count === 0) {
    return filterStatus === 'all'
      ? 'No policy entries are loaded for this corpus yet.'
      : `No ${filterStatus} policy entries are active in this corpus slice.`;
  }

  if (globalStatus) {
    return `${count} ${filterStatus === 'all' ? 'policy entries' : `${filterStatus} entries`} selected. International frameworks add a broader global glow.`;
  }

  return `${count} ${filterStatus === 'all' ? 'policy entries' : `${filterStatus} entries`} selected. Highlighted regions reflect the filtered laws.`;
};

const shouldUseHalfWidthGrid = (corpusKey = '') => (
  corpusKey === 'tweets' || corpusKey === 'arxiv_ai_safety'
);

const formatAuthors = (entry = {}) => {
  if (entry.author) return entry.author;
  if (!Array.isArray(entry.authors) || entry.authors.length === 0) return null;
  if (entry.authors.length === 1) return entry.authors[0];
  if (entry.authors.length === 2) return `${entry.authors[0]}, ${entry.authors[1]}`;
  return `${entry.authors[0]} +${entry.authors.length - 1}`;
};

const buildCorpusDefinitions = () => (
  CORPUS_ORDER
    .map((key) => {
      const corpus = corpusSample?.corpuses?.[key];
      if (!corpus) return null;
      const entries = Array.isArray(corpus.entries) ? corpus.entries : [];

      return {
        ...corpus,
        count_full: corpus.count_full,
        entries,
        key,
        tabLabel: TAB_LABELS[key] || corpus.label || key,
      };
    })
    .filter(Boolean)
);

const getEntryYear = (entry = {}) => {
  if (entry.year) return entry.year;
  const datedValue = entry.date || entry.date_enacted || entry.created_at;
  if (!datedValue) return null;
  const date = new Date(datedValue);
  return Number.isNaN(date.getTime()) ? null : date.getFullYear();
};

const renderCorpusIcon = (iconKey) => {
  const iconDefinition = ICONS[iconKey];
  if (iconDefinition) {
    return <FontAwesomeIcon icon={iconDefinition} />;
  }
  return <span>{ICON_FALLBACKS[iconKey] || '•'}</span>;
};

const buildNonTweetMeta = (corpusKey, entry = {}) => {
  const bits = [];
  const authorText = formatAuthors(entry);
  const year = getEntryYear(entry);

  if (authorText) bits.push(authorText);
  if (year) bits.push(year);
  if (entry.jurisdiction && corpusKey !== 'ai_laws_policy') bits.push(entry.jurisdiction);
  if (entry.venue) bits.push(entry.venue);
  if (entry.interviewer) bits.push(`with ${entry.interviewer}`);
  if (entry.category) bits.push(entry.category);

  return bits;
};

const EntryCard = ({ corpusKey, entry, onTagClick, onAtlasIssueOpen }) => {
  const isPolicyCorpus = corpusKey === 'ai_laws_policy';
  const isMetrCorpus = corpusKey === 'metr_evals_metrics';
  const meta = buildNonTweetMeta(corpusKey, entry);
  const summaryText = entry.summary || '';
  const tags = Array.isArray(entry.tags) ? entry.tags : [];
  const policyStatusGroup = isPolicyCorpus ? getPolicyStatusGroup(entry) : null;
  const policyFlag = isPolicyCorpus ? getJurisdictionFlag(entry.jurisdiction) : null;
  const policyStatusLabel = isPolicyCorpus ? getPolicyStatusLabel(entry) : null;
  const policyStatusBadgeClassName = policyStatusGroup === POLICY_FILTERS.proposed
    ? policyStyles.statusProposed
    : policyStatusGroup === POLICY_FILTERS.inactive
      ? policyStyles.statusInactive
      : policyStyles.statusLive;
  const sourceLabel = isMetrCorpus ? 'Open full report' : 'View source';
  const cardClassName = `${styles.card} ${
    isPolicyCorpus ? policyStyles.policyCard : isMetrCorpus ? styles.metrCard : ''
  }`.trim();

  return (
    <article className={cardClassName}>
      <div className={styles.entryHeader}>
        <div className={styles.entryHeaderContent}>
          {isPolicyCorpus ? (
            <div className={policyStyles.policyTitleRow}>
              <span className={policyStyles.jurisdictionFlag} aria-hidden="true">
                {policyFlag}
              </span>
              <div className={styles.entryTitle}>
                {entry.title || entry.id || 'Untitled entry'}
              </div>
            </div>
          ) : (
            <div className={styles.entryTitle}>
              {entry.title || entry.id || 'Untitled entry'}
            </div>
          )}
          {meta.length > 0 && (
            <div className={styles.entryMeta}>
              {meta.join(' • ')}
            </div>
          )}
        </div>
        {isPolicyCorpus ? (
          <div className={policyStyles.policyBadgeRow}>
            <span
              className={`${policyStyles.statusBadge} ${policyStatusBadgeClassName}`.trim()}
            >
              {policyStatusLabel}
            </span>
            {entry.jurisdiction ? (
              <span className={`${styles.pill} ${styles.jurisdictionBadge}`}>
                {entry.jurisdiction}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {entry?.image_url ? (
        <div className={styles.entryMediaBlock}>
          {entry?.url ? (
            <a
              href={entry.url}
              rel="noopener noreferrer"
              target="_blank"
              className={styles.entryMediaLink}
            >
              <img
                src={entry.image_url}
                alt={entry.title || 'Explorer preview'}
                className={styles.entryMediaImage}
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </a>
          ) : (
            <img
              src={entry.image_url}
              alt={entry.title || 'Explorer preview'}
              className={styles.entryMediaImage}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          )}
        </div>
      ) : null}

      <div
        className={`${styles.entrySummary} ${styles.clamp3}`}
      >
        {summaryText}
      </div>

      <div className={styles.pillRow}>
        {tags.slice(0, 6).map((tag) => (
          <button
            key={tag}
            type="button"
            className={`${styles.pill} ${styles.pillButton}`}
            onClick={() => onTagClick?.(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className={styles.cardFooter}>
        <DebateMapSection entry={entry} onAtlasIssueOpen={onAtlasIssueOpen} />
        {entry?.url ? (
          <div className={styles.cardFooterLinks}>
            {isMetrCorpus ? (
              <a
                href={entry.url}
                rel="noopener noreferrer"
                target="_blank"
                className={styles.externalIconLink}
                aria-label={sourceLabel}
                title={sourceLabel}
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} />
              </a>
            ) : (
              <ExternalSourceLink entry={entry} fallbackLabel={sourceLabel} />
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
};

const EmptyCorpusState = ({ corpus, title, text }) => (
  <div className={styles.emptyState}>
    <div className={styles.emptyStateIcon}>
      {renderCorpusIcon(corpus.icon)}
    </div>
    <div className={styles.emptyStateTitle}>
      {title || corpus.label}
    </div>
    <div className={styles.emptyStateText}>
      {text || 'No demo entries are loaded for this tab yet. The tab is wired and ready for cross-corpus debate material.'}
    </div>
  </div>
);

const CorpusViewer = ({ onAtlasIssueOpen = null, showGithubLink = true }) => {
  const corpusDefinitions = useMemo(() => buildCorpusDefinitions(), []);

  const [activeCorpusKey, setActiveCorpusKey] = useState(corpusDefinitions[0]?.key || 'tweets');
  const [activeTag, setActiveTag] = useState(null);

  const activeCorpus = corpusDefinitions.find((corpus) => corpus.key === activeCorpusKey) || corpusDefinitions[0];

  if (!activeCorpus) return null;

  const renderEntries = (entries) => (
    entries.filter(Boolean).map((entry, index) => {
      const key = entry.id || entry.url || `${activeCorpus.key}-${index}`;
      return activeCorpus.key === 'tweets' ? (
        <TweetCard key={key} entry={entry} onTagClick={setActiveTag} onAtlasIssueOpen={onAtlasIssueOpen} />
      ) : activeCorpus.key === 'arxiv_ai_safety' ? (
        <ArxivCard key={key} entry={entry} onTagClick={setActiveTag} onAtlasIssueOpen={onAtlasIssueOpen} />
      ) : activeCorpus.key === 'dwarkesh_lab_insiders' ? (
        <InsiderCard key={key} entry={entry} onTagClick={setActiveTag} onAtlasIssueOpen={onAtlasIssueOpen} />
      ) : (
        <EntryCard
          key={key}
          corpusKey={activeCorpus.key}
          entry={entry}
          onTagClick={setActiveTag}
          onAtlasIssueOpen={onAtlasIssueOpen}
        />
      );
    })
  );

  const renderEntriesCollection = (entries) => (
    <div className={`${styles.entriesCollection} ${shouldUseHalfWidthGrid(activeCorpus.key) ? styles.entriesCollectionHalf : ''}`.trim()}>
      {renderEntries(entries)}
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.tabBar}>
        {corpusDefinitions.map((corpus) => {
          const isActive = corpus.key === activeCorpus.key;

          return (
            <button
              key={corpus.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveCorpusKey(corpus.key)}
              className={`${styles.tabButton} ${isActive ? styles.tabButtonActive : ''}`.trim()}
            >
              <span className={`${styles.tabIcon} ${isActive ? styles.tabIconActive : ''}`.trim()}>
                {renderCorpusIcon(corpus.icon)}
              </span>
              <span className={styles.tabLabel}>
                {corpus.tabLabel}
              </span>
            </button>
          );
        })}
      </div>

      {showGithubLink ? (
        <div className={styles.sectionBlock}>
          <a
            href="https://github.com/xoCortex/context-engine/tree/main/client/src/variables/demo"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.githubLink}
          >
            <FontAwesomeIcon className={styles.githubLinkIcon} icon={faGithub} />
            <span>Full corpus on GitHub</span>
          </a>
        </div>
      ) : null}

      <div className={styles.scrollArea}>
        {activeCorpus.key === 'ai_laws_policy' ? (
          <PolicyGlobe entries={activeCorpus.entries}>
            {({ filteredEntries, filterStatus, FilterControlsElement }) => (
              <div className={styles.policySplitLayout} data-testid="ce-policy-split-layout">
                <div className={styles.policyListColumn}>
                  <div className={styles.policyListHeader}>
                    <div>
                      <div className={styles.policyListEyebrow}>Filter By</div>
                      <div className={styles.policyListTitle}>AI laws & policy</div>
                    </div>
                    {FilterControlsElement}
                  </div>
                  {filteredEntries.length === 0 ? (
                    <EmptyCorpusState
                      corpus={activeCorpus}
                      title="No matching policy entries"
                      text={
                        filterStatus === 'all'
                          ? 'No policy entries are loaded for this demo corpus yet.'
                          : `No ${filterStatus} policy entries match the current filter.`
                      }
                    />
                  ) : (
                    <div className={styles.policyEntriesList}>
                      {renderEntriesCollection(filteredEntries)}
                    </div>
                  )}
                </div>

                <aside className={styles.policyMapColumn}>
                  {(() => {
                    const { globalStatus, mapData } = buildPolicyMapState(filteredEntries);

                    return (
                      <div className={styles.policyMapPanel}>
                        <div className={styles.policyMapLens}>
                          <WorldResultsMap
                            data={mapData}
                            colorScale={(regionStatus) => getPolicyMapFill(regionStatus || globalStatus, !regionStatus)}
                            compact
                          />
                        </div>
                        <div className={styles.policyMapAssistiveText}>
                          {buildPolicyMapSubtitle({
                            filterStatus,
                            filteredEntries,
                            globalStatus,
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </aside>
              </div>
            )}
          </PolicyGlobe>
        ) : activeCorpus.entries.length === 0 ? (
          <EmptyCorpusState corpus={activeCorpus} />
        ) : (
          renderEntriesCollection(activeCorpus.entries)
        )}
      </div>

      <TagModal
        isOpen={!!activeTag}
        toggle={() => setActiveTag(null)}
        activeTag={activeTag}
      />
    </div>
  );
};

export default CorpusViewer;
