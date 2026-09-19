import {
  buildInterviewChangedFields,
  buildSelectedInterviewResearch,
  buildUnselectedInterviewResearch,
} from './sessionInterviewResearch';

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
      redactedFields: ['answer', 'additionalComments'],
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
      redactedFields: ['answer', 'additionalComments'],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /Revised prediction|Original prediction|Edited but rejected|Final private answer|Original note|Edited note|Basis/,
    );
  });
});
