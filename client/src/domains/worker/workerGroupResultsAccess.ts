import { resolveWorkerGroupAutoJoinContext } from './workerGroupAutoJoinContext';
import { loadWorkerGroupMembers } from './workerGroupPorts';
import {
  GROUP_FILTER_ROLES,
  type WorkerGroupResultsSelection,
  type WorkerGroupCohort,
} from './workerGroupResultsFilter';
export const resolveWorkerGroupFilterScope = resolveWorkerGroupAutoJoinContext;

export const loadWorkerGroupCohort = async (
  selection: WorkerGroupResultsSelection,
  credentialToken: string,
): Promise<WorkerGroupCohort['members']> => {
  const ids = [...new Set(GROUP_FILTER_ROLES.flatMap((role) => selection[role].map((group) => group.groupId)))];
  const members: WorkerGroupCohort['members'] = {};
  // No partial directory is usable for exclusion: publish only after every page succeeds.
  for (const groupId of ids) {
    const addresses = new Set<string>();
    const seen = new Set<string>();
    const principals = new Set<string>();
    let expectedCount: number | undefined;
    let cursor = '';
    let complete = false;
    for (let pageIndex = 0; pageIndex < 100; pageIndex += 1) {
      const page = await loadWorkerGroupMembers({ ...selection, credentialToken, groupId, cursor, limit: 250 });
      if (expectedCount != null && expectedCount !== page.memberCount)
        throw new Error('Group membership changed while loading. Please retry.');
      expectedCount = page.memberCount;
      for (const member of page.members) {
        const principal = member.principal;
        if (!principal || (principal.kind !== 'evm_address' && principal.kind !== 'passkey_account')) {
          throw new Error('This Group contains identities that cannot yet be matched to report responses.');
        }
        principals.add(`${principal.kind}:${principal.address.toLowerCase()}`);
        addresses.add(principal.address.toLowerCase());
      }
      if (!page.nextCursor) {
        complete = true;
        break;
      }
      if (seen.has(page.nextCursor)) throw new Error('The Group member list is incomplete. Please retry.');
      seen.add(page.nextCursor);
      cursor = page.nextCursor;
    }
    if (!complete || principals.size !== expectedCount)
      throw new Error('The Group member list is incomplete. Please retry.');
    members[groupId] = addresses;
  }
  return members;
};
