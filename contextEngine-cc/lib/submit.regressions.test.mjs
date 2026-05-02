import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'fs';
import { resolve, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { ethers } from 'ethers';
import { DEFAULT_CHAIN_ID } from './constants.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SUBMIT_MODULE_PATH = resolve(__dirname, 'submit.mjs');
const GATE_A = '0x0000000000000000000000000000000000000101';
const CHAIN_ID = DEFAULT_CHAIN_ID;

function importFresh(modulePath) {
  const ts = `${Date.now()}-${Math.random()}`;
  return import(`${pathToFileURL(modulePath).href}?t=${ts}`);
}

function signerContext() {
  const wallet = new ethers.Wallet('0x59c6995e998f97a5a0044976f84ce7de5d9d7f17b2f6a6a5f76f8864c8ad88f5');
  return {
    signTypedData: (domain, types, message) => wallet._signTypedData(domain, types, message),
    account: wallet.address,
    chainId: CHAIN_ID,
    surveyId: ethers.constants.HashZero,
  };
}

test('buildArweavePayload encrypts additional independently when encryptAdditional=true', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-submit-additional-only-'));
  const dataDir = resolve(root, 'data');
  const prevDataDir = process.env.CE_CC_DATA_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  try {
    const { __test__submit } = await importFresh(SUBMIT_MODULE_PATH);
    const payload = await __test__submit.buildArweavePayload(
      {
        questionId: `0x${'d1'.repeat(32)}`,
        questionType: 'freeform',
        answer: 'public answer',
        additional: 'secret additional',
        encrypt: false,
        encryptAdditional: true,
      },
      'test',
      signerContext(),
    );

    assert.equal(payload.answer.encrypted, false);
    assert.equal(payload.answer.value, 'public answer');
    assert.equal(payload.additional.encrypted, true);
    assert.equal(payload.additional.value, '*');
    assert.equal(payload.encryptionRequested, true);
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
  }
});

test('buildArweavePayload encrypts answer only when encrypt=true and encryptAdditional=false', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-submit-answer-only-'));
  const dataDir = resolve(root, 'data');
  const prevDataDir = process.env.CE_CC_DATA_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  try {
    const { __test__submit } = await importFresh(SUBMIT_MODULE_PATH);
    const payload = await __test__submit.buildArweavePayload(
      {
        questionId: `0x${'d2'.repeat(32)}`,
        questionType: 'freeform',
        answer: 'secret answer',
        additional: 'public note',
        encrypt: true,
        encryptAdditional: false,
      },
      'test',
      signerContext(),
    );

    assert.equal(payload.answer.encrypted, true);
    assert.equal(payload.answer.value, '*');
    assert.equal(payload.additional.encrypted, false);
    assert.equal(payload.additional.value, 'public note');
    assert.equal(payload.encryptionRequested, true);
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
  }
});

test('buildArweavePayload preserves legacy behavior when encryptAdditional is omitted', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-submit-legacy-additional-'));
  const dataDir = resolve(root, 'data');
  const prevDataDir = process.env.CE_CC_DATA_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  try {
    const { __test__submit } = await importFresh(SUBMIT_MODULE_PATH);
    const payload = await __test__submit.buildArweavePayload(
      {
        questionId: `0x${'d3'.repeat(32)}`,
        questionType: 'freeform',
        answer: 'legacy answer',
        additional: 'legacy additional',
        encrypt: true,
      },
      'test',
      signerContext(),
    );

    assert.equal(payload.answer.encrypted, true);
    assert.equal(payload.additional.encrypted, true);
    assert.equal(payload.encryptionRequested, true);
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
  }
});

test('buildArweavePayload keeps legacy encrypt booleans wallet-scoped when gate options are available', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-submit-legacy-gate-fallback-'));
  const dataDir = resolve(root, 'data');
  const prevDataDir = process.env.CE_CC_DATA_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  try {
    const { __test__submit } = await importFresh(SUBMIT_MODULE_PATH);
    const payload = await __test__submit.buildArweavePayload(
      {
        questionId: `0x${'d6'.repeat(32)}`,
        questionType: 'freeform',
        answer: 'legacy encrypted answer',
        additional: 'legacy encrypted comments',
        encrypt: true,
      },
      'test',
      {
        ...signerContext(),
        gateOptions: [
          {
            gateId: 'gate-a',
            label: 'Gate A',
            sbtAddresses: [GATE_A],
            chainId: CHAIN_ID,
            litChain: 'baseSepolia',
            mode: 'any',
          },
        ],
      },
    );

    assert.equal(payload.answer.encryptionAudience, 'self');
    assert.equal(payload.answer.encryptionGateId, null);
    assert.equal(payload.additional.encryptionAudience, 'self');
    assert.equal(payload.additional.encryptionGateId, null);
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
  }
});

test('buildArweavePayload throws when only encryptAdditional is requested without signer context', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-submit-additional-guard-'));
  const dataDir = resolve(root, 'data');
  const prevDataDir = process.env.CE_CC_DATA_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  try {
    const { __test__submit } = await importFresh(SUBMIT_MODULE_PATH);
    await assert.rejects(
      () => __test__submit.buildArweavePayload(
        {
          questionId: `0x${'d4'.repeat(32)}`,
          questionType: 'freeform',
          answer: 'public',
          additional: 'secret',
          encrypt: false,
          encryptAdditional: true,
        },
        'test',
      ),
      /Encryption requested but no signer context provided — refusing to upload plaintext/,
    );
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
  }
});

test('hasEncryptionRequests returns true for encryptAdditional-only batches', async () => {
  const { __test__submit } = await importFresh(SUBMIT_MODULE_PATH);
  const check = __test__submit.hasEncryptionRequests;

  assert.equal(check([{ encryptAdditional: true }]), true);
  assert.equal(check([{ encryptAdditional: 'TRUE' }]), true);
  assert.equal(check([{ encryptAdditional: false }]), false);
  assert.equal(check([{ encrypt: false, encryptAdditional: false }]), false);
  assert.equal(check([{ answerEncryptionAudience: 'self' }]), true);
  assert.equal(check([{ additionalEncryptionAudience: 'gate' }]), true);
});

test('buildArweavePayload carries explicit audience metadata for answer and additional fields', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ce-submit-audience-meta-'));
  const dataDir = resolve(root, 'data');
  const prevDataDir = process.env.CE_CC_DATA_DIR;
  process.env.CE_CC_DATA_DIR = dataDir;
  try {
    const { __test__submit } = await importFresh(SUBMIT_MODULE_PATH);
    const payload = await __test__submit.buildArweavePayload(
      {
        questionId: `0x${'d5'.repeat(32)}`,
        questionType: 'freeform',
        answer: 'gate scoped answer',
        additional: 'Match Answer',
        answerEncryptionAudience: 'gate',
        answerEncryptionGateId: 'gate-a',
        additionalEncryptionAudience: 'follow',
      },
      'test',
      {
        ...signerContext(),
        litHooks: {
          saveKey: async () => ({
            ciphertext: 'lit-ciphertext',
            dataToEncryptHash: 'lit-hash',
            chipotle: {
              version: 1,
              chainId: CHAIN_ID,
              gateMode: 'any',
              sbtAddresses: [GATE_A],
              rpcUrl: 'https://base-sepolia.example.test',
            },
          }),
        },
        gateOptions: [
          {
            gateId: 'gate-a',
            label: 'Gate A',
            sbtAddresses: [GATE_A],
            chainId: CHAIN_ID,
            litChain: 'baseSepolia',
            mode: 'any',
          },
        ],
      },
    );

    assert.equal(payload.answer.encryptionAudience, 'gate');
    assert.equal(payload.answer.encryptionGateId, 'gate-a');
    assert.equal(payload.answer.audienceMode, 'explicit');
    assert.equal(payload.additional.encryptionAudience, 'gate');
    assert.equal(payload.additional.encryptionGateId, 'gate-a');
    assert.equal(payload.additional.audienceMode, 'inherit');
    const answerEnvelope = JSON.parse(payload.answer.encryptedPortion);
    const answerLitRecipient = answerEnvelope.recipients.find((entry) => entry.type === 'lit-sbt-v1');
    assert.equal(typeof answerLitRecipient?.lit?.ciphertext, 'string');
    assert.equal(answerLitRecipient?.lit?.dataToEncryptHash, 'lit-hash');
    assert.deepEqual(answerLitRecipient?.lit?.chipotle, {
      version: 1,
      chainId: CHAIN_ID,
      gateMode: 'any',
      sbtAddresses: [GATE_A],
      rpcUrl: 'https://base-sepolia.example.test',
    });
  } finally {
    if (prevDataDir == null) delete process.env.CE_CC_DATA_DIR;
    else process.env.CE_CC_DATA_DIR = prevDataDir;
  }
});
