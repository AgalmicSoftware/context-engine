import {
  runSurveyResultsBrowserDownload,
  runSurveyResultsExportController,
  type SurveyResultsExportContentGenerators,
} from './surveyResultsExportController';

const createGenerators = (
  overrides: Partial<SurveyResultsExportContentGenerators> = {},
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

    expect(() =>
      runSurveyResultsExportController({
        baseFileName: 'contextEngine_questionResults',
        downloadFile,
        exportType: 'csv-questions-and-responses',
        generators,
        timestamp: '2026_05_28T10_00_00_000Z',
      }),
    ).toThrow(error);
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it('propagates download port errors after generation succeeds', () => {
    const error = new Error('download failed');
    const downloadFile = jest.fn(() => {
      throw error;
    });
    const generators = createGenerators();

    expect(() =>
      runSurveyResultsExportController({
        baseFileName: 'contextEngine_questionResults',
        downloadFile,
        exportType: 'json-questions-and-responses',
        generators,
        timestamp: '2026_05_28T10_00_00_000Z',
      }),
    ).toThrow(error);
    expect(generators['questions-responses-json']).toHaveBeenCalledTimes(1);
  });

  it('creates a hidden browser download anchor with the planned Blob metadata', async () => {
    const urlConstructor = window.URL as typeof window.URL & {
      createObjectURL?: (blob: Blob) => string;
    };
    const originalCreateObjectURL = urlConstructor.createObjectURL;
    const createObjectURL = jest.fn(() => 'blob:survey-results-download');
    let clickedAnchor: HTMLAnchorElement | null = null;
    Object.defineProperty(urlConstructor, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    });
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function recordClickedAnchor(
      this: HTMLAnchorElement,
    ) {
      clickedAnchor = this;
    });

    try {
      runSurveyResultsBrowserDownload({
        fileContent: 'downloaded contents',
        filename: 'contextEngine_questionResults_2026_05_28.json',
        mimeType: 'application/json;charset=utf-8;',
      });

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const blob = createObjectURL.mock.calls[0][0];
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json;charset=utf-8;');
      await expect(
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error || new Error('Unable to read Blob'));
          reader.readAsText(blob);
        }),
      ).resolves.toBe('downloaded contents');
      expect(clickedAnchor).not.toBeNull();
      expect(clickedAnchor?.getAttribute('hidden')).toBe('');
      expect(clickedAnchor?.getAttribute('href')).toBe('blob:survey-results-download');
      expect(clickedAnchor?.getAttribute('download')).toBe('contextEngine_questionResults_2026_05_28.json');
      expect(document.body.contains(clickedAnchor)).toBe(false);
      expect(clickSpy).toHaveBeenCalledTimes(1);
    } finally {
      clickSpy.mockRestore();
      if (originalCreateObjectURL) {
        Object.defineProperty(urlConstructor, 'createObjectURL', {
          configurable: true,
          value: originalCreateObjectURL,
        });
      } else {
        delete urlConstructor.createObjectURL;
      }
    }
  });
});
