#!/usr/bin/env node
// Context Engine MCP server for an agent participating as itself.
// stdout carries MCP protocol messages only; diagnostics go to stderr.
import { readFile } from 'node:fs/promises';
import { readConfig } from '../lib/config.mjs';
import { loadOrCreateWallet } from '../lib/agentState.mjs';
import { createMcpServer, serveStdio } from '../lib/mcpServer.mjs';
import { createParticipant } from '../lib/participant.mjs';
import { createSbtClaimer } from '../lib/sbtClaims.mjs';
import { SERVER_INSTRUCTIONS, buildTools } from '../lib/tools.mjs';

const log = (message) => process.stderr.write(`context-engine-mcp: ${message}\n`);

// stdout carries protocol messages only; libraries that print (ethers warns
// through console.log) must not corrupt it.
console.log = console.info = console.debug = console.warn = (...args) => console.error(...args);

const main = async () => {
  const config = readConfig(process.env);
  const { wallet, created } = await loadOrCreateWallet(config.stateDir);
  log(`${created ? 'created' : 'loaded'} agent address ${wallet.address} (state: ${config.stateDir})`);
  const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const participant = createParticipant({ config, wallet, sbt: createSbtClaimer({ config, wallet }) });
  const server = createMcpServer({
    serverInfo: { name: 'context-engine', title: 'Context Engine', version },
    instructions: SERVER_INSTRUCTIONS,
    tools: buildTools(participant),
    log,
  });
  await serveStdio(server, { log });
  // The host closed stdin: flush replies, then stop even if a chain provider is still polling.
  if (process.stdout.writableLength) await new Promise((resolve) => process.stdout.once('drain', resolve));
  process.exit(0);
};

main().catch((error) => {
  log(error?.message || String(error));
  process.exit(1);
});
