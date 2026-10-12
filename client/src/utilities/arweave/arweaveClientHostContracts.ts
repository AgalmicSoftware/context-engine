type UnknownRecord = Record<string, unknown>;

export interface ArweaveUploadFallbackTelemetryPayload extends UnknownRecord {
  attemptIndex?: number;
  error?: string;
  gateStatus?: string;
  reason?: string;
  requestId?: string;
  responseStatus?: number | null;
  sessionSlug?: string;
  workerUrl?: string;
}

export interface ArweaveUploadFallbackTelemetryEntry extends ArweaveUploadFallbackTelemetryPayload {
  ts: string;
}

export const buildArweaveUploadFallbackTelemetryEntry = (
  payload: unknown = {},
  now: () => Date = () => new Date(),
): ArweaveUploadFallbackTelemetryEntry => ({
  ts: now().toISOString(),
  ...(payload && typeof payload === 'object' ? payload : { value: payload }),
});
