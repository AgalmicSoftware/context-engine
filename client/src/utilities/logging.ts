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
    wallet: false,
    inviteDebug: false,
    cache: false,
    crypto: false,
  },
  levels: {
    log: true,
    info: true,
    debug: false,
    warn: true,
    error: true,
  },
};

const GLOBAL_KEY = 'CE_LOGGING';
const GUIDE_SHOWN_KEY = '__CE_LOGGING_GUIDE_SHOWN__';

type LoggingConfig = {
  enabled: boolean;
  categories: Record<string, boolean>;
  levels: Record<string, boolean>;
};

type PartialLoggingConfig = {
  enabled?: unknown;
  categories?: Record<string, unknown>;
  levels?: Record<string, unknown>;
  [key: string]: unknown;
};

type LoggerOptions = {
  prefix?: unknown;
};

type Logger = {
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  isEnabled: (level?: string) => boolean;
};

type LoggingRuntimeWindow = Window & {
  [GLOBAL_KEY]?: PartialLoggingConfig | LoggingConfig;
  [GUIDE_SHOWN_KEY]?: unknown;
  CE_LOGGING_HELP?: () => void;
  ENABLE_RPC_DEBUG_LOGGING?: unknown;
};

const CE_ASCII = [
  '  _____  ______   CE LOGGING',
  ' / ____| |  ____|  window.CE_LOGGING.enabled = true',
  '| |      | |__     window.CE_LOGGING.categories.all = true',
  '| |      |  __|    window.CE_LOGGING.levels.debug = true',
  '| |____  | |____   window.CE_LOGGING_HELP()',
  ' \\_____| |______|',
];
const defaultCategories = DEFAULT_LOGGING_CONFIG.categories as Record<string, boolean>;
const defaultLevels = DEFAULT_LOGGING_CONFIG.levels as Record<string, boolean>;

const getRuntimeWindow = (): LoggingRuntimeWindow | null =>
  typeof window === 'undefined' ? null : (window as LoggingRuntimeWindow);

const cloneDefaults = (): LoggingConfig => ({
  enabled: DEFAULT_LOGGING_CONFIG.enabled,
  categories: { ...DEFAULT_LOGGING_CONFIG.categories },
  levels: { ...DEFAULT_LOGGING_CONFIG.levels },
});

const applyDefaults = (cfg: unknown): LoggingConfig => {
  if (!cfg || typeof cfg !== 'object') return cloneDefaults();
  const mutableCfg = cfg as PartialLoggingConfig;

  if (typeof mutableCfg.enabled !== 'boolean') mutableCfg.enabled = DEFAULT_LOGGING_CONFIG.enabled;

  if (!mutableCfg.categories || typeof mutableCfg.categories !== 'object') mutableCfg.categories = {};
  Object.keys(defaultCategories).forEach((key) => {
    if (typeof mutableCfg.categories?.[key] !== 'boolean') {
      mutableCfg.categories![key] = defaultCategories[key];
    }
  });

  if (!mutableCfg.levels || typeof mutableCfg.levels !== 'object') mutableCfg.levels = {};
  Object.keys(defaultLevels).forEach((key) => {
    if (typeof mutableCfg.levels?.[key] !== 'boolean') {
      mutableCfg.levels![key] = defaultLevels[key];
    }
  });

  return mutableCfg as LoggingConfig;
};

export const getLoggingConfig = (): LoggingConfig => {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return cloneDefaults();
  if (!runtimeWindow[GLOBAL_KEY]) runtimeWindow[GLOBAL_KEY] = cloneDefaults();
  return applyDefaults(runtimeWindow[GLOBAL_KEY]);
};

const isLegacyCategoryEnabled = (category: unknown): boolean => {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return false;
  if (category === 'rpc' && runtimeWindow.ENABLE_RPC_DEBUG_LOGGING === true) return true;
  return false;
};

const isCategoryEnabled = (cfg: LoggingConfig | null | undefined, category: unknown): boolean => {
  if (!cfg) return false;
  if (cfg.categories?.all) return true;
  const categoryKey = String(category || '');
  if (categoryKey && cfg.categories?.[categoryKey]) return true;
  if (!category && cfg.categories?.general) return true;
  return isLegacyCategoryEnabled(category);
};

export const shouldLog = (category: unknown, level = 'log'): boolean => {
  const cfg = getLoggingConfig();
  if (!cfg?.levels?.[level]) return false;
  if (level === 'error') return true;
  if (cfg.enabled) return true;
  return isCategoryEnabled(cfg, category);
};

const buildArgs = (prefix: string, args: unknown[]): unknown[] => {
  if (!prefix) return args;
  return [prefix, ...args];
};

export const emitForcedLog = (level: unknown, ...args: unknown[]): void => {
  const consoleMethod = level === 'warn' ? console.warn : level === 'error' ? console.error : console.log;
  consoleMethod(...args);
};

export const createLogger = (category: unknown, options: LoggerOptions = {}): Logger => {
  const prefix = typeof options.prefix === 'string' ? options.prefix : category ? `[${category}]` : '';

  return {
    log: (...args: unknown[]) => {
      if (shouldLog(category, 'log')) console.log(...buildArgs(prefix, args));
    },
    info: (...args: unknown[]) => {
      if (shouldLog(category, 'info')) console.info(...buildArgs(prefix, args));
    },
    debug: (...args: unknown[]) => {
      if (shouldLog(category, 'debug')) console.debug(...buildArgs(prefix, args));
    },
    warn: (...args: unknown[]) => {
      if (shouldLog(category, 'warn')) console.warn(...buildArgs(prefix, args));
    },
    error: (...args: unknown[]) => {
      if (shouldLog(category, 'error')) console.error(...buildArgs(prefix, args));
    },
    isEnabled: (level = 'log') => shouldLog(category, level),
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
    'Run window.CE_LOGGING_HELP() to print this again.',
  ].join('\n');
};

export const printLoggingGuide = ({ force = false }: { force?: boolean } = {}): void => {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return;
  if (!force && runtimeWindow[GUIDE_SHOWN_KEY]) return;
  runtimeWindow[GUIDE_SHOWN_KEY] = true;
  console.info(buildGuideMessage());
};

export const initLogging = ({ showGuide = true }: { showGuide?: boolean } = {}): LoggingConfig | null => {
  const runtimeWindow = getRuntimeWindow();
  if (!runtimeWindow) return null;
  const cfg = getLoggingConfig();

  if (typeof runtimeWindow.CE_LOGGING_HELP !== 'function') {
    runtimeWindow.CE_LOGGING_HELP = () => printLoggingGuide({ force: true });
  }

  if (showGuide) {
    printLoggingGuide();
  }

  return cfg;
};
