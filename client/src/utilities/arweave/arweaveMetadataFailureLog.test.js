const loadSubject = () => {
  jest.resetModules();

  const mockWarn = jest.fn();
  const mockDebug = jest.fn();
  const mockError = jest.fn();
  const normalizeArweaveFailureMeta = jest.fn();
  const isTerminalArweaveFailureState = jest.fn();

  jest.doMock('../logging.js', () => ({
    __esModule: true,
    createLogger: () => ({
      log: jest.fn(),
      info: jest.fn(),
      warn: mockWarn,
      error: mockError,
      debug: mockDebug,
      isEnabled: jest.fn(() => false),
    }),
  }));

  jest.doMock('./arweaveFailureClassifiers.js', () => ({
    __esModule: true,
    normalizeArweaveFailureMeta,
    isTerminalArweaveFailureState,
  }));

  const subject = require('./arweaveMetadataFailureLog.js');

  return {
    ...subject,
    mockWarn,
    mockDebug,
    mockError,
    normalizeArweaveFailureMeta,
    isTerminalArweaveFailureState,
  };
};

describe('arweaveMetadataFailureLog', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('detects nested call-exception errors across chained payloads', () => {
    const { isCallExceptionError } = loadSubject();

    expect(
      isCallExceptionError({
        cause: {
          errors: [
            {
              error: {
                code: 'CALL_EXCEPTION',
                message: 'execution reverted: denied',
              },
            },
          ],
        },
      }),
    ).toBe(true);

    expect(
      isCallExceptionError({
        results: [
          {
            requestBody: '{"error":"execution reverted"}',
          },
        ],
      }),
    ).toBe(true);

    expect(
      isCallExceptionError({
        cause: { errors: [{ message: 'ordinary network timeout' }] },
      }),
    ).toBe(false);
  });

  it('dedupes repeated question call-exception warnings within the TTL and re-emits after expiry', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(10_000).mockReturnValueOnce(41_500);

    const {
      logArweaveMetadataFetchFailure,
      mockWarn,
      mockDebug,
      mockError,
      normalizeArweaveFailureMeta,
      isTerminalArweaveFailureState,
    } = loadSubject();

    normalizeArweaveFailureMeta.mockReturnValue({
      txId: 'tx-call-exception',
      state: 'transient',
      kind: 'fetch',
      status: 500,
      nextRetryAtMs: 0,
      message: 'lookup reverted',
    });
    isTerminalArweaveFailureState.mockReturnValue(false);

    const error = {
      error: {
        code: 'CALL_EXCEPTION',
        message: 'execution reverted: denied',
      },
    };

    logArweaveMetadataFetchFailure({ scope: 'question', error });
    logArweaveMetadataFetchFailure({ scope: 'question', error });
    logArweaveMetadataFetchFailure({ scope: 'question', error });

    const payload = {
      scope: 'question',
      code: 'CALL_EXCEPTION',
      message: 'execution reverted: denied',
    };

    expect(mockWarn).toHaveBeenNthCalledWith(1, '[arweave-cache] question metadata hash lookup reverted', payload);
    expect(mockDebug).toHaveBeenCalledWith('[arweave-cache] question metadata hash lookup reverted (deduped)', payload);
    expect(mockWarn).toHaveBeenNthCalledWith(2, '[arweave-cache] question metadata hash lookup reverted', payload);
    expect(mockWarn).toHaveBeenCalledTimes(2);
    expect(mockDebug).toHaveBeenCalledTimes(1);
    expect(mockError).not.toHaveBeenCalled();
  });

  it('logs scope-specific terminal failures without entering cooldown handling', () => {
    const {
      logArweaveMetadataFetchFailure,
      mockWarn,
      mockDebug,
      mockError,
      normalizeArweaveFailureMeta,
      isTerminalArweaveFailureState,
    } = loadSubject();

    normalizeArweaveFailureMeta.mockReturnValue({
      txId: 'tx-terminal',
      state: 'terminal_invalid',
      kind: 'invalid',
      status: 422,
      nextRetryAtMs: 0,
      message: 'bad payload',
    });
    isTerminalArweaveFailureState.mockReturnValue(true);

    logArweaveMetadataFetchFailure({
      scope: 'response',
      error: { message: 'fallback message' },
    });

    expect(mockWarn).toHaveBeenCalledWith('Response payload unavailable (terminal):', 'bad payload');
    expect(mockDebug).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });

  it('dedupes cooldown logging per scope and preserves the structured payload', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000);

    const {
      logArweaveMetadataFetchFailure,
      mockWarn,
      mockDebug,
      mockError,
      normalizeArweaveFailureMeta,
      isTerminalArweaveFailureState,
    } = loadSubject();

    normalizeArweaveFailureMeta.mockReturnValue({
      txId: 'tx-cooldown',
      state: 'transient',
      kind: 'cooldown',
      status: 429,
      nextRetryAtMs: 50_000,
      message: 'retry later',
    });
    isTerminalArweaveFailureState.mockReturnValue(false);

    const error = new Error('rate limited');
    logArweaveMetadataFetchFailure({ scope: 'survey', error });
    logArweaveMetadataFetchFailure({ scope: 'survey', error });

    const payload = {
      txId: 'tx-cooldown',
      state: 'transient',
      kind: 'cooldown',
      status: 429,
      nextRetryAtMs: 50_000,
    };

    expect(mockWarn).toHaveBeenCalledWith('[arweave-cache] survey metadata fetch cooldown', payload);
    expect(mockDebug).toHaveBeenCalledWith('[arweave-cache] survey metadata fetch cooldown (deduped)', payload);
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockDebug).toHaveBeenCalledTimes(1);
    expect(mockError).not.toHaveBeenCalled();
  });
});
