import { AGENT_BRIDGE_EVENT_TYPES, AGENT_BRIDGE_WORKER_VERSION } from './constants.mjs';
import { buildOpaqueActionId } from './opaqueActions.mjs';
import { redactSecrets, sanitizeForGroup } from './redaction.mjs';

const EVENT_TYPE_SET = new Set(Object.values(AGENT_BRIDGE_EVENT_TYPES));

export function normalizeBridgeEvent(event = {}) {
  const eventType = EVENT_TYPE_SET.has(event.eventType)
    ? event.eventType
    : AGENT_BRIDGE_EVENT_TYPES.FAILED;
  const summary = redactSecrets(event.summary || {});
  const refs = redactSecrets(event.refs || {});
  return {
    type: 'agent_bridge_event',
    version: AGENT_BRIDGE_WORKER_VERSION,
    eventId: String(event.eventId || buildOpaqueActionId(`${eventType}|${event.createdAt || ''}|${JSON.stringify(refs)}`)),
    eventType,
    lane: String(event.lane || '').trim() || null,
    telegramGroupChatId: String(event.telegramGroupChatId || '').trim() || null,
    telegramPrincipalId: String(event.telegramPrincipalId || '').trim() || null,
    accountId: String(event.accountId || '').trim() || null,
    sessionSlug: String(event.sessionSlug || '').trim() || null,
    questionId: String(event.questionId || '').trim() || null,
    summary,
    refs,
    createdAt: event.createdAt || new Date(0).toISOString(),
  };
}

export function appendBridgeEvent(events = [], event = {}) {
  return [...events, normalizeBridgeEvent(event)];
}

export function summarizeEventLog(events = []) {
  const counts = {};
  for (const event of events.map(normalizeBridgeEvent)) {
    counts[event.eventType] = (counts[event.eventType] || 0) + 1;
  }
  return sanitizeForGroup({
    type: 'agent_bridge_event_log_summary',
    count: events.length,
    counts,
    latestEventType: events.length ? normalizeBridgeEvent(events[events.length - 1]).eventType : null,
  });
}
