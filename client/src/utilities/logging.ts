/**
 * @module logging
 * @description Structured logging system — category-based loggers gated by window.CE_LOGGING
 *              configuration. Supports per-category enable/disable and colored console output.
 *
 * Key exports: createLogger, shouldLog, initLogging, getLoggingConfig, printLoggingGuide
 */
/* eslint-disable no-console */

const DEFAULT_LOGGING_CONFIG = {
  enabled: false,
  categories: {
    all: false,
    general: false,
    contracts: false,
    rpc: false,
    sbt: false,
    surveys: false,
    questions: false,
    questionFilter: false,
    ai: false,
    demo: false,
    mainSite: false,
    matches: false,
    proposals: false,
    account: false,
    ui: false,
    whisper: false,
    porto: false,
    inviteDebug: false,
    cache: false,
    crypto: false
  },
  levels: {
    log: true,
    info: true,
    debug: false,
    warn: true,
    error: true
  }
};

const GLOBAL_KEY = 'CE_LOGGING';
const GUIDE_SHOWN_KEY = '__CE_LOGGING_GUIDE_SHOWN__';

const CE_ASCII = [
  '  _____  ______   CE LOGGING',
  ' / ____| |  ____|  window.CE_LOGGING.enabled = true',
  '| |      | |__     window.CE_LOGGING.categories.all = true',
  '| |      |  __|    window.CE_LOGGING.levels.debug = true',
  '| |____  | |____   window.CE_LOGGING_HELP()',
  ' \\_____| |______|'
];
const defaultCategories = DEFAULT_LOGGING_CONFIG.categories as Record<string, boolean>;
const defaultLevels = DEFAULT_LOGGING_CONFIG.levels as Record<string, boolean>;

const cloneDefaults = (): any => ({
  enabled: DEFAULT_LOGGING_CONFIG.enabled,
  categories: { ...DEFAULT_LOGGING_CONFIG.categories },
  levels: { ...DEFAULT_LOGGING_CONFIG.levels }
});

const applyDefaults = (cfg: any): any => {
  if (!cfg || typeof cfg !== 'object') return cloneDefaults();

  if (typeof cfg.enabled !== 'boolean') cfg.enabled = DEFAULT_LOGGING_CONFIG.enabled;

  if (!cfg.categories || typeof cfg.categories !== 'object') cfg.categories = {};
  Object.keys(defaultCategories).forEach((key) => {
    if (typeof cfg.categories[key] !== 'boolean') {
      cfg.categories[key] = defaultCategories[key];
    }
  });

  if (!cfg.levels || typeof cfg.levels !== 'object') cfg.levels = {};
  Object.keys(defaultLevels).forEach((key) => {
    if (typeof cfg.levels[key] !== 'boolean') {
      cfg.levels[key] = defaultLevels[key];
    }
  });

  return cfg;
};

export const getLoggingConfig = (): any => {
  if (typeof window === 'undefined') return cloneDefaults();
  const runtimeWindow = window as any;
  if (!runtimeWindow[GLOBAL_KEY]) runtimeWindow[GLOBAL_KEY] = cloneDefaults();
  return applyDefaults(runtimeWindow[GLOBAL_KEY]);
};

const isLegacyCategoryEnabled = (category: any): boolean => {
  if (typeof window === 'undefined') return false;
  const runtimeWindow = window as any;
  if (category === 'rpc' && runtimeWindow.ENABLE_RPC_DEBUG_LOGGING === true) return true;
  return false;
};

const isCategoryEnabled = (cfg: any, category: any): boolean => {
  if (!cfg) return false;
  if (cfg.categories?.all) return true;
  if (category && cfg.categories?.[category]) return true;
  if (!category && cfg.categories?.general) return true;
  return isLegacyCategoryEnabled(category);
};

export const shouldLog = (category: any, level = 'log'): boolean => {
  const cfg = getLoggingConfig();
  if (!cfg?.levels?.[level]) return false;
  if (level === 'error') return true;
  if (cfg.enabled) return true;
  return isCategoryEnabled(cfg, category);
};

const buildArgs = (prefix: string, args: any[]): any[] => {
  if (!prefix) return args;
  return [prefix, ...args];
};

export const emitForcedLog = (level: any, ...args: any[]): void => {
  const consoleMethod = (
    level === 'warn' ? console.warn :
    level === 'error' ? console.error :
    console.log
  );
  consoleMethod(...args);
};

export const createLogger = (category: any, options: any = {}) => {
  const prefix =
    typeof options.prefix === 'string'
      ? options.prefix
      : (category ? `[${category}]` : '');

  return {
    log: (...args: any[]) => {
      if (shouldLog(category, 'log')) console.log(...buildArgs(prefix, args));
    },
    info: (...args: any[]) => {
      if (shouldLog(category, 'info')) console.info(...buildArgs(prefix, args));
    },
    debug: (...args: any[]) => {
      if (shouldLog(category, 'debug')) console.debug(...buildArgs(prefix, args));
    },
    warn: (...args: any[]) => {
      if (shouldLog(category, 'warn')) console.warn(...buildArgs(prefix, args));
    },
    error: (...args: any[]) => {
      if (shouldLog(category, 'error')) console.error(...buildArgs(prefix, args));
    },
    isEnabled: (level = 'log') => shouldLog(category, level)
  };
};

const buildGuideMessage = (): string => {
  const categories = Object.keys(DEFAULT_LOGGING_CONFIG.categories)
    .filter((key) => key !== 'all')
    .join(', ');

  return [
    ...CE_ASCII,
    '',
    '[Context Engine logging]',
    'Logging is off by default. Enable categories/levels in the dev console:',
    'window.CE_LOGGING.enabled = true',
    'window.CE_LOGGING.categories.contracts = true',
    'window.CE_LOGGING.categories.rpc = true',
    'window.CE_LOGGING.categories.sbt = true',
    'window.CE_LOGGING.categories.all = true',
    'window.CE_LOGGING.levels.debug = true',
    'window.CE_LOGGING.levels.warn = true',
    'window.CE_LOGGING.levels.error = false',
    `Available categories: ${categories}`,
    'See current config: window.CE_LOGGING',
    'Run window.CE_LOGGING_HELP() to print this again.'
  ].join('\n');
};

export const printLoggingGuide = ({ force = false }: any = {}): void => {
  if (typeof window === 'undefined') return;
  const runtimeWindow = window as any;
  if (!force && runtimeWindow[GUIDE_SHOWN_KEY]) return;
  runtimeWindow[GUIDE_SHOWN_KEY] = true;
  console.info(buildGuideMessage());
};

export const initLogging = ({ showGuide = true }: any = {}): any => {
  if (typeof window === 'undefined') return null;
  const runtimeWindow = window as any;
  const cfg = getLoggingConfig();

  if (typeof runtimeWindow.CE_LOGGING_HELP !== 'function') {
    runtimeWindow.CE_LOGGING_HELP = () => printLoggingGuide({ force: true });
  }

  if (showGuide) {
    printLoggingGuide();
  }

  return cfg;
};
