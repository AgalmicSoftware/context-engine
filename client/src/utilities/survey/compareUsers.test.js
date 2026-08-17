import {
  buildUsersFromCaches,
  computeOverlapMatrix,
  computeVennEvidence,
  encodeStancesForUser,
  fallbackBullets,
  getCompareSbtKey,
  getCompareSbtLabel,
  isValidAddress,
  opinionVennTriplet,
  pcaLiteCompass,
  sanitizeCompass,
  sbtNameSets,
  selectTopOpinionTokens,
  shortenPlain,
} from './compareUsers';

const ADDRESS_A = '0x0000000000000000000000000000000000000001';
const ADDRESS_B = '0x0000000000000000000000000000000000000002';
const ADDRESS_C = '0x0000000000000000000000000000000000000003';

const opinionUsers = [
  {
    address: ADDRESS_A,
    sbts: [{ name: 'Alpha' }],
    questions: [
      { id: 'q1', type: 'binary', answer: 'yes', importance: 2, prompt: 'Adopt durable tests?', tags: ['testing'] },
      { id: 'q2', type: 'binary', answer: 'no', importance: 1, prompt: 'Ship quickly?', tags: ['ship'] },
      { id: 'q3', type: 'rating', answer: 5, importance: 4, prompt: 'Rate confidence', tags: ['confidence'] },
      { id: 'q4', type: 'multichoice', answer: ['CLI', 'UI'], prompt: 'Tooling choices', tags: ['tools'] },
    ],
  },
  {
    address: ADDRESS_B,
    sbts: [{ name: 'Beta' }],
    questions: [
      { id: 'q1', type: 'binary', answer: true, prompt: 'Adopt durable tests?', tags: ['testing'] },
      { id: 'q2', type: 'binary', answer: 'agree', prompt: 'Ship quickly?', tags: ['ship'] },
      { id: 'q3', type: 'rating', answer: 2, prompt: 'Rate confidence', tags: ['confidence'] },
      { id: 'q4', type: 'multichoice', answer: ['CLI'], prompt: 'Tooling choices', tags: ['tools'] },
    ],
  },
  {
    address: ADDRESS_C,
    sbts: [{ name: 'Gamma' }],
    questions: [
      { id: 'q1', type: 'binary', answer: 'disagree', prompt: 'Adopt durable tests?', tags: ['testing'] },
      { id: 'q2', type: 'binary', answer: 'yes', prompt: 'Ship quickly?', tags: ['ship'] },
      { id: 'q3', type: 'rating', answer: 1, prompt: 'Rate confidence', tags: ['confidence'] },
      { id: 'q4', type: 'multichoice', answer: ['API'], prompt: 'Tooling choices', tags: ['tools'] },
    ],
  },
];

describe('buildUsersFromCaches', () => {
  it('merges SBTs, questions, and surveys across caches', () => {
    const addresses = ['0xUser1', '0xUSER1', '0xUser2'];

    const sbtCaches = [
      {
        1: {
          sbtList: {
            '0xsbt1': {
              sbtAddress: '0xSbt1',
              sbtInfo: { name: 'Alpha' },
              mintedAddresses: ['0xUser1'],
              burnedAddresses: [],
            },
            '0xsbt2': {
              sbtAddress: '0xSbt2',
              sbtInfo: { name: 'Beta' },
              mintedAddresses: ['0xUSER1'],
              burnedAddresses: ['0xuser1'],
            },
          },
        },
      },
    ];

    const questionsCaches = [
      {
        1: {
          questions: {
            Q1: { type: 'binary', prompt: 'Should we test?' },
            Q2: { type: 'rating', prompt: 'Rate readiness' },
          },
          questionResponses: {
            Q1: {
              '0xUser1': JSON.stringify({
                type: 'binary',
                prompt: 'Should we test?',
                answer: { value: 'yes' },
                importance: 3,
                additionalComment: 'Because',
              }),
            },
          },
        },
      },
    ];

    const surveysCaches = [
      {
        1: {
          surveys: { S1: { title: 'Survey A' } },
          surveyResponses: {
            S1: {
              '0xUser1': JSON.stringify({
                responses: [
                  {
                    questionID: 'Q2',
                    type: 'rating',
                    prompt: 'Rate readiness',
                    answer: { value: 4 },
                  },
                ],
              }),
            },
          },
        },
      },
    ];

    const users = buildUsersFromCaches(addresses, sbtCaches, questionsCaches, surveysCaches);

    expect(users).toHaveLength(2);
    expect(users[0].address).toBe('0xUser1');
    expect(users[1].address).toBe('0xUser2');

    expect(users[0].sbts).toEqual([expect.objectContaining({ name: 'Alpha', address: '0xSbt1' })]);
    expect(users[1].sbts).toEqual([]);

    const q1 = users[0].questions.find((q) => q.id === 'q1');
    const q2 = users[0].questions.find((q) => q.id === 'q2');

    expect(q1).toMatchObject({
      id: 'q1',
      type: 'binary',
      prompt: 'Should we test?',
      answer: 'yes',
      importance: 3,
      additionalComment: 'Because',
    });
    expect(q2).toMatchObject({
      id: 'q2',
      type: 'rating',
      prompt: 'Rate readiness',
      answer: 4,
    });

    expect(users[0].surveys).toEqual([{ id: 's1', title: 'Survey A' }]);
    expect(users[1].questions).toEqual([]);
    expect(users[1].surveys).toEqual([]);
  });

  it('keeps locked-name SBTs visible with masked display labels', () => {
    const users = buildUsersFromCaches(
      ['0xUser1'],
      [
        {
          84532: {
            sbtList: {
              '0xsbt1': {
                sbtAddress: '0xSbt1',
                sbtInfo: {
                  name: '',
                  contractName: 'CE-SBT-12',
                  nameLocked: true,
                },
                mintedAddresses: ['0xUser1'],
                burnedAddresses: [],
              },
            },
          },
        },
      ],
      [],
      [],
    );

    expect(users).toHaveLength(1);
    expect(users[0].sbts).toEqual([
      expect.objectContaining({
        name: '[encrypted]',
        address: '0xSbt1',
        compareKey: 'sbt_onchain:general:84532:0xsbt1',
      }),
    ]);
  });

  it('does not collapse distinct locked-name SBTs into one shared compare key', () => {
    const users = buildUsersFromCaches(
      ['0xUser1', '0xUser2'],
      [
        {
          84532: {
            sbtList: {
              '0xsbt1': {
                sbtAddress: '0xSbt1',
                sbtInfo: {
                  name: '',
                  contractName: 'CE-SBT-12',
                  nameLocked: true,
                },
                mintedAddresses: ['0xUser1'],
                burnedAddresses: [],
              },
              '0xsbt2': {
                sbtAddress: '0xSbt2',
                sbtInfo: {
                  name: '',
                  contractName: 'CE-SBT-13',
                  nameLocked: true,
                },
                mintedAddresses: ['0xUser2'],
                burnedAddresses: [],
              },
            },
          },
        },
      ],
      [],
      [],
    );

    expect(sbtNameSets(users).map((set) => Array.from(set))).toEqual([
      ['sbt_onchain:general:84532:0xsbt1'],
      ['sbt_onchain:general:84532:0xsbt2'],
    ]);
    expect(fallbackBullets(users).agreements).toEqual([]);
  });

  it('compares fallback answers by semantic value instead of wrapper shape', () => {
    const result = fallbackBullets([
      {
        sbts: [],
        questions: [
          {
            prompt: 'Should we test?',
            answer: { value: 'yes', encrypted: true },
          },
        ],
      },
      {
        sbts: [],
        questions: [
          {
            prompt: 'Should we test?',
            answer: 'yes',
          },
        ],
      },
    ]);

    expect(result.disagreements).toEqual([]);
  });

  it('keeps reminted holders when count maps show a positive net balance', () => {
    const users = buildUsersFromCaches(
      ['0xUser1'],
      [
        {
          84532: {
            sbtList: {
              '0xsbt1': {
                sbtAddress: '0xSbt1',
                sbtInfo: { name: 'Alpha' },
                mintedAddresses: ['0xUser1'],
                burnedAddresses: ['0xUser1'],
                mintedCountByAddress: { '0xuser1': 2 },
                burnedCountByAddress: { '0xuser1': 1 },
              },
            },
          },
        },
      ],
      [],
      [],
    );

    expect(users).toHaveLength(1);
    expect(users[0].sbts).toEqual([expect.objectContaining({ name: 'Alpha', address: '0xSbt1' })]);
  });

  it('uses checkpoint-backed partial counts only when the compared subject is present', () => {
    const users = buildUsersFromCaches(
      ['0xUser1'],
      [
        {
          84532: {
            sbtList: {
              '0xsbt1': {
                sbtAddress: '0xSbt1',
                sbtInfo: { name: 'Alpha' },
                mintedAddresses: ['0xUser1'],
                burnedAddresses: [],
                mintedCountByAddress: { '0xuser1': 1 },
                burnedCountByAddress: {},
                countsLoaded: false,
                countsScanCheckpoint: {
                  phase: 'activity',
                  blockNumber: 149,
                  mintedCountByAddress: { '0xuser1': 1 },
                  burnedCountByAddress: {},
                },
              },
            },
          },
        },
      ],
      [],
      [],
    );

    expect(users).toHaveLength(1);
    expect(users[0].sbts).toEqual([expect.objectContaining({ name: 'Alpha', address: '0xSbt1' })]);
  });

  it('lets completed empty count maps override older legacy ownership hints', () => {
    const users = buildUsersFromCaches(
      ['0xUser1'],
      [
        {
          84532: {
            sbtList: {
              '0xsbt1': {
                sbtAddress: '0xSbt1',
                sbtInfo: { name: 'Alpha' },
                mintedAddresses: ['0xUser1'],
              },
            },
          },
        },
        {
          84532: {
            sbtList: {
              '0xsbt1': {
                sbtAddress: '0xSbt1',
                sbtInfo: { name: 'Alpha' },
                countsLoaded: true,
                mintedCountByAddress: {},
                burnedCountByAddress: {},
              },
            },
          },
        },
      ],
      [],
      [],
    );

    expect(users[0].sbts).toEqual([]);
  });

  it('keeps same-address memberships on different chains distinct', () => {
    const users = buildUsersFromCaches(
      ['0xUser1', '0xUser2'],
      [
        {
          11155420: {
            sbtList: {
              '0xsbt1': {
                sbtAddress: '0xSbt1',
                sbtInfo: { name: 'Alpha' },
                mintedAddresses: ['0xUser1'],
              },
            },
          },
          84532: {
            sbtList: {
              '0xsbt1': {
                sbtAddress: '0xSbt1',
                sbtInfo: { name: 'Alpha' },
                mintedAddresses: ['0xUser2'],
              },
            },
          },
        },
      ],
      [],
      [],
      { sessionSlug: 'alpha' },
    );

    const keys = users.map((user) => Array.from(sbtNameSets([user])[0]));
    expect(keys[0][0]).toContain(':11155420:');
    expect(keys[1][0]).toContain(':84532:');
    expect(fallbackBullets(users).agreements).toEqual([]);
  });
});

describe('compare user pure helpers', () => {
  it('normalizes SBT labels, keys, shortened addresses, and address validity', () => {
    expect(getCompareSbtLabel({ sbtInfo: { name: '  Alpha Ring  ' } })).toBe('Alpha Ring');
    expect(getCompareSbtKey({ sbtInfo: { name: 'Alpha Ring' } })).toBe('alpha ring');
    expect(getCompareSbtKey({ compareKey: 'Canonical:Membership', name: 'Alpha Ring' })).toBe('canonical:membership');
    expect(getCompareSbtKey({ name: '[encrypted]', address: ADDRESS_A })).toBe(ADDRESS_A);
    expect(shortenPlain('0x1234567890abcdef1234567890abcdef1234abcd')).toBe('0x1234\u2026abcd');
    expect(shortenPlain('not-an-address')).toBe('not-an-address');
    expect(isValidAddress(ADDRESS_A)).toBe(true);
    expect(isValidAddress('alice.eth')).toBe(true);
    expect(isValidAddress('0xshort')).toBe(false);
  });

  it('encodes binary, rating, and multichoice stances with signs and weights', () => {
    const { tokens } = encodeStancesForUser(opinionUsers[0]);

    expect(tokens.get('q1')).toEqual({ sign: 1, weight: 1.2 });
    expect(tokens.get('q2')).toEqual({ sign: -1, weight: 1.1 });
    expect(tokens.has('q3')).toBe(false);
    expect(tokens.get('q4::cli')).toEqual({ sign: 1, weight: 1 });
    expect(tokens.get('q4::ui')).toEqual({ sign: 1, weight: 1 });
  });

  it.each([
    [0, -1],
    [1, -0.8],
    [2, -0.6],
    [3, -0.4],
    [4, -0.2],
    [5, 0],
    [6, 0.2],
    [7, 0.4],
    [8, 0.6],
    [9, 0.8],
    [10, 1],
  ])('encodes rating answer %s on the canonical 0-10 scale', (answer, expectedValue) => {
    const { tokens } = encodeStancesForUser({
      questions: [{ id: 'rating', type: 'rating', answer }],
    });
    const stance = tokens.get('rating');

    if (expectedValue === 0) {
      expect(stance).toBeUndefined();
      return;
    }

    expect(stance.sign).toBe(expectedValue > 0 ? 1 : -1);
    expect(stance.weight).toBeCloseTo(Math.abs(expectedValue));
  });

  it.each([' ', '\t', '\n', '*'])('drops blank or sentinel rating answer %j', (answer) => {
    const { tokens } = encodeStancesForUser({
      questions: [{ id: 'rating', type: 'rating', answer }],
    });

    expect(tokens.has('rating')).toBe(false);
  });

  it.each([-1, 11, Number.NaN, Number.POSITIVE_INFINITY, 'not-a-rating'])(
    'drops non-canonical rating answer %s',
    (answer) => {
      const { tokens } = encodeStancesForUser({
        questions: [{ id: 'rating', type: 'rating', answer }],
      });

      expect(tokens.has('rating')).toBe(false);
    },
  );

  it('selects top opinion tokens and builds opinion overlap rows', () => {
    const topTokens = selectTopOpinionTokens(opinionUsers, 4);
    const matrix = computeOverlapMatrix(opinionUsers, 4);

    expect(topTokens).toEqual(['q1', 'q2', 'q4::cli', 'q3']);
    expect(matrix.mode).toBe('opinion');
    expect(matrix.columns.map((column) => column.key)).toEqual(topTokens);
    expect(matrix.rows).toEqual([
      [1, -1, 1, 0],
      [1, 1, 1, -1],
      [-1, 1, 0, -1],
    ]);
  });

  it('falls back to an SBT presence matrix when opinion signal is sparse', () => {
    const matrix = computeOverlapMatrix(
      [
        { address: ADDRESS_A, sbts: [{ name: 'Alpha' }], questions: [{ id: 'q1', type: 'binary', answer: 'yes' }] },
        { address: ADDRESS_B, sbts: [{ name: 'Alpha' }, { name: 'Beta' }], questions: [] },
      ],
      3,
    );

    expect(matrix.mode).toBe('sbt');
    expect(matrix.columns.map((column) => column.label)).toEqual(['Alpha', 'Beta']);
    expect(matrix.rows).toEqual([
      [{ has: true }, { has: false }],
      [{ has: true }, { has: true }],
    ]);
  });

  it('computes sign-aware Venn regions with evidence for overlapping opinions', () => {
    const venn = opinionVennTriplet([
      {
        tokens: new Map([
          ['a', { sign: 1 }],
          ['ab', { sign: 1 }],
          ['ac', { sign: 1 }],
          ['abc', { sign: 1 }],
        ]),
      },
      {
        tokens: new Map([
          ['b', { sign: 1 }],
          ['ab', { sign: 1 }],
          ['bc', { sign: 1 }],
          ['abc', { sign: 1 }],
        ]),
      },
      {
        tokens: new Map([
          ['c', { sign: 1 }],
          ['ac', { sign: 1 }],
          ['bc', { sign: 1 }],
          ['abc', { sign: 1 }],
        ]),
      },
    ]);
    const evidence = computeVennEvidence(opinionUsers.slice(0, 2));
    const opinionFixtureVenn = opinionVennTriplet(opinionUsers);
    const opinionFixtureEvidence = computeVennEvidence(opinionUsers);

    expect(venn).toEqual({ a: 1, b: 1, c: 1, ab: 1, ac: 1, bc: 1, abc: 1 });
    expect(opinionFixtureVenn).toEqual({ a: 2, b: 0, c: 2, ab: 2, ac: 0, bc: 2, abc: 0 });
    expect(opinionFixtureEvidence.counts).toEqual(opinionFixtureVenn);
    expect(evidence.counts).toEqual({ a: 2, b: 2, c: 0, ab: 2, ac: 0, bc: 0, abc: 0 });
    expect(evidence.counts.ab).toBeGreaterThan(0);
    expect(evidence.evidenceMap.ab.some((entry) => entry.includes('q1'))).toBe(true);
    expect(computeVennEvidence([opinionUsers[0]]).counts).toEqual({ a: 0, b: 0, c: 0, ab: 0, ac: 0, bc: 0, abc: 0 });
  });

  it('uses shared signed stance regions for Venn counts and evidence', () => {
    const signedTokenUsers = [
      {
        tokens: new Map([
          ['a', { sign: 1 }],
          ['ab', { sign: 1 }],
          ['ac', { sign: -1 }],
          ['abc', { sign: -1 }],
        ]),
      },
      {
        tokens: new Map([
          ['b', { sign: 1 }],
          ['ab', { sign: 1 }],
          ['bc', { sign: 1 }],
          ['abc', { sign: -1 }],
        ]),
      },
      {
        tokens: new Map([
          ['c', { sign: 1 }],
          ['ac', { sign: -1 }],
          ['bc', { sign: 1 }],
          ['abc', { sign: -1 }],
        ]),
      },
    ];
    const expectedCounts = { a: 1, b: 1, c: 1, ab: 1, ac: 1, bc: 1, abc: 1 };

    expect(opinionVennTriplet(signedTokenUsers)).toEqual(expectedCounts);
    expect(computeVennEvidence(signedTokenUsers).counts).toEqual(expectedCounts);
  });

  it('creates and sanitizes deterministic compass points', () => {
    const compass = pcaLiteCompass(opinionUsers);
    const sanitized = sanitizeCompass(
      {
        axes: [{ id: 'x', label: 'Custom X', description: 'Provided x axis' }],
        points: [{ address: ADDRESS_B, x: 2, y: -2 }],
        evidence: { x: ['one', 'two', 'three', 'four', 'five', 'six'], y: ['north'] },
      },
      [ADDRESS_A, ADDRESS_B],
    );

    expect(compass.points).toHaveLength(3);
    expect(compass.points.every((point) => point.x >= -1 && point.x <= 1 && point.y >= -1 && point.y <= 1)).toBe(true);
    expect(sanitized).toEqual({
      axes: [
        { id: 'x', label: 'Custom X', description: 'Provided x axis' },
        { id: 'y', label: 'Axis 2', description: 'Second principal direction of encoded opinions.' },
      ],
      points: [
        { address: ADDRESS_A, x: 0, y: 0 },
        { address: ADDRESS_B, x: 1, y: -1 },
      ],
      evidence: { x: ['one', 'two', 'three', 'four', 'five'], y: ['north'] },
    });
    expect(sanitizeCompass(null)).toBeNull();
  });

  it('collapses a numerically empty second compass axis for opposite two-user stances', () => {
    const compass = pcaLiteCompass([
      {
        address: ADDRESS_A,
        questions: [{ id: 'q1', type: 'binary', answer: 'yes' }],
      },
      {
        address: ADDRESS_B,
        questions: [{ id: 'q1', type: 'binary', answer: 'no' }],
      },
    ]);

    expect(compass.points).toHaveLength(2);
    expect(compass.points.map((point) => point.y)).toEqual([0, 0]);
  });
});
