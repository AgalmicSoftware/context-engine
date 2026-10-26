import { buildSiweMessage as buildClientMessage } from './workerAuth';
import { normalizeWorkerCanonicalSessionIdHex as normalizeClientId } from '../session/sessionWorkerDiscovery';
import { resolveSessionConfigSessionIdHex } from '../../../../workers/sessionCorsWorker/sessionConfigMutation.js';
import {
  buildSiweMessage as buildMcpMessage,
  normalizeSessionIdHex as normalizeMcpId,
} from '../../../../mcp/lib/workerClient.mjs';
import {
  parseSiweMessage,
  validateSiwe,
  validateSiweResources,
} from '../../../../workers/sessionCorsWorker/siweMessageValidation.js';

const SESSION_ID = '0x00112233445566778899aabbccddeeff';
const BASE = {
  address: '0x00000000000000000000000000000000000000aa',
  nonce: 'abcdef1234567890',
  chainId: 11155420,
  appOrigin: 'https://app.example.test',
  workerOrigin: 'https://worker.example.test',
  issuedAt: '2026-10-26T12:00:00.000Z',
  expirationTime: '2026-10-26T12:10:00.000Z',
};
const now = () => Date.parse('2026-10-26T12:01:00.000Z');
const clientMessage = (vector) =>
  buildClientMessage({
    ...vector,
    domain: new URL(vector.appOrigin).host,
    uri: vector.appOrigin,
    workerUrl: vector.workerOrigin,
  });

describe('browser, MCP and Worker sign-in conformance', () => {
  it.each([
    ['canonical session', { sessionId: SESSION_ID }],
    ['registry session', { sessionSlug: 'town-hall' }],
    ['default registry session', { sessionSlug: 'general' }],
    ['local origin with port', { appOrigin: 'http://localhost:3000', sessionId: SESSION_ID }],
  ])('accepts identical bytes for %s', (_label, overrides) => {
    const vector = { ...BASE, ...overrides };
    const message = clientMessage(vector);
    expect(message).toBe(buildMcpMessage(vector));
    const parsed = parseSiweMessage(message);
    expect(validateSiwe(parsed, { now, requireIssuedAt: true })).toEqual({ ok: true });
    expect(
      validateSiweResources({
        siwe: parsed,
        request: new Request(`${vector.workerOrigin}/auth/login`),
        targetSlug: vector.sessionSlug,
        config: vector.sessionId
          ? {
              sessionId: vector.sessionId,
              sessionModeProfile: { authority: { mode: 'worker_canonical' } },
            }
          : {},
      }),
    ).toEqual({ ok: true });
  });

  it.each([
    ['short nonce', (message) => message.replace('abcdef1234567890', 'short')],
    ['bad address', (message) => message.replace(BASE.address, '0x123')],
    ['duplicate field', (message) => message.replace('Version: 1', 'Version: 1\nVersion: 1')],
    ['CRLF', (message) => message.replace(/\n/g, '\r\n')],
    ['wrong domain', (message) => message.replace(/^app.example.test/, 'other.example.test')],
    ['expired', (message) => message.replace(BASE.expirationTime, BASE.issuedAt)],
  ])('rejects %s from either builder', (_label, mutate) => {
    const vector = { ...BASE, sessionId: SESSION_ID };
    for (const builder of [clientMessage, buildMcpMessage]) {
      expect(validateSiwe(parseSiweMessage(mutate(builder(vector))), { now, requireIssuedAt: true }).ok).toBe(false);
    }
  });

  it.each([
    [SESSION_ID, SESSION_ID],
    [SESSION_ID.toUpperCase(), SESSION_ID],
    [SESSION_ID.slice(2), SESSION_ID],
    ['00112233-4455-6677-8899-AABBCCDDEEFF', SESSION_ID],
    ['0x00000000000000000000000000000000', ''],
    ['00000000-0000-0000-0000-000000000000', ''],
    [` ${SESSION_ID}`, ''],
    [`${SESSION_ID} `, ''],
    ['0x0011-2233445566778899aabbccddeeff', ''],
    ['00112233445566778899aabbccddeeff-', ''],
    ['0x1234', ''],
    [null, ''],
    [{}, ''],
  ])('normalizes session ID %p consistently', (input, expected) => {
    expect(normalizeClientId(input)).toBe(expected);
    expect(normalizeMcpId(input)).toBe(expected);
    expect(resolveSessionConfigSessionIdHex({ sessionId: input })).toBe(expected);
  });
});
