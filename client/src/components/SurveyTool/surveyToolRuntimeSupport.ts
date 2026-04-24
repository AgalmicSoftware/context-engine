import { createLogger } from 'utilities/logging.js';

const SURVEY_TOOL_PERF_SCOPE = 'surveyTool';

export const surveyLog = createLogger('surveys');
export const GATE_SBT_HYDRATION_RETRY_MS = 45 * 1000;

// Keep this dormant toggle path for PRD 135 voice-only interview mode.
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
    return typeof globalThis !== 'undefined' && (
      (globalThis as any).ENABLE_CE_UI_PERF_STATS === true ||
      (globalThis as any).ENABLE_CE_DEBUG_COUNTERS === true ||
      (globalThis as any).__CE_DEBUG_COUNTERS__ === true
    );
  } catch (_) {
    return false;
  }
};

export const bumpSurveyPerfCounter = (key: unknown, inc: unknown = 1): void => {
  if (!isSurveyPerfCountersEnabled()) return;
  try {
    if (!(globalThis as any).__CE_PERF_COUNTERS__ || typeof (globalThis as any).__CE_PERF_COUNTERS__ !== 'object') {
      (globalThis as any).__CE_PERF_COUNTERS__ = {};
    }
    if (
      !(globalThis as any).__CE_PERF_COUNTERS__[SURVEY_TOOL_PERF_SCOPE] ||
      typeof (globalThis as any).__CE_PERF_COUNTERS__[SURVEY_TOOL_PERF_SCOPE] !== 'object'
    ) {
      (globalThis as any).__CE_PERF_COUNTERS__[SURVEY_TOOL_PERF_SCOPE] = {};
    }
    const scope = (globalThis as any).__CE_PERF_COUNTERS__[SURVEY_TOOL_PERF_SCOPE];
    scope[key as any] = Number(scope[key as any] || 0) + Number(inc || 0);
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
