import {
  computeContext as computeCcContext,
  computeResponseFieldContext,
  encodeValueBytes,
} from '@ce-shared/encryption/envelopeV1Core.mjs';
import { cryptoUtils } from './cryptography';

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
    expect([...encodeValueBytes('rating', 7)]).toEqual([7]);
    expect([...encodeValueBytes('multichoice', ['beta'], { options: ['alpha', 'beta', 'gamma'] })]).toEqual([2]);
    expect(new TextDecoder().decode(encodeValueBytes('freeform', 'shared-vector'))).toBe('shared-vector');
  });
});
