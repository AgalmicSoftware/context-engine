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

const cloneDefaults = () => ({
  enabled: DEFAULT_LOGGING_CONFIG.enabled,
  categories: { ...DEFAULT_LOGGING_CONFIG.categories },
  levels: { ...DEFAULT_LOGGING_CONFIG.levels }
});

const applyDefaults = (cfg) => {
  if (!cfg || typeof cfg !== 'object') return cloneDefaults();

  if (typeof cfg.enabled !== 'boolean') cfg.enabled = DEFAULT_LOGGING_CONFIG.enabled;

  if (!cfg.categories || typeof cfg.categories !== 'object') cfg.categories = {};
  Object.keys(DEFAULT_LOGGING_CONFIG.categories).forEach((key) => {
    if (typeof cfg.categories[key] !== 'boolean') {
      cfg.categories[key] = DEFAULT_LOGGING_CONFIG.categories[key];
    }
  });

  if (!cfg.levels || typeof cfg.levels !== 'object') cfg.levels = {};
  Object.keys(DEFAULT_LOGGING_CONFIG.levels).forEach((key) => {
    if (typeof cfg.levels[key] !== 'boolean') {
      cfg.levels[key] = DEFAULT_LOGGING_CONFIG.levels[key];
    }
  });

  return cfg;
};

export const getLoggingConfig = () => {
  if (typeof window === 'undefined') return cloneDefaults();
  if (!window[GLOBAL_KEY]) window[GLOBAL_KEY] = cloneDefaults();
  return applyDefaults(window[GLOBAL_KEY]);
};

const isLegacyCategoryEnabled = (category) => {
  if (typeof window === 'undefined') return false;
  if (category === 'rpc' && window.ENABLE_RPC_DEBUG_LOGGING === true) return true;
  return false;
};

const isCategoryEnabled = (cfg, category) => {
  if (!cfg) return false;
  if (cfg.categories?.all) return true;
  if (category && cfg.categories?.[category]) return true;
  if (!category && cfg.categories?.general) return true;
  return isLegacyCategoryEnabled(category);
};

export const shouldLog = (category, level = 'log') => {
  const cfg = getLoggingConfig();
  if (!cfg?.levels?.[level]) return false;
  if (level === 'error') return true;
  if (cfg.enabled) return true;
  return isCategoryEnabled(cfg, category);
};

const buildArgs = (prefix, args) => {
  if (!prefix) return args;
  return [prefix, ...args];
};

export const emitForcedLog = (level, ...args) => {
  const consoleMethod = (
    level === 'warn' ? console.warn :
    level === 'error' ? console.error :
    console.log
  );
  consoleMethod(...args);
};

export const createLogger = (category, options = {}) => {
  const prefix =
    typeof options.prefix === 'string'
      ? options.prefix
      : (category ? `[${category}]` : '');

  return {
    log: (...args) => {
      if (shouldLog(category, 'log')) console.log(...buildArgs(prefix, args));
    },
    info: (...args) => {
      if (shouldLog(category, 'info')) console.info(...buildArgs(prefix, args));
    },
    debug: (...args) => {
      if (shouldLog(category, 'debug')) console.debug(...buildArgs(prefix, args));
    },
    warn: (...args) => {
      if (shouldLog(category, 'warn')) console.warn(...buildArgs(prefix, args));
    },
    error: (...args) => {
      if (shouldLog(category, 'error')) console.error(...buildArgs(prefix, args));
    },
    isEnabled: (level = 'log') => shouldLog(category, level)
  };
};

const buildGuideMessage = () => {
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

export const printLoggingGuide = ({ force = false } = {}) => {
  if (typeof window === 'undefined') return;
  if (!force && window[GUIDE_SHOWN_KEY]) return;
  window[GUIDE_SHOWN_KEY] = true;
  console.info(buildGuideMessage());
};

export const initLogging = ({ showGuide = true } = {}) => {
  if (typeof window === 'undefined') return null;
  const cfg = getLoggingConfig();

  if (typeof window.CE_LOGGING_HELP !== 'function') {
    window.CE_LOGGING_HELP = () => printLoggingGuide({ force: true });
  }

  if (showGuide) {
    printLoggingGuide();
  }

  return cfg;
};
