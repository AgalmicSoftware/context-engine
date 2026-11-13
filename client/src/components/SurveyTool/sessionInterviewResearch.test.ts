import {
  buildInterviewChangedFields,
  lockEncryptedFields,
  redactInterviewEncryptedRatings,
  buildSelectedInterviewResearch,
  buildUnselectedInterviewResearch,
  resolveInterviewDraftOrigin,
  withoutEncryptedFields,
} from './sessionInterviewResearch';

describe('what someone encrypted, in interview review', () => {
  const fields = {
    answers: { open: { value: 'Yes' }, locked: { value: 'Private yes', encrypted: true } },
    additionalComments: {
      open: { value: 'Open note' },
      unlocked: { value: 'Secret reason', encrypted: true, audienceMode: 'explicit' },
      // A comment without its own audience follows its answer's lock.
      locked: { value: 'Inherited secret', audienceMode: 'inherit' },
      blank: { value: '', encrypted: true },
    },
  };

  it('counts an encrypted answer or comment as locked, even once unlocked on the page', () => {
    const review = lockEncryptedFields(fields);
    expect(review?.answers).toEqual({ open: { value: 'Yes' }, locked: { value: '*', encrypted: true } });
    expect(review?.additionalComments).toEqual({
      open: { value: 'Open note' },
      unlocked: { value: '*', encrypted: true, audienceMode: 'explicit' },
      locked: { value: '*', audienceMode: 'inherit' },
      blank: { value: '', encrypted: true },
    });
    // Only an answer someone encrypted is locked, not one beside an encrypted comment.
    const commentOnly = {
      answers: { q: { value: 'Yes' } },
      additionalComments: { q: { value: 'Why', encrypted: true } },
    };
    expect(lockEncryptedFields(commentOnly)?.answers).toBe(commentOnly.answers);
    // Nothing to lock leaves the fields as they were.
    const open = { answers: { open: { value: 'Yes' } }, additionalComments: { open: { value: 'Open note' } } };
    expect(lockEncryptedFields(open)).toBe(open);
    expect(lockEncryptedFields(null)).toBeNull();
  });

  it('keeps encrypted answers, comments and the ratings beside them from an AI', () => {
    const reviewed = {
      questionId: 'locked',
      answer: 'Typed answer',
      additionalComments: 'Typed note',
      importance: 7,
      conviction: 4,
      userEditedFields: ['answer' as const, 'additionalComments' as const, 'importance' as const],
    };
    expect(withoutEncryptedFields('locked', fields, reviewed)).toEqual({ questionId: 'locked', userEditedFields: [] });
    expect(withoutEncryptedFields('unlocked', fields, { ...reviewed, questionId: 'unlocked' })).toEqual({
      questionId: 'unlocked',
      answer: 'Typed answer',
      userEditedFields: ['answer'],
    });
    const open = { ...reviewed, questionId: 'open' };
    expect(withoutEncryptedFields('open', fields, open)).toBe(open);
    expect(withoutEncryptedFields('open', fields, undefined)).toBeUndefined();
  });
});

describe('selected interview research', () => {
  it('keeps net changed fields separate from fields the reviewer touched', () => {
    expect(
      buildInterviewChangedFields(
        { answer: 'Original', additionalComments: 'Note' },
        { answer: 'Original', additionalComments: 'Note', userEditedFields: ['answer'] },
      ),
    ).toEqual([]);
    expect(
      buildSelectedInterviewResearch({
        questionId: 'q1',
        answer: 'Original',
        additionalComments: 'Note',
        userEditedFields: ['answer'],
        original: { answer: 'Original', additionalComments: 'Note', evidence: 'Basis' },
      }),
    ).toMatchObject({
      changedFields: [],
      userEditedFields: ['answer'],
      finalSubmitted: { answer: 'Original', additionalComments: 'Note' },
    });
  });

  it('redacts selected encrypted text and revision evidence', () => {
    const result = buildSelectedInterviewResearch(
      {
        questionId: 'q1',
        answer: 'Private final',
        additionalComments: 'Private comment',
        original: {
          answer: 'Private original',
          additionalComments: 'Private original note',
          evidence: 'Sensitive evidence',
          revisions: [
            {
              revision: 1,
              modelId: 'fixture',
              answer: 'Revision private',
              additionalComments: 'Revision note',
              evidence: 'Revision evidence',
            },
          ],
        },
      },
      {
        answers: { q1: { encrypted: true } },
        additionalComments: { q1: { audienceMode: 'follow' } },
      },
    );
    expect(result).toMatchObject({
      originalPrediction: { answer: { redacted: true }, additionalComments: { redacted: true }, evidence: '' },
      predictionRevisions: [{ answer: { redacted: true }, additionalComments: { redacted: true }, evidence: '' }],
      finalSubmitted: { answer: { redacted: true }, additionalComments: { redacted: true } },
      redactedFields: ['answer', 'additionalComments', 'importance', 'conviction'],
    });
    expect(JSON.stringify(result)).not.toMatch(/Private|Sensitive|Revision private|Revision evidence/);
  });
});

describe('unselected interview research', () => {
  const draft = {
    questionId: 'q2',
    answer: 'Edited but rejected',
    additionalComments: 'Edited note',
    userEditedFields: ['answer'],
    original: {
      answer: 'Original prediction',
      additionalComments: 'Original note',
      evidence: 'Basis',
      confidence: 0.6,
      revisions: [
        {
          revision: 1,
          modelId: 'fixture',
          answer: 'Original prediction',
          additionalComments: 'Original note',
          evidence: 'Basis',
        },
        { revision: 2, modelId: 'fixture', answer: 'Revised prediction' },
      ],
    },
  };

  it('distinguishes an edited unselected prediction from a submitted answer', () => {
    expect(buildUnselectedInterviewResearch([draft])[0]).toMatchObject({
      questionId: 'q2',
      selection: 'not_selected',
      revisions: [
        expect.objectContaining({ answer: 'Original prediction' }),
        expect.objectContaining({ answer: 'Revised prediction' }),
      ],
      submitted: null,
      original: { answer: 'Original prediction' },
      reviewed: { answer: 'Edited but rejected' },
      changedFields: ['answer', 'additionalComments'],
      userEditedFields: ['answer'],
    });
  });

  it('redacts protected original, edited and final text, including evidence', () => {
    const result = buildUnselectedInterviewResearch(
      [{ ...draft, submissionValueSnapshot: { answer: 'Final private answer' } }],
      {
        answers: { q2: { encrypted: true } },
        additionalComments: { q2: { audienceMode: 'follow' } },
      },
    );
    expect(result[0]).toMatchObject({
      original: { answer: { redacted: true }, additionalComments: { redacted: true }, evidence: '' },
      reviewed: { answer: { redacted: true }, additionalComments: { redacted: true } },
      submitted: { answer: { redacted: true } },
      redactedFields: ['answer', 'additionalComments', 'importance', 'conviction'],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /Revised prediction|Original prediction|Edited but rejected|Final private answer|Original note|Edited note|Basis/,
    );
  });

  it('does not report an untouched empty comment as changed', () => {
    // Review entries carry '' where the AI prediction had no comment.
    const untouched = {
      questionId: 'q3',
      answer: 'Prediction',
      additionalComments: '',
      original: {
        answer: 'Prediction',
        revisions: [{ revision: 1, modelId: 'fixture', answer: 'Prediction', additionalComments: undefined }],
      },
    };
    expect(buildUnselectedInterviewResearch([untouched])[0]).toMatchObject({
      original: { additionalComments: '' },
      reviewed: { additionalComments: '' },
      changedFields: [],
    });
  });
});

it('redacts only ratings with final envelopes, including historical snapshots', () => {
  const research = {
    originalPrediction: { importance: 7, conviction: 3, answer: 'public' },
    predictionRevisions: [{ importance: 8, conviction: 4 }],
    finalSubmitted: { importance: 9, conviction: 5 },
    redactedFields: [],
    unselectedPredictions: [
      { questionId: 'q1', reviewed: { importance: 2, conviction: 1 } },
      { questionId: 'q2', reviewed: { importance: 6 } },
    ],
  };
  const output = redactInterviewEncryptedRatings(research, 'q1', ['importance']);
  expect(output).toMatchObject({
    originalPrediction: { importance: { redacted: true }, conviction: 3, answer: 'public' },
    predictionRevisions: [{ importance: { redacted: true }, conviction: 4 }],
    finalSubmitted: { importance: { redacted: true }, conviction: 5 },
    redactedFields: ['importance'],
    unselectedPredictions: [
      { reviewed: { importance: { redacted: true }, conviction: 1 } },
      { reviewed: { importance: 6 } },
    ],
  });
  expect(research.originalPrediction.importance).toBe(7);
});

describe('minimal interview research', () => {
  const draft = {
    questionId: 'q1',
    answer: 'Agree',
    additionalComments: 'My own note',
    importance: 6,
    conviction: 7,
    original: {
      answer: 'Disagree',
      additionalComments: 'As a nurse in Boston I worry',
      importance: 4,
      conviction: 5,
      confidence: 0.6,
      evidence: 'From memory: works in a hospital',
      revisions: [
        {
          revision: 1,
          modelId: 'claude-test',
          answer: 'Disagree',
          additionalComments: 'Draft',
          evidence: 'Basis',
          confidence: 0.6,
        },
      ],
    },
  };

  it('keeps predicted choices, ratings and confidence but no AI notes or drafted text', () => {
    const result = buildSelectedInterviewResearch(draft, {}, { tier: 'minimal' });
    expect(result).toEqual({
      questionId: 'q1',
      selection: 'selected',
      originalPrediction: { answer: 'Disagree', importance: 4, conviction: 5, confidence: 0.6 },
      predictionRevisions: [
        {
          revision: 1,
          modelId: 'claude-test',
          answer: 'Disagree',
          importance: null,
          conviction: null,
          confidence: 0.6,
        },
      ],
      finalSubmitted: { answer: 'Agree', importance: 6, conviction: 7 },
      changedFields: ['answer', 'additionalComments', 'importance', 'conviction'],
      userEditedFields: [],
      redactedFields: [],
    });
    expect(JSON.stringify(result)).not.toMatch(/nurse|hospital|My own note|Draft|Basis/);
  });

  it('drops the drafted answer itself on freeform questions but keeps redaction markers', () => {
    const freeform = buildSelectedInterviewResearch(draft, {}, { tier: 'minimal', textAnswer: true });
    expect(freeform?.originalPrediction).toEqual({ answer: null, importance: 4, conviction: 5, confidence: 0.6 });
    expect(freeform?.finalSubmitted).toEqual({ answer: null, importance: 6, conviction: 7 });
    const encrypted = buildSelectedInterviewResearch(
      draft,
      { answers: { q1: { encrypted: true } } },
      { tier: 'minimal', textAnswer: true },
    );
    expect(encrypted?.originalPrediction).toMatchObject({ answer: { redacted: true } });
  });

  it('uses supplied changed fields when the original text is no longer known', () => {
    const result = buildSelectedInterviewResearch(draft, {}, { tier: 'minimal', changedFields: ['answer'] });
    expect(result?.changedFields).toEqual(['answer']);
  });

  it('leaves the full record unchanged', () => {
    expect(buildSelectedInterviewResearch(draft, {}, { tier: 'full' })).toEqual(buildSelectedInterviewResearch(draft));
  });
});

describe('interview draft origin', () => {
  const packet = { source: { modelId: 'claude-test' } };
  it.each([
    [{ revisions: [{ modelId: 'claude-test' }] }, packet, { modelId: 'claude-test' }, 'external_prefill'],
    [{}, packet, null, 'external_prefill'],
    [{ revisions: [{ modelId: 'gpt-realtime' }] }, packet, null, 'voice_interview'],
    [{ revisions: [{ modelId: 'gpt-realtime' }] }, null, null, 'voice_interview'],
    [{ revisions: [{ modelId: 'gpt-x' }] }, null, { modelId: 'direct-user-context' }, 'typed_context'],
    [{ revisions: [{ modelId: 'gpt-x', origin: 'group_recording' }] }, packet, null, 'group_recording'],
    [
      { revisions: [{ modelId: 'gpt-x', origin: 'group_recording' }] },
      null,
      { modelId: 'direct-user-context' },
      'group_recording',
    ],
    [
      { revisions: [{ modelId: 'gpt-x' }, { modelId: 'gpt-x', origin: 'group_recording' }] },
      null,
      null,
      'voice_interview',
    ],
  ])('labels %j', (value, prefill, source, expected) => {
    expect(resolveInterviewDraftOrigin(value, prefill, source)).toBe(expected);
  });
});
