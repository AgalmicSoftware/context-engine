import {
  createWorkerRuntimeInputWithWorkerDeps as createWorkerRuntimeInputWithWorkerDepsBoundary,
} from './workerRuntimeInputBinding.js';
import {
  resolveWorkerRuntimeDeps as resolveWorkerRuntimeDepsBoundary,
} from './workerRuntimeDepResolution.js';

export const createWorkerRuntimeDepsWithWorkerDeps = ({
  deps,
  constants,
  defaults,
} = {}) => {
  const createWorkerRuntimeInputWithWorkerDeps = (
    deps?.createWorkerRuntimeInputWithWorkerDeps ||
    createWorkerRuntimeInputWithWorkerDepsBoundary
  );
  const resolved = (
    deps?.resolveWorkerRuntimeDeps ||
    resolveWorkerRuntimeDepsBoundary
  )({
    deps,
    constants,
  }) || {};

  return createWorkerRuntimeInputWithWorkerDeps({
    deps: resolved.deps,
    constants: resolved.constants,
    defaults,
  });
};
