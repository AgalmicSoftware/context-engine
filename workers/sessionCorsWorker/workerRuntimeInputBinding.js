import {
  createWorkerLowLevelHelpersWithWorkerDeps as createWorkerLowLevelHelpersWithWorkerDepsBoundary,
} from './workerLowLevelHelperBinding.js';
import {
  createWorkerRouteRuntimeWithWorkerDeps as createWorkerRouteRuntimeWithWorkerDepsBoundary,
} from './workerRouteRuntimeBinding.js';
import {
  resolveWorkerLowLevelHelperInput as resolveWorkerLowLevelHelperInputBoundary,
} from './workerLowLevelHelperInputResolution.js';
import {
  resolveWorkerRouteRuntimeInput as resolveWorkerRouteRuntimeInputBoundary,
} from './workerRouteRuntimeInputResolution.js';

const ANONYMOUS_UNKNOWN_IDENTITY = 'anon:unknown';

export const createWorkerRuntimeInputWithWorkerDeps = ({
  deps,
  constants,
  defaults,
} = {}) => {
  const createWorkerLowLevelHelpersWithWorkerDeps = (
    deps?.createWorkerLowLevelHelpersWithWorkerDeps ||
    createWorkerLowLevelHelpersWithWorkerDepsBoundary
  );
  const createWorkerRouteRuntimeWithWorkerDeps = (
    deps?.createWorkerRouteRuntimeWithWorkerDeps ||
    createWorkerRouteRuntimeWithWorkerDepsBoundary
  );
  const resolveWorkerLowLevelHelperInput = (
    deps?.resolveWorkerLowLevelHelperInput ||
    resolveWorkerLowLevelHelperInputBoundary
  );
  const resolveWorkerRouteRuntimeInput = (
    deps?.resolveWorkerRouteRuntimeInput ||
    resolveWorkerRouteRuntimeInputBoundary
  );

  const workerLowLevelHelpers = createWorkerLowLevelHelpersWithWorkerDeps(
    resolveWorkerLowLevelHelperInput({ deps, constants, defaults })
  );

  const workerRouteRuntime = createWorkerRouteRuntimeWithWorkerDeps(
    resolveWorkerRouteRuntimeInput({
      deps,
      constants,
      defaults,
      workerLowLevelHelpers,
      anonymousUnknownIdentity: ANONYMOUS_UNKNOWN_IDENTITY,
    })
  );

  return {
    workerLowLevelHelpers,
    workerRouteRuntime,
    workerAuthGateUtils: workerRouteRuntime.workerAuthGateUtils,
    fetch: workerRouteRuntime.fetch,
  };
};
