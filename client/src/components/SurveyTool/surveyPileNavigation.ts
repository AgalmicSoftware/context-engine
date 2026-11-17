import { DEFAULT_PILE_AUTO_ADVANCE_ENABLED } from '../../variables/appConfig.js';

export const resolvePileAutoAdvanceEnabled = (config?: { pileAutoAdvanceEnabled?: unknown } | null): boolean =>
  typeof config?.pileAutoAdvanceEnabled === 'boolean'
    ? config.pileAutoAdvanceEnabled
    : DEFAULT_PILE_AUTO_ADVANCE_ENABLED;

/**
 * How long a single-choice card waits, with the choice ticked, before moving to the next question. Null stays on
 * the card until the person presses Next: a tap that moved on at once looked like a lost answer. Agree/disagree
 * cards still move on at once where the session allows it.
 */
export const SINGLE_CHOICE_ADVANCE_DELAY_MS: number | null = null;
