import { ethers } from 'ethers';
import { describeTestEthOffer } from '@ce-shared/sessions/testEthOffer.mjs';
import type { UnknownRecord } from '../../utilities/session/sessionTypes';

const record = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};
const participantScopes = (config: UnknownRecord): string[] => {
  const scopes = record(config.workerAuthority).participantScopes;
  return Array.isArray(scopes) ? scopes.filter((value): value is string => typeof value === 'string') : [];
};

export const describeHostedFaucetSetup = (value: unknown) => {
  const config = record(value);
  const profile = record(config.sessionModeProfile);
  const hosted = record(profile.authority).mode === 'worker_canonical';
  const chainId = Number(config.networkChainId || record(profile.evm).registryChainId || 0);
  const documents = [
    record(profile.encryption).accessConditions,
    record(record(profile.storage).payloadAccessControl).accessConditions,
  ];
  const conditions = documents.flatMap((document) => {
    const entries = record(document).conditions;
    return Array.isArray(entries) ? entries.filter((condition) => record(condition).kind === 'sbt_onchain') : [];
  });
  const { network } = describeTestEthOffer({ config: { ...config, networkChainId: chainId } });
  const visible = hosted && conditions.length > 0;
  const eligible =
    visible && !!network && conditions.every((condition) => Number(record(condition).chainId) === chainId);
  return {
    visible,
    eligible,
    enabled: eligible && participantScopes(config).some((scope) => scope === 'faucet_self' || scope === 'faucet'),
    chainId,
    network,
    reason: !network
      ? 'Choose OP Sepolia or Base Sepolia to offer test ETH.'
      : 'Every on-chain SBT rule must use the session network to offer test ETH.',
  };
};

export const setHostedFaucetEnabled = <Draft extends UnknownRecord>(draft: Draft, enabled: boolean) => {
  const authority = record(draft.workerAuthority);
  const currentScopes = Array.isArray(authority.participantScopes)
    ? participantScopes(draft)
    : ['ai', 'transcribe', 'storage', 'groups', 'fetch'];
  // Older Workers ignore this grant instead of issuing their unrestricted faucet scope.
  const scopes = currentScopes.filter((scope) => scope !== 'faucet' && scope !== 'faucet_self');
  if (enabled && describeHostedFaucetSetup(draft).eligible) scopes.push('faucet_self');
  return {
    ...draft,
    workerAuthority: { version: 1, anonymousScopes: [], ...authority, participantScopes: scopes },
  };
};

export const normalizeHostedFaucetSelection = <Draft extends UnknownRecord>(
  draft: Draft,
  previous?: unknown,
): Draft => {
  if (!participantScopes(draft).some((scope) => scope === 'faucet_self' || scope === 'faucet')) return draft;
  const setup = describeHostedFaucetSetup(draft);
  const oldSetup = previous ? describeHostedFaucetSetup(previous) : null;
  if (!setup.eligible || (oldSetup?.enabled && oldSetup.chainId !== setup.chainId)) {
    return setHostedFaucetEnabled(draft, false);
  }
  // The wizard effect uses identity to detect changes. Migrate the legacy grant once;
  // cloning an already-normalized draft would trigger an endless render/update loop.
  return participantScopes(draft).includes('faucet') ? setHostedFaucetEnabled(draft, true) : draft;
};

export const faucetAddressFromKey = (value: unknown): string | null => {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!/^0x[0-9a-f]{64}$/i.test(key)) return null;
  try {
    const scalar = ethers.BigNumber.from(key);
    const curveOrder = '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141';
    if (scalar.isZero() || scalar.gte(curveOrder)) return null;
    return ethers.utils.computeAddress(key);
  } catch {
    return null;
  }
};
