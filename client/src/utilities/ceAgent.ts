/**
 * @module ceAgent
 * @description Dev/E2E-only agent mode — JSON-driven deterministic UI actions via the TestID API.
 *              Gated by non-production bundle + query param agent=1 or localStorage ce-agent-enabled=1.
 *
 * Key exports: installCeAgent, describeCeAgentContract
 */
// Dev/E2E-only Agent Mode: JSON-driven deterministic actions via the TestID API.
//
// Gated by:
// - non-production bundle, AND
// - query param `agent=1` OR localStorage `ce-agent-enabled=1`.
//
// Exposes: window.__ceAgent
// - getState()
// - describe()
// - perform(action)
// - run(actions[])

import store from '../store.js';
import { describeCeAgentContract } from './ceAgentContract.js';
import { E2E_TESTIDS } from './e2eTestIds.js';
import { toStr } from './shared/primitives.js';
import { createLogger } from './logging.js';
import { isDemoModeEnabled } from './demoModeHelpers.js';

export { describeCeAgentContract } from './ceAgentContract.js';

const log = createLogger('ceAgent');

type CeAgentRecord = Record<string, any>;
type CeAgentAction = CeAgentRecord & {
  type?: string;
};
type CeAgentActionResult = {
  ok: boolean;
  type?: string;
  at?: string;
  error?: string;
  result?: CeAgentRecord;
};
type CeAgentRunResult = {
  ok: boolean;
  results: CeAgentActionResult[];
};

const readLocalStorageFlag = (key: unknown): boolean => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(String(key || '')) === '1';
  } catch (_) {
    return false;
  }
};

const readQueryFlag = (key: unknown): boolean => {
  try {
    if (typeof window === 'undefined' || !window.location) return false;
    const qp = new URLSearchParams(String(window.location.search || ''));
    return qp.get(String(key || '')) === '1';
  } catch (_) {
    return false;
  }
};

const isAgentEnabled = () => {
  if (process.env.NODE_ENV === 'production') return false;
  return readLocalStorageFlag('ce-agent-enabled') || readQueryFlag('agent');
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const cssEscapeAttr = (value: unknown): string => toStr(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const elByTestId = (testId: unknown): Element | null => {
  const id = toStr(testId).trim();
  if (!id) return null;
  return document.querySelector(`[data-testid="${cssEscapeAttr(id)}"]`);
};

const isVisible = (el: Element | null): boolean => {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (!style) return false;
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (Number(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const waitFor = async (
  fn: () => unknown | Promise<unknown>,
  { timeoutMs = 30000, tickMs = 100 }: { timeoutMs?: number; tickMs?: number } = {},
): Promise<boolean> => {
  const startedAt = Date.now();
  const maxMs = Math.max(100, Number(timeoutMs) || 0);
  const tick = Math.max(25, Number(tickMs) || 0);

  while (true) {
    const ok = await Promise.resolve()
      .then(fn)
      .catch(() => false);
    if (ok) return true;
    if (Date.now() - startedAt > maxMs) return false;

    await sleep(tick);
  }
};

const waitForTestId = async (
  testId: unknown,
  { timeoutMs = 20000 }: { timeoutMs?: number } = {},
): Promise<Element | null> => {
  const id = toStr(testId).trim();
  if (!id) return null;
  const ok = await waitFor(() => !!elByTestId(id), { timeoutMs, tickMs: 50 });
  return ok ? elByTestId(id) : null;
};

const setNativeValue = (el: HTMLInputElement | HTMLTextAreaElement | null, value: unknown): void => {
  const v = toStr(value);
  if (!el) return;
  const tag = String(el.tagName || '').toLowerCase();
  const proto = tag === 'textarea' ? window.HTMLTextAreaElement?.prototype : window.HTMLInputElement?.prototype;
  const desc = proto ? Object.getOwnPropertyDescriptor(proto, 'value') : null;
  const setter = desc && typeof desc.set === 'function' ? desc.set : null;
  if (setter) setter.call(el, v);
  else el.value = v;
};

const scrollIntoViewIfNeeded = (el: Element | null): void => {
  if (!el) return;
  try {
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
  } catch (_) {
    try {
      el.scrollIntoView();
    } catch (e) {
      log.warn('ceAgent: fallback', e);
    }
  }
};

const getState = () => {
  const route = (() => {
    try {
      return `${window.location.pathname || ''}${window.location.search || ''}`;
    } catch (_) {
      return '';
    }
  })();

  let account = '';
  let provider = '';
  let loginComplete = false;
  let activeSessionSlug = '';
  let demoMode = false;

  try {
    const s = store.getState();
    account = toStr(s?.profile?.account).trim();
    provider = toStr(s?.profile?.provider).trim();
    loginComplete = !!s?.sessionState?.loginComplete;
    activeSessionSlug = toStr(s?.sessionState?.activeSessionSlug).trim();
    demoMode = isDemoModeEnabled(s?.sessionState?.demoMode);
  } catch (e) {
    log.warn('ceAgent: fallback', e);
  }

  // Secondary source of truth for wallet (what E2E asserts).
  try {
    const walletEl = elByTestId(E2E_TESTIDS.WALLET_DISPLAY);
    const addr = walletEl ? toStr(walletEl.getAttribute('data-ce-wallet-address')).trim() : '';
    if (addr) account = addr;
  } catch (e) {
    log.warn('ceAgent: fallback', e);
  }

  return {
    route,
    account,
    provider,
    loginComplete,
    activeSessionSlug,
    demoMode,
  };
};

export const resolvePolisReportSessionSlug = ({
  params = {},
  state = {},
}: {
  params?: CeAgentRecord;
  state?: CeAgentRecord;
} = {}): string => toStr(params?.sessionSlug || params?.slug || state?.activeSessionSlug).trim();

const perform = async (action) => {
  const a = action && typeof action === 'object' ? action : null;
  const actionRecord = a as CeAgentAction | null;
  const type = toStr(actionRecord?.type).trim();
  const startedAt = new Date().toISOString();

  const err = (message: unknown): CeAgentActionResult => ({
    ok: false,
    type,
    at: startedAt,
    error: toStr(message).trim() || 'Unknown error',
  });

  if (!type) return err('Missing action.type');

  if (type === 'navigate') {
    const to = toStr(actionRecord?.to).trim();
    if (!to) return err('navigate.to is required');
    if (typeof window === 'undefined' || !window.history) return err('No window.history available');
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
    const ok = await waitFor(() => `${window.location.pathname || ''}${window.location.search || ''}` === to, {
      timeoutMs: 15000,
      tickMs: 50,
    });
    if (!ok) return err(`navigate timeout: expected route=${toStr(to)}`);
    return { ok: true, type, at: startedAt, result: { route: to } };
  }

  if (type === 'fill') {
    const testId = toStr(actionRecord?.testId).trim();
    const value = toStr(actionRecord?.value);
    if (!testId) return err('fill.testId is required');
    const el = await waitForTestId(testId, { timeoutMs: 20000 });
    if (!el) return err(`fill: element not found for testId=${testId}`);
    const tag = String(el.tagName || '').toLowerCase();
    if (tag !== 'input' && tag !== 'textarea') {
      return err(`fill: element is not input/textarea (tag=${tag}) testId=${testId}`);
    }
    scrollIntoViewIfNeeded(el);
    const inputEl = el as HTMLInputElement | HTMLTextAreaElement;
    try {
      inputEl.focus();
    } catch (e) {
      log.warn('ceAgent: fallback', e);
    }
    setNativeValue(inputEl, value);
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    // Best-effort wait for React to reconcile.
    await waitFor(() => toStr(inputEl.value) === value, { timeoutMs: 2000, tickMs: 50 });
    return { ok: true, type, at: startedAt, result: { testId, value } };
  }

  if (type === 'click') {
    const testId = toStr(actionRecord?.testId).trim();
    if (!testId) return err('click.testId is required');
    const el = await waitForTestId(testId, { timeoutMs: 20000 });
    if (!el) return err(`click: element not found for testId=${testId}`);
    scrollIntoViewIfNeeded(el);
    // Click even if not strictly "visible"; some toggles are clipped but still clickable.
    try {
      (el as HTMLElement).click();
    } catch (e) {
      return err(`click failed: ${(e as Error)?.message || e}`);
    }
    return { ok: true, type, at: startedAt, result: { testId } };
  }

  if (type === 'assertVisible') {
    const testId = toStr(actionRecord?.testId).trim();
    if (!testId) return err('assertVisible.testId is required');
    const timeoutMs = (() => {
      const raw = actionRecord?.timeoutMs ?? actionRecord?.timeout;
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000;
    })();
    const ok = await waitFor(() => isVisible(elByTestId(testId)), { timeoutMs, tickMs: 100 });
    if (!ok) return err(`assertVisible timeout: testId=${testId}`);
    return { ok: true, type, at: startedAt, result: { testId } };
  }

  if (type === 'invokeAi') {
    const tool = toStr(actionRecord?.tool).trim();
    const params =
      actionRecord?.params && typeof actionRecord.params === 'object' ? (actionRecord.params as CeAgentRecord) : {};

    if (tool === 'CompareAddresses') {
      const addressA = toStr(params.addressA || params.a).trim();
      const addressB = toStr(params.addressB || params.b).trim();
      const aFilled = addressA || '0x0000000000000000000000000000000000000001';
      const bFilled = addressB || '0x0000000000000000000000000000000000000002';

      // Prefer SPA navigation.
      const navRes = await perform({ type: 'navigate', to: '/compare/' });
      if (!navRes.ok) return navRes;
      const readyRes = await perform({
        type: 'assertVisible',
        testId: E2E_TESTIDS.PAGE_COMPARE_ROOT,
        timeoutMs: 60000,
      });
      if (!readyRes.ok) return readyRes;

      const fillA = await perform({ type: 'fill', testId: E2E_TESTIDS.COMPARE_ADDRESS_A, value: aFilled });
      if (!fillA.ok) return fillA;
      const fillB = await perform({ type: 'fill', testId: E2E_TESTIDS.COMPARE_ADDRESS_B, value: bFilled });
      if (!fillB.ok) return fillB;
      const clickRes = await perform({ type: 'click', testId: E2E_TESTIDS.COMPARE_RUN });
      if (!clickRes.ok) return clickRes;

      const res = await perform({ type: 'assertVisible', testId: E2E_TESTIDS.COMPARE_RESULT, timeoutMs: 60000 });
      if (!res.ok) return res;
      return { ok: true, type, at: startedAt, result: { tool, addressA: aFilled, addressB: bFilled } };
    }

    if (tool === 'PolisReport') {
      const sessionSlug = resolvePolisReportSessionSlug({
        params,
        state: getState(),
      });
      if (!sessionSlug) {
        return err('PolisReport: sessionSlug is required when no active session is selected');
      }
      const navRes = await perform({ type: 'navigate', to: `/session/${encodeURIComponent(sessionSlug)}` });
      if (!navRes.ok) return navRes;
      const readyRes = await perform({
        type: 'assertVisible',
        testId: E2E_TESTIDS.PAGE_SESSION_ROOT,
        timeoutMs: 240000,
      });
      if (!readyRes.ok) return readyRes;

      const resultsToggleRes = await perform({ type: 'click', testId: E2E_TESTIDS.SESSION_RESULTS_TOGGLE });
      if (!resultsToggleRes.ok) return resultsToggleRes;
      const reportReadyRes = await perform({
        type: 'assertVisible',
        testId: E2E_TESTIDS.POLIS_REPORT_ROOT,
        timeoutMs: 240000,
      });
      if (!reportReadyRes.ok) return reportReadyRes;

      const settingsToggleRes = await perform({ type: 'click', testId: E2E_TESTIDS.POLIS_SETTINGS_TOGGLE });
      if (!settingsToggleRes.ok) return settingsToggleRes;

      // Ensure Demo Data is enabled so summaries are deterministic.
      const demoToggle = await waitForTestId(E2E_TESTIDS.POLIS_DEMO_DATA_TOGGLE, { timeoutMs: 20000 });
      if (!demoToggle) return err('PolisReport: missing demo data toggle');
      if (!(demoToggle as HTMLInputElement).checked) {
        const demoRes = await perform({ type: 'click', testId: E2E_TESTIDS.POLIS_DEMO_DATA_TOGGLE });
        if (!demoRes.ok) return demoRes;
      }

      const analyzeRes = await perform({ type: 'click', testId: E2E_TESTIDS.POLIS_ANALYZE_CLUSTERS });
      if (!analyzeRes.ok) return analyzeRes;

      const ok = await waitFor(
        () => {
          const els = document.querySelectorAll(`[data-testid="${cssEscapeAttr(E2E_TESTIDS.POLIS_CLUSTER_ANALYSIS)}"]`);
          for (const el of els) {
            if (isVisible(el) && toStr(el.getAttribute('data-ce-analysis-state')).trim() === 'ready') {
              return true;
            }
          }
          return false;
        },
        { timeoutMs: 60000, tickMs: 250 },
      );
      if (!ok) return err('PolisReport: timed out waiting for cluster analysis state=ready');

      return { ok: true, type, at: startedAt, result: { tool, sessionSlug } };
    }

    return err(`invokeAi.tool unsupported: ${tool}`);
  }

  return err(`Unsupported action.type: ${type}`);
};

const run = async (actions: unknown): Promise<CeAgentRunResult> => {
  const arr = Array.isArray(actions) ? actions : null;
  if (!arr)
    return {
      ok: false,
      results: [{ ok: false, type: 'run', at: new Date().toISOString(), error: 'run(actions) expects an array' }],
    };

  const results = [];
  for (const action of arr) {
    const res = await perform(action);
    results.push(res);
    if (!res.ok) return { ok: false, results };
  }
  return { ok: true, results };
};

const describe = () => describeCeAgentContract();

export const installCeAgent = () => {
  if (!isAgentEnabled()) return false;
  if (typeof window === 'undefined') return false;
  if (window.__ceAgent) return true;

  window.__ceAgent = {
    getState,
    describe,
    perform,
    run,
  };
  return true;
};
