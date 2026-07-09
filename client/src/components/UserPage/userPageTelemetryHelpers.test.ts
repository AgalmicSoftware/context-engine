import {
  buildUserPageDeriveTelemetrySnapshot,
  buildUserPageNoSbtVisibleTelemetryState,
  buildUserPageRefreshTelemetrySignature,
  buildUserPageRefreshTelemetrySnapshot,
  readBoolishUserPageTelemetryFlag,
} from './userPageTelemetryHelpers';

describe('userPageTelemetryHelpers', () => {
  it('reads boolish telemetry flags with fallback semantics', () => {
    expect(readBoolishUserPageTelemetryFlag(true, false)).toBe(true);
    expect(readBoolishUserPageTelemetryFlag(false, true)).toBe(false);
    expect(readBoolishUserPageTelemetryFlag(' YES ', false)).toBe(true);
    expect(readBoolishUserPageTelemetryFlag('on', false)).toBe(true);
    expect(readBoolishUserPageTelemetryFlag('0', true)).toBe(false);
    expect(readBoolishUserPageTelemetryFlag('off', true)).toBe(false);
    expect(readBoolishUserPageTelemetryFlag('', true)).toBe(true);
    expect(readBoolishUserPageTelemetryFlag('maybe', 0)).toBe(false);
    expect(readBoolishUserPageTelemetryFlag(null, 'fallback')).toBe(true);
  });

  it('builds derive telemetry snapshots without changing missing-section defaults', () => {
    expect(
      buildUserPageDeriveTelemetrySnapshot({
        aggregate: {
          combinedQuestions: { q1: {} },
          combinedQuestionResponses: { q1: {}, q2: {} },
          combinedSurveys: { s1: {}, s2: {} },
          combinedSurveyResponses: { s1: {} },
          sbtAggregate: { badge1: {}, badge2: {}, badge3: {} },
        },
        questionSection: {
          questionCreationInfo: [{ id: 'q1' }, { id: 'q2' }],
          questionResponseInfo: [{ id: 'q1' }],
        },
        sbtSection: { sbtList: [{}, {}] },
        surveySection: {
          surveyCreationInfo: [{ id: 's1' }],
          surveyResponseInfo: [{ id: 's1' }, { id: 's2' }],
        },
      }),
    ).toEqual({
      aggregateBuilt: true,
      combinedSurveys: 2,
      combinedQuestions: 1,
      combinedSurveyResponses: 1,
      combinedQuestionResponses: 2,
      sbtAggregateKeys: 3,
      surveySection: { responseCount: 2, createdCount: 1 },
      questionSection: { responseCount: 1, createdCount: 2 },
      sbtSection: { sbtCount: 2 },
    });
    expect(buildUserPageDeriveTelemetrySnapshot()).toEqual({
      aggregateBuilt: false,
      combinedSurveys: 0,
      combinedQuestions: 0,
      combinedSurveyResponses: 0,
      combinedQuestionResponses: 0,
      sbtAggregateKeys: 0,
      surveySection: null,
      questionSection: null,
      sbtSection: null,
    });
  });

  it('builds no-SBT visible telemetry only after SBT loading completes', () => {
    expect(
      buildUserPageNoSbtVisibleTelemetryState({
        isSBTReady: false,
        sbtList: [],
      }),
    ).toEqual({
      payload: null,
      shouldEmit: false,
      signature: '',
    });
    expect(
      buildUserPageNoSbtVisibleTelemetryState({
        isSBTReady: true,
        sbtList: [{ sbtAddress: '0x1' }],
      }).shouldEmit,
    ).toBe(false);

    expect(
      buildUserPageNoSbtVisibleTelemetryState({
        hasUncertainGateAccess: true,
        hasUncertainSbtData: true,
        hasUncertainUserData: true,
        isDeepScanning: false,
        isSBTReady: true,
        latestRefreshTelemetry: {
          aggregateSbtAddresses: 2,
          derivedSbtCount: null,
          heldAggregateSbtCount: 0,
        },
        loadingSBTs: false,
        networkID: 84532,
        sbtList: [],
        viewAddress: '0x00000000000000000000000000000000000000AA',
      }),
    ).toEqual({
      payload: {
        viewAddress: '0x00000000000000000000000000000000000000aa',
        networkID: '84532',
        loadingSBTs: false,
        isSBTReady: true,
        isDeepScanning: false,
        hasUncertainUserData: true,
        hasUncertainSbtData: true,
        hasUncertainGateAccess: true,
        sbtListCount: 0,
        refreshSnapshot: {
          aggregateSbtAddresses: 2,
          derivedSbtCount: null,
          heldAggregateSbtCount: 0,
        },
      },
      shouldEmit: true,
      signature: '0x00000000000000000000000000000000000000aa|84532|0|1|0|1|1|1|0|2|0|',
    });
  });

  it('builds refresh telemetry snapshots and signatures with stable samples', () => {
    const telemetryAddress = '0x00000000000000000000000000000000000000aa';
    const sourcePresence = {
      hasQuestionsCache: true,
      hasSbtCache: true,
      hasSurveysCache: false,
      hasUserCache: true,
    };
    const refreshTelemetry = buildUserPageRefreshTelemetrySnapshot({
      aggregate: {
        combinedQuestions: { q1: {} },
        combinedQuestionResponses: {
          Q1: { [telemetryAddress]: { answer: 'yes' } },
          q2: { [telemetryAddress]: { answer: 'no' } },
          q3: { '0xother': { answer: 'maybe' } },
        },
        combinedSurveys: { s1: {}, s2: {} },
        combinedSurveyResponses: {
          SurveyA: { [telemetryAddress]: { submittedAt: 1 } },
          surveyb: { '0xother': { submittedAt: 2 } },
        },
        sbtAggregate: {
          '0xsbt1': { burnedSet: new Set(), mintedSet: new Set([telemetryAddress]) },
          '0xsbt2': { burnedSet: new Set([telemetryAddress]), mintedSet: new Set([telemetryAddress]) },
          '0xsbt3': { burnedSet: new Set(), mintedSet: new Set() },
        },
      },
      bypassSignature: true,
      deepScanTooltipLines: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
      force: true,
      hasSbtSources: true,
      hasUncertainGateAccess: true,
      hasUncertainUserData: true,
      holdSbtLoading: false,
      isDeepScanning: true,
      networkID: 84532,
      sbtReady: true,
      sbtSection: { sbtList: [{}, {}] },
      sourcePresence,
      viewAddressLower: telemetryAddress,
    });

    expect(refreshTelemetry).toEqual({
      viewAddress: telemetryAddress,
      networkID: '84532',
      force: true,
      markLoading: false,
      bypassSignature: true,
      isDeepScanning: true,
      hasUncertainUserData: true,
      hasUncertainGateAccess: true,
      sbtReady: true,
      holdSbtLoading: false,
      hasSbtSources: true,
      aggregateSbtAddresses: 3,
      heldAggregateSbtCount: 1,
      heldAggregateSbtSample: ['0xsbt1'],
      aggregateSurveyCount: 2,
      aggregateQuestionCount: 1,
      aggregateSurveyResponseCount: 1,
      aggregateQuestionResponseCount: 2,
      aggregateSurveyResponseSample: ['SurveyA'],
      aggregateQuestionResponseSample: ['Q1', 'q2'],
      derivedSbtCount: 2,
      sourcePresence,
      deepScanTooltipLines: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'],
    });
    expect(buildUserPageRefreshTelemetrySignature(refreshTelemetry)).toBe(
      `${telemetryAddress}|84532|1|1|1|0|1|3|1|2|1|1|2|2|one|two|three|four|five|six|seven|eight`,
    );
  });
});
