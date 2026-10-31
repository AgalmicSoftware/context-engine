import { buildSignedAdminActionAuth } from '../../../utilities/worker/workerAuth';
import { postSignedAdminWorkerRequest } from '../../../utilities/worker/signedAdminWorkerRequest';

type SaveSessionSettingsInput = {
  workerOrigin: string;
  sessionSlug: string;
  /** The Worker-canonical session ID the admin signature is bound to. */
  sessionIdHex: string;
  /** Only changed fields set-config accepts (buildSessionSettingsSave's patch). */
  patch: Record<string, unknown>;
  account: string;
  provider?: unknown;
  chainId: number;
  fetchImpl?: typeof fetch;
};

// One signed POST /admin/set-config, retried only for the Worker's nonce races
// (postSignedAdminWorkerRequest). The patch merges into the stored config.
export const saveSessionSettings = ({
  workerOrigin,
  sessionSlug,
  sessionIdHex,
  patch,
  account,
  provider,
  chainId,
  fetchImpl,
}: SaveSessionSettingsInput) =>
  postSignedAdminWorkerRequest({
    action: 'set-config',
    path: '/admin/set-config',
    workerUrl: workerOrigin,
    body: { sessionSlug, config: patch },
    ...(fetchImpl ? { fetchImpl } : {}),
    signAdminAction: ({ action, body, workerUrl }) =>
      buildSignedAdminActionAuth({
        action,
        slug: sessionSlug,
        sessionId: sessionIdHex || undefined,
        sessionAuthorityMode: 'worker_canonical',
        body,
        workerUrl,
        context: { account, chainId, providerLike: typeof provider === 'string' ? provider : undefined },
      }),
  });
