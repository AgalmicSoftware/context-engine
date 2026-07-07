import {
  buildUserPageDeepScanReportSamples,
  buildUserPageDeepScanReportSignature,
  buildUserPageDeepScanReportStatePatch,
  buildUserPageDeepScanReportStatus,
  buildUserPageDeepScanReportTelemetryPayloads,
  buildUserPageDeepScanRequestStatePatch,
  shouldApplyUserPageDeepScanResponse,
} from './userPageHelpers';

describe('userPageDeepScanHelpers report helpers', () => {
  it('builds stable deep-scan report signatures for background event dedupe', () => {
    expect(
      buildUserPageDeepScanReportSignature({
        reportTargetLower: '0xabc',
        report: {
          hadRpcErrors: true,
          coverageReason: 'partial',
          coverageComplete: false,
          attemptedSlugs: ['alpha', 'beta'],
          scannedSlugs: ['alpha'],
          skippedSlugs: ['gamma'],
          failedSlugs: ['delta'],
          failedActivitySlugs: ['epsilon'],
        },
      }),
    ).toBe('0xabc|1|partial|0|alpha,beta|alpha|gamma|delta|epsilon');

    expect(
      buildUserPageDeepScanReportSignature({
        reportTargetLower: '0xabc',
        report: {
          attemptedSlugs: 'bad',
          scannedSlugs: ['alpha'],
        },
      }),
    ).toBe('0xabc|0||||alpha|||');
  });

  it('classifies deep-scan report uncertainty from coverage and failure evidence', () => {
    expect(
      buildUserPageDeepScanReportStatus({
        report: {
          hadRpcErrors: true,
          attemptedSlugs: ['alpha', 'beta'],
          scannedSlugs: [],
          failedActivitySlugs: ['alpha', 'beta'],
        },
      }),
    ).toMatchObject({
      attemptedSlugs: ['alpha', 'beta'],
      scannedSlugs: [],
      failedActivitySlugs: ['alpha', 'beta'],
      rawHadRpcErrors: true,
      totalActivityFailure: true,
      totalSbtFailure: false,
      totalSkippedScan: false,
      hasCoverageGap: false,
      hasUncertainUserData: true,
      hasUncertainSbtData: false,
    });

    expect(
      buildUserPageDeepScanReportStatus({
        report: {
          hadRpcErrors: true,
          coverageComplete: false,
          attemptedSlugs: ['alpha', 'beta'],
          scannedSlugs: ['alpha'],
          failedSlugs: ['beta'],
        },
      }),
    ).toMatchObject({
      totalActivityFailure: false,
      totalSbtFailure: false,
      totalSkippedScan: false,
      hasCoverageGap: true,
      hasUncertainUserData: true,
      hasUncertainSbtData: true,
    });

    expect(buildUserPageDeepScanReportStatus({ report: null })).toMatchObject({
      attemptedSlugs: [],
      rawHadRpcErrors: false,
      hasUncertainUserData: false,
      hasUncertainSbtData: false,
    });

    expect(buildUserPageDeepScanRequestStatePatch()).toEqual({
      isDeepScanning: true,
      hasUncertainUserData: false,
      hasUncertainSbtData: false,
      hasUncertainGateAccess: false,
    });
    expect(
      buildUserPageDeepScanReportStatePatch({
        hasUncertainUserData: 1,
        hasUncertainSbtData: '',
      }),
    ).toEqual({
      isDeepScanning: false,
      hasUncertainUserData: true,
      hasUncertainSbtData: false,
      hasUncertainGateAccess: false,
    });

    expect(
      shouldApplyUserPageDeepScanResponse({
        activeRequestSeq: 3,
        currentViewAddress: '0xABC',
        isMounted: true,
        requestSeq: 3,
        targetLower: '0xabc',
      }),
    ).toBe(true);
    expect(
      shouldApplyUserPageDeepScanResponse({
        activeRequestSeq: 4,
        currentViewAddress: '0xABC',
        isMounted: true,
        requestSeq: 3,
        targetLower: '0xabc',
      }),
    ).toBe(false);
    expect(
      shouldApplyUserPageDeepScanResponse({
        activeRequestSeq: 3,
        currentViewAddress: '0xABC',
        isMounted: false,
        requestSeq: 3,
        targetLower: '0xabc',
      }),
    ).toBe(false);
    expect(
      shouldApplyUserPageDeepScanResponse({
        activeRequestSeq: 3,
        currentViewAddress: '0xDEF',
        isMounted: true,
        requestSeq: 3,
        targetLower: '0xabc',
      }),
    ).toBe(false);
  });

  it('limits deep-scan report telemetry samples', () => {
    expect(
      buildUserPageDeepScanReportSamples({
        limit: 2,
        report: {
          sampleSbtAddresses: ['sbt-1', 'sbt-2', 'sbt-3'],
          sampleCreatedSurveyIds: ['survey-1', 'survey-2', 'survey-3'],
          sampleCreatedQuestionIds: ['question-1'],
          sampleSurveyResponseIds: 'bad',
          sampleQuestionResponseIds: ['response-1', 'response-2', 'response-3'],
        },
      }),
    ).toEqual({
      sampleSbtAddresses: ['sbt-1', 'sbt-2'],
      sampleCreatedSurveyIds: ['survey-1', 'survey-2'],
      sampleCreatedQuestionIds: ['question-1'],
      sampleSurveyResponseIds: [],
      sampleQuestionResponseIds: ['response-1', 'response-2'],
    });
    expect(buildUserPageDeepScanReportSamples({ report: null })).toEqual({
      sampleSbtAddresses: [],
      sampleCreatedSurveyIds: [],
      sampleCreatedQuestionIds: [],
      sampleSurveyResponseIds: [],
      sampleQuestionResponseIds: [],
    });
  });

  it('builds deep-scan report telemetry payloads from status and report samples', () => {
    const report = {
      anyNewData: true,
      attemptedSlugs: ['alpha', 'beta'],
      coverageComplete: false,
      coverageReason: 'partial-rpc',
      failedActivitySlugs: ['beta'],
      failedSlugs: ['beta'],
      hadRpcErrors: true,
      registryEntryCount: '7',
      sampleCreatedQuestionIds: ['q1'],
      sampleCreatedSurveyIds: ['s1'],
      sampleQuestionResponseIds: ['qr1', 'qr2'],
      sampleSbtAddresses: ['0xsbt1'],
      sampleSurveyResponseIds: ['sr1'],
      scannedSlugs: ['alpha'],
      skippedSlugs: ['gamma'],
      totalCreatedQuestionsFound: '4',
      totalCreatedSurveysFound: '3',
      totalQuestionResponsesFound: '6',
      totalSbtContractsFound: '2',
      totalSurveyResponsesFound: '5',
      usedAllSessions: true,
    };
    const status = buildUserPageDeepScanReportStatus({ report });
    expect(
      buildUserPageDeepScanReportTelemetryPayloads({
        report,
        status,
        viewAddress: '0x00000000000000000000000000000000000000AA',
      }),
    ).toEqual({
      coldDiagPayload: {
        viewAddress: '0x00000000000000000000000000000000000000aa',
        attemptedSlugs: ['alpha', 'beta'],
        scannedSlugs: ['alpha'],
        skippedSlugs: ['gamma'],
        failedSlugs: ['beta'],
        failedActivitySlugs: ['beta'],
        anyNewData: true,
        coverageComplete: false,
        coverageReason: 'partial-rpc',
        hasUncertainUserData: true,
        hasUncertainSbtData: true,
        totalActivityFailure: false,
        totalSbtFailure: false,
        totalSkippedScan: false,
        hasCoverageGap: true,
        totalSbtContractsFound: '2',
        totalCreatedSurveysFound: '3',
        totalCreatedQuestionsFound: '4',
        totalSurveyResponsesFound: '5',
        totalQuestionResponsesFound: '6',
      },
      telemetryPayload: {
        viewAddress: '0x00000000000000000000000000000000000000aa',
        hadRpcErrors: true,
        hasUncertainUserData: true,
        hasUncertainSbtData: true,
        totalActivityFailure: false,
        totalSbtFailure: false,
        totalSkippedScan: false,
        usedAllSessions: true,
        coverageComplete: false,
        coverageReason: 'partial-rpc',
        attemptedSlugs: ['alpha', 'beta'],
        scannedSlugs: ['alpha'],
        skippedSlugs: ['gamma'],
        failedSlugs: ['beta'],
        failedActivitySlugs: ['beta'],
        registryEntryCount: 7,
        anyNewData: true,
        totalSbtContractsFound: 2,
        totalCreatedSurveysFound: 3,
        totalCreatedQuestionsFound: 4,
        totalSurveyResponsesFound: 5,
        totalQuestionResponsesFound: 6,
        sampleSbtAddresses: ['0xsbt1'],
        sampleCreatedSurveyIds: ['s1'],
        sampleCreatedQuestionIds: ['q1'],
        sampleSurveyResponseIds: ['sr1'],
        sampleQuestionResponseIds: ['qr1', 'qr2'],
      },
    });
    expect(
      buildUserPageDeepScanReportTelemetryPayloads({
        report: { attemptedSlugs: 'bad' },
        viewAddress: '',
      }).telemetryPayload.coverageComplete,
    ).toBeNull();
  });
});
