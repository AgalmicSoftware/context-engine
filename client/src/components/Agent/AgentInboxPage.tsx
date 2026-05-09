import React, { useEffect, useMemo, useState } from 'react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { toStr } from '../../utilities/shared/primitives.js';

export type CeActivityEvent = {
  eventId?: unknown;
  accountId?: unknown;
  subjectAddress?: unknown;
  session?: unknown;
  actorType?: unknown;
  actorId?: unknown;
  eventType?: unknown;
  requestId?: unknown;
  grantId?: unknown;
  resourceRef?: unknown;
  safeSummary?: unknown;
  createdAt?: unknown;
};

type AgentInboxPayload = {
  activity?: CeActivityEvent[];
  activityCount?: number;
  activityEventCounts?: Record<string, number>;
  requests?: unknown[];
  pendingResponses?: unknown[];
  error?: unknown;
};

type AgentInboxPageProps = {
  fetchInbox?: (url: string) => Promise<AgentInboxPayload>;
};

const abbreviateAddress = (value: unknown) => {
  const normalized = toStr(value).trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(normalized)) {
    return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
  }
  return normalized;
};

const formatEventType = (value: unknown) => (
  toStr(value || 'activity_recorded')
    .replace(/[._:-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

const readSessionQuery = () => {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('session') || '';
};

export const buildAgentInboxApiPath = (session = '') => {
  const normalized = toStr(session).trim();
  return normalized ? `/api/agent/inbox?session=${encodeURIComponent(normalized)}` : '/api/agent/inbox';
};

const defaultFetchInbox = async (url: string): Promise<AgentInboxPayload> => {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(toStr(payload?.error || payload?.message || `Inbox request failed (${response.status}).`));
  }
  return payload;
};

const normalizeActivity = (payload: AgentInboxPayload | null): CeActivityEvent[] => (
  Array.isArray(payload?.activity) ? payload.activity : []
);

const pageStyles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '60vh',
    padding: '24px',
    color: '#f7f7f7',
    background: '#12161c',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-start',
    maxWidth: 1120,
    margin: '0 auto 18px',
  },
  title: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.2,
  },
  subtitle: {
    margin: '6px 0 0',
    color: 'rgba(247,247,247,0.72)',
    fontSize: 13,
  },
  tabs: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  tab: {
    border: '1px solid rgba(247,247,247,0.16)',
    borderRadius: 8,
    background: 'rgba(247,247,247,0.10)',
    color: '#f7f7f7',
    padding: '8px 10px',
    fontSize: 13,
    minWidth: 96,
  },
  content: {
    maxWidth: 1120,
    margin: '0 auto',
  },
  list: {
    display: 'grid',
    gap: 10,
  },
  row: {
    border: '1px solid rgba(247,247,247,0.14)',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.05)',
    padding: 14,
  },
  rowTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'baseline',
  },
  eventType: {
    fontSize: 14,
    fontWeight: 700,
    textTransform: 'capitalize',
  },
  time: {
    color: 'rgba(247,247,247,0.58)',
    fontSize: 12,
    whiteSpace: 'nowrap',
  },
  summary: {
    margin: '7px 0 10px',
    color: '#f7f7f7',
    fontSize: 14,
    lineHeight: 1.45,
  },
  meta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px 8px',
    color: 'rgba(247,247,247,0.68)',
    fontSize: 12,
  },
  pill: {
    border: '1px solid rgba(247,247,247,0.12)',
    borderRadius: 8,
    padding: '3px 6px',
    maxWidth: '100%',
    overflowWrap: 'anywhere',
  },
  empty: {
    border: '1px dashed rgba(247,247,247,0.18)',
    borderRadius: 8,
    padding: 18,
    color: 'rgba(247,247,247,0.72)',
    fontSize: 14,
  },
  alert: {
    border: '1px solid rgba(255,120,120,0.35)',
    borderRadius: 8,
    padding: 14,
    color: '#ffd6d6',
    background: 'rgba(120,0,0,0.18)',
    fontSize: 14,
  },
};

export default function AgentInboxPage({ fetchInbox = defaultFetchInbox }: AgentInboxPageProps) {
  const session = readSessionQuery();
  const apiPath = useMemo(() => buildAgentInboxApiPath(session), [session]);
  const [payload, setPayload] = useState<AgentInboxPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    fetchInbox(apiPath)
      .then((nextPayload) => {
        if (!alive) return;
        setPayload(nextPayload);
      })
      .catch((err) => {
        if (!alive) return;
        setPayload(null);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [apiPath, fetchInbox]);

  const activity = normalizeActivity(payload);
  const requestCount = Array.isArray(payload?.requests) ? payload.requests.length : 0;
  const draftCount = Array.isArray(payload?.pendingResponses) ? payload.pendingResponses.length : 0;
  const totalActivity = Number.isFinite(payload?.activityCount) ? Number(payload?.activityCount) : activity.length;

  return (
    <main data-testid={E2E_TESTIDS.PAGE_AGENT_INBOX_ROOT} style={pageStyles.root}>
      <div style={pageStyles.header}>
        <div>
          <h1 style={pageStyles.title}>Inbox</h1>
          <p style={pageStyles.subtitle}>
            {session ? `Session ${session}` : 'All sessions'} · {totalActivity} events
          </p>
        </div>
        <div role="tablist" aria-label="Inbox views" style={pageStyles.tabs}>
          <button type="button" role="tab" aria-selected="true" style={pageStyles.tab}>History</button>
          <button type="button" role="tab" aria-selected="false" style={pageStyles.tab}>
            Requests {requestCount}
          </button>
          <button type="button" role="tab" aria-selected="false" style={pageStyles.tab}>
            Drafts {draftCount}
          </button>
        </div>
      </div>

      <section data-testid={E2E_TESTIDS.AGENT_INBOX_HISTORY} style={pageStyles.content}>
        {loading ? <div style={pageStyles.empty}>Loading activity...</div> : null}
        {!loading && error ? <div role="alert" style={pageStyles.alert}>{error}</div> : null}
        {!loading && !error && !activity.length ? (
          <div data-testid={E2E_TESTIDS.AGENT_INBOX_EMPTY} style={pageStyles.empty}>
            No activity yet.
          </div>
        ) : null}
        {!loading && !error && activity.length ? (
          <div style={pageStyles.list}>
            {activity.map((event, index) => {
              const createdAt = toStr(event.createdAt).trim();
              const meta = [
                ['actor', toStr(event.actorType || event.actorId)],
                ['account', abbreviateAddress(event.subjectAddress || event.accountId)],
                ['session', event.session],
                ['request', event.requestId],
                ['grant', event.grantId],
                ['ref', event.resourceRef],
              ].filter(([, value]) => toStr(value).trim());
              return (
                <article
                  key={toStr(event.eventId) || `${toStr(event.eventType)}-${index}`}
                  data-testid={E2E_TESTIDS.AGENT_INBOX_EVENT}
                  style={pageStyles.row}
                >
                  <div style={pageStyles.rowTop}>
                    <div style={pageStyles.eventType}>{formatEventType(event.eventType)}</div>
                    {createdAt ? <time style={pageStyles.time}>{createdAt}</time> : null}
                  </div>
                  <p style={pageStyles.summary}>{toStr(event.safeSummary || 'Activity recorded.')}</p>
                  <div style={pageStyles.meta}>
                    {meta.map(([label, value]) => (
                      <span key={`${label}:${toStr(value)}`} style={pageStyles.pill}>
                        {label}: {abbreviateAddress(value)}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}
