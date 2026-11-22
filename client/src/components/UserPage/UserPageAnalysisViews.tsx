import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { UncontrolledTooltip } from 'reactstrap';

import type { UserAnalysisBreakdown } from 'utilities/ai/userAnalysisBreakdown';
import type { AnalysisCard } from 'utilities/analysisCard/analysisCardModel';
import { formatSavedAnalysisCardDate } from 'utilities/analysisCard/analysisCardSaved';

import styles from './UserPage.module.scss';
import cardStyles from './UserPageAnalysisCard.module.scss';
import viewStyles from './UserPageAnalysisViews.module.scss';
import UserPageAnalysisCard, { type UserPageAnalysisCardPicture } from './UserPageAnalysisCard';
import UserPageAnalysisCardSkeleton from './UserPageAnalysisCardSkeleton';
import type { UserAnalysisGeneration } from './userPageAnalysisStateHelpers';

// On my own page: whether my card is shown on it, while a change is being saved, and why one failed.
export type UserPageAnalysisCardPublish = { shown: boolean; saving: boolean; note: string };

export type UserPageAnalysisViewsProps = {
  aiAnalysis?: React.ReactNode;
  analysisBreakdown?: UserAnalysisBreakdown | null;
  analysisCard?: AnalysisCard | null;
  analysisCardPending?: boolean;
  analysisCardPicture?: UserPageAnalysisCardPicture | null;
  analysisCardPublish?: UserPageAnalysisCardPublish | null;
  analysisCardSavedAt?: number | null;
  analysisDetails?: React.ReactNode;
  analysisGeneration?: UserAnalysisGeneration | null;
  analysisHistoricalFigure?: React.ReactNode;
  analysisHistoricalReasoning?: React.ReactNode;
  analysisName?: React.ReactNode;
  onAnalysisCardShownChange?: (shown: boolean) => void;
};

type View = 'text' | 'breakdown' | 'card';
const VIEW_LABELS: ReadonlyArray<[View, string]> = [
  ['text', 'Text'],
  ['breakdown', 'Breakdown'],
  ['card', 'Card'],
];
// The Text view says what the Breakdown says, so its button is there only for those who ask for it under Options.
// The choice is kept in this browser; where storage is shut it is kept here, for this visit.
const TEXT_VIEW_KEY = 'ce-analysis-text-view';
let textViewThisVisit = false;
const readTextView = (): boolean => {
  try {
    return window.localStorage.getItem(TEXT_VIEW_KEY) === '1';
  } catch {
    return textViewThisVisit;
  }
};
const keepTextView = (shown: boolean): void => {
  try {
    if (shown) window.localStorage.setItem(TEXT_VIEW_KEY, '1');
    else window.localStorage.removeItem(TEXT_VIEW_KEY);
  } catch {
    textViewThisVisit = shown;
  }
};

const BREAKDOWN_LINES: ReadonlyArray<[keyof UserAnalysisBreakdown, string]> = [
  ['holds', 'Holds most strongly'],
  ['openTo', 'Open to'],
  ['unsure', 'Least sure about'],
];

// The historical figure and why, written as the analysis writes it: a tinted box in the Text view, a panel in
// the Breakdown.
const HistoricalAlignment = ({
  figure,
  panel = false,
  reasoning,
}: {
  figure: React.ReactNode;
  panel?: boolean;
  reasoning: React.ReactNode;
}) =>
  figure || reasoning ? (
    <div className={panel ? viewStyles.panel : styles.historicalAlignment}>
      {panel ? <h5 className={viewStyles.label}>Historical Alignment</h5> : <h4>Historical Alignment</h4>}
      {figure ? <p className={panel ? viewStyles.figure : undefined}>{figure}</p> : null}
      {reasoning ? <p className={panel ? undefined : styles.placeholderNote}>{reasoning}</p> : null}
    </div>
  ) : null;

/**
 * One analysis, three ways to read it. The picture card is the third view, there only where the session makes
 * one: on my own page it shows nowhere else, and its "Show this card on my page" box sits with it.
 */
const UserPageAnalysisViews = ({
  aiAnalysis,
  analysisBreakdown = null,
  analysisCard = null,
  analysisCardPending = false,
  analysisCardPicture = null,
  analysisCardPublish = null,
  analysisCardSavedAt = null,
  analysisDetails,
  analysisGeneration,
  analysisHistoricalFigure,
  analysisHistoricalReasoning,
  analysisName,
  onAnalysisCardShownChange,
}: UserPageAnalysisViewsProps): React.ReactElement => {
  const hasCard = !!(analysisCard || analysisCardPending);
  const [chosen, setChosen] = useState<View>('breakdown');
  const [textView, setTextView] = useState(readTextView);
  // A card that is taken away (the session turned it off), or a Text view put away under Options, leaves the
  // Breakdown, not an empty view.
  const view = (chosen === 'card' && !hasCard) || (chosen === 'text' && !textView) ? 'breakdown' : chosen;
  const views = VIEW_LABELS.filter(([id]) => (id !== 'card' || hasCard) && (id !== 'text' || textView));
  const lines = BREAKDOWN_LINES.filter(([key]) => analysisBreakdown?.[key]);
  return (
    <>
      {views.length > 1 ? (
        <div className={viewStyles.switch} role="group" aria-label="How to show the analysis">
          {views.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={viewStyles.switchButton}
              aria-pressed={view === id}
              onClick={() => setChosen(id)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {view === 'text' && (
        <>
          {analysisName ? <h4 className={viewStyles.name}>{analysisName}</h4> : null}
          <p className={styles.placeholderNote}>{aiAnalysis}</p>
          {analysisDetails ? <p className={styles.analysisDetails}>{analysisDetails}</p> : null}
          <HistoricalAlignment figure={analysisHistoricalFigure} reasoning={analysisHistoricalReasoning} />
        </>
      )}

      {view === 'breakdown' && (
        <>
          <div className={viewStyles.banner}>
            {analysisName ? <h4 className={viewStyles.name}>{analysisName}</h4> : null}
            <p>{aiAnalysis}</p>
            {analysisDetails ? <p>{analysisDetails}</p> : null}
          </div>
          {lines.length > 0 && (
            <div className={viewStyles.lines}>
              {lines.map(([key, label]) => (
                <div key={key} className={viewStyles.panel}>
                  <h5 className={viewStyles.label}>{label}</h5>
                  <p>{analysisBreakdown?.[key]}</p>
                </div>
              ))}
            </div>
          )}
          <div className={viewStyles.pair}>
            {analysisBreakdown?.ownWords ? (
              <figure className={viewStyles.panel}>
                <figcaption className={viewStyles.label}>Own words</figcaption>
                <blockquote className={viewStyles.quote}>“{analysisBreakdown.ownWords}”</blockquote>
              </figure>
            ) : null}
            <HistoricalAlignment panel figure={analysisHistoricalFigure} reasoning={analysisHistoricalReasoning} />
          </div>
        </>
      )}

      {/* Once there is a card it is drawn in every view, out of sight outside its own: drawing it is what gives the
          saved card its picture, and that must not wait for the Card button to be pressed. */}
      {analysisCard ? (
        <div hidden={view !== 'card'}>
          <UserPageAnalysisCard card={analysisCard} picture={analysisCardPicture} />
          {analysisCardSavedAt ? (
            <p className={styles.placeholderNote}>
              Their saved card, from {formatSavedAnalysisCardDate(analysisCardSavedAt)}
            </p>
          ) : null}
          {analysisCardPublish && onAnalysisCardShownChange ? (
            <div className={cardStyles.publish}>
              <label>
                <input
                  type="checkbox"
                  checked={analysisCardPublish.shown}
                  disabled={analysisCardPublish.saving}
                  onChange={(event) => onAnalysisCardShownChange(event.target.checked)}
                />{' '}
                Show this card on my page
              </label>{' '}
              <button
                type="button"
                id="analysisCardPublishHelp"
                className={cardStyles.publishHelp}
                data-ce-control-appearance="frameless"
                aria-label="About showing this card on your page"
              >
                <FontAwesomeIcon icon={faQuestionCircle} />
              </button>
              <UncontrolledTooltip target="analysisCardPublishHelp" trigger="hover focus" autohide={false}>
                Anyone signed in to this session who may use its AI and read your answers sees this card on your page,
                with up to three of those answers. Untick to remove it.
              </UncontrolledTooltip>
              {analysisCardPublish.note ? (
                <p className={styles.placeholderNote} role="status">
                  {analysisCardPublish.note}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : view === 'card' ? (
        <>
          <p className={cardStyles.skeletonStatus} role="status">
            Making the card…
          </p>
          <UserPageAnalysisCardSkeleton />
        </>
      ) : null}

      <p className={viewStyles.model}>
        {analysisGeneration?.source === 'requested' ? 'Requested AI model: ' : 'AI model: '}
        {analysisGeneration?.model || 'not recorded'}
        {analysisGeneration?.provider ? ` (${analysisGeneration.provider})` : ''}
      </p>
      <details className={viewStyles.options}>
        <summary>Options</summary>
        <label>
          <input
            type="checkbox"
            checked={textView}
            onChange={(event) => {
              setTextView(event.target.checked);
              keepTextView(event.target.checked);
              // Put away, it is forgotten as the view shown: ticked again, the Breakdown stays.
              if (!event.target.checked && chosen === 'text') setChosen('breakdown');
            }}
          />{' '}
          Show the Text view
        </label>
      </details>
    </>
  );
};

export default UserPageAnalysisViews;
