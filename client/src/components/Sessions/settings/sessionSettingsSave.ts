import { adminSessionRegistryPorts } from '../../../domains/sessions/registry/sessionRegistryAdminPorts';
import { buildSignedAdminActionAuth } from '../../../utilities/worker/workerAuth';
import { postSignedAdminWorkerRequest } from '../../../utilities/worker/signedAdminWorkerRequest';
import { asRecord, text } from '../setup/setupSectionTypes';
import {
  buildOnChainSessionMetadata,
  buildRegistryWorkerSync,
  describeChain,
  readRegistryFacts,
} from './sessionSettingsChain';
import { readSigningWallet } from './sessionSettingsWallet';

type Config = Record<string, unknown>;

type SaveSessionSettingsInput = {
  workerOrigin: string;
  sessionSlug: string;
  /** The Worker-canonical session ID the admin signature is bound to ('' for an on-chain session). */
  sessionIdHex: string;
  /** Only changed fields set-config accepts (buildSessionSettingsSave's patch). */
  patch: Record<string, unknown>;
  account: string;
  provider?: unknown;
  chainId: number;
  /** The authority the signature names; an on-chain session's Worker checks the registry admin. */
  sessionAuthorityMode?: string;
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
  sessionAuthorityMode = 'worker_canonical',
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
        sessionAuthorityMode,
        body,
        workerUrl,
        context: { account, chainId, providerLike: typeof provider === 'string' ? provider : undefined },
      }),
  });

export const ON_CHAIN_SAVE_STEPS = Object.freeze(['wallet', 'upload', 'registry', 'cache', 'worker'] as const);
export type OnChainSaveStep = (typeof ON_CHAIN_SAVE_STEPS)[number];
export type OnChainSaveStepState = 'running' | 'done' | 'failed' | 'skipped';

type SaveOnChainInput = {
  /** The session's config as loaded from the registry, with its __registry record. */
  before: Config;
  /** buildSessionSettingsSave's result for an on-chain session. */
  after: Config;
  patch: Config;
  sessionSlug: string;
  account: string;
  provider?: unknown;
  /** The session's Worker, or '' when it has none. */
  workerOrigin: string;
  /** The session's authority mode, for the Worker signature. */
  authorityMode: string;
  onStep: (step: OnChainSaveStep, state: OnChainSaveStepState, detail?: string) => void;
};

export type OnChainSaveResult = {
  txHash: string;
  /** The config as the registry now serves it, also written to this browser's registry cache. */
  nextConfig: Config;
  /** '' when the Worker synced or the session has none. */
  workerError: string;
};

const messageOf = (error: unknown, fallback: string) => (error instanceof Error && error.message) || fallback;

// The /admin metadata save, restored: check the signing wallet, upload the
// new metadata, point the SessionRegistry at it from the admin's wallet
// (keeping the encrypted metadata URI), update this browser's registry cache,
// then sync the session's Worker. Cache and Worker failures are reported on
// their own: the on-chain update still stands.
export const saveOnChainSessionSettings = async ({
  before,
  after,
  patch,
  sessionSlug,
  account,
  provider,
  workerOrigin,
  authorityMode,
  onStep,
}: SaveOnChainInput): Promise<OnChainSaveResult> => {
  const facts = readRegistryFacts(before);
  // Built first, so a field that can't be saved stops the save before anything is sent.
  const metadata = buildOnChainSessionMetadata(after);
  const step = async <T>(name: OnChainSaveStep, run: () => Promise<T>): Promise<T> => {
    onStep(name, 'running');
    try {
      const result = await run();
      onStep(name, 'done');
      return result;
    } catch (error) {
      onStep(name, 'failed', messageOf(error, 'It failed.'));
      throw error;
    }
  };

  // Checked before the paid upload: the registry write refuses another
  // account or network, but only after the upload is spent.
  await step('wallet', async () => {
    const wallet = await readSigningWallet(provider);
    if (wallet.address.toLowerCase() !== facts.adminAddress.toLowerCase()) {
      throw new Error(
        wallet.address
          ? `The wallet is on ${wallet.address}. Switch it to the registry admin, ${facts.adminAddress}.`
          : `Connect the registry admin wallet, ${facts.adminAddress}.`,
      );
    }
    if (wallet.chainId !== facts.registryChainId) {
      throw new Error(
        `Switch the wallet to ${describeChain(facts.registryChainId)}; it is on ${describeChain(wallet.chainId)}.`,
      );
    }
  });
  const upload = await step('upload', async () => {
    const uploaded = await adminSessionRegistryPorts.writes.uploadSessionMetadata(metadata, {
      sessionConfig: before,
      sessionSlug,
      context: { account, providerLike: provider, chainId: facts.registryChainId },
      ...(workerOrigin ? { workerUrl: workerOrigin } : {}),
    });
    if (!text(uploaded?.metadataUri).trim()) throw new Error('The upload returned no metadata URI.');
    return uploaded;
  });
  const metadataURI = text(upload.metadataUri).trim();
  const tx = await step('registry', () =>
    adminSessionRegistryPorts.writes.updateSessionMetadataOnChain({
      providerLike: provider,
      chainId: facts.registryChainId,
      slug: sessionSlug,
      metadataURI,
      encryptedMetadataURI: facts.encryptedMetadataURI,
    }),
  );

  // The registry record now names the new document; keep it with the record,
  // so a later refresh of the cached entry doesn't bring back the old one.
  const nextConfig: Config = {
    ...after,
    __registry: {
      ...asRecord(before.__registry),
      metadataURI,
      encryptedMetadataURI: facts.encryptedMetadataURI,
      metadata,
      metadataLoadState: 'loaded',
      metadataDefaultedContractKeys: [],
    },
  };
  await step('cache', async () =>
    adminSessionRegistryPorts.reads.upsertSessionRegistryCache({ config: nextConfig }),
  ).catch(() => undefined);

  let workerError = '';
  if (!workerOrigin) {
    onStep('worker', 'skipped', 'This session has no Session Worker.');
  } else {
    await step('worker', () =>
      saveSessionSettings({
        workerOrigin,
        sessionSlug,
        sessionIdHex: '',
        sessionAuthorityMode: authorityMode,
        patch: buildRegistryWorkerSync({ nextConfig, patch, metadata, account }),
        account,
        provider,
        chainId: facts.chainId || facts.registryChainId || 1,
      }),
    ).catch((error) => {
      workerError = messageOf(error, 'The Session Worker sync failed.');
    });
  }
  return { txHash: text(tx?.txHash).trim(), nextConfig, workerError };
};
