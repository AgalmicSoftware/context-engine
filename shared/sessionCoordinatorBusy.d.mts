export declare const SESSION_COORDINATOR_UNAVAILABLE: string;
export declare const COORDINATOR_RETRY_DELAYS_MS: readonly number[];
export declare const coordinatorBusyBody: <T extends object>(extra?: T) => T & { error: string; retryable: true };
export declare const isRetryableBusy: (status: number, body: unknown) => boolean;
export declare const coordinatorRetryDelayMs: (attempt: number, random?: () => number) => number | null;
