import { runSurveyResultsSurveyQuestionBookmarkWriteController } from './surveyResultsSurveyQuestionBookmarkWriteController';

describe('surveyResultsSurveyQuestionBookmarkWriteController', () => {
  it('dispatches one injected bookmarks cache write and returns a plain success result', async () => {
    const payload = {
      surveys: ['s1'],
      questions: ['q1'],
      otherField: 'kept',
    };
    const writeBookmarksCache = jest.fn().mockResolvedValue(true);

    const result = await runSurveyResultsSurveyQuestionBookmarkWriteController({
      plan: {
        blockedReason: '',
        payload,
        shouldWrite: true,
        statePatch: {
          key: 'bookmarkedSurveyIDs',
          value: ['s1'],
        },
        target: {
          namespace: 'bookmarksCache',
          slug: 'edge',
        },
        toggled: {
          action: 'add',
          bookmarkType: 'survey',
          id: 's1',
        },
      },
      ports: {
        writeBookmarksCache,
      },
    });

    expect(writeBookmarksCache).toHaveBeenCalledWith('bookmarksCache', 'edge', payload);
    expect(result).toEqual({
      attempted: true,
      error: null,
      ok: true,
      statePatch: {
        key: 'bookmarkedSurveyIDs',
        value: ['s1'],
      },
      target: {
        namespace: 'bookmarksCache',
        slug: 'edge',
      },
      toggled: {
        action: 'add',
        bookmarkType: 'survey',
        id: 's1',
      },
    });
  });

  it('does not write when the plan is blocked or missing a payload', async () => {
    const writeBookmarksCache = jest.fn();

    await expect(
      runSurveyResultsSurveyQuestionBookmarkWriteController({
        plan: {
          blockedReason: 'invalid-bookmark-type',
          payload: null,
          shouldWrite: false,
          statePatch: null,
          target: {
            namespace: 'bookmarksCache',
            slug: 'edge',
          },
          toggled: null,
        },
        ports: {
          writeBookmarksCache,
        },
      }),
    ).resolves.toEqual({
      attempted: false,
      error: null,
      ok: false,
      statePatch: null,
      target: {
        namespace: 'bookmarksCache',
        slug: 'edge',
      },
      toggled: null,
    });
    expect(writeBookmarksCache).not.toHaveBeenCalled();
  });

  it('returns write failures without throwing or dropping the parent state patch', async () => {
    const writeError = new Error('bookmark write failed');
    const writeBookmarksCache = jest.fn().mockRejectedValue(writeError);

    const result = await runSurveyResultsSurveyQuestionBookmarkWriteController({
      plan: {
        blockedReason: '',
        payload: {
          surveys: ['s1'],
          questions: [],
        },
        shouldWrite: true,
        statePatch: {
          key: 'bookmarkedQuestionIDs',
          value: [],
        },
        target: {
          namespace: 'bookmarksCache',
          slug: 'edge',
        },
        toggled: {
          action: 'remove',
          bookmarkType: 'question',
          id: 'q1',
        },
      },
      ports: {
        writeBookmarksCache,
      },
    });

    expect(writeBookmarksCache).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      attempted: true,
      error: writeError,
      ok: false,
      statePatch: {
        key: 'bookmarkedQuestionIDs',
        value: [],
      },
      target: {
        namespace: 'bookmarksCache',
        slug: 'edge',
      },
      toggled: {
        action: 'remove',
        bookmarkType: 'question',
        id: 'q1',
      },
    });
  });

  it('captures synchronous write-port throws as plain failure results', async () => {
    const writeError = new Error('sync write failed');
    const writeBookmarksCache = jest.fn(() => {
      throw writeError;
    });

    const result = await runSurveyResultsSurveyQuestionBookmarkWriteController({
      plan: {
        blockedReason: '',
        payload: {
          surveys: [],
          questions: ['q1'],
        },
        shouldWrite: true,
        statePatch: {
          key: 'bookmarkedQuestionIDs',
          value: ['q1'],
        },
        target: {
          namespace: 'bookmarksCache',
          slug: 'edge',
        },
        toggled: {
          action: 'add',
          bookmarkType: 'question',
          id: 'q1',
        },
      },
      ports: {
        writeBookmarksCache,
      },
    });

    expect(writeBookmarksCache).toHaveBeenCalledWith('bookmarksCache', 'edge', {
      surveys: [],
      questions: ['q1'],
    });
    expect(result).toEqual({
      attempted: true,
      error: writeError,
      ok: false,
      statePatch: {
        key: 'bookmarkedQuestionIDs',
        value: ['q1'],
      },
      target: {
        namespace: 'bookmarksCache',
        slug: 'edge',
      },
      toggled: {
        action: 'add',
        bookmarkType: 'question',
        id: 'q1',
      },
    });
  });
});
