import { toStr } from '../shared/primitives.js';

type UnknownRecord = Record<string, unknown>;

type WorkerAuthRemoteFailureKind = 'admin_nonce' | 'worker_nonce' | 'worker_login';

export const NONCE_MISMATCH_ERROR = 'nonce mismatch or expired';
export const ONCHAIN_GATE_UNAVAILABLE_ERROR = 'on-chain gate data unavailable';

class WorkerAuthRemoteError extends Error {
  reason: string;
  status: number;

  constructor(reason: string, message: string, status: number) {
    super(message);
    this.name = 'WorkerAuthRemoteError';
    this.reason = reason;
    this.status = status;
  }
}

export const getWorkerAuthRemoteErrorMessage = (error: unknown): string =>
  error instanceof WorkerAuthRemoteError ? error.message : '';

const normalizeWorkerAuthResponseStatus = (value: unknown): number => {
  const status = Number(value);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0;
};

export const createWorkerAuthRemoteError = ({
  kind,
  payload,
  status,
}: {
  kind: WorkerAuthRemoteFailureKind;
  payload: unknown;
  status: unknown;
}): WorkerAuthRemoteError => {
  const source = payload && typeof payload === 'object' ? (payload as UnknownRecord) : {};
  const remoteText = toStr(source.reason || source.error)
    .trim()
    .toLowerCase();
  const normalizedStatus = normalizeWorkerAuthResponseStatus(status);
  if (remoteText.includes(NONCE_MISMATCH_ERROR)) {
    return new WorkerAuthRemoteError(
      'worker_auth_nonce_mismatch',
      'Worker authentication failed: nonce mismatch or expired.',
      normalizedStatus,
    );
  }
  if (remoteText.includes(ONCHAIN_GATE_UNAVAILABLE_ERROR)) {
    return new WorkerAuthRemoteError(
      'worker_auth_gate_unavailable',
      'Worker authentication failed: on-chain gate data unavailable.',
      normalizedStatus,
    );
  }
  const label =
    kind === 'admin_nonce'
      ? 'Admin Worker nonce request'
      : kind === 'worker_nonce'
        ? 'Worker nonce request'
        : 'Worker login';
  return new WorkerAuthRemoteError(
    `worker_auth_${kind}_failed`,
    `${label} failed${normalizedStatus ? ` (${normalizedStatus})` : ''}.`,
    normalizedStatus,
  );
};
