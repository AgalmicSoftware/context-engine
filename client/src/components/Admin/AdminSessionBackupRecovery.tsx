import { adminWorkerPorts } from '../../domains/worker/adminWorkerPorts';
import { postSignedAdminWorkerRequest } from './adminPageSignedWorkerRequest';
import AdminSessionBackupPanel from './AdminSessionBackupPanel';

// An empty deployment has no canonical config to bootstrap AdminPage. Restore
// still uses the normal signed admin transport; the Worker checks its owner.
export default function AdminSessionBackupRecovery({
  workerUrl,
  sessionSlug,
  account,
  provider,
  chainId,
}: {
  workerUrl: string;
  sessionSlug: string;
  account?: string;
  provider?: unknown;
  chainId?: unknown;
}) {
  return (
    <AdminSessionBackupPanel
      workerUrl={workerUrl}
      sessionSlug={sessionSlug}
      account={account}
      canAdminWorker={false}
      postSignedRequest={(args) =>
        postSignedAdminWorkerRequest({
          ...args,
          workerUrl,
          signAdminAction: ({ action, body }) =>
            adminWorkerPorts.adminAuth.buildSignedAdminActionAuth({
              action,
              slug: sessionSlug,
              sessionAuthorityMode: 'worker_canonical',
              body,
              workerUrl,
              context: {
                account,
                chainId: Number(chainId) || 1,
                providerLike: typeof provider === 'string' ? provider : undefined,
              },
            }),
        })
      }
    />
  );
}
