import { createLogger } from 'utilities/logging.js';

const SURVEY_TOOL_PERF_SCOPE = 'surveyTool';
type SurveyPerfCounterScope = Record<string, number>;
type SurveyPerfCounters = Record<string, SurveyPerfCounterScope>;
type SurveyRuntimeGlobal = typeof globalThis & {
  ENABLE_CE_UI_PERF_STATS?: unknown;
  ENABLE_CE_DEBUG_COUNTERS?: unknown;
  __CE_DEBUG_COUNTERS__?: unknown;
  __CE_PERF_COUNTERS__?: SurveyPerfCounters | unknown;
};

const getSurveyRuntimeGlobal = (): SurveyRuntimeGlobal | null =>
  typeof globalThis !== 'undefined' ? (globalThis as unknown as SurveyRuntimeGlobal) : null;

export const surveyLog = createLogger('surveys');
export const GATE_SBT_HYDRATION_RETRY_MS = 45 * 1000;

// Keep this dormant toggle path for future voice-only interview mode.
// The pile hologram avatar is intentionally hidden for now, but the render/state
// plumbing stays in place so future voice-mode work can re-enable it cleanly.
export const SHOW_PILE_HOLOGRAM_TOGGLE = false;

export const QUESTION_TAG_DROPDOWN_ROW_STYLE = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: '12px',
};

export const isSurveyPerfCountersEnabled = (): boolean => {
  try {
    const runtimeGlobal = getSurveyRuntimeGlobal();
    return (
      !!runtimeGlobal &&
      (runtimeGlobal.ENABLE_CE_UI_PERF_STATS === true ||
        runtimeGlobal.ENABLE_CE_DEBUG_COUNTERS === true ||
        runtimeGlobal.__CE_DEBUG_COUNTERS__ === true)
    );
  } catch (_) {
    return false;
  }
};

export const bumpSurveyPerfCounter = (key: unknown, inc: unknown = 1): void => {
  if (!isSurveyPerfCountersEnabled()) return;
  try {
    const runtimeGlobal = getSurveyRuntimeGlobal();
    if (!runtimeGlobal) return;
    if (!runtimeGlobal.__CE_PERF_COUNTERS__ || typeof runtimeGlobal.__CE_PERF_COUNTERS__ !== 'object') {
      runtimeGlobal.__CE_PERF_COUNTERS__ = {};
    }
    const counters = runtimeGlobal.__CE_PERF_COUNTERS__ as SurveyPerfCounters;
    if (!counters[SURVEY_TOOL_PERF_SCOPE] || typeof counters[SURVEY_TOOL_PERF_SCOPE] !== 'object') {
      counters[SURVEY_TOOL_PERF_SCOPE] = {};
    }
    const scope = counters[SURVEY_TOOL_PERF_SCOPE];
    const keyName = String(key);
    scope[keyName] = Number(scope[keyName] || 0) + Number(inc || 0);
  } catch (error) {
    void error;
  }
};

export const scheduleMicrotask = (cb: unknown): void => {
  if (typeof cb !== 'function') return;
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(cb as VoidFunction);
    return;
  }
  Promise.resolve().then(cb as VoidFunction);
};

export const DEBUG_PREFILL = false;
export const EMPTY_QUESTION_POOL: never[] = [];
