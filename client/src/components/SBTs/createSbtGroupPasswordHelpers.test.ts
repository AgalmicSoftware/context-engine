import { ethers } from 'ethers';
import {
  buildCreateSbtDeferredDraftCreate2Salt,
  buildCreateSbtInviteLinks,
  buildCreateSbtPasswordExportFile,
  CREATE_SBT_GROUP_PASSWORD_MIN_LENGTH,
  generateCreateSbtGroupPassphrase,
  generateCreateSbtInviteNonces,
  generateCreateSbtRandomHexString,
  isShortCreateSbtGroupPassword,
  resolveCreateSbtInviteCodeList,
  resolveCreateSbtPasswordGenerationCount,
  resolveCreateSbtPredictablePasswordListDecision,
} from './createSbtGroupPasswordHelpers';

describe('createSbtGroupPasswordHelpers', () => {
  it('builds CreateSBT password export files', () => {
    expect(
      buildCreateSbtPasswordExportFile({
        autoJoinUrl: 'https://app.example/session?sbt=0xabc&auto=1',
        date: '2026-05-05',
        exportFormat: 'json',
        passwordList: ['pw1', 'pw2'],
        sbtDistribution: { isLimited: false },
        sbtInviteLinks: ['https://app.example/sbt/0xabc/pw1'],
        sbtName: 'Alpha',
        sbtSymbol: 'ALP',
      }),
    ).toEqual({
      content: JSON.stringify(
        [
          {
            index: 0,
            password: 'pw1',
            inviteLink: 'https://app.example/sbt/0xabc',
          },
          {
            index: 1,
            password: 'pw2',
            inviteLink: 'https://app.example/session?sbt=0xabc&auto=1',
          },
        ],
        null,
        2,
      ),
      fileName: 'ALP_Alpha_passwords_2026-05-05.json',
      mimeType: 'application/json',
    });
    expect(
      buildCreateSbtPasswordExportFile({
        autoJoinUrl: 'fallback',
        date: '2026-05-05',
        exportFormat: 'csv',
        passwordList: ['gp1'],
        sbtDistribution: { isLimited: true, distributionOption: 'groupPassword' },
        sbtInviteLinks: [],
        sbtName: 'Beta',
        sbtSymbol: 'BET',
      }),
    ).toEqual({
      content: 'index,inviteCode,inviteLink\n0,gp1,fallback',
      fileName: 'BET_Beta_invites_2026-05-05.csv',
      mimeType: 'text/csv',
    });
    expect(
      buildCreateSbtPasswordExportFile({
        autoJoinUrl: 'https://app.example/session?fallback=1',
        date: '2026-05-05',
        exportFormat: 'csv',
        passwordList: ['alpha,beta', 'quote"code', 'line\nbreak'],
        sbtDistribution: { isLimited: true, distributionOption: 'groupPassword' },
        sbtInviteLinks: ['https://app.example/session?gp=alpha,beta', 'https://app.example/session?gp=quote"code'],
        sbtName: 'Beta',
        sbtSymbol: 'BET',
      }),
    ).toEqual({
      content: [
        'index,inviteCode,inviteLink',
        '0,"alpha,beta",https://app.example/session',
        '1,"quote""code",https://app.example/session',
        '2,"line\nbreak",https://app.example/session?fallback=1',
      ].join('\n'),
      fileName: 'BET_Beta_invites_2026-05-05.csv',
      mimeType: 'text/csv',
    });
  });

  it('builds CreateSBT invite links and resolves invite code lists', () => {
    expect(
      buildCreateSbtInviteLinks({
        base: 'https://app.example',
        detailPath: '/sbt/0xabc?session=alpha',
        passwordList: ['pw 1', 'pw/2'],
      }),
    ).toEqual(['https://app.example/sbt/0xabc?session=alpha', 'https://app.example/sbt/0xabc?session=alpha']);
    expect(
      buildCreateSbtInviteLinks({
        base: 'https://app.example',
        demoPath: '/session/alpha',
        encodeGroupPassword: (code) => `encoded:${code}`,
        isInvite: true,
        passwordList: ['group code'],
        sbtAddress: '0xABC',
      }),
    ).toEqual(['https://app.example/session/alpha?auto=1&sbt=0xABC']);
    expect(
      resolveCreateSbtInviteCodeList({
        listOverride: ['override', 0],
        passwordList: ['state'],
      }),
    ).toEqual(['override', '']);
    expect(
      resolveCreateSbtInviteCodeList({
        listOverride: [],
        passwordList: ['state', null],
      }),
    ).toEqual(['state', '']);
  });

  it('resolves CreateSBT password generation counts and predictable list decisions', () => {
    expect(
      resolveCreateSbtPasswordGenerationCount({
        numInviteLinks: 7,
        sbtDistribution: { isLimited: true, limitedNumber: 3 },
      }),
    ).toBe(3);
    expect(
      resolveCreateSbtPasswordGenerationCount({
        numInviteLinks: 7.8,
        sbtDistribution: { isLimited: true, limitedNumber: 0 },
      }),
    ).toBe(7);
    expect(
      resolveCreateSbtPasswordGenerationCount({
        numInviteLinks: 'bad',
        sbtDistribution: { isLimited: false, limitedNumber: 4 },
      }),
    ).toBe(0);
    expect(
      resolveCreateSbtPredictablePasswordListDecision({
        usesClaimCodes: false,
      }),
    ).toEqual({
      passwordListPatch: null,
      returnValue: [],
      shouldUpdatePasswordList: false,
    });
    expect(
      resolveCreateSbtPredictablePasswordListDecision({
        passwordList: ['pw1', '', 'pw2'],
        targetCount: 2,
        usesClaimCodes: true,
      }),
    ).toEqual({
      passwordListPatch: null,
      returnValue: ['pw1', 'pw2'],
      shouldUpdatePasswordList: false,
    });
    expect(
      resolveCreateSbtPredictablePasswordListDecision({
        generatePassword: (length) => `pw-${length}`,
        passwordList: ['pw1'],
        targetCount: 3,
        usesClaimCodes: true,
      }),
    ).toEqual({
      passwordListPatch: ['pw-32', 'pw-32', 'pw-32'],
      returnValue: null,
      shouldUpdatePasswordList: true,
    });
  });

  it('generates CreateSBT random hex strings and CREATE2 salts from injected sources', () => {
    expect(
      generateCreateSbtRandomHexString({
        length: 5,
        getRandomValues: (arr) => {
          arr[0] = 0xab;
          arr[1] = 0xcd;
          arr[2] = 0xef;
          return arr;
        },
        randomBytes: () => {
          throw new Error('fallback should not run');
        },
      }),
    ).toBe('abcde');
    expect(
      generateCreateSbtRandomHexString({
        length: 4,
        randomBytes: () => [1, 2],
      }),
    ).toBe('0102');
    expect(
      buildCreateSbtDeferredDraftCreate2Salt({
        randomBytes: (length) => Array.from({ length }, (_, index) => index),
      }),
    ).toBe('draft/000102030405060708090a0b0c0d0e0f');
  });

  it('generates CreateSBT invite nonces from injected sources', () => {
    let browserCall = 0;
    expect(
      generateCreateSbtInviteNonces({
        bytesToNonce: (bytes) => `nonce-${Array.from(bytes)[0]}`,
        count: 2,
        getRandomValues: (arr) => {
          browserCall += 1;
          arr.fill(browserCall);
          return arr;
        },
        randomBytes: () => {
          throw new Error('fallback should not run');
        },
      }),
    ).toEqual(['nonce-1', 'nonce-2']);

    let fallbackCall = 4;
    expect(
      generateCreateSbtInviteNonces({
        bytesToNonce: (bytes) => `nonce-${Array.from(bytes)[0]}`,
        count: '2.9',
        randomBytes: () => {
          fallbackCall += 1;
          return new Uint8Array(12).fill(fallbackCall);
        },
      }),
    ).toEqual(['nonce-5', 'nonce-6']);
    expect(
      generateCreateSbtInviteNonces({
        count: 'bad',
        randomBytes: () => new Uint8Array(12).fill(9),
      }),
    ).toEqual([]);
  });

  it('generates five hyphen-joined BIP-39 words from the low 11 bits of each random value', () => {
    const wordlist = ethers.wordlists.en;
    const getRandomValues = jest.fn((array: Uint16Array) => {
      array.set([0, 2047, 2048, 65535, 4097]);
      return array;
    });

    expect(generateCreateSbtGroupPassphrase(getRandomValues)).toBe(
      [0, 2047, 0, 2047, 1].map((index) => wordlist.getWord(index)).join('-'),
    );
    expect(getRandomValues).toHaveBeenCalledWith(expect.any(Uint16Array));
    expect(getRandomValues.mock.calls[0][0]).toHaveLength(5);
  });

  it('draws passphrase words from crypto.getRandomValues by default', () => {
    const spy = jest.spyOn(globalThis.crypto, 'getRandomValues');
    try {
      const words = generateCreateSbtGroupPassphrase().split('-');

      expect(spy).toHaveBeenCalledTimes(1);
      expect(words).toHaveLength(5);
      words.forEach((word) => expect(ethers.wordlists.en.getWordIndex(word)).toBeGreaterThanOrEqual(0));
    } finally {
      spy.mockRestore();
    }
  });

  it('never flags a generated passphrase as short, even from the shortest words', () => {
    const wordlist = ethers.wordlists.en;
    let shortestIndex = 0;
    for (let index = 1; index < 2048; index += 1) {
      if (wordlist.getWord(index).length < wordlist.getWord(shortestIndex).length) shortestIndex = index;
    }
    const passphrase = generateCreateSbtGroupPassphrase((array) => array.fill(shortestIndex));

    expect(passphrase.length).toBeGreaterThanOrEqual(CREATE_SBT_GROUP_PASSWORD_MIN_LENGTH);
    expect(isShortCreateSbtGroupPassword(passphrase)).toBe(false);
  });

  it('flags custom passwords shorter than the minimum length', () => {
    expect(CREATE_SBT_GROUP_PASSWORD_MIN_LENGTH).toBe(16);
    expect(isShortCreateSbtGroupPassword('')).toBe(false);
    expect(isShortCreateSbtGroupPassword('a'.repeat(15))).toBe(true);
    expect(isShortCreateSbtGroupPassword('a'.repeat(16))).toBe(false);
    // Counts characters, not UTF-16 code units.
    expect(isShortCreateSbtGroupPassword('\u{1F642}'.repeat(15))).toBe(true);
  });
});
