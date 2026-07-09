import { ethers } from 'ethers';

import { base64urlToHex, generateQuestionId, hexToBase64url } from './questionUtils.mjs';

describe('questionUtils', () => {
  it('generates stable question ids for multichoice prompts', () => {
    expect(generateQuestionId('multichoice', 'Prompt', ['Yes', 'No'], true)).toBe(
      ethers.utils.id('multichoice:prompt:yes,no:single'),
    );
  });

  it('normalizes surrounding whitespace before hashing question ids', () => {
    expect(generateQuestionId('multichoice', 'What is your name? ', [' Yes ', 'No  '], true)).toBe(
      generateQuestionId('multichoice', 'What is your name?', ['Yes', 'No'], true),
    );
  });

  it('round-trips hex and base64url payloads', () => {
    const hex = '0x1234abcd';
    const encoded = hexToBase64url(hex);

    expect(encoded).toBe('EjSrzQ');
    expect(base64urlToHex(encoded)).toBe(hex);
  });

  it('does not rely on a global Buffer runtime', () => {
    const originalBuffer = global.Buffer;

    try {
      global.Buffer = undefined;
      expect(hexToBase64url('0x1234abcd')).toBe('EjSrzQ');
      expect(base64urlToHex('EjSrzQ')).toBe('0x1234abcd');
    } finally {
      global.Buffer = originalBuffer;
    }
  });
});
