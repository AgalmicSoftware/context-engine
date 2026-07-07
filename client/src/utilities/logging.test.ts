import { createLogger, emitForcedLog, getLoggingConfig, initLogging, printLoggingGuide, shouldLog } from './logging.js';

type LoggingTestWindow = Window & {
  CE_LOGGING?: {
    enabled?: unknown;
    categories?: Record<string, unknown>;
    levels?: Record<string, unknown>;
  };
  CE_LOGGING_HELP?: () => void;
  ENABLE_RPC_DEBUG_LOGGING?: unknown;
  __CE_LOGGING_GUIDE_SHOWN__?: unknown;
};

const runtimeWindow = window as LoggingTestWindow;

describe('logging', () => {
  beforeEach(() => {
    delete runtimeWindow.CE_LOGGING;
    delete runtimeWindow.CE_LOGGING_HELP;
    delete runtimeWindow.ENABLE_RPC_DEBUG_LOGGING;
    delete runtimeWindow.__CE_LOGGING_GUIDE_SHOWN__;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete runtimeWindow.CE_LOGGING;
    delete runtimeWindow.CE_LOGGING_HELP;
    delete runtimeWindow.ENABLE_RPC_DEBUG_LOGGING;
    delete runtimeWindow.__CE_LOGGING_GUIDE_SHOWN__;
  });

  it('installs and completes the mutable window logging config', () => {
    runtimeWindow.CE_LOGGING = {
      enabled: true,
      categories: { rpc: true },
      levels: { debug: true },
    };

    const cfg = getLoggingConfig();

    expect(cfg).toBe(runtimeWindow.CE_LOGGING);
    expect(cfg.enabled).toBe(true);
    expect(cfg.categories.rpc).toBe(true);
    expect(cfg.categories.general).toBe(false);
    expect(cfg.levels.debug).toBe(true);
    expect(cfg.levels.log).toBe(true);
  });

  it('honors category, level, and legacy rpc gates', () => {
    runtimeWindow.CE_LOGGING = {
      enabled: false,
      categories: {},
      levels: { log: true, error: true },
    };

    expect(shouldLog('ui', 'log')).toBe(false);

    getLoggingConfig().categories.ui = true;

    expect(shouldLog('ui', 'log')).toBe(true);
    expect(shouldLog('ui', 'debug')).toBe(false);
    expect(shouldLog('other', 'error')).toBe(true);

    getLoggingConfig().categories.ui = false;
    runtimeWindow.ENABLE_RPC_DEBUG_LOGGING = true;

    expect(shouldLog('rpc', 'log')).toBe(true);
  });

  it('emits prefixed logger output only when enabled', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    runtimeWindow.CE_LOGGING = {
      enabled: false,
      categories: { ui: true },
      levels: { log: true, debug: false },
    };

    const logger = createLogger('ui');

    logger.log('ready');
    logger.debug('hidden');

    expect(logSpy).toHaveBeenCalledWith('[ui]', 'ready');
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it('keeps forced logging independent from category gates', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    emitForcedLog('warn', 'careful');
    emitForcedLog('error', 'broken');
    emitForcedLog('log', 'plain');

    expect(warnSpy).toHaveBeenCalledWith('careful');
    expect(errorSpy).toHaveBeenCalledWith('broken');
    expect(logSpy).toHaveBeenCalledWith('plain');
  });

  it('installs the help hook and prints the guide once unless forced', () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const cfg = initLogging();

    expect(cfg).toBe(runtimeWindow.CE_LOGGING);
    expect(typeof runtimeWindow.CE_LOGGING_HELP).toBe('function');
    expect(infoSpy).toHaveBeenCalledTimes(1);

    printLoggingGuide();
    expect(infoSpy).toHaveBeenCalledTimes(1);

    runtimeWindow.CE_LOGGING_HELP?.();
    expect(infoSpy).toHaveBeenCalledTimes(2);
  });
});
