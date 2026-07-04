import { buildUsersFromCaches, fallbackBullets, sbtNameSets } from './compareUsers';

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

    const users = buildUsersFromCaches(
      addresses,
      sbtCaches,
      questionsCaches,
      surveysCaches
    );

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
      []
    );

    expect(users).toHaveLength(1);
    expect(users[0].sbts).toEqual([
      expect.objectContaining({
        name: '[encrypted]',
        address: '0xSbt1',
        compareKey: '0xsbt1',
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
      []
    );

    expect(sbtNameSets(users).map((set) => Array.from(set))).toEqual([
      ['0xsbt1'],
      ['0xsbt2'],
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
      []
    );

    expect(users).toHaveLength(1);
    expect(users[0].sbts).toEqual([
      expect.objectContaining({ name: 'Alpha', address: '0xSbt1' }),
    ]);
  });

  it('ignores checkpoint-backed partial holder counts until a full scan completes', () => {
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
      []
    );

    expect(users).toHaveLength(1);
    expect(users[0].sbts).toEqual([]);
  });
});
