import { DEFAULT_PILE_AUTO_ADVANCE_ENABLED } from '../../variables/appConfig.js';

export const resolvePileAutoAdvanceEnabled = (config?: { pileAutoAdvanceEnabled?: unknown } | null): boolean =>
  typeof config?.pileAutoAdvanceEnabled === 'boolean'
    ? config.pileAutoAdvanceEnabled
    : DEFAULT_PILE_AUTO_ADVANCE_ENABLED;

/**
 * How long an agree/unsure/disagree card waits, with the choice ticked, before it moves to the next question where the
 * session moves on. The beat lets the choice read as kept: an instant jump looked like a lost answer. Null stays on the
 * card until the person presses Next. Every other card, a single-choice list included, stays until Next.
 */
export const CHOICE_ADVANCE_DELAY_MS: number | null = 700;

/** A tap this soon after the person dragged or wheeled the card ended a scroll, so it never moves the card on. */
export const SCROLL_TAP_GUARD_MS = 300;
/** How far a finger moves before it is scrolling rather than tapping. */
export const SCROLL_MOVE_PX = 10;
