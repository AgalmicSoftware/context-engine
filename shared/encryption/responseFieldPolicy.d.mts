export type ResponseFieldPolicy = { enabled: boolean; self: boolean; admin: boolean; session: boolean; centralized: boolean; privateSession: boolean };
export function resolveResponseFieldPolicy(config: unknown, options?: { workerAvailable?: boolean }): ResponseFieldPolicy;
export function assertResponseFieldAudience(config: unknown, audience: string, options?: { workerAvailable?: boolean }): ResponseFieldPolicy;
