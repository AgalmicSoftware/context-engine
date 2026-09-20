const isObj = (value) =>
  !!value && typeof value === "object" && !Array.isArray(value);
const hasOwn = (value, key) =>
  Object.prototype.hasOwnProperty.call(value || {}, key);

export const RESULTS_ANALYSIS_SETTINGS_VERSION = 1;
export const RESULTS_ANALYSIS_GENERATION_MODES = Object.freeze([
  "manual",
  "automatic",
  "both",
]);
export const RESULTS_ANALYSIS_VIEW_KEYS = Object.freeze([
  "circles",
  "breakdown",
  "riskMatrix",
]);
export const RESULTS_ANALYSIS_AUTO_UNITS = Object.freeze([
  "distinctParticipants",
]);
export const RESULTS_ANALYSIS_AUTO_AFTER_UNITS = RESULTS_ANALYSIS_AUTO_UNITS;
export const RESULTS_ANALYSIS_INPUT_SCOPES = Object.freeze(["submitted"]);
export const RESULTS_ANALYSIS_PUBLICATIONS = Object.freeze(["latest_success_visible"]);
export const RESULTS_ANALYSIS_THRESHOLD_MIN = 1;
export const RESULTS_ANALYSIS_THRESHOLD_MAX = 100000;

export const DEFAULT_RESULTS_ANALYSIS_SETTINGS = Object.freeze({
  version: RESULTS_ANALYSIS_SETTINGS_VERSION,
  generationMode: "manual",
  views: Object.freeze({
    circles: true,
    breakdown: true,
    riskMatrix: true,
  }),
  autoAfter: Object.freeze({
    threshold: 10,
    unit: "distinctParticipants",
  }),
  inputScope: "submitted",
  publication: "latest_success_visible",
});

const allowedKeys = (record, keys) => {
  const allowed = new Set(keys);
  const unknown = Object.keys(record || {}).find((key) => !allowed.has(key));
  return unknown || "";
};

const normalizeBoolean = (value, fallback) =>
  typeof value === "boolean" ? value : fallback;

const normalizeThreshold = (value, fallback) => {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) &&
    numeric >= RESULTS_ANALYSIS_THRESHOLD_MIN
    ? Math.min(numeric, RESULTS_ANALYSIS_THRESHOLD_MAX)
    : fallback;
};

export const normalizeResultsAnalysisSettings = (raw = {}) => {
  const source = isObj(raw) ? raw : {};
  const defaultSettings = DEFAULT_RESULTS_ANALYSIS_SETTINGS;
  const views = isObj(source.views) ? source.views : {};
  const autoAfter = isObj(source.autoAfter) ? source.autoAfter : {};
  const generationMode = RESULTS_ANALYSIS_GENERATION_MODES.includes(
    source.generationMode,
  )
    ? source.generationMode
    : defaultSettings.generationMode;
  const unit = RESULTS_ANALYSIS_AUTO_UNITS.includes(autoAfter.unit)
    ? autoAfter.unit
    : defaultSettings.autoAfter.unit;
  const inputScope = RESULTS_ANALYSIS_INPUT_SCOPES.includes(source.inputScope)
    ? source.inputScope
    : defaultSettings.inputScope;
  const publication = RESULTS_ANALYSIS_PUBLICATIONS.includes(source.publication)
    ? source.publication
    : defaultSettings.publication;

  return {
    version: RESULTS_ANALYSIS_SETTINGS_VERSION,
    generationMode,
    views: {
      circles: normalizeBoolean(views.circles, defaultSettings.views.circles),
      breakdown: normalizeBoolean(
        views.breakdown,
        defaultSettings.views.breakdown,
      ),
      riskMatrix: normalizeBoolean(
        views.riskMatrix,
        defaultSettings.views.riskMatrix,
      ),
    },
    autoAfter: {
      threshold: normalizeThreshold(
        autoAfter.threshold,
        defaultSettings.autoAfter.threshold,
      ),
      unit,
    },
    inputScope,
    publication,
  };
};

export const validateResultsAnalysisSettings = (raw = {}) => {
  if (!isObj(raw))
    return {
      ok: false,
      path: "resultsAnalysis",
      error: "resultsAnalysis must be an object.",
    };
  const topUnknown = allowedKeys(raw, [
    "version",
    "generationMode",
    "views",
    "autoAfter",
    "inputScope",
    "publication",
  ]);
  if (topUnknown)
    return {
      ok: false,
      path: `resultsAnalysis.${topUnknown}`,
      error: "Unsupported results analysis setting.",
    };
  if (
    hasOwn(raw, "version") &&
    raw.version !== RESULTS_ANALYSIS_SETTINGS_VERSION
  ) {
    return {
      ok: false,
      path: "resultsAnalysis.version",
      error: "Unsupported results analysis settings version.",
    };
  }
  if (
    hasOwn(raw, "generationMode") &&
    !RESULTS_ANALYSIS_GENERATION_MODES.includes(raw.generationMode)
  ) {
    return {
      ok: false,
      path: "resultsAnalysis.generationMode",
      error: "Invalid results analysis generation mode.",
    };
  }
  if (hasOwn(raw, "views")) {
    if (!isObj(raw.views))
      return {
        ok: false,
        path: "resultsAnalysis.views",
        error: "views must be an object.",
      };
    const viewUnknown = allowedKeys(raw.views, RESULTS_ANALYSIS_VIEW_KEYS);
    if (viewUnknown)
      return {
        ok: false,
        path: `resultsAnalysis.views.${viewUnknown}`,
        error: "Unsupported results analysis view.",
      };
    for (const key of RESULTS_ANALYSIS_VIEW_KEYS) {
      if (hasOwn(raw.views, key) && typeof raw.views[key] !== "boolean") {
        return {
          ok: false,
          path: `resultsAnalysis.views.${key}`,
          error: "Result analysis views must be booleans.",
        };
      }
    }
  }
  if (hasOwn(raw, "autoAfter")) {
    if (!isObj(raw.autoAfter))
      return {
        ok: false,
        path: "resultsAnalysis.autoAfter",
        error: "autoAfter must be an object.",
      };
    const autoUnknown = allowedKeys(raw.autoAfter, ["threshold", "unit"]);
    if (autoUnknown)
      return {
        ok: false,
        path: `resultsAnalysis.autoAfter.${autoUnknown}`,
        error: "Unsupported auto trigger setting.",
      };
    if (hasOwn(raw.autoAfter, "threshold")) {
      if (
        !Number.isSafeInteger(raw.autoAfter.threshold) ||
        raw.autoAfter.threshold < RESULTS_ANALYSIS_THRESHOLD_MIN ||
        raw.autoAfter.threshold > RESULTS_ANALYSIS_THRESHOLD_MAX
      ) {
        return {
          ok: false,
          path: "resultsAnalysis.autoAfter.threshold",
          error: "autoAfter.threshold must be a bounded positive integer.",
        };
      }
    }
    if (
      hasOwn(raw.autoAfter, "unit") &&
      !RESULTS_ANALYSIS_AUTO_UNITS.includes(raw.autoAfter.unit)
    ) {
      return {
        ok: false,
        path: "resultsAnalysis.autoAfter.unit",
        error: "Unsupported autoAfter unit.",
      };
    }
  }
  if (
    hasOwn(raw, "inputScope") &&
    !RESULTS_ANALYSIS_INPUT_SCOPES.includes(raw.inputScope)
  ) {
    return {
      ok: false,
      path: "resultsAnalysis.inputScope",
      error: "Unsupported input scope.",
    };
  }
  if (
    hasOwn(raw, "publication") &&
    !RESULTS_ANALYSIS_PUBLICATIONS.includes(raw.publication)
  ) {
    return {
      ok: false,
      path: "resultsAnalysis.publication",
      error: "Unsupported publication mode.",
    };
  }
  return { ok: true, settings: normalizeResultsAnalysisSettings(raw) };
};

export const validResultsAnalysisSettings = (raw = {}) =>
  validateResultsAnalysisSettings(raw).ok === true;

export const resolveResultsAnalysisSectionKeys = (settings = {}) => {
  const normalized = normalizeResultsAnalysisSettings(settings);
  const sections = [];
  if (normalized.views.breakdown) sections.push("breakdown");
  if (normalized.views.riskMatrix) sections.push("riskMatrix");
  if (normalized.views.circles) sections.push("argumentMap", "atlas");
  return [...new Set(sections)];
};
