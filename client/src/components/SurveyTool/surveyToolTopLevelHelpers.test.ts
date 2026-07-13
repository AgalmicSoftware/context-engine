import {
  buildSurveyToolHydratedFilterState,
  buildSurveyToolLoadingStatePatch,
  buildSurveyToolPubKeyStatePatch,
  buildSurveyToolQuestionsCacheNoncePatch,
  buildSurveyToolFilterStateUrlPath,
  buildSurveyToolResultsModalStatePatch,
  buildSurveyToolSurveyListStatePatch,
  buildSurveyToolSurveyListFromBag,
  findSurveyInAllSurveyCaches,
  findSurveyInSurveyCacheEntries,
  getInitialCacheState,
  getNormalizedSurveyIdFromPropsValue,
  getResolvedSurveyToolPropsFromProps,
  getSurveyToolSessionPropFromProps,
  resolveSurveyToolResultsModalCloseState,
  resolveSurveyToolRenderMode,
  resolveSurveyToolSelectorRenderState,
  shouldBumpSurveyToolQuestionsCacheNonce,
  shouldFetchSurveyToolSurveysOnPropsChange,
  shouldOpenSurveyToolResultsOnPropsChange,
  shouldRouteSurveyToolMountToQuestions,
} from './surveyToolTopLevelHelpers';

describe('surveyToolTopLevelHelpers', () => {
  it('builds a fresh initial cache state', () => {
    const first = getInitialCacheState();
    const second = getInitialCacheState();

    expect(first).toEqual({
      surveyIDs: [],
      questionIDs: [],
      questionResponses: {},
      arweaveContent: {},
    });
    expect(first).not.toBe(second);
    expect(first.surveyIDs).not.toBe(second.surveyIDs);
  });

  it('builds top-level modal and question-cache nonce state patches', () => {
    expect(buildSurveyToolResultsModalStatePatch({ open: true })).toEqual({
      showResultsModal: true,
    });
    expect(buildSurveyToolResultsModalStatePatch({ open: 1 })).toEqual({
      showResultsModal: false,
    });
    expect(buildSurveyToolQuestionsCacheNoncePatch({ questionsCacheNonce: 4 })).toEqual({
      questionsCacheNonce: 5,
    });
    expect(buildSurveyToolQuestionsCacheNoncePatch({ questionsCacheNonce: null })).toEqual({
      questionsCacheNonce: 1,
    });
  });

  it('builds top-level loading and survey-list state patches', () => {
    const surveys = [{ id: '0xsurvey' }];

    expect(buildSurveyToolLoadingStatePatch({ loading: true })).toEqual({
      loading: true,
    });
    expect(buildSurveyToolLoadingStatePatch({ loading: 'true' })).toEqual({
      loading: false,
    });
    expect(buildSurveyToolPubKeyStatePatch({ pubKey: '0xpub' })).toEqual({
      pubKey: '0xpub',
    });
    expect(buildSurveyToolPubKeyStatePatch({ pubKey: null })).toEqual({
      pubKey: '',
    });
    expect(buildSurveyToolSurveyListStatePatch({ surveys })).toEqual({
      surveys,
      loading: false,
    });
    expect(buildSurveyToolSurveyListStatePatch({ surveys: null, loading: true })).toEqual({
      surveys: [],
      loading: true,
    });
  });

  it('builds URL filter hydration state without mutating browser history', () => {
    window.history.pushState({}, '', '/questions');
    const path = buildSurveyToolFilterStateUrlPath(
      {
        sessionSlug: 'Demo Session',
      },
      {
        questionTypes: ['freeform'],
      },
    );
    const result = buildSurveyToolHydratedFilterState({
      props: {},
      href: new URL(path, 'https://example.test').toString(),
    });

    expect(result.error).toBeNull();
    expect(result.filterState).toMatchObject({
      questionTypes: ['freeform'],
    });
    expect(result.cleanUrl).toBe('https://example.test/questions/results?session=Demo+Session');
    expect(window.location.pathname).toBe('/questions');
  });

  it('skips URL filter hydration for pile mode and active prop filters', () => {
    const href = 'https://example.test/questions/results?filter=abc';

    expect(
      buildSurveyToolHydratedFilterState({
        props: { minifiedMode: 'pile' },
        href,
      }),
    ).toEqual({
      filterState: null,
      cleanUrl: null,
      error: null,
    });
    expect(
      buildSurveyToolHydratedFilterState({
        props: { filterState: { questionTypes: ['rating'] } },
        href,
      }),
    ).toEqual({
      filterState: null,
      cleanUrl: null,
      error: null,
    });
  });

  it('returns hydration errors without throwing', () => {
    const result = buildSurveyToolHydratedFilterState({
      props: {},
      href: 'not a valid url',
    });

    expect(result.filterState).toBeNull();
    expect(result.cleanUrl).toBeNull();
    expect(result.error).toBeTruthy();
    expect(String(result.error)).toContain('Invalid URL');
  });

  it('normalizes string session slugs and leaves absent slugs undefined', () => {
    expect(getSurveyToolSessionPropFromProps({ sessionSlug: ' Demo Session ' })).toBe('Demo Session');
    expect(getSurveyToolSessionPropFromProps({ sessionSlug: null })).toBeUndefined();
  });

  it('returns the original props object when no normalized session slug is needed', () => {
    const props = { surveyId: '0xabc' };

    expect(getResolvedSurveyToolPropsFromProps(props)).toBe(props);
  });

  it('returns a copied props object with normalized session slug when provided', () => {
    const props = { sessionSlug: ' Demo Session ', surveyId: '0xabc' };
    const resolved = getResolvedSurveyToolPropsFromProps(props);

    expect(resolved).not.toBe(props);
    expect(resolved).toEqual({
      sessionSlug: 'Demo Session',
      surveyId: '0xabc',
    });
  });

  it('normalizes surveyId before legacy surveyID', () => {
    expect(
      getNormalizedSurveyIdFromPropsValue({
        surveyId: ' 0xABC ',
        surveyID: '0xdef',
      }),
    ).toBe('0xabc');
    expect(getNormalizedSurveyIdFromPropsValue({ surveyID: ' 0xDEF ' })).toBe('0xdef');
    expect(getNormalizedSurveyIdFromPropsValue({})).toBeNull();
  });

  it('resolves top-level render mode precedence', () => {
    expect(
      resolveSurveyToolRenderMode({
        minifiedMode: 'pile',
        singleQuestionMode: true,
      }),
    ).toEqual({
      shouldRenderPileMode: true,
      shouldRenderSingleQuestionMode: false,
      shouldRenderSurveySelectorMode: false,
    });
    expect(
      resolveSurveyToolRenderMode({
        singleQuestionMode: true,
      }),
    ).toEqual({
      shouldRenderPileMode: false,
      shouldRenderSingleQuestionMode: true,
      shouldRenderSurveySelectorMode: false,
    });
    expect(resolveSurveyToolRenderMode()).toEqual({
      shouldRenderPileMode: false,
      shouldRenderSingleQuestionMode: false,
      shouldRenderSurveySelectorMode: true,
    });
  });

  it('resolves selector survey id precedence and mismatch warnings', () => {
    expect(
      resolveSurveyToolSelectorRenderState({
        props: {
          surveyId: ' 0xABC ',
          surveyID: '0xdef',
        },
      }),
    ).toMatchObject({
      normalizedSurveyId: '0xabc',
      shouldWarnMismatchedSurveyIds: true,
      mismatchedSurveyIdWarning:
        '[SurveyTool] Both surveyId and surveyID props were provided with different values. Preferring surveyId: " 0xABC " over surveyID: "0xdef"',
    });

    expect(
      resolveSurveyToolSelectorRenderState({
        props: {
          surveyId: ' 0xABC ',
          surveyID: '0xabc',
        },
      }),
    ).toMatchObject({
      normalizedSurveyId: '0xabc',
      shouldWarnMismatchedSurveyIds: false,
      mismatchedSurveyIdWarning: '',
    });
  });

  it('resolves selector filter state with prop precedence before hydrated URL state', () => {
    expect(
      resolveSurveyToolSelectorRenderState({
        props: {
          filterState: { questionTypes: ['rating'] },
        },
        hydratedFilterState: { questionTypes: ['freeform'] },
      }).effectiveFilterState,
    ).toMatchObject({
      questionTypes: ['rating'],
    });

    expect(
      resolveSurveyToolSelectorRenderState({
        props: {},
        hydratedFilterState: { questionTypes: ['freeform'] },
      }).effectiveFilterState,
    ).toMatchObject({
      questionTypes: ['freeform'],
    });
  });

  it('resolves mount-time questions route guards', () => {
    expect(
      shouldRouteSurveyToolMountToQuestions({
        pathname: '/home',
        props: {},
      }),
    ).toBe(true);
    expect(
      shouldRouteSurveyToolMountToQuestions({
        pathname: '/questions',
        props: {},
      }),
    ).toBe(false);
    expect(
      shouldRouteSurveyToolMountToQuestions({
        pathname: '/home',
        props: { minifiedMode: 'pile' },
      }),
    ).toBe(false);
    expect(
      shouldRouteSurveyToolMountToQuestions({
        pathname: '/home',
        props: { preventUrlChange: true },
      }),
    ).toBe(false);
  });

  it('resolves SurveyTool prop-change lifecycle guards', () => {
    expect(
      shouldFetchSurveyToolSurveysOnPropsChange({
        prevProps: { network: { id: 1 }, isSurveyCacheReady: false },
        props: { network: { id: 2 }, isSurveyCacheReady: false },
      }),
    ).toBe(true);
    expect(
      shouldFetchSurveyToolSurveysOnPropsChange({
        prevProps: { network: { id: 1 }, isSurveyCacheReady: false },
        props: { network: { id: 1 }, isSurveyCacheReady: true },
      }),
    ).toBe(true);
    expect(
      shouldFetchSurveyToolSurveysOnPropsChange({
        prevProps: { network: { id: 1 }, isSurveyCacheReady: true },
        props: { network: { id: 1 }, isSurveyCacheReady: false },
      }),
    ).toBe(false);

    expect(
      shouldOpenSurveyToolResultsOnPropsChange({
        prevProps: { autoOpenResults: false },
        props: { autoOpenResults: true },
        showResultsModal: false,
      }),
    ).toBe(true);
    expect(
      shouldOpenSurveyToolResultsOnPropsChange({
        prevProps: { autoOpenResults: false },
        props: { autoOpenResults: true },
        showResultsModal: true,
      }),
    ).toBe(false);

    expect(
      shouldBumpSurveyToolQuestionsCacheNonce({
        prevProps: { isQuestionCacheReady: false },
        props: { isQuestionCacheReady: true },
      }),
    ).toBe(true);
    expect(
      shouldBumpSurveyToolQuestionsCacheNonce({
        prevProps: { isResponsesCacheReady: false },
        props: { isResponsesCacheReady: true },
      }),
    ).toBe(true);
    expect(
      shouldBumpSurveyToolQuestionsCacheNonce({
        prevProps: { questionResponsesNonce: 1 },
        props: { questionResponsesNonce: 2 },
      }),
    ).toBe(true);
    expect(
      shouldBumpSurveyToolQuestionsCacheNonce({
        prevProps: { network: { id: 1 } },
        props: { network: { id: 2 } },
      }),
    ).toBe(true);
    expect(
      shouldBumpSurveyToolQuestionsCacheNonce({
        prevProps: { isQuestionCacheReady: true, questionResponsesNonce: 1, network: { id: 1 } },
        props: { isQuestionCacheReady: false, questionResponsesNonce: 1, network: { id: 1 } },
      }),
    ).toBe(false);
  });

  it('resolves results modal close URL state', () => {
    expect(
      resolveSurveyToolResultsModalCloseState({
        pathname: '/session/edge/questions/results',
        hasExternalCloseHandler: false,
      }),
    ).toEqual({
      shouldTrimResultsPath: true,
      nextPathname: '/session/edge',
      shouldCallExternalCloseHandler: false,
    });
    expect(
      resolveSurveyToolResultsModalCloseState({
        pathname: '/ce/session/edge/questions/results',
        hasExternalCloseHandler: false,
      }),
    ).toEqual({
      shouldTrimResultsPath: true,
      nextPathname: '/ce/session/edge',
      shouldCallExternalCloseHandler: false,
    });
    expect(
      resolveSurveyToolResultsModalCloseState({
        pathname: '/session/edge/questions/results/',
        hasExternalCloseHandler: false,
      }),
    ).toEqual({
      shouldTrimResultsPath: true,
      nextPathname: '/session/edge',
      shouldCallExternalCloseHandler: false,
    });
    expect(
      resolveSurveyToolResultsModalCloseState({
        pathname: '/session/edge/QUESTIONS/RESULTS',
        hasExternalCloseHandler: false,
      }),
    ).toEqual({
      shouldTrimResultsPath: true,
      nextPathname: '/session/edge',
      shouldCallExternalCloseHandler: false,
    });
    expect(
      resolveSurveyToolResultsModalCloseState({
        pathname: '/questions/results',
        hasExternalCloseHandler: false,
      }),
    ).toEqual({
      shouldTrimResultsPath: true,
      nextPathname: '/questions',
      shouldCallExternalCloseHandler: false,
    });
    expect(
      resolveSurveyToolResultsModalCloseState({
        pathname: '/session/edge/questions/results',
        hasExternalCloseHandler: true,
      }),
    ).toEqual({
      shouldTrimResultsPath: false,
      nextPathname: '/session/edge/questions/results',
      shouldCallExternalCloseHandler: true,
    });
  });

  it('finds a survey in namespaced cache entries case-insensitively', () => {
    const survey = { id: '0xabc', title: 'Stored survey' };
    const result = findSurveyInSurveyCacheEntries('0xABC', [
      {
        slug: 'first-session',
        value: {
          '11155420': {
            surveys: {},
          },
        },
      },
      {
        slug: 'second-session',
        value: {
          '11155420': {
            surveys: {
              '0xabc': survey,
            },
          },
        },
      },
    ]);

    expect(result).toEqual({
      data: survey,
      foundSlug: 'second-session',
    });
  });

  it('finds surveys across all survey cache entries through an injected cache reader', () => {
    const survey = { id: '0xabc', title: 'Stored survey' };
    const listNamespaceEntries = jest.fn(() => [
      {
        slug: 'cached-session',
        value: {
          '11155420': {
            surveys: {
              '0xabc': survey,
            },
          },
        },
      },
    ]);

    expect(findSurveyInAllSurveyCaches('0xABC', listNamespaceEntries)).toEqual({
      data: survey,
      foundSlug: 'cached-session',
    });
    expect(listNamespaceEntries).toHaveBeenCalledWith('surveysCache', { cloneValues: false });
  });

  it('ignores invalid cache entries and returns null for missing surveys', () => {
    expect(findSurveyInSurveyCacheEntries(null, [])).toBeNull();
    expect(
      findSurveyInSurveyCacheEntries('0xabc', [
        { slug: 'bad-session', value: null },
        { slug: 'empty-session', value: { '11155420': { surveys: {} } } },
      ]),
    ).toBeNull();
  });

  it('builds survey list entries from a cache bag while preserving first-seen ids', () => {
    const alpha: { title: string; surveyID: string; questionIDs: string[]; id?: string } = {
      title: 'Alpha',
      surveyID: '0xAlpha',
      questionIDs: ['0xQ1'],
    };
    const duplicateAlpha = { title: 'Duplicate Alpha', id: '0xalpha', questionIDs: ['0xQ2'] };
    const beta = { title: 'Beta', id: '0xBeta', questionIDs: ['0xQ3'] };

    const result = buildSurveyToolSurveyListFromBag({
      '0xalpha': alpha,
      '0xduplicate': duplicateAlpha,
      '0xbeta': beta,
    });

    expect(alpha.id).toBe('0xAlpha');
    expect(result).toEqual([alpha, beta]);
  });

  it('skips malformed cached surveys and empty question lists', () => {
    expect(buildSurveyToolSurveyListFromBag(null)).toEqual([]);
    expect(
      buildSurveyToolSurveyListFromBag({
        missingTitle: { questionIDs: ['0xQ1'] },
        missingQuestionIds: { title: 'No questions' },
        emptyQuestionIds: { title: 'Empty questions', questionIDs: [] },
        valid: { title: 'Valid', questionIDs: [''] },
      }),
    ).toEqual([{ title: 'Valid', questionIDs: [''], id: 'valid' }]);
  });

  it('builds survey result URL paths with normalized ids and explicit session hints', () => {
    window.history.pushState({}, '', '/questions');

    expect(
      buildSurveyToolFilterStateUrlPath(
        {
          surveyId: ' 0xABC ',
          sessionSlug: ' Demo Session ',
        },
        {},
      ),
    ).toBe('/survey/0xabc/results?session=Demo%20Session');
  });

  it('builds question result URL paths with serialized filters and route session hints', () => {
    window.history.pushState({}, '', '/session/edge/questions');

    const path = buildSurveyToolFilterStateUrlPath({}, { questionTypes: ['freeform'] });

    expect(path).toMatch(/^\/questions\/results\?filter=/);
    expect(path).toContain('&session=edge');
  });
});
