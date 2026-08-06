import React from 'react';
import { Link, useLocation } from 'react-router-dom';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { sbtsListPath } from '../../utilities/ui/terminology.js';

const readLocalStorageFlag = (key: string) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(key) === '1';
  } catch (_) {
    return false;
  }
};

const readQueryFlag = (search: string, key: string) => {
  try {
    const qp = new URLSearchParams(toStr(search));
    return qp.get(key) === '1';
  } catch (_) {
    return false;
  }
};

const resolveSessionSlug = (search: string) => {
  try {
    const qp = new URLSearchParams(toStr(search));
    const fromQuery = toStr(qp.get('sessionSlug')).trim();
    if (fromQuery) return fromQuery;
  } catch (e) {
    void e; /* fallback: dev nav session lookup. */
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const fromLs = toStr(window.localStorage.getItem('ce-e2e-session-slug')).trim();
      if (fromLs) return fromLs;
    }
  } catch (e) {
    void e; /* fallback: dev nav session lookup. */
  }

  // Keep a stable default for E2E/dev navigation.
  return 'general';
};

const isAgentModeEnabled = (search: string) => {
  if (process.env.NODE_ENV === 'production') return false;
  return readQueryFlag(search, 'agent') || readLocalStorageFlag('ce-agent-enabled');
};

const isDevNavEnabled = (search: string) => {
  if (process.env.NODE_ENV === 'production') return false;
  return readQueryFlag(search, 'e2eNav') || readLocalStorageFlag('ce-e2e-nav') || isAgentModeEnabled(search);
};

export const buildDevNavAtlasTarget = (pathname = '', search = '') => {
  if (!String(pathname || '').startsWith('/su/')) return '/atlas';
  const params = new URLSearchParams(toStr(search));
  params.set('demo', '1');
  return `/atlas?${params.toString()}`;
};

export default function DevE2eNav() {
  const location = useLocation();
  const enabled = isDevNavEnabled(location.search);
  if (!enabled) return null;

  const sessionSlug = resolveSessionSlug(location.search);
  const encodedSession = encodeURIComponent(sessionSlug);
  const canShowAgent = isAgentModeEnabled(location.search);
  const atlasTarget = buildDevNavAtlasTarget(location.pathname, location.search);

  const items: Array<{ testId: string; to: string; label: string }> = [
    { testId: E2E_TESTIDS.NAV_HOME, to: '/', label: 'Home' },
    { testId: E2E_TESTIDS.NAV_SURVEYS, to: '/surveys', label: 'Surveys' },
    { testId: E2E_TESTIDS.NAV_QUESTIONS, to: '/questions', label: 'Questions' },
    { testId: E2E_TESTIDS.NAV_SBTS, to: sbtsListPath(), label: 'SBTs' },
    { testId: E2E_TESTIDS.NAV_COMPARE, to: '/compare/', label: 'Compare' },
    { testId: E2E_TESTIDS.NAV_BOOKMARKS, to: '/bookmarks', label: 'Bookmarks' },
    { testId: E2E_TESTIDS.NAV_DOCS, to: '/docs', label: 'Docs' },
    { testId: E2E_TESTIDS.NAV_ABOUT, to: '/about', label: 'About' },
    { testId: E2E_TESTIDS.NAV_ADMIN, to: '/admin', label: 'Admin' },
    { testId: E2E_TESTIDS.NAV_SESSION, to: `/session/${encodedSession}`, label: 'Session' },
    { testId: E2E_TESTIDS.NAV_SESSION_DOCS, to: `/session/${encodedSession}/docs`, label: 'Session Docs' },
    { testId: E2E_TESTIDS.NAV_SESSION_WIZARD, to: '/session/new', label: 'Wizard' },
    { testId: E2E_TESTIDS.NAV_ATLAS, to: atlasTarget, label: 'Atlas' },
    { testId: E2E_TESTIDS.NAV_MATRIX, to: '/matrix', label: 'Matrix' },
  ].filter(Boolean);

  if (canShowAgent) {
    items.push({ testId: E2E_TESTIDS.NAV_AGENT, to: '/agent', label: 'Agent' });
  }

  // Keep styling inline so this remains a dev/E2E-only feature without new CSS churn.
  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 99999,
        top: 10,
        left: 10,
        padding: '10px 12px',
        borderRadius: 10,
        background: 'rgba(0,0,0,0.72)',
        border: '1px solid rgba(255,255,255,0.18)',
        color: '#fff',
        maxWidth: 260,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: 12,
        lineHeight: 1.2,
      }}
      aria-label="Dev/E2E Navigation"
    >
      <div style={{ marginBottom: 8, opacity: 0.9 }}>
        <div style={{ fontWeight: 700 }}>Dev/E2E Nav</div>
        <div style={{ opacity: 0.75 }}>sessionSlug: {sessionSlug}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item) => (
          <Link
            key={`${item.testId}:${item.to}`}
            to={item.to}
            data-testid={item.testId}
            style={{
              color: '#fff',
              textDecoration: 'none',
              padding: '6px 8px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
