import { useId } from 'react';
import { UncontrolledTooltip } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

import type { ContextCard } from '@ce-shared/contextCards.mjs';
import css from './ContextCard.module.scss';

const WRITERS: Record<ContextCard['by'], string> = {
  ai: 'Written by the session’s AI',
  admin: 'Written by an admin',
  adder: 'Written by whoever added it',
};

/** What a card says beyond its tags, for the "?": its summary, the names it gives, and who wrote it. */
export const describeContextCard = (card: ContextCard): string =>
  [card.summary, card.names.length ? `Names: ${card.names.join(', ')}.` : '', `${WRITERS[card.by]}.`]
    .filter(Boolean)
    .join(' ');

type Props = { card?: ContextCard | null; title: string };

// A source's topic tags as chips, with its summary behind a "?". A source
// without a card shows nothing, as before cards.
const ContextCardChips = ({ card, title }: Props) => {
  const id = `ce-context-card-${useId().replace(/:/g, '')}`;
  if (!card) return null;
  const about = describeContextCard(card);
  return (
    <ul className={css.card} aria-label={`Topics of ${title}`} data-testid="ce-context-card">
      {card.tags.map((tag) => (
        <li key={tag} className={css.chip}>
          {tag}
        </li>
      ))}
      <li>
        <button
          type="button"
          id={id}
          className={css.about}
          aria-label={`About ${title}`}
          aria-describedby={`${id}-about`}
        >
          <FontAwesomeIcon icon={faQuestionCircle} />
        </button>
        <span id={`${id}-about`} hidden>
          {about}
        </span>
        <UncontrolledTooltip target={id} trigger="hover focus" autohide={false}>
          {about}
        </UncontrolledTooltip>
      </li>
    </ul>
  );
};

export default ContextCardChips;
