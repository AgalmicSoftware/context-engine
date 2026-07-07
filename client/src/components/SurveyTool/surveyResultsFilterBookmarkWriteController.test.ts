import { runSurveyResultsFilterBookmarkWriteController } from './surveyResultsFilterBookmarkWriteController';

describe('surveyResultsFilterBookmarkWriteController', () => {
  it('dispatches one injected filter bookmark write and returns a plain success result', async () => {
    const payload = {
      bookmarkedFilters: [{ types: ['radio'] }],
      otherField: 'kept',
    };
    const writeFilterBookmark = jest.fn().mockResolvedValue(true);

    const result = await runSurveyResultsFilterBookmarkWriteController({
      plan: {
        blockedReason: '',
        bookmarkedFiltersInvalid: false,
        payload,
        shouldReadCache: true,
        shouldWrite: true,
        successFeedback: true,
        target: {
          namespace: 'filters',
          slug: 'edge',
        },
      },
      ports: {
        writeFilterBookmark,
      },
    });

    expect(writeFilterBookmark).toHaveBeenCalledWith('filters', 'edge', payload);
    expect(result).toEqual({
      attempted: true,
      error: null,
      ok: true,
      shouldApplySuccessFeedback: true,
      statePatch: {},
      target: {
        namespace: 'filters',
        slug: 'edge',
      },
    });
  });

  it('does not write when the plan is blocked or missing a payload', async () => {
    const writeFilterBookmark = jest.fn();

    await expect(
      runSurveyResultsFilterBookmarkWriteController({
        plan: {
          blockedReason: 'unmounted',
          bookmarkedFiltersInvalid: false,
          payload: null,
          shouldReadCache: false,
          shouldWrite: false,
          successFeedback: false,
          target: {
            namespace: 'filters',
            slug: 'edge',
          },
        },
        ports: {
          writeFilterBookmark,
        },
      }),
    ).resolves.toEqual({
      attempted: false,
      error: null,
      ok: false,
      shouldApplySuccessFeedback: false,
      statePatch: {},
      target: {
        namespace: 'filters',
        slug: 'edge',
      },
    });
    expect(writeFilterBookmark).not.toHaveBeenCalled();

    await expect(
      runSurveyResultsFilterBookmarkWriteController({
        plan: {
          blockedReason: '',
          bookmarkedFiltersInvalid: false,
          payload: null,
          shouldReadCache: true,
          shouldWrite: true,
          successFeedback: true,
          target: {
            namespace: 'filters',
            slug: 'edge',
          },
        },
        ports: {
          writeFilterBookmark,
        },
      }),
    ).resolves.toEqual({
      attempted: false,
      error: null,
      ok: false,
      shouldApplySuccessFeedback: false,
      statePatch: {},
      target: {
        namespace: 'filters',
        slug: 'edge',
      },
    });
    expect(writeFilterBookmark).not.toHaveBeenCalled();
  });

  it('returns write failures without throwing or applying feedback', async () => {
    const writeError = new Error('write failed');
    const writeFilterBookmark = jest.fn().mockRejectedValue(writeError);

    const result = await runSurveyResultsFilterBookmarkWriteController({
      plan: {
        blockedReason: '',
        bookmarkedFiltersInvalid: false,
        payload: {
          bookmarkedFilters: [{ types: ['rating'] }],
        },
        shouldReadCache: true,
        shouldWrite: true,
        successFeedback: true,
        target: {
          namespace: 'filters',
          slug: 'edge',
        },
      },
      ports: {
        writeFilterBookmark,
      },
    });

    expect(writeFilterBookmark).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      attempted: true,
      error: writeError,
      ok: false,
      shouldApplySuccessFeedback: false,
      statePatch: {},
      target: {
        namespace: 'filters',
        slug: 'edge',
      },
    });
  });
});
