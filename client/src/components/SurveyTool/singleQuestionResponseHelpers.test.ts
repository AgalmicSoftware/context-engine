import {
  buildAggregatorResponseSignature,
  buildBinaryAggregatorSummary,
  buildFreeformAggregatorSummary,
  buildMultichoiceAggregatorSummary,
  buildRatingAggregatorSummary,
  buildSingleQuestionBookmarkFeedbackPatch,
  buildSingleQuestionBookmarkStatusPatch,
  buildSingleQuestionBookmarkSuccessPatch,
  collectGateAddresses,
  extractSingleQuestionOptionsFromCandidate,
  findSingleQuestionEntryAcrossGroups,
  getLatestAnsweredResponses,
  hasLitSbtRecipientEncryptedPortion,
  isEnvelopeAesGcm256,
  normalizePromptGateMode,
  responseHasLitSbtRecipient,
  resolveSingleQuestionMapFromCacheValue,
  resolvePromptGateTooltipProps,
} from './singleQuestionResponseHelpers.js';

describe('singleQuestionResponseHelpers gate addresses', () => {
  it('dedupes direct and gate SBT addresses case-insensitively', () => {
    expect(
      collectGateAddresses(
        [
          {
            sbtAddresses: ['0xAAA', '0xbbb'],
            sbtAddress: '0xaaa',
          },
        ],
        ['0xBBB', '0xccc'],
      ),
    ).toEqual(['0xBBB', '0xccc', '0xAAA']);
  });
});

describe('singleQuestionResponseHelpers encrypted envelope detection', () => {
  it('accepts v2 aes-gcm-256 envelopes from strings or objects', () => {
    expect(isEnvelopeAesGcm256({ v: 2, cipher: 'aes-gcm-256' })).toBe(true);
    expect(isEnvelopeAesGcm256(JSON.stringify({ v: '2', cipher: 'AES-GCM-256' }))).toBe(true);
  });

  it('rejects malformed or unsupported envelopes', () => {
    expect(isEnvelopeAesGcm256('{bad json')).toBe(false);
    expect(isEnvelopeAesGcm256({ v: 1, cipher: 'aes-gcm-256' })).toBe(false);
    expect(isEnvelopeAesGcm256({ v: 2, cipher: 'legacy' })).toBe(false);
    expect(isEnvelopeAesGcm256(null)).toBe(false);
  });

  it('detects Lit SBT recipients in encrypted field envelopes', () => {
    const envelope = {
      v: 1,
      cipher: 'aes-gcm-256',
      recipients: [{ type: 'self-eip712-v1' }, { type: 'lit-sbt-v1', lit: { chain: 'optimismSepolia' } }],
    };

    expect(hasLitSbtRecipientEncryptedPortion(JSON.stringify(envelope))).toBe(true);
    expect(
      responseHasLitSbtRecipient({
        answer: { encryptedPortion: JSON.stringify(envelope) },
        additional: { encryptedPortion: '' },
      }),
    ).toBe(true);
  });

  it('rejects encrypted envelopes without Lit SBT recipients', () => {
    expect(
      hasLitSbtRecipientEncryptedPortion(
        JSON.stringify({
          recipients: [{ type: 'self-eip712-v1' }],
        }),
      ),
    ).toBe(false);
    expect(hasLitSbtRecipientEncryptedPortion('{bad json')).toBe(false);
    expect(
      responseHasLitSbtRecipient({
        answer: { encryptedPortion: JSON.stringify({ recipients: [] }) },
      }),
    ).toBe(false);
  });
});

describe('singleQuestionResponseHelpers bookmark state patches', () => {
  it('normalizes bookmark status patches', () => {
    expect(buildSingleQuestionBookmarkStatusPatch('yes')).toEqual({
      isBookmarked: true,
    });
    expect(buildSingleQuestionBookmarkStatusPatch(0)).toEqual({
      isBookmarked: false,
    });
  });

  it('builds bookmark feedback and success reset patches', () => {
    expect(buildSingleQuestionBookmarkFeedbackPatch(true)).toEqual({
      isBookmarked: true,
      bookmarkSuccess: true,
    });
    expect(buildSingleQuestionBookmarkFeedbackPatch(false)).toEqual({
      isBookmarked: false,
      bookmarkSuccess: true,
    });
    expect(buildSingleQuestionBookmarkSuccessPatch(false)).toEqual({
      bookmarkSuccess: false,
    });
  });
});

describe('singleQuestionResponseHelpers aggregator responses', () => {
  it('builds compact response-list signatures from length and boundary records', () => {
    expect(buildAggregatorResponseSignature()).toBe('0');
    expect(
      buildAggregatorResponseSignature([
        { responder: '0xa', timestamp: '1' },
        { responder: '0xb', timestamp: '3' },
      ]),
    ).toBe('2|0xa|1|0xb|3');
  });

  it('keeps the latest truthy response per responder', () => {
    expect(
      getLatestAnsweredResponses([
        { responder: '0xa', timestamp: '1', response: { answer: { value: 'old-a' } } },
        { responder: '0xa', timestamp: '2', response: { answer: { value: 'new-a' } } },
        { responder: '0xb', timestamp: '1', response: null },
        { responder: '0xc', timestamp: '1', response: { answer: { value: 'only-c' } } },
      ]),
    ).toEqual([{ answer: { value: 'new-a' } }, { answer: { value: 'only-c' } }]);
  });

  it('builds freeform summary counts and visible responses', () => {
    expect(
      buildFreeformAggregatorSummary([
        { answer: { value: 'Visible response', encrypted: false } },
        { answer: { value: '', encrypted: false } },
        { answer: { value: '*', encrypted: true } },
        { answer: { value: { nested: 'value' }, encrypted: false } },
        { other: 'ignored' },
      ]),
    ).toEqual({
      blankCount: 1,
      displayedResponses: ['Visible response', { nested: 'value' }],
      encryptedCount: 1,
      nonBlankTotal: 4,
      summaryParts: ['4 total responses.', '1 encrypted responses not shown.', '1 blank not shown.'],
      total: 5,
    });
  });

  it('keeps zero encrypted freeform summary copy and normalizes non-arrays', () => {
    expect(buildFreeformAggregatorSummary([{ answer: { value: 'Visible response', encrypted: false } }])).toMatchObject(
      {
        displayedResponses: ['Visible response'],
        summaryParts: ['1 total responses.', '0 encrypted responses not shown.'],
        total: 1,
      },
    );
    expect(buildFreeformAggregatorSummary(null)).toMatchObject({
      displayedResponses: [],
      summaryParts: ['0 total responses.', '0 encrypted responses not shown.'],
      total: 0,
    });
  });

  it('builds binary counts for recognized answer values only', () => {
    expect(
      buildBinaryAggregatorSummary([
        { answer: { value: 'Agree' } },
        { answer: { value: 'Agree' } },
        { answer: { value: 'Unsure' } },
        { answer: { value: 'Disagree' } },
        { answer: { value: 'agree' } },
        { answer: { value: Object('Agree') } },
        { answer: { value: '' } },
      ]),
    ).toEqual({
      counts: {
        Agree: 2,
        Unsure: 1,
        Disagree: 1,
      },
      total: 4,
    });
    expect(buildBinaryAggregatorSummary(null)).toEqual({
      counts: {
        Agree: 0,
        Unsure: 0,
        Disagree: 0,
      },
      total: 0,
    });
  });

  it('builds rating totals, average, and median from normalized values', () => {
    expect(
      buildRatingAggregatorSummary([
        { answer: { value: '1' } },
        { answer: { value: 5 } },
        { answer: { value: 10 } },
        { answer: { value: 'bad' } },
      ]),
    ).toEqual({
      average: 16 / 3,
      median: 5,
      total: 3,
      values: [1, 5, 10],
    });
    expect(buildRatingAggregatorSummary([{ answer: { value: 2 } }, { answer: { value: 8 } }])).toMatchObject({
      average: 5,
      median: 5,
      total: 2,
    });
    expect(buildRatingAggregatorSummary(null)).toEqual({
      average: 0,
      median: 0,
      total: 0,
      values: [],
    });
  });

  it('extracts normalized option labels from candidate option shapes', () => {
    expect(
      extractSingleQuestionOptionsFromCandidate({
        options: [
          ' Alpha ',
          { label: 'Beta' },
          { text: 'Gamma' },
          { name: 'Delta' },
          { value: 'Epsilon' },
          { id: 'zeta' },
          '',
          'Alpha',
        ],
      }),
    ).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'zeta']);

    expect(
      extractSingleQuestionOptionsFromCandidate({
        config: {
          choices: {
            one: { label: 'One' },
            two: { id: 'two' },
          },
        },
      }),
    ).toEqual(['One', 'two']);

    expect(
      extractSingleQuestionOptionsFromCandidate({
        payload: {
          options: [{ value: 'Payload' }],
        },
      }),
    ).toEqual(['Payload']);

    expect(extractSingleQuestionOptionsFromCandidate(null)).toEqual([]);
  });

  it('finds question entries across group cache entries by network and id casing', () => {
    const fallbackQuestion = { id: 'q-fallback', options: ['Fallback'] };
    const targetQuestion = { id: 'Q-Target', options: ['Target'] };
    const entries = [
      { slug: 'empty', value: null },
      {
        slug: 'fallback',
        value: {
          '84532': {
            questions: {
              'q-fallback': fallbackQuestion,
            },
          },
        },
      },
      {
        slug: 'target',
        value: {
          '11155420': {
            questions: {
              'Q-Target': targetQuestion,
            },
          },
          '84532': {
            questions: {
              'q-target': { id: 'wrong-network' },
            },
          },
        },
      },
    ];

    expect(
      findSingleQuestionEntryAcrossGroups({
        entries,
        idLower: 'q-target',
        netIdStr: '11155420',
      }),
    ).toBe(targetQuestion);
    expect(
      findSingleQuestionEntryAcrossGroups({
        entries,
        idLower: 'q-fallback',
        netIdStr: '',
      }),
    ).toBe(fallbackQuestion);
    expect(
      findSingleQuestionEntryAcrossGroups({
        entries,
        idLower: 'missing',
        netIdStr: '11155420',
      }),
    ).toBeNull();
  });

  it('resolves question maps from cache values by exact network before fallback networks', () => {
    const exactQuestions = { q1: { id: 'q1' } };
    const fallbackQuestions = { q2: { id: 'q2' } };
    const cacheValue = {
      '84532': {
        questions: fallbackQuestions,
      },
      '11155420': {
        questions: exactQuestions,
      },
    };

    expect(resolveSingleQuestionMapFromCacheValue(cacheValue, '11155420')).toBe(exactQuestions);
    expect(resolveSingleQuestionMapFromCacheValue(cacheValue, '10')).toBe(fallbackQuestions);
    expect(resolveSingleQuestionMapFromCacheValue({ bad: {} }, '11155420')).toEqual({});
    expect(resolveSingleQuestionMapFromCacheValue(null, '11155420')).toEqual({});
  });

  it('builds multichoice counts with case-insensitive option matching and per-response dedupe', () => {
    expect(
      buildMultichoiceAggregatorSummary(
        [
          { answer: { value: ['yes', 'YES', { label: 'Maybe' }], encrypted: false } },
          { answer: { value: { text: 'no' }, encrypted: false } },
          { answer: { value: 'hidden', encrypted: true } },
          { answer: { value: 'unknown', encrypted: false } },
        ],
        ['Yes', 'No', 'Maybe'],
      ),
    ).toEqual({
      counts: {
        Yes: 1,
        No: 1,
        Maybe: 1,
      },
      options: ['Yes', 'No', 'Maybe'],
      totalResponders: 2,
    });
  });

  it('derives multichoice options from visible answers when metadata has none', () => {
    expect(
      buildMultichoiceAggregatorSummary([
        { answer: { value: [{ name: 'Alpha' }, 'Beta'], encrypted: false } },
        { answer: { value: { value: 'Alpha' }, encrypted: false } },
        { answer: { value: 'Gamma', encrypted: true } },
      ]),
    ).toEqual({
      counts: {
        Alpha: 2,
        Beta: 1,
      },
      options: ['Alpha', 'Beta'],
      totalResponders: 2,
    });
  });
});

describe('singleQuestionResponseHelpers gate mode', () => {
  it('normalizes all/and aliases and defaults to any', () => {
    expect(normalizePromptGateMode({ requireAll: true })).toBe('all');
    expect(normalizePromptGateMode({ mode: 'and' })).toBe('all');
    expect(normalizePromptGateMode({ mode: '' })).toBe('any');
  });
});

describe('singleQuestionResponseHelpers prompt gate tooltip props', () => {
  it('derives tooltip props from question encryption gates and direct props', () => {
    const gate = {
      gateId: 'vip_access',
      mode: 'all',
      sbtAddresses: ['0x111'],
    };

    expect(
      resolvePromptGateTooltipProps({
        question: {
          encryption: {
            gates: [gate],
            sbtAddresses: ['0x222'],
          },
        },
        sbtAddresses: ['0x333'],
        userHeldSBTs: ['0x111'],
      }),
    ).toEqual({
      gateId: 'vip_access',
      gateConfig: gate,
      mode: 'all',
      sbtAddresses: ['0x333', '0x222', '0x111'],
      userHeldSBTs: ['0x111'],
    });
  });

  it('prefers explicit gate props over question metadata', () => {
    const explicitGate = {
      gateId: 'explicit',
      mode: 'any',
      sbtAddress: '0x999',
    };

    expect(
      resolvePromptGateTooltipProps({
        question: {
          gateId: 'question_gate',
          encryption: {
            gates: [{ gateId: 'question_encryption_gate', sbtAddress: '0x111' }],
          },
        },
        gateId: 'direct_gate',
        gateConfig: explicitGate,
        gateMode: 'all',
      }),
    ).toMatchObject({
      gateId: 'direct_gate',
      gateConfig: explicitGate,
      mode: 'all',
      sbtAddresses: ['0x111'],
    });
  });
});
