import {
  buildWorkerGroupsPath,
  readWorkerGroupIdFromHash,
  readWorkerGroupIdFromPath,
  readWorkerGroupSessionSlugFromSearch,
} from '../../utilities/worker/workerGroupRoutes';

type WorkerGroupPathOptions = Parameters<typeof buildWorkerGroupsPath>[0];

export const workerGroupNavigationPort = Object.freeze({
  readSessionSlugFromSearch: (search: unknown): string => readWorkerGroupSessionSlugFromSearch(search),
  buildPath: (options: WorkerGroupPathOptions): string => buildWorkerGroupsPath(options),
  readGroupIdFromHash: (hash: unknown): string => readWorkerGroupIdFromHash(hash),
  readGroupIdFromPath: (path: unknown): string => readWorkerGroupIdFromPath(path),
});
