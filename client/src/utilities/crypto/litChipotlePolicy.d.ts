export const CHIPOTLE_WRAPPED_KEY_VERSION: 2;
export const CHIPOTLE_POLICY_VERSION: 'chipotle-sbt-v2';

export type ChipotleGateMode = 'any' | 'all';
type UnknownRecord = Record<string, unknown>;

export interface LitChipotlePolicy extends UnknownRecord {
  version: typeof CHIPOTLE_POLICY_VERSION;
  chainId: number;
  gateMode: ChipotleGateMode;
  sbtAddresses: string[];
  litActionCid: string;
  litPkpId: string;
}

export interface LitChipotleWrappedPlaintext {
  v: typeof CHIPOTLE_WRAPPED_KEY_VERSION;
  cekHex: string;
  policyFingerprint: string;
  policy: LitChipotlePolicy;
}

export interface BuildLitChipotlePolicyOptions extends UnknownRecord {
  chainId?: unknown;
  gateMode?: unknown;
  sbtAddresses?: unknown;
  litActionCid?: unknown;
  litPkpId?: unknown;
}

export interface BuildLitChipotleWrappedPlaintextOptions {
  cekHex?: unknown;
  policy?: BuildLitChipotlePolicyOptions;
}

export function normalizeChipotleGateMode(value: unknown): ChipotleGateMode;
export function normalizeChipotleChainId(value: unknown): number;
export function normalizeChipotleSbtAddresses(values?: unknown): string[];
export function stableChipotleStringify(value: unknown): string;
export function buildLitChipotlePolicy(options?: BuildLitChipotlePolicyOptions): LitChipotlePolicy;
export function fingerprintLitChipotlePolicy(options?: BuildLitChipotlePolicyOptions): string;
export function normalizeChipotleCekHex(value: unknown): string;
export function buildLitChipotleWrappedPlaintext(
  options?: BuildLitChipotleWrappedPlaintextOptions,
): LitChipotleWrappedPlaintext;
export function parseLitChipotleWrappedPlaintext(value: unknown): LitChipotleWrappedPlaintext;
export function normalizeLitChipotleMetadataVersion(chipotle?: unknown): number;
