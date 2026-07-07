import { t } from '../../utilities/ui/terminology.js';
import { normalizeAiProvider } from './sessionWizardAiConfig';

type SessionWizardSecretFieldType = 'password' | 'text' | 'textarea';

type SessionWizardSecretField = {
  key: string;
  label: string;
  type: SessionWizardSecretFieldType;
  placeholder?: string;
  required?: boolean;
  rows?: number;
};

type SessionWizardResourceRecord = Record<string, unknown>;

const isResourceRecord = (value: unknown): value is SessionWizardResourceRecord =>
  value !== null && typeof value === 'object';

const readAiModelProvider = (ai: unknown, modelKey: string): string => {
  const aiRecord = isResourceRecord(ai) ? ai : {};
  const models = isResourceRecord(aiRecord.models) ? aiRecord.models : {};
  const model = isResourceRecord(models[modelKey]) ? models[modelKey] : {};
  return normalizeAiProvider(model.provider || 'openai');
};

export const RESOURCE_LABELS: Record<string, string> = {
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

export const RESOURCE_SECTION_TOOLTIPS: Readonly<Record<string, string>> = Object.freeze({
  ai: 'Session-funded OpenAI key used for text generation and transcription.',
  rpc: 'Authenticated RPC endpoint used by the worker for chain reads and related operations.',
  arweave: `${t('wallet')} used to pay for Arweave uploads and storage.`,
  txGas: 'Faucet signer used to send small testnet funding grants.',
  lit: 'Worker-mediated Lit Chipotle setup. Paste one Lit API key; the worker derives the scoped group, PKP, and CE action after deploy.',
});

const RESOURCE_SECRET_FIELDS: Record<string, SessionWizardSecretField[]> = Object.freeze({
  ai: [{ key: 'openaiKey', label: 'OpenAI key', type: 'password', required: true }],
  rpc: [
    { key: 'customRpcUrl', label: 'Custom RPC URL', type: 'text', placeholder: 'https://...' },
    // Intentionally hidden until PATH gateway auth is supported.
    // { key: 'customRpcKey', label: 'Custom RPC key', type: 'password' },
  ],
  arweave: [{ key: 'arweaveJwk', label: 'Arweave JWK', type: 'textarea', rows: 3, required: true }],
  txGas: [{ key: 'faucetPrivateKey', label: 'Faucet private key', type: 'password' }],
  default: [],
  lit: [{ key: 'litAccountApiKey', label: 'Lit API key', type: 'password' }],
});

export const resolveSessionWizardAiModelProviders = (
  ai: unknown,
): {
  fastProvider: string;
  thinkingProvider: string;
} => {
  const fastProvider = readAiModelProvider(ai, 'fast');
  const thinkingProvider = readAiModelProvider(ai, 'thinking');
  return { fastProvider, thinkingProvider };
};

export const resolveSessionWizardResourceSecretFields = (
  resourceKey: string,
  ai: unknown,
): SessionWizardSecretField[] => {
  void ai;
  if (resourceKey !== 'ai') return [...(RESOURCE_SECRET_FIELDS[resourceKey] || [])];
  return [...RESOURCE_SECRET_FIELDS.ai];
};
