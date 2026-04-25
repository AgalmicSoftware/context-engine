import { t } from '../../utilities/ui/terminology.js';
import { normalizeAiProvider } from './sessionWizardAiConfig';
import type { AnyRecord } from '../shellTypes';

type SessionWizardSecretField = {
  key: string;
  label: string;
  type: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
};

export const RESOURCE_LABELS = {
  default: 'DEFAULT',
  questionResponses: 'QUESTION RESPONSES',
  surveyResponses: 'SURVEY RESPONSES',
  docUploads: 'DOC UPLOADS',
  docUrls: 'DOC URLS',
  ai: 'AI',
  arweave: 'ARWEAVE',
  rpc: 'RPC',
  txGas: 'TXGAS',
  lit: 'LIT',
};

export const RESOURCE_SECTION_TOOLTIPS = Object.freeze({
  ai: 'Session-funded API keys used for AI inference and transcription.',
  rpc: 'Authenticated RPC endpoint used by the worker for chain reads and related operations.',
  arweave: `${t('wallet')} used to pay for Arweave uploads and storage.`,
  txGas: 'Faucet signer used to send small testnet funding grants.',
  lit: `Payer ${t('walletLower')} used to sponsor Lit operations for this session.`,
});

const RESOURCE_SECRET_FIELDS: Record<string, SessionWizardSecretField[]> = Object.freeze({
  ai: [
    { key: 'openaiKey', label: 'OpenAI key', type: 'password', required: true },
  ],
  rpc: [
    { key: 'customRpcUrl', label: 'Custom RPC URL', type: 'text', placeholder: 'https://...' },
    // Intentionally hidden until PATH gateway auth is supported (tracked in PRD 198 / 354).
    // { key: 'customRpcKey', label: 'Custom RPC key', type: 'password' },
  ],
  arweave: [
    { key: 'arweaveJwk', label: 'Arweave JWK', type: 'textarea', rows: 3, required: true },
  ],
  txGas: [
    { key: 'faucetPrivateKey', label: 'Faucet private key', type: 'password' },
  ],
  default: [],
  lit: [
    { key: 'litPayerPrivateKey', label: 'Lit payer private key', type: 'password' },
  ],
});

const ANTHROPIC_AI_SECRET_FIELD: SessionWizardSecretField = {
  key: 'anthropicKey',
  label: 'Anthropic key',
  type: 'password',
  required: true,
};
const OPENROUTER_AI_SECRET_FIELD: SessionWizardSecretField = {
  key: 'openrouterKey',
  label: 'OpenRouter key',
  type: 'password',
};

export const resolveSessionWizardAiModelProviders = (ai: AnyRecord | null | undefined): {
  fastProvider: string;
  thinkingProvider: string;
} => {
  const fastProvider = normalizeAiProvider(ai?.models?.fast?.provider || 'openai');
  const thinkingProvider = normalizeAiProvider(ai?.models?.thinking?.provider || 'openai');
  return { fastProvider, thinkingProvider };
};

export const resolveSessionWizardResourceSecretFields = (
  resourceKey: string,
  ai: AnyRecord | null | undefined,
): SessionWizardSecretField[] => {
  if (resourceKey !== 'ai') return [...(RESOURCE_SECRET_FIELDS[resourceKey] || [])];
  const { fastProvider, thinkingProvider } = resolveSessionWizardAiModelProviders(ai);
  const fields = [...RESOURCE_SECRET_FIELDS.ai];
  if (fastProvider === 'anthropic' || thinkingProvider === 'anthropic') fields.push(ANTHROPIC_AI_SECRET_FIELD);
  if (fastProvider === 'openrouter' || thinkingProvider === 'openrouter') fields.push(OPENROUTER_AI_SECRET_FIELD);
  return fields;
};
