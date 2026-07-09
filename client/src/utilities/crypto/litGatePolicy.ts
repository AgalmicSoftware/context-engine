/**
 * @module litGatePolicy
 * @description Lit Protocol gate policy builders — constructs access control condition sets
 *              for survey response encryption and upload gating based on SBT holdings.
 *
 * Key exports: buildResponseGatePolicy, buildUploadGatePolicy, createLitRecipientFromGate
 */
import { buildSbtAccessControlConditions, resolveLitChain } from './litProtocol.js';
import {
  SPONSORED_GATE_STATES,
  getGateSbtAddresses,
  normalizeGateMode,
  resolveSponsoredGateStateForResource,
} from '../web3/sponsoredAccess.js';
import type { SponsoredGate } from '../web3/sponsoredAccessState.js';
import { createLogger } from '../logging.js';
import { toStr } from '../shared/primitives.js';

type UnknownRecord = Record<string, unknown>;
type LitGate = UnknownRecord & {
  type?: unknown;
  label?: unknown;
  name?: unknown;
  title?: unknown;
  gateId?: unknown;
  id?: unknown;
  sbtAddress?: unknown;
  sbtAddresses?: unknown;
  chainId?: unknown;
  litChain?: unknown;
  chain?: unknown;
};

type LitRecipient = {
  accessControlConditions: unknown;
  chain: string | null;
  [key: string]: unknown;
};

type GatePolicyGate = {
  type: 'sbt';
  label: string | null;
  gateId: string | null;
  sbtAddresses: string[];
  chainId: number | string | null;
  litChain: string | null;
  chain?: string | null;
  mode: string;
};

type GateRecipientPayload = {
  resourceKey: string;
  gate: GatePolicyGate;
  recipient: LitRecipient;
};

type GatePolicyAccumulator = {
  gates: GatePolicyGate[];
  recipients: LitRecipient[];
};

type GatePolicyArgs = {
  cfg?: UnknownRecord;
  fallbackChainId?: number | string | null;
};

type ResponseGatePolicyArgs = GatePolicyArgs & {
  isQuestionResponseFlow?: boolean;
};

type UploadTargets = {
  survey?: boolean;
  questions?: boolean;
  questionTags?: boolean;
  docUrls?: boolean;
  [key: string]: unknown;
};

type UploadGatePolicyArgs = GatePolicyArgs & {
  targets?: UploadTargets;
  isStandaloneQuestion?: boolean;
  manualGate?: LitGate | null;
};

type AppendGateRecipientArgs = {
  out: GatePolicyAccumulator;
  dedupe: Set<string>;
  gateDedupe: Set<string>;
  gate?: LitGate | null;
  fallbackChainId?: number | string | null;
  resourceKey: string;
};

const log = createLogger('crypto', { prefix: '[litGatePolicy]' });

const normalizeText = (value: unknown): string => {
  const text = toStr(value).trim();
  if (!text) return '';
  if (/^\[object\s+object\]$/i.test(text)) return '';
  return text;
};

const normalizeGateType = (value: unknown): string => toStr(value).trim().toLowerCase();

const buildRecipientDedupeKey = (recipient: LitRecipient): string =>
  JSON.stringify({
    chain: recipient.chain || null,
    accessControlConditions: recipient.accessControlConditions || null,
  });

const buildGateDedupeKey = (gate: LitGate): string =>
  JSON.stringify({
    chainId: Number(gate?.chainId || 0) || null,
    litChain: toStr(gate?.litChain || gate?.chain || '')
      .trim()
      .toLowerCase(),
    mode: normalizeGateMode(gate as SponsoredGate),
    sbtAddresses: getGateSbtAddresses(gate as SponsoredGate)
      .map((addr) => addr.toLowerCase())
      .sort(),
  });

export const createLitRecipientFromGate = ({
  gate,
  fallbackChainId,
  resourceKey = '',
}: {
  gate?: LitGate | null;
  fallbackChainId?: number | string | null;
  resourceKey?: string;
} = {}): GateRecipientPayload | null => {
  const rawGateType = gate?.type;
  const gateType = normalizeGateType(rawGateType);
  if (typeof rawGateType !== 'undefined' && gateType !== 'sbt') {
    log.warn('Skipping unsupported gate type while building Lit policy; failing closed.', {
      gateType,
      resourceKey: toStr(resourceKey).trim() || null,
    });
    return null;
  }

  const sponsoredGate = gate as SponsoredGate;
  const sbtAddresses = getGateSbtAddresses(sponsoredGate);
  if (!sbtAddresses.length) return null;

  const gateChainId = Number(gate?.chainId || fallbackChainId || 0) || fallbackChainId || null;
  const litChain = resolveLitChain({
    chainId: gateChainId,
    litChain: gate?.litChain || gate?.chain,
  });
  const mode = normalizeGateMode(sponsoredGate) || 'any';
  const accessControlConditions = buildSbtAccessControlConditions({
    sbtAddresses,
    chainId: gateChainId,
    litChain,
    mode,
  });
  if (!accessControlConditions) return null;

  return {
    resourceKey: toStr(resourceKey).trim(),
    gate: {
      type: 'sbt',
      label: normalizeText(gate?.label || gate?.name || gate?.title) || null,
      gateId: normalizeText(gate?.gateId || gate?.id) || null,
      sbtAddresses,
      chainId: gateChainId,
      litChain,
      mode,
    },
    recipient: {
      accessControlConditions,
      chain: litChain,
    },
  };
};

const appendGateRecipient = ({
  out,
  dedupe,
  gateDedupe,
  gate,
  fallbackChainId,
  resourceKey,
}: AppendGateRecipientArgs): void => {
  const payload = createLitRecipientFromGate({
    gate,
    fallbackChainId,
    resourceKey,
  });
  if (!payload) return;
  const gateKey = buildGateDedupeKey(payload.gate);
  const recipientKey = buildRecipientDedupeKey(payload.recipient);
  if (gateDedupe.has(gateKey) || dedupe.has(recipientKey)) return;
  gateDedupe.add(gateKey);
  dedupe.add(recipientKey);
  out.gates.push(payload.gate);
  out.recipients.push(payload.recipient);
};

export const buildResponseGatePolicy = ({
  cfg = {},
  isQuestionResponseFlow = false,
  fallbackChainId = null,
}: ResponseGatePolicyArgs = {}) => {
  const primaryResource = isQuestionResponseFlow ? 'questionResponses' : 'surveyResponses';
  const primaryState = resolveSponsoredGateStateForResource(cfg, primaryResource);
  const primaryGateIsExplicitOpen = primaryState?.status === SPONSORED_GATE_STATES.OPEN;

  const out: GatePolicyAccumulator = { gates: [], recipients: [] };
  const dedupe = new Set<string>();
  const gateDedupe = new Set<string>();

  if (primaryState?.status === SPONSORED_GATE_STATES.RESTRICTED && primaryState.gate) {
    appendGateRecipient({
      out,
      dedupe,
      gateDedupe,
      gate: primaryState.gate,
      fallbackChainId,
      resourceKey: primaryResource,
    });
  }

  if (!primaryGateIsExplicitOpen) {
    const defaultState = resolveSponsoredGateStateForResource(cfg, 'default');
    if (defaultState?.status === SPONSORED_GATE_STATES.RESTRICTED && defaultState.gate) {
      appendGateRecipient({
        out,
        dedupe,
        gateDedupe,
        gate: defaultState.gate,
        fallbackChainId,
        resourceKey: 'default',
      });
    }
  }

  return {
    primaryResource,
    gates: out.gates,
    recipients: out.recipients,
    allowFallbackConditions: !primaryGateIsExplicitOpen,
  };
};

const resolveUploadResourceKeys = ({
  targets = {},
  isStandaloneQuestion = false,
}: {
  targets?: UploadTargets;
  isStandaloneQuestion?: boolean;
} = {}): string[] => {
  const out: string[] = [];
  if (isStandaloneQuestion) {
    if (targets.questions || targets.questionTags) out.push('questionResponses');
    return out;
  }

  if (targets.questions || targets.questionTags || targets.survey) out.push('surveyResponses');
  if (targets.docUrls) out.push('docUrls');
  return out;
};

export const buildUploadGatePolicy = ({
  cfg = {},
  targets = {},
  isStandaloneQuestion = false,
  fallbackChainId = null,
  manualGate = null,
}: UploadGatePolicyArgs = {}) => {
  const resourceKeys = resolveUploadResourceKeys({ targets, isStandaloneQuestion });
  const states = resourceKeys.map((resourceKey) => ({
    resourceKey,
    state: resolveSponsoredGateStateForResource(cfg, resourceKey),
  }));

  const out: GatePolicyAccumulator = { gates: [], recipients: [] };
  const dedupe = new Set<string>();
  const gateDedupe = new Set<string>();

  let hasExplicitOpenResource = false;
  states.forEach(({ resourceKey, state }) => {
    if (state?.status === SPONSORED_GATE_STATES.OPEN) {
      hasExplicitOpenResource = true;
      return;
    }
    if (state?.status === SPONSORED_GATE_STATES.RESTRICTED && state.gate) {
      appendGateRecipient({
        out,
        dedupe,
        gateDedupe,
        gate: state.gate,
        fallbackChainId,
        resourceKey,
      });
    }
  });

  const hasNonOpenResource = states.some(({ state }) => state?.status !== SPONSORED_GATE_STATES.OPEN);
  if (hasNonOpenResource) {
    const defaultState = resolveSponsoredGateStateForResource(cfg, 'default');
    if (defaultState?.status === SPONSORED_GATE_STATES.RESTRICTED && defaultState.gate) {
      appendGateRecipient({
        out,
        dedupe,
        gateDedupe,
        gate: defaultState.gate,
        fallbackChainId,
        resourceKey: 'default',
      });
    }
  }

  if (manualGate) {
    appendGateRecipient({
      out,
      dedupe,
      gateDedupe,
      gate: manualGate,
      fallbackChainId,
      resourceKey: 'manual',
    });
  }

  return {
    resourceKeys,
    gates: out.gates,
    recipients: out.recipients,
    hasExplicitOpenResource,
  };
};
