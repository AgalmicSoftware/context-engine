import {
  emitProfileScanColdDiag,
  emitProfileScanTelemetry,
  isProfileScanColdDiagEnabled,
  isProfileScanTelemetryEnabled,
} from './profileScanTelemetry';

jest.mock('utilities/logging.js', () => ({
  __esModule: true,
  createLogger: jest.fn(() => ({
    warn: jest.fn(),
  })),
}), { virtual: true });

type TelemetryTestContext = {
  readBoolishRuntimeFlag: jest.Mock<boolean, [unknown, boolean?]>;
  _profileScanTelemetrySeq: number;
  isProfileScanTelemetryEnabled: jest.Mock<boolean, []>;
  isProfileScanColdDiagEnabled: jest.Mock<boolean, []>;
  emitProfileScanTelemetry: jest.Mock<unknown, [string, unknown?]>;
};

type DebugTelemetryGlobals = typeof globalThis & Record<string, unknown>;

const globals = globalThis as DebugTelemetryGlobals;

const createContext = (): TelemetryTestContext => {
  const context: TelemetryTestContext = {
    readBoolishRuntimeFlag: jest.fn((raw: unknown, fallback = false) => {
      if (raw == null) return fallback;
      const normalized = String(raw).trim().toLowerCase();
      return normalized === '1' || normalized === 'true' || normalized === 'yes';
    }),
    _profileScanTelemetrySeq: 0,
    isProfileScanTelemetryEnabled: jest.fn(),
    isProfileScanColdDiagEnabled: jest.fn(),
    emitProfileScanTelemetry: jest.fn(),
  };

  context.isProfileScanTelemetryEnabled.mockImplementation(() => (
    isProfileScanTelemetryEnabled.call(context)
  ));
  context.isProfileScanColdDiagEnabled.mockImplementation(() => (
    isProfileScanColdDiagEnabled.call(context)
  ));
  context.emitProfileScanTelemetry.mockImplementation((event: string, payload?: unknown) => (
    emitProfileScanTelemetry.call(context, event, payload)
  ));

  return context;
};

describe('profileScanTelemetry', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete globals.CE_PROFILE_SCAN_TELEMETRY;
    delete globals.CE_PROFILE_SCAN_COLD_DIAG;
    delete globals.__CE_PROFILE_SCAN_TELEMETRY__;
    window.history.replaceState({}, '', '/');
  });

  it('uses the runtime telemetry flag when present', () => {
    const context = createContext();
    globals.CE_PROFILE_SCAN_TELEMETRY = 'yes';

    expect(isProfileScanTelemetryEnabled.call(context)).toBe(true);
    expect(context.readBoolishRuntimeFlag).toHaveBeenCalledWith('yes', true);
  });

  it('enables profile scan telemetry on user routes by default', () => {
    const context = createContext();
    window.history.replaceState({}, '', '/u/0x1234567890abcdef1234567890abcdef12345678');

    expect(isProfileScanTelemetryEnabled.call(context)).toBe(true);
  });

  it('writes telemetry entries to the bounded global bucket', () => {
    const context = createContext();
    globals.CE_PROFILE_SCAN_TELEMETRY = true;
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    emitProfileScanTelemetry.call(context, 'scan-start', { slug: 'alpha' });

    expect(context._profileScanTelemetrySeq).toBe(1);
    expect(globals.__CE_PROFILE_SCAN_TELEMETRY__).toEqual([
      expect.objectContaining({
        seq: 1,
        source: 'MainSite',
        event: 'scan-start',
        slug: 'alpha',
      }),
    ]);
    expect(infoSpy).toHaveBeenCalledWith(
      '[CE_PROFILE_SCAN][MainSite] scan-start',
      expect.objectContaining({ event: 'scan-start' })
    );
  });

  it('emits cold diagnostics through profile scan telemetry when enabled', () => {
    const context = createContext();
    globals.CE_PROFILE_SCAN_COLD_DIAG = 'true';

    emitProfileScanColdDiag.call(context, 'RPC', { attempts: 2 });

    expect(context.emitProfileScanTelemetry).toHaveBeenCalledWith(
      'cold-diag:rpc',
      { attempts: 2 }
    );
  });
});
