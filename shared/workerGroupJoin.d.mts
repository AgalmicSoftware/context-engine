export type WorkerGroupJoinMode = 'open' | 'one_use' | 'group_password' | 'admin_add';
export type WorkerGroupInviteToken =
  { kind: 'password'; password: string } | { kind: 'one_use'; secret: string } | { kind: 'invite' };

export const WORKER_GROUP_JOIN_MODES: readonly WorkerGroupJoinMode[];
export const WORKER_GROUP_SECRET_MODES: readonly WorkerGroupJoinMode[];
export const WORKER_GROUP_JOIN_REFUSED: 'worker_group_join_refused';
export const WORKER_GROUP_MEMBER_CEILING_DEFAULT: number;
export const WORKER_GROUP_MEMBER_CEILING_MAX: number;
export const WORKER_GROUP_INVITE_BATCH_MAX: number;
export const WORKER_GROUP_PASSWORD_MIN_LENGTH: number;
export const WORKER_GROUP_INVITE_FRAGMENT_KEY: 'groupInvite';

export function isWorkerGroupPasswordLongEnough(password: unknown): boolean;
export function parseGroupInviteToken(text: unknown): WorkerGroupInviteToken | null;
export function formatGroupInviteToken(token: {
  kind: 'password' | 'one_use';
  password?: string;
  secret?: string;
}): string;
export function generateOneUseSecret(): string;
export function hashOneUseSecret(secret: string): Promise<string>;
export function isOneUseSecretHash(value: unknown): boolean;
export function inviteIdOfHash(hash: string): string;
export function workerGroupJoinStatement(input: { sessionId: string; groupId: string; address: string }): string;

type PasswordInput = { password: string; sessionId: string; groupId: string };
export function createWorkerGroupPasswordKeys(ethers: unknown): Readonly<{
  deriveWallet(input: PasswordInput): Promise<{
    address: string;
    signMessage(message: string): Promise<string>;
  }>;
  signerOf(input: PasswordInput): Promise<string>;
  signJoin(input: PasswordInput & { address: string }): Promise<string>;
  recoverJoinSigner(input: { sessionId: string; groupId: string; address: string; proof: string }): string;
}>;
