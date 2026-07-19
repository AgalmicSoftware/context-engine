import { AGENT_BRIDGE_EVENT_TYPES, AGENT_BRIDGE_WORKER_VERSION, RISK_CEILINGS } from './constants.mjs';
import {
  buildDemoKeyExportRecord,
  deriveDemoPrivateKeyMaterial,
  deriveManagedDemoAccount,
  evaluateManagedAccountGrant,
  recoverManagedDemoAccountFromKey,
  summarizeDemoKeyExportForAudit,
} from './managedAccounts.mjs';
import { appendBridgeEvent } from './eventLog.mjs';
import { buildOpaqueActionId } from './opaqueActions.mjs';
import { assertNoSecretShape, redactSecrets } from './redaction.mjs';

const textEncoder = new TextEncoder();

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(secret, payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload));
  return bytesToHex(new Uint8Array(signature));
}

class MemoryDurableObjectState {
  constructor() {
    this.records = new Map();
  }

  async get(key) {
    return this.records.get(key);
  }

  async put(key, value) {
    this.records.set(key, value);
  }
}

export function createMemoryDurableObjectState() {
  return new MemoryDurableObjectState();
}

export class ManagedDemoSignerDurableObject {
  constructor(state = createMemoryDurableObjectState(), env = {}) {
    this.state = state;
    this.env = env;
  }

  rootSecret() {
    return String(this.env.DEMO_SIGNER_ROOT_SECRET || this.env.AGENT_BRIDGE_DEMO_ROOT_SECRET || '');
  }

  deploymentId(inputDeploymentId = '') {
    return String(inputDeploymentId || this.env.AGENT_BRIDGE_DEPLOYMENT_ID || 'local-demo').trim();
  }

  async getOrCreateAccount({
    principal = {},
    deploymentId = '',
    createdAt = null,
    lifecycle,
  } = {}) {
    const account = await deriveManagedDemoAccount({
      principal,
      deploymentId: this.deploymentId(deploymentId),
      rootSecret: this.rootSecret(),
      createdAt,
      lifecycle,
    });
    await this.state.put(`account:${account.accountId}`, account);
    return account;
  }

  async signCanonicalDemoEnvelope({
    principal = {},
    deploymentId = '',
    account = null,
    grant = {},
    sessionSlug = '',
    action = 'direct_submit_response',
    requestedRisk = RISK_CEILINGS.SUBMIT,
    canonicalPayload = {},
    createdAt = null,
  } = {}) {
    const managedAccount = account || await this.getOrCreateAccount({ principal, deploymentId, createdAt });
    const grantCheck = evaluateManagedAccountGrant({
      account: managedAccount,
      grant,
      sessionSlug,
      action,
      requestedRisk,
    });
    if (!grantCheck.ok) {
      return {
        ok: false,
        reason: grantCheck.reason,
        account: redactSecrets(managedAccount),
      };
    }
    const payload = {
      type: 'managed_demo_signed_payload',
      version: AGENT_BRIDGE_WORKER_VERSION,
      accountId: managedAccount.accountId,
      accountAddress: managedAccount.accountAddress,
      sessionSlug,
      action,
      chainScope: 'testnet',
      broadcast: false,
      canonicalPayload: redactSecrets(canonicalPayload),
      createdAt,
    };
    assertNoSecretShape(payload, 'Signed demo envelopes must not embed secrets.');
    const canonical = canonicalJson(payload);
    let privateKey;
    try {
      privateKey = await deriveDemoPrivateKeyMaterial({
        principal: managedAccount.principal,
        deploymentId: managedAccount.workerDeploymentId,
        rootSecret: this.rootSecret(),
      });
    } catch (error) {
      return {
        ok: false,
        reason: String(error?.message || error || 'managed_demo_signing_failed'),
        account: redactSecrets(managedAccount),
      };
    }
    const signature = `0x${await hmacSha256Hex(privateKey, canonical)}`;
    const signedEnvelope = {
      ...payload,
      envelopeId: buildOpaqueActionId(`signed|${canonical}`),
      signature,
      signerBoundary: 'durable_object_managed_demo_signer',
      signingAlgorithm: 'hmac-sha256-demo-envelope',
    };
    const events = appendBridgeEvent([], {
      eventType: AGENT_BRIDGE_EVENT_TYPES.SIGNED_ENVELOPE_CREATED,
      accountId: managedAccount.accountId,
      sessionSlug,
      questionId: canonicalPayload.questionId,
      summary: {
        action,
        envelopeId: signedEnvelope.envelopeId,
        broadcast: false,
      },
      createdAt,
    });
    return {
      ok: true,
      account: redactSecrets(managedAccount),
      signedEnvelope,
      events,
    };
  }

  async exportDemoKey({ account = {}, principal = {}, deploymentId = '', reveal = false, createdAt = null } = {}) {
    const result = await buildDemoKeyExportRecord({
      account,
      principal,
      deploymentId: this.deploymentId(deploymentId),
      rootSecret: this.rootSecret(),
      reveal,
      createdAt,
    });
    if (!result.ok) return result;
    const audit = summarizeDemoKeyExportForAudit(result.record);
    return {
      ok: true,
      reveal: reveal === true ? result.record : { ...result.record, privateKey: null },
      audit,
      events: appendBridgeEvent([], {
        eventType: AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_KEY_EXPORTED,
        accountId: account.accountId,
        summary: audit,
        createdAt,
      }),
    };
  }

  recoverDemoKey(input = {}) {
    const result = recoverManagedDemoAccountFromKey(input);
    if (!result.ok) return result;
    return {
      ...result,
      events: appendBridgeEvent([], {
        eventType: AGENT_BRIDGE_EVENT_TYPES.ACCOUNT_KEY_RECOVERED,
        accountId: result.account.accountId,
        summary: result.audit,
        createdAt: input.createdAt || null,
      }),
    };
  }
}
