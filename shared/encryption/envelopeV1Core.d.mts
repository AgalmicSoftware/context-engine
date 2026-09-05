export type EnvelopePoseidonHasher = (
  inputs: bigint[],
) => string | number | bigint | Promise<string | number | bigint>;

export type EnvelopeContextInput = {
  chainId?: unknown;
  account?: unknown;
  surveyId?: unknown;
  qId?: unknown;
  fieldKey?: unknown;
};

export function requireBigInt(): void;
export function hexToBytes(hex: string): Uint8Array;
export function bytesToHex(bytes: Uint8Array): string;
export function utf8e(value: unknown): Uint8Array;
export function utf8d(bytes: BufferSource): string;
export function safeLower(value: string): string;
export function safeLower<T>(value: T): T;
export function stableStringify(value: unknown): string;
export function getContextBytes(contextHex: string): Uint8Array;
export function importAesGcmKey(raw32: BufferSource): Promise<CryptoKey>;
export function aesGcmEncrypt(
  key: CryptoKey,
  plaintextBytes: BufferSource,
  options?: { aadBytes?: BufferSource },
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }>;
export function aesGcmDecrypt(
  key: CryptoKey,
  iv: BufferSource,
  ciphertextBytes: BufferSource,
  options?: { aadBytes?: BufferSource },
): Promise<Uint8Array>;
export function deriveKekFromSig(signatureHex: string, contextBytes: BufferSource): Promise<CryptoKey>;
export function buildEip712KeyWrap(
  account: string,
  chainId: unknown,
  contextHex: string,
  nonce?: string | number | bigint | null,
): {
  domain: Record<string, unknown>;
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: 'KeyDerivation';
  message: Record<string, unknown>;
};
export function computeContext(input: EnvelopeContextInput): string;
export function computeResponseFieldContext(input: EnvelopeContextInput): string;
export function buildResponseFieldAAD(
  input: EnvelopeContextInput & { contextHex: string },
): Record<string, unknown>;
export function hashIdentifier(identifier: unknown): string;
export function encodeValueBytes(
  kind: unknown,
  value: unknown,
  options?: { options?: unknown[] },
): Uint8Array;
export function toField(bytes: Uint8Array): bigint;
export function normalizePoseidonHashOutput(value: string | number | bigint): string;
export function buildCommitDomainBytes(input: EnvelopeContextInput): Uint8Array;
export function computeSaltedCommitments(input: EnvelopeContextInput & {
  kind: unknown;
  value: unknown;
  optionsForKind?: unknown[];
  hasher?: EnvelopePoseidonHasher | null;
}): Promise<{ salt: string; keccak256: string; poseidon: string | null }>;
export function buildEnvelopeObject(input: {
  iv: Uint8Array;
  ciphertextBytes: Uint8Array;
  aadObj: Record<string, unknown>;
  recipients: Array<Record<string, unknown>>;
  commitments: { keccak256: string; poseidon?: string | null };
  kind: unknown;
}): Record<string, unknown>;
export function wrapCekWithSelfRecipient(input: {
  signTypedData: (
    domain: Record<string, unknown>,
    types: Record<string, Array<{ name: string; type: string }>>,
    message: Record<string, unknown>,
  ) => Promise<string> | string;
  account?: string;
  chainId: unknown;
  contextHex: string;
  cekRaw: Uint8Array;
}): Promise<Record<string, unknown>>;
