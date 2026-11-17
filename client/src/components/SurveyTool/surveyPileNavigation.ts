import { DEFAULT_PILE_AUTO_ADVANCE_ENABLED } from '../../variables/appConfig.js';

export const resolvePileAutoAdvanceEnabled = (config?: { pileAutoAdvanceEnabled?: unknown } | null): boolean =>
  typeof config?.pileAutoAdvanceEnabled === 'boolean'
    ? config.pileAutoAdvanceEnabled
    : DEFAULT_PILE_AUTO_ADVANCE_ENABLED;

/**
 * How long a card with one choice (agree/disagree, or a single-choice list) waits, with the choice ticked, before it
 * moves to the next question where the session moves on. The beat lets the choice read as kept: an instant jump
 * looked like a lost answer. Null stays on the card until the person presses Next.
 */
export const CHOICE_ADVANCE_DELAY_MS: number | null = 700;

/** A tap this soon after the person dragged or wheeled the card ended a scroll, so it never moves the card on. */
export const SCROLL_TAP_GUARD_MS = 300;
