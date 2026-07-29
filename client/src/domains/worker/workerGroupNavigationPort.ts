import {
  buildWorkerGroupsPath,
  readWorkerGroupIdFromHash,
  readWorkerGroupIdFromPath,
} from '../../utilities/worker/workerGroupRoutes';

type WorkerGroupPathOptions = Parameters<typeof buildWorkerGroupsPath>[0];

export const workerGroupNavigationPort = Object.freeze({
  buildPath: (options: WorkerGroupPathOptions): string => buildWorkerGroupsPath(options),
  readGroupIdFromHash: (hash: unknown): string => readWorkerGroupIdFromHash(hash),
  readGroupIdFromPath: (path: unknown): string => readWorkerGroupIdFromPath(path),
});
