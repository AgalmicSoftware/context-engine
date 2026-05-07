import { error, info } from './lib/log.mjs';
import {
  formatAlreadyRunningMessage,
  formatPortInUseMessage,
  probeContextEngineServer,
  resolveHost,
  resolvePort,
} from './lib/startup.mjs';

function isMainModule() {
  return import.meta.url === new URL(process.argv[1], 'file://').href;
}

function waitForServerStart(server) {
  return new Promise((resolve, reject) => {
    function cleanup() {
      server.off('listening', onListening);
      server.off('error', onError);
    }

    function onListening() {
      cleanup();
      resolve(server);
    }

    function onError(err) {
      cleanup();
      reject(err);
    }

    server.once('listening', onListening);
    server.once('error', onError);
  });
}

export async function bootServer({ host, port }) {
  const { startContextEngineServer } = await import('./server.mjs');
  const server = startContextEngineServer({ host, port });
  await waitForServerStart(server);
  return server;
}

export async function runStartCommand({
  host = resolveHost(),
  port = resolvePort(),
  probe = probeContextEngineServer,
  startServer = bootServer,
  logInfo = info,
} = {}) {
  if (await probe({ host, port })) {
    logInfo(formatAlreadyRunningMessage({ port }));
    return { status: 'already-running', host, port };
  }

  try {
    await startServer({ host, port });
    return { status: 'started', host, port };
  } catch (err) {
    if (err?.code === 'EADDRINUSE' && await probe({ host, port })) {
      logInfo(formatAlreadyRunningMessage({ port }));
      return { status: 'already-running', host, port };
    }
    throw err;
  }
}

export async function main() {
  const host = resolveHost();
  const port = resolvePort();

  try {
    await runStartCommand({ host, port });
  } catch (err) {
    if (err?.code === 'EADDRINUSE') {
      error(formatPortInUseMessage({ port }));
      process.exitCode = 1;
      return;
    }
    error(err?.stack || err?.message || String(err));
    process.exitCode = 1;
  }
}

if (isMainModule()) {
  await main();
}
