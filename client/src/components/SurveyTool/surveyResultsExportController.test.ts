import {
  runSurveyResultsExportController,
  type SurveyResultsExportContentGenerators,
} from './surveyResultsExportController';

const createGenerators = (
  overrides: Partial<SurveyResultsExportContentGenerators> = {}
): SurveyResultsExportContentGenerators => ({
  'questions-csv': jest.fn(() => '"questionID","prompt","type","tags","options"\n"q1","Prompt","binary","",""'),
  'questions-json': jest.fn(() => '{"questions":true}'),
  'questions-responses-csv': jest.fn(() => '"questionID","prompt"\n"q1","Prompt"'),
  'questions-responses-json': jest.fn(() => '{"responses":true}'),
  ...overrides,
});

describe('surveyResultsExportController', () => {
  it('does not call the download port for invalid export types', () => {
    const downloadFile = jest.fn();
    const onAlertMessage = jest.fn();
    const generators = createGenerators();

    const result = runSurveyResultsExportController({
      baseFileName: 'contextEngine_questionResults',
      downloadFile,
      exportType: 'legacy-export',
      generators,
      onAlertMessage,
      timestamp: '2026_05_28T10_00_00_000Z',
    });

    expect(result).toMatchObject({
      alertMessage: 'Invalid export type selected.',
      status: 'invalid',
    });
    expect(onAlertMessage).toHaveBeenCalledWith('Invalid export type selected.');
    expect(downloadFile).not.toHaveBeenCalled();
    expect(generators['questions-responses-json']).not.toHaveBeenCalled();
  });

  it('does not call the download port for empty planned exports', () => {
    const downloadFile = jest.fn();
    const onAlertMessage = jest.fn();
    const generators = createGenerators({
      'questions-csv': jest.fn(() => '"questionID","prompt","type","tags","options"'),
    });

    const result = runSurveyResultsExportController({
      baseFileName: 'contextEngine_filteredQuestions',
      downloadFile,
      exportType: 'csv-questions',
      generators,
      onAlertMessage,
      timestamp: '2026_05_28T10_00_00_000Z',
    });

    expect(result).toMatchObject({
      alertMessage: 'No data available to download for this export type.',
      status: 'empty',
    });
    expect(onAlertMessage).toHaveBeenCalledWith('No data available to download for this export type.');
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it('preserves an existing alert instead of replacing it for empty planned exports', () => {
    const downloadFile = jest.fn();
    const onAlertMessage = jest.fn();
    const generators = createGenerators({
      'questions-json': jest.fn(() => '   '),
    });

    const result = runSurveyResultsExportController({
      baseFileName: 'contextEngine_filteredQuestions',
      downloadFile,
      exportType: 'json-questions',
      generators,
      getCurrentAlertMessage: () => 'No filtered questions to export.',
      onAlertMessage,
      timestamp: '2026_05_28T10_00_00_000Z',
    });

    expect(result).toMatchObject({
      alertMessage: 'No data available to download for this export type.',
      status: 'empty',
    });
    expect(onAlertMessage).not.toHaveBeenCalled();
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it('calls the download port once with unchanged filename, MIME type, and content', () => {
    const downloadFile = jest.fn();
    const generators = createGenerators({
      'questions-responses-json': jest.fn(() => '{"ok":true}'),
    });

    const result = runSurveyResultsExportController({
      baseFileName: 'contextEngine_questionResults',
      downloadFile,
      exportType: 'json-questions-and-responses',
      generators,
      timestamp: '2026_05_28T10_00_00_000Z',
    });

    expect(result).toMatchObject({
      alertMessage: '',
      status: 'download',
    });
    expect(downloadFile).toHaveBeenCalledTimes(1);
    expect(downloadFile).toHaveBeenCalledWith({
      fileContent: '{"ok":true}',
      filename: 'contextEngine_questionResults_2026_05_28T10_00_00_000Z.json',
      mimeType: 'application/json;charset=utf-8;',
    });
  });

  it('runs generation before the injected download port', () => {
    const calls: string[] = [];
    const downloadFile = jest.fn(() => {
      calls.push('download');
    });
    const generators = createGenerators({
      'questions-csv': jest.fn(() => {
        calls.push('generate');
        return '"questionID","prompt","type","tags","options"\n"q1","Prompt","binary","",""';
      }),
    });

    runSurveyResultsExportController({
      baseFileName: 'contextEngine_filteredQuestions',
      downloadFile,
      exportType: 'csv-questions',
      generators,
      timestamp: '2026_05_28T10_00_00_000Z',
    });

    expect(calls).toEqual(['generate', 'download']);
  });

  it('propagates generator errors without calling the download port', () => {
    const downloadFile = jest.fn();
    const error = new Error('generation failed');
    const generators = createGenerators({
      'questions-responses-csv': jest.fn(() => {
        throw error;
      }),
    });

    expect(() => runSurveyResultsExportController({
      baseFileName: 'contextEngine_questionResults',
      downloadFile,
      exportType: 'csv-questions-and-responses',
      generators,
      timestamp: '2026_05_28T10_00_00_000Z',
    })).toThrow(error);
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it('propagates download port errors after generation succeeds', () => {
    const error = new Error('download failed');
    const downloadFile = jest.fn(() => {
      throw error;
    });
    const generators = createGenerators();

    expect(() => runSurveyResultsExportController({
      baseFileName: 'contextEngine_questionResults',
      downloadFile,
      exportType: 'json-questions-and-responses',
      generators,
      timestamp: '2026_05_28T10_00_00_000Z',
    })).toThrow(error);
    expect(generators['questions-responses-json']).toHaveBeenCalledTimes(1);
  });
});
