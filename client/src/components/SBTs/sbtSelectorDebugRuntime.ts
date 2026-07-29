import { emitForcedLog } from '../../utilities/logging.js';
import { isSbtSelectorForcedDebugEnabled } from './sbtSelectorRuntimeHelpers';
import type { SbtSelectorLogMethod } from './sbtSelectorRuntimePorts';

type SbtSelectorLogger = Record<string, unknown> & {
  log: SbtSelectorLogMethod;
};

export const createSbtSelectorDebugEmitter = (loggerOwner: unknown, logger: SbtSelectorLogger) => {
  return (level: unknown, message: unknown, payload?: unknown): void => {
    const loggerLevel = String(level || 'log');
    const dynamicMethod = logger[loggerLevel];
    const loggerMethod =
      typeof dynamicMethod === 'function'
        ? (dynamicMethod as SbtSelectorLogMethod).bind(loggerOwner)
        : logger.log.bind(loggerOwner);
    if (isSbtSelectorForcedDebugEnabled()) {
      if (typeof payload === 'undefined') emitForcedLog(loggerLevel, message);
      else emitForcedLog(loggerLevel, message, payload);
      return;
    }
    if (typeof payload === 'undefined') loggerMethod(message);
    else loggerMethod(message, payload);
  };
};
