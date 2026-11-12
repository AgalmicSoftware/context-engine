import { t } from '../../utilities/ui/terminology.js';
import { normalizeAiProvider } from './sessionWizardAiConfig';

type SessionWizardSecretFieldType = 'password' | 'text' | 'textarea';

export type SessionWizardSecretField = {
  key: string;
  label: string;
  type: SessionWizardSecretFieldType;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  /** Behind the field's "?". */
  help?: string;
};

const KEPT_SECRET = 'Create gives it to the session’s Worker, which keeps it secret.';
const NOT_SAVED = 'It is never saved in this browser or in templates.';

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
  txGas: 'Test gas faucet',
  lit: 'LIT',
};

export const RESOURCE_SECTION_TOOLTIPS: Readonly<Record<string, string>> = Object.freeze({
  ai: 'Session-funded provider key used by the selected AI models.',
  rpc: 'Authenticated RPC endpoint used by the worker for chain reads and related operations.',
  arweave: `${t('wallet')} used to pay for Arweave uploads and storage.`,
  txGas: 'Faucet signer used to send small testnet funding grants.',
  lit: 'Worker-mediated Lit Chipotle setup. Paste one Lit API key; the worker derives the scoped group, PKP, and CE action after deploy.',
});

const RESOURCE_SECRET_FIELDS: Record<string, SessionWizardSecretField[]> = Object.freeze({
  ai: [],
  rpc: [
    {
      key: 'customRpcUrl',
      label: 'Custom RPC URL',
      type: 'text',
      placeholder: 'https://...',
      help: 'The RPC address the Worker uses to read the chain and send its transactions. Blank uses the default shown.',
    },
    // Intentionally hidden until PATH gateway auth is supported.
    // { key: 'customRpcKey', label: 'Custom RPC key', type: 'password' },
  ],
  arweave: [
    {
      key: 'arweaveJwk',
      label: 'Arweave JWK',
      type: 'textarea',
      rows: 3,
      required: true,
      help: `The key file of the Arweave wallet that pays for the session’s uploads, pasted as text. ${KEPT_SECRET}`,
    },
  ],
  txGas: [
    {
      key: 'faucetPrivateKey',
      label: 'Faucet private key',
      type: 'password',
      help: `The private key of a test wallet that sends participants small grants of test gas. Use a wallet that holds only test funds. ${KEPT_SECRET}`,
    },
  ],
  default: [],
  lit: [
    {
      key: 'litAccountApiKey',
      label: 'Lit API key',
      type: 'password',
      help: `Your Lit usage API key. After Create, the Worker uses it to set up what releases Lit-encrypted answers. ${NOT_SAVED}`,
    },
  ],
});

const AI_PROVIDER_SECRET_FIELDS: Readonly<Record<string, SessionWizardSecretField>> = Object.freeze({
  openai: {
    key: 'openaiKey',
    label: 'OpenAI key',
    type: 'password',
    required: true,
    help: `Your OpenAI API key. ${KEPT_SECRET} Suggest questions sends it from this browser straight to OpenAI. ${NOT_SAVED}`,
  },
  anthropic: {
    key: 'anthropicKey',
    label: 'Anthropic key',
    type: 'password',
    required: true,
    help: `Your Anthropic API key, for the Claude models chosen under AI. ${KEPT_SECRET} ${NOT_SAVED}`,
  },
  openrouter: {
    key: 'openrouterKey',
    label: 'OpenRouter key',
    type: 'password',
    required: true,
    help: `Your OpenRouter API key, for the models chosen under AI. ${KEPT_SECRET} ${NOT_SAVED}`,
  },
});

export const resolveSessionWizardAiModelProviders = (
  ai: unknown,
): {
  fastProvider: string;
  thinkingProvider: string;
  transcriptionProvider: string;
} => {
  const fastProvider = readAiModelProvider(ai, 'fast');
  const thinkingProvider = readAiModelProvider(ai, 'thinking');
  const transcriptionProvider = readAiModelProvider(ai, 'transcription');
  return { fastProvider, thinkingProvider, transcriptionProvider };
};

export const resolveSessionWizardResourceSecretFields = (
  resourceKey: string,
  ai: unknown,
): SessionWizardSecretField[] => {
  if (resourceKey !== 'ai') return [...(RESOURCE_SECRET_FIELDS[resourceKey] || [])];
  const providers = resolveSessionWizardAiModelProviders(ai);
  return [...new Set([providers.fastProvider, providers.thinkingProvider, providers.transcriptionProvider])]
    .map((provider) => AI_PROVIDER_SECRET_FIELDS[provider])
    .filter((field): field is SessionWizardSecretField => !!field)
    .map((field) => ({ ...field }));
};
