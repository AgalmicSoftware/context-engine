import { ethers } from 'ethers';
import {
  createWorkerTopLevelRuntimeWithWorkerDeps as createWorkerTopLevelRuntimeWithWorkerDepsBoundary,
} from './workerTopLevelBinding.js';

export { SessionWriteCoordinator, WorkerGroupWriteCoordinator } from './sessionWriteCoordinator.js';

let workerDebugLogsEnabled = false;

const isWorkerDebugLogsEnabled = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return false;

  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const initializeWorkerDebugLogs = (env) => {
  workerDebugLogsEnabled = isWorkerDebugLogsEnabled(env?.WORKER_DEBUG_LOGS);
};

const log = (...args) => {
  if (!workerDebugLogsEnabled) return;
  console.log(...args);
};

log.warn = (...args) => console.warn(...args);
log.error = (...args) => console.error(...args);

const workerDeps = {
  deps: {
    ethers,
    URL,
    Headers,
    log,
    fetch: (...args) => fetch(...args),
    rpcFetch: (...args) => globalThis.fetch(...args),
    now: Date.now,
  },
};

const createWorkerRuntime = (env) => createWorkerTopLevelRuntimeWithWorkerDepsBoundary({
  ...workerDeps,
  env,
});

const defaultWorkerRuntime = createWorkerRuntime();

export const workerAuthGateUtils = defaultWorkerRuntime.workerAuthGateUtils;

export default {
  fetch(request, env, ctx) {
    initializeWorkerDebugLogs(env);
    const workerRuntime = createWorkerRuntime(env);
    return workerRuntime.fetch(request, env, ctx);
  },
};
