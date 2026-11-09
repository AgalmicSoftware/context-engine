import React, { useId, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';

import type { DebateComment } from './debateMapTypes';
import styles from './DebateMap.module.scss';

// A tweet's length, so the lead can be taken in at a glance.
export const SUMMARY_LEAD_CHARS = 280;

// A sentence ends at its punctuation and any closing quote or bracket, before a
// space or the end of the text.
const SENTENCE_END = /[.!?]+["'”’)\]]*(?=\s|$)/g;
// A full stop after a lone letter abbreviates, as in "e.g." or "U.S."; it ends no sentence.
const ABBREVIATED = /(?:^|[\s.])[A-Za-z]$/;
// A lead shorter than this says too little; the first words up to the limit say more.
const SHORTEST_LEAD = 80;

// The start of the summary: the most whole sentences that fit, or else its first
// words. Always a prefix, so the lead never starts mid-sentence.
export const shortenSummary = (text: string): string => {
  const clean = text.trim();
  if (clean.length <= SUMMARY_LEAD_CHARS) return clean;
  let end = 0;
  for (const match of clean.matchAll(SENTENCE_END)) {
    const stop = (match.index ?? 0) + match[0].length;
    if (stop > SUMMARY_LEAD_CHARS) break;
    if (match[0].startsWith('.') && ABBREVIATED.test(clean.slice(0, match.index))) continue;
    end = stop;
  }
  if (end >= SHORTEST_LEAD) return clean.slice(0, end);
  const cut = clean.slice(0, SUMMARY_LEAD_CHARS - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : cut.length)}…`;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

type Props = {
  entries: DebateComment[];
};

// The AI's summary of a node: a short lead, then on request the whole summary
// and each position, with how many participants hold it.
export default function DebateMapGeneratedSummary({ entries }: Props) {
  const [open, setOpen] = useState(false);
  const detailsId = `generated-summary-${useId().replace(/:/g, '')}`;
  const summary = String(entries.find((entry) => !entry.label)?.comment || '').trim();
  const positions = entries.filter((entry) => String(entry.label || '').trim());
  const lead = shortenSummary(summary);
  const hasMore = positions.length > 0 || lead !== summary;

  return (
    <section className={styles.generatedSummarySection} aria-label="AI-generated summary">
      <div className={styles.generatedSummaryEyebrow}>AI-generated summary</div>
      <div id={detailsId}>
        {summary && <p className={styles.generatedSummaryLead}>{open ? summary : lead}</p>}
        {open && positions.length > 0 && (
          <ul className={styles.generatedSummaryPositions}>
            {positions.map((position, index) => {
              const count = Number(position.participantCount) || 0;
              const total = Number(position.participantTotal) || 0;
              const share = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;
              return (
                <li key={String(position.id || index)} className={styles.generatedSummaryPosition}>
                  <div className={styles.generatedSummaryPositionHeader}>
                    <strong>{String(position.label)}</strong>
                    <span className={styles.generatedSummaryCount}>
                      {total > 0 ? `${count} of ${plural(total, 'participant')}` : plural(count, 'participant')}
                    </span>
                  </div>
                  {total > 0 && (
                    <div className={styles.generatedSummaryShare} aria-hidden="true">
                      <span style={{ width: `${share}%` }} />
                    </div>
                  )}
                  {String(position.comment || '').trim() && <p>{String(position.comment)}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {hasMore && (
        <button
          type="button"
          className={styles.generatedSummaryToggle}
          data-ce-control-appearance="frameless"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Show less' : 'Show more'}{' '}
          <FontAwesomeIcon icon={open ? faCaretUp : faCaretDown} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
