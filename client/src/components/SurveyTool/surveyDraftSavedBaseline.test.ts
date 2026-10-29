import {
  buildDraftBaselineEntry,
  withoutStaleDraftFields,
  withoutUnrestorableUnlocks,
} from './surveyDraftSavedBaseline';

describe('withoutStaleDraftFields', () => {
  it('drops only the draft fields whose saved value changed since the draft was written', () => {
    const saved = {
      answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'env-1' } },
      additionalComments: { q1: { value: 'note' } },
      importance: {},
      conviction: {},
    };
    const stored = buildDraftBaselineEntry(saved, 'q1');
    const decrypted = { ...saved, answers: { q1: { value: 'secret', encrypted: true, encryptedPortion: 'env-1' } } };
    const draft = { value: '*', answerEncrypted: false, additional: 'edited note', additionalEncrypted: false };

    expect(stored).toEqual({ value: '*', answerEncryptedPortion: 'env-1', additional: 'note' });
    expect(withoutStaleDraftFields(draft, stored, decrypted, 'q1')).toEqual(draft);
    // Drafts saved by earlier releases stored full entries, including decrypted values.
    expect(
      withoutStaleDraftFields(
        draft,
        { value: 'secret', answerEncryptedPortion: 'env-1', additional: 'note', importance: null },
        saved,
        'q1',
      ),
    ).toEqual(draft);
    // Saved answers that are not loaded yet cannot conflict.
    expect(withoutStaleDraftFields(draft, stored, null, 'q1')).toEqual(draft);
    expect(
      withoutStaleDraftFields(draft, stored, { ...saved, additionalComments: { q1: { value: 'newer note' } } }, 'q1'),
    ).toEqual({ value: '*', answerEncrypted: false });
    expect(
      withoutStaleDraftFields(
        draft,
        stored,
        { ...saved, answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'env-2' } } },
        'q1',
      ),
    ).toEqual({ additional: 'edited note', additionalEncrypted: false });
  });

  it('treats a draft written before saved answers were known as not conflicting', () => {
    const saved = { answers: { q1: { value: 'Saved answer' } }, additionalComments: { q1: { value: 'Saved note' } } };
    const draft = { additional: 'Typed before saved answers loaded', additionalEncrypted: false };

    expect(withoutStaleDraftFields(draft, undefined, saved, 'q1')).toEqual(draft);
    // Known to have nothing saved, the same draft now conflicts with the saved comment.
    expect(withoutStaleDraftFields(draft, {}, saved, 'q1')).toEqual({});
  });

  it('keeps a consent withdrawal from a stale draft and drops the rest of it', () => {
    const saved = {
      answers: { q1: { value: 'Newer answer' } },
      additionalComments: {},
      interviewProvenance: {
        q1: { includeAiProvenance: true, source: { modelId: 'saved-model' }, responderName: 'Participant A' },
      },
    };
    const draft = {
      value: 'Draft answer',
      interviewProvenance: { includeAiProvenance: true, source: { modelId: 'draft-model' } },
    };

    expect(withoutStaleDraftFields(draft, { value: 'Older answer' }, saved, 'q1')).toEqual({
      interviewProvenance: {
        includeAiProvenance: true,
        includePredictionComparison: false,
        source: { modelId: 'saved-model' },
        version: 1,
      },
    });
  });
});

describe('withoutUnrestorableUnlocks', () => {
  it('drops an unlock stored with the masked value and keeps every other draft field', () => {
    const { entry, lostUnlocks } = withoutUnrestorableUnlocks({
      value: '*',
      answerEncrypted: false,
      answerEncryptedPortion: 'answer-envelope',
      additional: '*',
      additionalEncrypted: false,
      importance: 7,
    });
    expect(entry).toEqual({ importance: 7 });
    expect(lostUnlocks).toEqual(['answer', 'additional']);
  });

  it('keeps a masked value that stays locked and an unlocked value with text', () => {
    const lockedAudienceChange = { value: '*', answerEncrypted: true, answerEncryptionAudience: 'self_admin' };
    const publicComment = { additional: 'Public note', additionalEncrypted: false };
    expect(withoutUnrestorableUnlocks(lockedAudienceChange)).toEqual({ entry: lockedAudienceChange, lostUnlocks: [] });
    expect(withoutUnrestorableUnlocks(publicComment)).toEqual({ entry: publicComment, lostUnlocks: [] });
  });
});

describe('buildDraftBaselineEntry', () => {
  it('keeps decrypted ratings out when the saved ratings are encrypted', () => {
    const saved = {
      answers: { q1: { value: 'Public answer' } },
      additionalComments: { q1: { value: '' } },
      importance: { q1: 6 },
      conviction: { q1: 5 },
    };
    expect(buildDraftBaselineEntry(saved, 'q1')).toEqual({ value: 'Public answer', importance: 6, conviction: 5 });
    expect(buildDraftBaselineEntry(saved, 'q1', true)).toEqual({ value: 'Public answer' });
  });
});

describe('known empty saved answers', () => {
  const empty = { answers: {}, additionalComments: {}, importance: {}, conviction: {} };
  const nonempty = { answers: { q1: { value: 'Saved' } }, additionalComments: { q1: { value: 'Saved note' } } };
  const draft = { value: 'Draft', additional: 'Draft note' };
  it('records a loaded empty answer separately from an unknown answer', () => {
    expect(buildDraftBaselineEntry(empty, 'q1')).toEqual({});
    expect(buildDraftBaselineEntry(null, 'q1')).toBeNull();
  });
  it.each([
    ['nonempty', nonempty, empty, {}],
    ['empty', empty, empty, draft],
    ['unknown', null, empty, draft],
    ['loading', nonempty, null, draft],
  ])('restores against a %s baseline with the same writer and reader rule', (_name, saved, current, expected) => {
    const stored = buildDraftBaselineEntry(saved, 'q1');
    expect(withoutStaleDraftFields(draft, stored, current, 'q1')).toEqual(expected);
  });
});
