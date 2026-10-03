import { buildSelfQuestionDecryptSuccessState } from './surveyToolDecryptSliceState';

const saved = {
  value: '*',
  encrypted: true,
  encryptedPortion: 'saved-envelope',
  hash: 'saved-hash',
  encryptionAudience: 'self_admin',
  encryptionGateId: null,
  audienceMode: 'explicit',
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

it.each(
  ['answers', 'additionalComments'].flatMap(
    (field) =>
      [
        [field, { encryptionAudience: 'self' }],
        [field, { encryptionAudience: 'gate', encryptionGateId: 'new-gate' }],
        [field, { audienceMode: 'inherited' }],
      ] as const,
  ),
)('preserves pending %s policy %j without adopting it into the saved baseline', (field, choice) => {
  const previous = {
    surveysResponseState: [{ [field]: { q1: { ...saved, ...choice }, q2: { value: 'untouched' } } }],
    editBaseline: { [field]: { q1: saved } },
  };
  const snapshot = clone(previous);
  const next = buildSelfQuestionDecryptSuccessState(
    previous,
    {
      questionId: 'q1',
      didUpdate: true,
      baselineSlice: { [field]: { q1: { ...saved, encryptedPortion: 'latest-envelope', hash: 'latest-hash' } } },
      decryptedStateSlice: { [field]: { q1: { value: 'decrypted' } } },
    },
    clone,
  );
  expect(next.surveysResponseState[0]).toMatchObject({
    [field]: {
      q1: { ...saved, ...choice, value: 'decrypted', encryptedPortion: 'latest-envelope', hash: 'latest-hash' },
      q2: { value: 'untouched' },
    },
  });
  expect(next.editBaseline).toMatchObject({
    [field]: { q1: { ...saved, value: 'decrypted', encryptedPortion: 'latest-envelope', hash: 'latest-hash' } },
  });
  expect(previous).toEqual(snapshot);
});

it.each([null, {}, { answers: {}, additionalComments: {} }])(
  'adopts the fetched policy when the prior baseline is unavailable: %j',
  (editBaseline) => {
    const previous = {
      surveysResponseState: [{ answers: { q1: saved }, additionalComments: { q1: saved } }],
      editBaseline,
    };
    const latest = { ...saved, encryptionAudience: 'self' };
    const result = buildSelfQuestionDecryptSuccessState(
      previous,
      {
        questionId: 'q1',
        didUpdate: true,
        baselineSlice: { answers: { q1: latest }, additionalComments: { q1: latest } },
        decryptedStateSlice: { answers: { q1: { value: 'answer' } }, additionalComments: { q1: { value: 'comment' } } },
      },
      clone,
    );
    expect(result.surveysResponseState[0]).toMatchObject({
      answers: { q1: { encryptionAudience: 'self' } },
      additionalComments: { q1: { encryptionAudience: 'self' } },
    });
  },
);

it.each(['answers', 'additionalComments'])(
  'keeps saved %s policy when a Worker decrypt starts from the edited slice',
  (field) => {
    const edited = { [field]: { q1: { ...saved, encryptionAudience: 'self' } } };
    const next = buildSelfQuestionDecryptSuccessState(
      { surveysResponseState: [edited], editBaseline: { [field]: { q1: saved } } },
      {
        questionId: 'q1',
        didUpdate: true,
        baselineSlice: edited,
        decryptedStateSlice: { [field]: { q1: { value: 'decrypted' } } },
      },
    );
    expect(next.surveysResponseState[0]).toMatchObject({
      [field]: { q1: { value: 'decrypted', encryptionAudience: 'self' } },
    });
    expect(next.editBaseline).toMatchObject({
      [field]: { q1: { value: 'decrypted', encryptionAudience: 'self_admin' } },
    });
  },
);
