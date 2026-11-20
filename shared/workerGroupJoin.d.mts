export type WorkerGroupJoinMode = 'open' | 'one_use' | 'group_password' | 'admin_add';
export type WorkerGroupInviteToken =
  { kind: 'password'; password: string } | { kind: 'one_use'; secret: string } | { kind: 'invite' };

export const WORKER_GROUP_JOIN_MODES: readonly WorkerGroupJoinMode[];
export const WORKER_GROUP_JOIN_REFUSED: 'worker_group_join_refused';
export const WORKER_GROUP_MEMBER_CEILING_DEFAULT: number;
export const WORKER_GROUP_MEMBER_CEILING_MAX: number;
export const WORKER_GROUP_INVITE_BATCH_MAX: number;
export const WORKER_GROUP_PASSWORD_MIN_LENGTH: number;
export const WORKER_GROUP_INVITE_FRAGMENT_KEY: 'groupInvite';
export const WORKER_GROUP_MEMBER_CEILING_FIELD: 'groupMemberCeiling';
export function isWorkerGroupMemberCeiling(value: unknown): value is number;
export function readWorkerGroupMemberCeiling(config: unknown): number;
export function workerOffersGroupJoinChoices(config: unknown): boolean;

export function isWorkerGroupPasswordLongEnough(password: unknown): boolean;
export function parseGroupInviteToken(text: unknown): WorkerGroupInviteToken | null;
export function workerGroupPasswordProblem(password: unknown): string;
export function formatGroupInviteToken(token: {
  kind: 'password' | 'one_use';
  password?: string;
  secret?: string;
}): string;
export function generateOneUseSecret(): string;
export function hashOneUseSecret(secret: string): Promise<string>;
export function isOneUseSecretHash(value: unknown): boolean;
export function workerGroupJoinStatement(input: { sessionId: string; groupId: string; address: string }): string;
export const WORKER_GROUP_READ_INVITE_HEADER: 'X-CE-Group-Invite';
export const PRIVATE_SESSION_INVITE_REQUIRED: 'private_session_invite_required';
export const PRIVATE_SESSION_INVITE_INVALID: 'private_session_invite_invalid';
export const PRIVATE_SESSION_UNAVAILABLE: 'private_session_unavailable';
export function workerGroupReadStatement(input: { sessionId: string; groupId: string }): string;
export const WORKER_GROUP_READ_PROOF_V2_FEATURE: 'group_read_proof_v2';
export function workerGroupReadOrigin(value: unknown): string;
export function workerGroupReadStatementV2(input: { sessionId: string; groupId: string; workerOrigin: string }): string;
export function formatWorkerGroupReadInvite(input: { groupId: string; proof: string; version?: 1 | 2 }): string;
export const WORKER_GROUP_READ_CODE_FEATURE: 'group_read_code_v1';
export const WORKER_GROUP_READ_CODE_MAX_AGE_SECONDS: number;
export function workerGroupReadCodeStatement(input: { sessionId: string; groupId: string; workerOrigin: string; expires: number }): string;
export function workerGroupReadCodeMac(input: { codeHash: string; statement: string }): Promise<string>;
export function buildWorkerGroupReadCodeInvite(input: {
  codeHash: string;
  sessionId: string;
  groupId: string;
  workerOrigin: string;
  expires: number;
}): Promise<string>;
export function parseWorkerGroupReadInvite(
  value: unknown,
):
  | { groupId: string; proof: string; version: 1 | 2 }
  | { groupId: string; version: 'code'; hashPrefix: string; expires: number; mac: string }
  | null;

type PasswordInput = { password: string; sessionId: string; groupId: string };
export function createWorkerGroupPasswordKeys(ethers: unknown): Readonly<{
  deriveWallet(input: PasswordInput): Promise<{
    address: string;
    signMessage(message: string): Promise<string>;
  }>;
  signerOf(input: PasswordInput): Promise<string>;
  signJoin(input: PasswordInput & { address: string }): Promise<string>;
  signRead(input: PasswordInput): Promise<string>;
  signReadFor(input: PasswordInput & { workerOrigin: string }): Promise<string>;
  recoverJoinSigner(input: { sessionId: string; groupId: string; address: string; proof: string }): string;
}>;
