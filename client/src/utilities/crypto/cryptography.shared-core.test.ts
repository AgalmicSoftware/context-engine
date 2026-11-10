import {
  computeContext as computeCcContext,
  computeResponseFieldContext,
  encodeValueBytes,
  poseidonHashBytes,
} from '@ce-shared/encryption/envelopeV1Core.mjs';
import { cryptoUtils } from './cryptography';
import { loadPoseidonHasher } from './poseidonHasher';

const CONTEXT_INPUT = {
  chainId: 11155420,
  account: '0x00000000000000000000000000000000000000aa',
  surveyId: `0x${'22'.repeat(32)}`,
  qId: 'Question-One',
  fieldKey: 'answer',
};

describe('shared envelope v1 compatibility', () => {
  it('pins both shipped context formats and keeps the browser on its field-bound format', () => {
    expect(computeCcContext(CONTEXT_INPUT)).toBe('0x4fb37fe5c79758e3876379169801df424c4ccd037955bb9384be8ec64ab20b6a');
    expect(computeResponseFieldContext(CONTEXT_INPUT)).toBe(
      '0x6c40aab365e45abd78e8d47008cf12c593f1c434962173ede98d25de324baa25',
    );
    expect(cryptoUtils.computeContext(CONTEXT_INPUT)).toBe(computeResponseFieldContext(CONTEXT_INPUT));
  });

  it('uses the canonical shared value encoders in the browser test environment', () => {
    expect([...encodeValueBytes('binary', 'Agree')]).toEqual([2]);
    expect(new TextDecoder().decode(encodeValueBytes('rating', 7))).toBe('7');
    expect([...encodeValueBytes('multichoice', ['beta'], { options: ['alpha', 'beta', 'gamma'] })]).toEqual([2]);
    expect(new TextDecoder().decode(encodeValueBytes('freeform', 'shared-vector'))).toBe('shared-vector');
  });

  it('keeps distinct ratings distinct in their commitment bytes', () => {
    [
      [20, 100],
      [-5, 0],
      [0.1, 0.9],
      [5, 5.5],
    ].forEach(([left, right]) => {
      expect(encodeValueBytes('rating', left)).not.toEqual(encodeValueBytes('rating', right));
    });
    expect(() => encodeValueBytes('rating', 'not a number')).toThrow('Invalid rating');
  });

  it('keeps Poseidon inputs that differ by leading zero bytes or past 31 bytes distinct', async () => {
    const hasher = await loadPoseidonHasher();
    const text = (value: string) => new TextEncoder().encode(value);
    const domain = text('rxc|commit|v1|chain:1|survey:0x00|qid:q');
    const commit = (bytes: Uint8Array) => poseidonHashBytes([bytes, domain], hasher);
    const fieldModulus = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    const bytes32 = (value: bigint) =>
      Uint8Array.from(value.toString(16).padStart(64, '0').match(/../g) || [], (byte) => parseInt(byte, 16));

    expect(await commit(text('approve'))).not.toBe(await commit(text('\u0000approve')));
    // As 32-byte numbers these two differ by exactly the field modulus.
    expect(await commit(bytes32(1n))).not.toBe(await commit(bytes32(fieldModulus + 1n)));
  });
});
