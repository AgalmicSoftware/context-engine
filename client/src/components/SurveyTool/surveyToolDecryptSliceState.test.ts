// Chain under test (all real production functions except the Worker key route):
//   finalizeSurveyDecryptAttempt output -> normalizeBulkDecryptedSliceForSurveyState
//   -> buildSurveyDecryptSuccessState (handleDecryptEdit, surveyQuestionsRuntimeMethods.tsx:1653)
//   -> buildAnswerUpdatePlan (user edits the decrypted answer)
//   -> buildFieldEncryptionWorkGroups -> cryptoUtils.encryptMultipleAnswers (submit)
import { webcrypto } from 'crypto';
import { ethers } from 'ethers';
import { cryptoUtils } from '../../utilities/crypto/cryptography';
import { wrapWorkerResponseFieldKey } from '../../utilities/crypto/workerResponseFieldKeys';
import {
  buildSurveyDecryptSuccessState,
  normalizeBulkDecryptedSliceForSurveyState,
} from './surveyToolDecryptSliceState';
import { buildAnswerUpdatePlan } from './surveyToolResponseMutationController';
import { buildFieldEncryptionWorkGroups } from './surveyToolSubmitPrepController';
import {
  normalizeResponseEncryptionAudience,
  resolveFieldEncryptionAudience,
} from './surveyToolAudienceDerivationController';

jest.mock('../../utilities/crypto/workerResponseFieldKeys', () => ({
  wrapWorkerResponseFieldKey: jest.fn(),
  unwrapWorkerResponseFieldKey: jest.fn(),
}));

const owner = new ethers.Wallet(`0x${'61'.repeat(32)}`);
const signer = (wallet: ethers.Wallet) => ({
  request: async ({ method, params }: { method: string; params: string[] }) => {
    if (method === 'eth_chainId') return '0xaa37dc';
    if (method === 'eth_accounts') return [wallet.address];
    const { domain, types, message } = JSON.parse(params[1]);
    delete types.EIP712Domain;
    return wallet._signTypedData(domain, types, message);
  },
});
const sessionConfig = {
  sessionId: 'example-id',
  responseFieldEncryption: { mode: 'optional', version: 1 },
  sessionModeProfile: {
    authority: { mode: 'worker_canonical' },
    storage: { backend: 'cloudflare' },
    encryption: { mode: 'none' },
  },
  storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
};

beforeAll(() => {
  Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
});
beforeEach(() => {
  jest.resetAllMocks();
});

// Mirrors surveyQuestionsGateAudienceRuntime.ts:234-259 for a session whose default
// response-gate policy has Lit recipients (gateRecipients) or none.
const audienceDeps = (gateRecipients: unknown[]) => {
  const getEffectiveRecipientsForQid = () => gateRecipients;
  const getDefaultAudienceForQid = () => (gateRecipients.length ? 'gate' : 'self');
  const normalizeAudience = (value: unknown, qid: string | null) =>
    normalizeResponseEncryptionAudience(value, qid, {
      isQuestionLocked: () => false,
      getEffectiveRecipientsForQid,
      hasDefaultGateRecipients: () => gateRecipients.length > 0,
    });
  const resolveAudience = (field: unknown, qid: string | null, fieldKey = 'answer') =>
    resolveFieldEncryptionAudience(field, qid, fieldKey, {
      normalizeAudience,
      getDefaultAudienceForQid,
      getDefaultAudience: () => getDefaultAudienceForQid(),
    });
  return { getEffectiveRecipientsForQid, resolveAudience };
};

const bulkDecryptThenEdit = (storedAnswer: Record<string, unknown>, gateRecipients: unknown[]) => {
  const deps = audienceDeps(gateRecipients);
  const previousStateSlice = { answers: { q1: storedAnswer }, additionalComments: {}, importance: {}, conviction: {} };
  // decryptMultipleAnswers returns only { value, zkSalt } per decrypted field (cryptography.ts:1776-1779).
  const decrypted = { answers: { q1: { value: 'my original answer', zkSalt: '0x01' } }, additionalComments: {} };
  const normalized = normalizeBulkDecryptedSliceForSurveyState(decrypted, {
    previousStateSlice,
    baselineSlice: previousStateSlice,
  });
  const afterDecrypt = buildSurveyDecryptSuccessState(
    { surveysResponseState: [previousStateSlice] },
    { surveyIndex: 0, decryptedSlice: normalized },
  ) as { surveysResponseState: Array<{ answers: Record<string, Record<string, unknown>> }> };
  const decryptedSlice = afterDecrypt.surveysResponseState[0];
  const plan = buildAnswerUpdatePlan('q1', 'my edited answer', decryptedSlice as never, {
    buildEmptyResponseFieldState: () => ({ value: '', encrypted: false, encryptionAudience: 'self' }),
    resolveFieldEncryptionAudience: (field, qid, fieldKey) => deps.resolveAudience(field, qid, fieldKey),
    resolveFieldEncryptionGateId: () => null,
    isQuestionLockedForResponse: () => false,
    getEffectiveRecipientsForQid: deps.getEffectiveRecipientsForQid,
    normalizeFieldAudienceMode: () => 'explicit',
    buildInheritedAdditionalFieldState: (field) => field,
    valuesEqual: (a, b) => a === b,
    getQuestionById: () => ({ id: 'q1', type: 'freeform' }),
    computeHash: () => '0xhash',
  });
  const editedSlice = { ...decryptedSlice, answers: { q1: plan.nextAnswerState } };
  const { groups } = buildFieldEncryptionWorkGroups(editedSlice as never, new Set(['q1']), {
    isQuestionLockedForResponse: () => false,
    resolveFieldEncryptionGateId: () => null,
    resolveFieldEncryptionAudience: (field, qid, fieldKey) => deps.resolveAudience(field, qid, fieldKey),
    getEffectiveRecipientsForField: () => gateRecipients as string[],
  });
  return { decryptedField: decryptedSlice.answers.q1, editedField: plan.nextAnswerState, groups };
};

it('"Decrypt & edit" keeps a Me + admin answer readable by the admin after the owner edits it', async () => {
  const { decryptedField, editedField, groups } = bulkDecryptThenEdit(
    {
      value: '*',
      encrypted: true,
      encryptedPortion: '{"v":1}',
      hash: '0xold',
      encryptionAudience: 'self_admin',
      audienceMode: 'explicit',
    },
    [],
  );
  jest.mocked(wrapWorkerResponseFieldKey).mockImplementation(async (_key, choice, context) => ({
    type: 'worker-response-field-v1',
    policy: {
      audience: choice,
      context,
      sessionSlug: 'example',
      sessionId: 'example-id',
      owner: owner.address.toLowerCase(),
    },
    wrapped: { fixture: 'ciphertext' },
  }));
  const encrypted = await cryptoUtils.encryptMultipleAnswers(groups[0].slice as never, {
    sessionSlug: 'example',
    sessionConfig,
    provider: signer(owner),
    account: owner.address,
    onlyTheseQids: groups[0].qids,
    questionPool: [{ id: 'q1', type: 'freeform' }],
  });
  const recipients = JSON.parse(encrypted.answers.q1.encryptedPortion as string).recipients.map(
    (r: { type: string }) => r.type,
  );
  expect(editedField.encryptionAudience).toBe('self_admin');
  expect(recipients).toEqual(['self-eip712-v1', 'worker-response-field-v1']);
});

it('"Decrypt & edit" never widens an Only me answer to the session gate audience', () => {
  const litRecipient = { accessControlConditions: [{}], chain: 'base' };
  const { decryptedField, editedField, groups } = bulkDecryptThenEdit(
    {
      value: '*',
      encrypted: true,
      encryptedPortion: '{"v":1}',
      hash: '0xold',
      encryptionAudience: 'self',
      audienceMode: 'explicit',
    },
    [litRecipient],
  );
  expect(editedField.encryptionAudience).toBe('self');
  expect(groups.map((group) => group.recipients)).toEqual([[]]);
});

it('preserves answer and comment audience metadata when decrypting the survey', () => {
  const field = {
    value: '*',
    encrypted: true,
    encryptionAudience: 'self_admin',
    encryptionGateId: 'gate-1',
    audienceMode: 'explicit',
    hash: 'hash',
    encryptedPortion: 'envelope',
  };
  const patch = buildSurveyDecryptSuccessState(
    { surveysResponseState: [{ answers: { q1: field }, additionalComments: { q1: field } }] },
    { decryptedSlice: { answers: { q1: { value: 'answer' } }, additionalComments: { q1: { value: 'comment' } } } },
  );
  const slice = patch.surveysResponseState[0] as {
    answers: Record<string, unknown>;
    additionalComments: Record<string, unknown>;
  };
  expect(slice.answers.q1).toEqual({ ...field, value: 'answer' });
  expect(slice.additionalComments.q1).toEqual({ ...field, value: 'comment' });
});
