/* global BigInt */
import { webcrypto } from 'crypto';
import { ethers } from 'ethers';
import { TextDecoder, TextEncoder } from 'util';

import {
  BN254_P,
  aesGcmDecrypt,
  aesGcmEncrypt,
  assertBytes32Hex,
  b64decode,
  b64encode,
  bigIntToHex32,
  buildAAD,
  buildCommitDomainBytes,
  buildEip712KeyWrap,
  buildEnvelope,
  bytesToHex,
  computeContext,
  computeSaltedCommitments,
  concatBytes,
  deriveKekFromSig,
  encodeBinary,
  encodeFreeform,
  encodeMultichoiceBitset,
  encodeRating,
  encodeValueBytes,
  getContextBytes,
  hashIdentifier,
  hexToBytes,
  importAesGcmKey,
  isObj,
  parseEnvelope,
  poseidonHashBytes,
  safeLower,
  sha256,
  stableStringify,
  toField,
  utf8d,
  utf8e,
  validateEnvelopeBinding,
  wrapCekWithSelfRecipient,
} from './envelopeV1Core.mjs';

const ACCOUNT = '0x00000000000000000000000000000000000000aa';
const CHAIN_ID = 11155420;
const CONTEXT_HEX = `0x${'11'.repeat(32)}`;
const SURVEY_ID = `0x${'22'.repeat(32)}`;
const Q_ID = 'Question-One';
const SIG_HEX = `0x${'33'.repeat(65)}`;
const KECCAK_HEX = `0x${'44'.repeat(32)}`;

if (!globalThis.TextEncoder) {
  globalThis.TextEncoder = TextEncoder;
}

if (!globalThis.TextDecoder) {
  globalThis.TextDecoder = TextDecoder;
}

const expectBytes = (bytes, expected) => {
  expect(Array.from(bytes)).toEqual(expected);
};

const makeRaw32 = (seed = 1) => Uint8Array.from({ length: 32 }, (_, i) => (seed + i) & 0xff);
const hexToBytesIndependent = (hex) => {
  const normalized = String(hex).startsWith('0x') ? String(hex).slice(2) : String(hex);
  return Uint8Array.from(normalized.match(/.{2}/g) || [], (byte) => parseInt(byte, 16));
};
const b64decodeIndependent = (value) => new Uint8Array(Buffer.from(value, 'base64'));
const deriveKekFromSigIndependent = async (signatureHex, contextBytes, keyUsages = ['decrypt']) => {
  const cryptoApi = globalThis.crypto;
  const ikm = await cryptoApi.subtle.digest('SHA-256', hexToBytesIndependent(signatureHex));
  const hkdfKey = await cryptoApi.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
  return cryptoApi.subtle.deriveKey(
    {
      name: 'HKDF',
      salt: new TextEncoder().encode('surveytool:v1'),
      info: contextBytes,
      hash: 'SHA-256',
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    keyUsages,
  );
};

const VALID_SELF_RECIPIENT = Object.freeze({
  type: 'self-eip712-v1',
  context: CONTEXT_HEX,
  wrap_iv: b64encode(new Uint8Array(12).fill(5)),
  wrapped_cek: b64encode(new Uint8Array([6])),
  nonce: '1',
});

const makeSelfRecipient = (overrides = {}) => ({
  ...VALID_SELF_RECIPIENT,
  ...overrides,
});

const makeEnvelopeJson = (overrides = {}) =>
  JSON.stringify({
    v: 1,
    cipher: 'aes-gcm-256',
    iv: b64encode(new Uint8Array(12).fill(1)),
    aad: { surveyId: SURVEY_ID, qId: Q_ID },
    ciphertext: b64encode(new Uint8Array([2, 3, 4])),
    recipients: [makeSelfRecipient()],
    commitments: { keccak256: KECCAK_HEX },
    ...overrides,
  });

describe('envelopeV1Core', () => {
  beforeAll(() => {
    if (!globalThis.crypto || !globalThis.crypto.subtle) {
      Object.defineProperty(globalThis, 'crypto', {
        value: webcrypto,
        configurable: true,
      });
    }
    if (typeof window !== 'undefined' && (!window.crypto || !window.crypto.subtle)) {
      Object.defineProperty(window, 'crypto', {
        value: webcrypto,
        configurable: true,
      });
    }
  });

  it('round-trips byte, base64, and utf8 helpers', () => {
    const hex = '0x000102feff';
    const bytes = hexToBytes(hex);

    expectBytes(bytes, [0, 1, 2, 254, 255]);
    expect(bytesToHex(bytes)).toBe(hex);
    expectBytes(b64decode(b64encode(bytes)), [0, 1, 2, 254, 255]);

    for (const value of ['plain ascii', 'snowman \u2603 cafe \u00e9', '']) {
      expect(utf8d(utf8e(value))).toBe(value);
    }
    expect(b64encode(new Uint8Array())).toBe('');
    expectBytes(b64decode(''), []);
  });

  it('concatenates bytes while ignoring empty and null arrays', () => {
    expectBytes(concatBytes(null, new Uint8Array([1]), new Uint8Array(), undefined, new Uint8Array([2, 3])), [1, 2, 3]);
  });

  it('normalizes lowercase strings and strictly detects objects', () => {
    expect(safeLower('AbC')).toBe('abc');
    expect(safeLower(3)).toBe(3);
    expect(isObj({ a: 1 })).toBe(true);
    expect(isObj([])).toBe(false);
    expect(isObj(null)).toBe(false);
    expect(isObj('x')).toBe(false);
    expect(isObj(1)).toBe(false);
  });

  it('validates 32-byte hex with labeled errors', () => {
    expect(() => assertBytes32Hex(CONTEXT_HEX, 'context')).not.toThrow();
    expect(() => assertBytes32Hex('0x1234', 'context')).toThrow(/context/);
  });

  it('hashes SHA-256 with the known abc digest', async () => {
    const digest = await sha256(utf8e('abc'));
    expect(bytesToHex(digest)).toBe('0xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('encodes canonical binary, rating, multichoice, and freeform values', () => {
    expect(bytesToHex(encodeBinary('Disagree'))).toBe('0x00');
    expect(bytesToHex(encodeBinary('Unsure'))).toBe('0x01');
    expect(bytesToHex(encodeBinary('Agree'))).toBe('0x02');
    expect(bytesToHex(encodeRating(12))).toBe('0x0a');
    expect(bytesToHex(encodeRating(-1))).toBe('0x00');
    expect(bytesToHex(encodeMultichoiceBitset(['a', 'i'], ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']))).toBe(
      '0x0101',
    );
    expect(bytesToHex(encodeFreeform('hi\u2713'))).toBe('0x6869e29c93');
  });

  it('dispatches encodeValueBytes by kind', () => {
    expect(bytesToHex(encodeValueBytes('binary', 'Agree'))).toBe('0x02');
    expect(bytesToHex(encodeValueBytes('rating', 7))).toBe('0x07');
    expect(bytesToHex(encodeValueBytes('multichoice', ['b'], { options: ['a', 'b'] }))).toBe('0x02');
    expect(bytesToHex(encodeValueBytes('freeform', 'x'))).toBe('0x78');
    expect(bytesToHex(encodeValueBytes('unknown', 'x'))).toBe('0x78');
  });

  it('reduces bytes to BN254 field elements', () => {
    expect(toField(hexToBytes('0x01'))).toBe(1n);
    expect(toField(new Uint8Array(32))).toBe(0n);
    expect(toField(new Uint8Array(64).fill(255))).toBeLessThan(BN254_P);
  });

  it('formats BigInts as 32-byte hex strings', () => {
    for (const value of [0n, 1n, BN254_P - 1n]) {
      const hex = bigIntToHex32(value);
      expect(hex).toMatch(/^0x[0-9a-f]+$/);
      expect(hex).toHaveLength(66);
    }
    expect(bigIntToHex32(1n)).toBe(`0x${'0'.repeat(63)}1`);
  });

  it('normalizes injected Poseidon hasher output and requires a hasher', async () => {
    const fakeHasher = ([a, b, c]) => a + b + c;

    await expect(
      poseidonHashBytes([new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3])], fakeHasher),
    ).resolves.toBe(bigIntToHex32(6n));
    await expect(poseidonHashBytes([new Uint8Array([1])], null)).rejects.toThrow(/Poseidon hasher required/);
  });

  it('supports async Poseidon hashers and normalizes their output', async () => {
    const asyncHasher = async (inputs) => inputs.reduce((a, b) => a + b, 0n) + 7n;
    const independentlyComputedSum = 1n + 2n;
    const expected = bigIntToHex32((independentlyComputedSum + 7n) % BN254_P);

    await expect(poseidonHashBytes([new Uint8Array([1]), new Uint8Array([2])], asyncHasher)).resolves.toBe(expected);
  });

  it('builds deterministic commitment domain bytes', () => {
    const expected = `rxc|commit|v1|chain:${CHAIN_ID}|survey:${SURVEY_ID}|qid:${Q_ID.toLowerCase()}`;
    const expectedBytes = new TextEncoder().encode(expected);

    expect(utf8d(buildCommitDomainBytes({ chainId: CHAIN_ID, surveyId: SURVEY_ID, qId: Q_ID }))).toBe(expected);
    expect(bytesToHex(buildCommitDomainBytes({ chainId: CHAIN_ID, surveyId: SURVEY_ID, qId: Q_ID }))).toBe(
      ethers.utils.hexlify(expectedBytes),
    );
  });

  it('computes exact salted commitments with nullable Poseidon output', async () => {
    const fixedSaltBytes = Uint8Array.from({ length: 16 }, (_, i) => i);
    const canonicalBytes = new Uint8Array([2]);
    const domainBytes = new TextEncoder().encode(
      `rxc|commit|v1|chain:${CHAIN_ID}|survey:${SURVEY_ID}|qid:${Q_ID.toLowerCase()}`,
    );
    const combinedBytes = new Uint8Array(fixedSaltBytes.length + canonicalBytes.length + domainBytes.length);
    combinedBytes.set(fixedSaltBytes, 0);
    combinedBytes.set(canonicalBytes, fixedSaltBytes.length);
    combinedBytes.set(domainBytes, fixedSaltBytes.length + canonicalBytes.length);

    const bn254P = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    const toFieldIndependent = (bytes) => {
      let out = 0n;
      for (const byte of bytes) {
        out = (out * 256n + BigInt(byte)) % bn254P;
      }
      return out;
    };
    const expectedPoseidonValue =
      ([fixedSaltBytes, canonicalBytes, domainBytes].reduce((acc, bytes) => acc + toFieldIndependent(bytes), 0n) + 1n) %
      bn254P;
    const expected = {
      salt: '0x000102030405060708090a0b0c0d0e0f',
      keccak256: ethers.utils.keccak256(combinedBytes),
      poseidon: `0x${expectedPoseidonValue.toString(16).padStart(64, '0')}`,
    };
    const originalGetRandomValues = globalThis.crypto.getRandomValues;
    globalThis.crypto.getRandomValues = jest.fn((target) => {
      for (let i = 0; i < target.length; i++) {
        target[i] = fixedSaltBytes[i];
      }
      return target;
    });

    try {
      const withPoseidon = await computeSaltedCommitments({
        chainId: CHAIN_ID,
        surveyId: SURVEY_ID,
        qId: Q_ID,
        kind: 'binary',
        value: 'Agree',
        hasher: (inputs) => inputs.reduce((acc, value) => acc + value, 0n) + 1n,
      });
      expect(withPoseidon).toEqual(expected);

      const withoutPoseidon = await computeSaltedCommitments({
        chainId: CHAIN_ID,
        surveyId: SURVEY_ID,
        qId: Q_ID,
        kind: 'binary',
        value: 'Agree',
        hasher: null,
      });
      expect(withoutPoseidon).toEqual({
        salt: expected.salt,
        keccak256: expected.keccak256,
        poseidon: null,
      });

      const throwingPoseidon = await computeSaltedCommitments({
        chainId: CHAIN_ID,
        surveyId: SURVEY_ID,
        qId: Q_ID,
        kind: 'binary',
        value: 'Agree',
        hasher: () => {
          throw new Error('poseidon unavailable');
        },
      });
      expect(throwingPoseidon).toEqual({
        salt: expected.salt,
        keccak256: expected.keccak256,
        poseidon: null,
      });
    } finally {
      globalThis.crypto.getRandomValues = originalGetRandomValues;
    }
  });

  it('builds EIP-712 key-wrap payloads with optional nonce', () => {
    const typed = buildEip712KeyWrap(ACCOUNT, CHAIN_ID, CONTEXT_HEX, 123n);

    expect(typed.domain.name).toBe('ContextEngineEncKey');
    expect(typed.domain.version).toBe('1');
    expect(typed.types.KeyDerivation).toContainEqual({ name: 'nonce', type: 'uint256' });
    expect(typed.message.account).toBe(ethers.utils.getAddress(ACCOUNT));
    expect(typed.message.nonce).toBe('123');
  });

  it('computes stable context hashes for fixed inputs', () => {
    const expected = ethers.utils.keccak256(
      new TextEncoder().encode(
        `rxc|v1|chain:${CHAIN_ID}|acct:${ACCOUNT}|survey:${SURVEY_ID}|qid:${Q_ID.toLowerCase()}`,
      ),
    );

    expect(computeContext({ chainId: CHAIN_ID, account: ACCOUNT, surveyId: SURVEY_ID, qId: Q_ID })).toBe(expected);
    expect(computeContext({ chainId: CHAIN_ID, account: ACCOUNT, surveyId: SURVEY_ID, qId: Q_ID })).toBe(expected);
  });

  it('builds AAD and hashes identifiers deterministically', () => {
    const upperHexDigits = `0x${'AA'.repeat(32)}`;
    const aad = buildAAD({ contextHex: CONTEXT_HEX, chainId: CHAIN_ID, surveyId: SURVEY_ID, qId: Q_ID });

    expect(aad).toEqual({
      context: CONTEXT_HEX,
      chainId: CHAIN_ID,
      surveyId: SURVEY_ID,
      qId: Q_ID,
    });
    expect(stableStringify(aad)).toBe(
      '{"context":"' +
        CONTEXT_HEX +
        '","chainId":' +
        CHAIN_ID +
        ',"surveyId":"' +
        SURVEY_ID +
        '","qId":"' +
        Q_ID +
        '"}',
    );
    expect(hashIdentifier(upperHexDigits)).toBe(upperHexDigits.toLowerCase());
    expect(hashIdentifier('')).toBe(ethers.utils.hexZeroPad('0x0', 32));
    expect(hashIdentifier('question-id')).toBe(ethers.utils.id('question-id'));
  });

  it('builds a JSON envelope string with the expected shape', () => {
    const json = buildEnvelope({
      iv: new Uint8Array(12).fill(7),
      ciphertextBytes: new Uint8Array([8, 9]),
      aadObj: { surveyId: SURVEY_ID, qId: Q_ID },
      recipients: [],
      commitments: { keccak256: KECCAK_HEX },
      kind: 'freeform',
    });
    const parsed = JSON.parse(json);

    expect(typeof json).toBe('string');
    expect(parsed).toMatchObject({
      v: 1,
      cipher: 'aes-gcm-256',
      aad: { surveyId: SURVEY_ID, qId: Q_ID },
      recipients: [],
      commitments: { keccak256: KECCAK_HEX },
      meta: { kind: 'freeform' },
    });
    expect(parsed.commitments).not.toHaveProperty('poseidon');
  });

  it('parses envelopes and validates required shape fields', () => {
    const json = buildEnvelope({
      iv: new Uint8Array(12).fill(1),
      ciphertextBytes: new Uint8Array([2, 3]),
      aadObj: { surveyId: SURVEY_ID, qId: Q_ID },
      recipients: [makeSelfRecipient()],
      commitments: { keccak256: KECCAK_HEX },
      kind: 'binary',
    });
    const parsed = parseEnvelope(json);
    const raw = JSON.parse(json);

    expect(parsed).toEqual(raw);
    expect(parsed.iv).toBe(b64encode(new Uint8Array(12).fill(1)));
    expect(parsed.ciphertext).toBe(b64encode(new Uint8Array([2, 3])));
    expect(parsed.aad).toEqual({ surveyId: SURVEY_ID, qId: Q_ID });
    expect(() => parseEnvelope({})).toThrow(/JSON string/);
    expect(() => parseEnvelope('not-json')).toThrow(/valid JSON/);
    expect(() => parseEnvelope(makeEnvelopeJson({ v: 2 }))).toThrow(/version/);
    expect(() => parseEnvelope(makeEnvelopeJson({ cipher: 'other' }))).toThrow(/cipher/);
    expect(() => parseEnvelope(makeEnvelopeJson({ iv: undefined }))).toThrow(/iv/);
    expect(() => parseEnvelope(makeEnvelopeJson({ iv: b64encode(new Uint8Array(11)) }))).toThrow(/12 bytes/);
    expect(() => parseEnvelope(makeEnvelopeJson({ aad: null }))).toThrow(/aad/);
    expect(() => parseEnvelope(makeEnvelopeJson({ ciphertext: '' }))).toThrow(/ciphertext/);
    expect(() => parseEnvelope(makeEnvelopeJson({ recipients: {} }))).toThrow(/recipients/);
    expect(() => parseEnvelope(makeEnvelopeJson({ recipients: [] }))).not.toThrow();
    expect(() => parseEnvelope(makeEnvelopeJson({ recipients: [{ type: 1 }] }))).toThrow(/recipient type/);
    expect(() => parseEnvelope(makeEnvelopeJson({ recipients: [{ type: '' }] }))).toThrow(/recipient type/);
    expect(() => parseEnvelope(makeEnvelopeJson({ recipients: [{ type: 'lit-sbt-v1' }] }))).not.toThrow();
    expect(() => parseEnvelope(makeEnvelopeJson({ commitments: {} }))).toThrow(/keccak256/);
    expect(() => parseEnvelope(makeEnvelopeJson({ commitments: { keccak256: '0x1234' } }))).toThrow(/keccak256/);
    expect(() =>
      parseEnvelope(makeEnvelopeJson({ commitments: { keccak256: KECCAK_HEX, poseidon: null } })),
    ).not.toThrow();
    expect(() =>
      parseEnvelope(makeEnvelopeJson({ commitments: { keccak256: KECCAK_HEX, poseidon: '0x1234' } })),
    ).toThrow(/poseidon/);
  });

  it.each([
    ['missing context', { context: undefined }],
    ['missing nonce', { nonce: undefined }],
    ['missing context and nonce', { context: undefined, nonce: undefined }],
  ])('accepts self-eip712-v1 recipients with optional %s', (_, recipientOverrides) => {
    expect(() =>
      parseEnvelope(makeEnvelopeJson({ recipients: [makeSelfRecipient(recipientOverrides)] })),
    ).not.toThrow();
  });

  it.each([
    ['bad context format', { context: '0x1234' }, /recipient\[0\].*context must be 32-byte hex/],
    ['missing wrap_iv', { wrap_iv: undefined }, /recipient\[0\].*missing wrap_iv/],
    [
      'short wrap_iv',
      { wrap_iv: b64encode(new Uint8Array(11)) },
      /recipient\[0\].*wrap_iv must decode to exactly 12 bytes/,
    ],
    ['missing wrapped_cek', { wrapped_cek: undefined }, /recipient\[0\].*missing wrapped_cek/],
    ['empty wrapped_cek', { wrapped_cek: b64encode(new Uint8Array()) }, /recipient\[0\].*wrapped_cek/],
    ['non-string nonce', { nonce: 1 }, /recipient\[0\].*nonce must be a non-empty string/],
    ['empty nonce', { nonce: '' }, /recipient\[0\].*nonce must be a non-empty string/],
  ])('rejects self-eip712-v1 recipients with %s', (_, recipientOverrides, expectedError) => {
    expect(() => parseEnvelope(makeEnvelopeJson({ recipients: [makeSelfRecipient(recipientOverrides)] }))).toThrow(
      expectedError,
    );
  });

  it('validates envelope bindings case-insensitively', () => {
    const env = parseEnvelope(makeEnvelopeJson({ aad: { surveyId: SURVEY_ID.toUpperCase(), qId: 'Case-Q' } }));

    expect(() => validateEnvelopeBinding(env, { expectedSurveyId: SURVEY_ID, expectedQId: 'case-q' })).not.toThrow();
    expect(() => validateEnvelopeBinding({}, { expectedSurveyId: SURVEY_ID, expectedQId: Q_ID })).not.toThrow();
    expect(() => validateEnvelopeBinding({ aad: null }, { expectedSurveyId: SURVEY_ID })).not.toThrow();
    expect(() => validateEnvelopeBinding(env, { expectedSurveyId: `0x${'55'.repeat(32)}` })).toThrow(/surveyId/);
    expect(() => validateEnvelopeBinding(env, { expectedQId: 'other-q' })).toThrow(/qId/);
  });

  it('encrypts AES-GCM with AAD that raw WebCrypto can decrypt', async () => {
    const key = await importAesGcmKey(makeRaw32(9));
    const aadBytes = utf8e('aad');
    const plaintext = utf8e('secret');
    const encrypted = await aesGcmEncrypt(key, plaintext, { aadBytes });
    const raw = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: encrypted.iv, additionalData: aadBytes },
      key,
      encrypted.ciphertext,
    );
    const tamperedAadBytes = new Uint8Array(aadBytes);
    tamperedAadBytes[0] ^= 0xff;

    expectBytes(new Uint8Array(raw), Array.from(plaintext));
    await expect(
      globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: encrypted.iv, additionalData: tamperedAadBytes },
        key,
        encrypted.ciphertext,
      ),
    ).rejects.toThrow();
  });

  it('decrypts AES-GCM with AAD and rejects tampered authenticated data', async () => {
    const key = await importAesGcmKey(makeRaw32(10));
    const aadBytes = utf8e('known-aad');
    const plaintext = utf8e('fixed plaintext');
    const encrypted = await aesGcmEncrypt(key, plaintext, { aadBytes });
    const decrypted = await aesGcmDecrypt(key, encrypted.iv, encrypted.ciphertext, { aadBytes });
    const tamperedAadBytes = new Uint8Array(aadBytes);
    tamperedAadBytes[0] ^= 0xff;
    const tamperedCiphertext = new Uint8Array(encrypted.ciphertext);
    tamperedCiphertext[0] ^= 0xff;

    expectBytes(decrypted, Array.from(plaintext));
    await expect(
      aesGcmDecrypt(key, encrypted.iv, encrypted.ciphertext, { aadBytes: tamperedAadBytes }),
    ).rejects.toThrow();
    await expect(aesGcmDecrypt(key, encrypted.iv, tamperedCiphertext, { aadBytes })).rejects.toThrow();
  });

  it('derives KEKs from signatures that match an independent WebCrypto derivation', async () => {
    const contextBytes = getContextBytes(CONTEXT_HEX);
    const kek = await deriveKekFromSig(SIG_HEX, contextBytes);
    const cekRaw = makeRaw32(21);
    const iv = new Uint8Array(12).fill(8);
    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: contextBytes },
      kek,
      cekRaw,
    );
    const independentKek = await deriveKekFromSigIndependent(SIG_HEX, contextBytes);
    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: contextBytes },
      independentKek,
      ciphertext,
    );

    expectBytes(new Uint8Array(decrypted), Array.from(cekRaw));
  });

  it('wraps a CEK for the self EIP-712 recipient that raw WebCrypto can unwrap', async () => {
    const cekRaw = makeRaw32(31);
    const signTypedData = jest.fn(async () => SIG_HEX);
    const recipient = await wrapCekWithSelfRecipient({
      signTypedData,
      account: ACCOUNT,
      chainId: CHAIN_ID,
      contextHex: CONTEXT_HEX,
      cekRaw,
    });
    const contextBytes = hexToBytesIndependent(CONTEXT_HEX);
    const independentKek = await deriveKekFromSigIndependent(SIG_HEX, contextBytes);
    const unwrapped = await globalThis.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: b64decodeIndependent(recipient.wrap_iv),
        additionalData: contextBytes,
      },
      independentKek,
      b64decodeIndependent(recipient.wrapped_cek),
    );

    expect(recipient.type).toBe('self-eip712-v1');
    expect(recipient.context).toBe(CONTEXT_HEX);
    expect(b64decode(recipient.wrap_iv)).toHaveLength(12);
    expect(b64decode(recipient.wrapped_cek).length).toBeGreaterThan(0);
    expect(typeof recipient.nonce).toBe('string');
    expect(signTypedData).toHaveBeenCalledTimes(1);
    expectBytes(new Uint8Array(unwrapped), Array.from(cekRaw));
  });
});
