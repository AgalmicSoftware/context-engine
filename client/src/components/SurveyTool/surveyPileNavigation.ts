import { DEFAULT_PILE_AUTO_ADVANCE_ENABLED } from '../../variables/appConfig.js';

export const resolvePileAutoAdvanceEnabled = (config?: { pileAutoAdvanceEnabled?: unknown } | null): boolean =>
  typeof config?.pileAutoAdvanceEnabled === 'boolean'
    ? config.pileAutoAdvanceEnabled
    : DEFAULT_PILE_AUTO_ADVANCE_ENABLED;
