import { isConfiguredAdmin } from '../../utilities/storage/storageClient';

type UnknownRecord = Record<string, unknown>;

const toRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};
const lower = (value: unknown): string => (typeof value === 'string' ? value.trim().toLowerCase() : '');

/**
 * Whether to offer this account the Results builds (AI Views, atlas, risk
 * matrix): admins, co-admins and results admins. On a hat session any signed-in
 * account is offered them and the Worker decides.
 */
export const mayStartResultsBuilds = (sessionConfig: unknown, account: unknown): boolean => {
  const config = toRecord(sessionConfig);
  const address = lower(account);
  if (!address) return false;
  const resultsAdmins = Array.isArray(config.resultsAdminAddresses) ? config.resultsAdminAddresses.map(lower) : [];
  return (
    isConfiguredAdmin(config, { account: address }) ||
    lower(toRecord(config.__registry).adminAddress) === address ||
    resultsAdmins.includes(address) ||
    (!!lower(config.adminHatId) && !!lower(config.hatsAddress))
  );
};
