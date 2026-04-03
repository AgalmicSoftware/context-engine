#!/usr/bin/env node

'use strict';

const {
  DEFAULT_OUTPUT_DIR,
  generateArweaveJwk,
  inspectArweaveJwk,
} = require('./lib/arweave-jwk');

const KNOWN_BOOLEAN_FLAGS = new Set(['force', 'help']);

const printUsage = () => {
  console.log([
    'Usage:',
    '  npm run -s arweave:jwk:generate -- --output .keys/arweave-upload.jwk.json',
    '  npm run -s arweave:jwk:inspect -- --input .keys/arweave-upload.jwk.json',
    '  npm run -s arweave:jwk:inspect -- --expect-address <known-address>',
    '',
    'Commands:',
    '  generate   Create a new Arweave JWK, write it to a local file, and print the derived address.',
    '  inspect    Load an existing JWK from --input or ARWEAVE_JWK_PATH / ARWEAVE_JWK_JSON / ARWEAVE_JWK and print the derived address.',
    '',
    'Flags:',
    '  --output <path>          Output path for generate (default: .keys/arweave-wallet-<timestamp>.jwk.json)',
    '  --input <path>           Input path for inspect (overrides env)',
    '  --expect-address <addr>  Exit non-zero if the derived address does not match',
    '  --force                  Overwrite an existing output file during generate',
    '  --help                   Show this help text',
    '',
    `Default output directory: ${DEFAULT_OUTPUT_DIR}/ (gitignored in this repo)`,
  ].join('\n'));
};

const parseArgs = (argv = process.argv.slice(2)) => {
  let command = '';
  const flags = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || '').trim();
    if (!token) continue;

    if (!token.startsWith('--') && !command) {
      command = token;
      continue;
    }

    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2).trim();
    if (!key) {
      throw new Error('Encountered an empty flag.');
    }

    if (KNOWN_BOOLEAN_FLAGS.has(key)) {
      flags[key] = true;
      continue;
    }

    const nextValue = argv[index + 1];
    if (typeof nextValue !== 'string' || !String(nextValue).trim() || String(nextValue).startsWith('--')) {
      throw new Error(`Flag --${key} requires a value.`);
    }
    flags[key] = String(nextValue).trim();
    index += 1;
  }

  return {
    command: command || 'inspect',
    flags,
  };
};

async function main() {
  const { command, flags } = parseArgs();
  if (flags.help || command === 'help') {
    printUsage();
    return;
  }

  if (command === 'generate') {
    const result = await generateArweaveJwk({
      outputPath: flags.output || '',
      force: !!flags.force,
    });
    console.log(JSON.stringify({
      command,
      outputPath: result.outputPath,
      address: result.address,
      ownerToAddressMatches: result.ownerToAddressMatches,
      exportExample: `ARWEAVE_JWK_PATH=${result.outputPath}`,
    }, null, 2));
    return;
  }

  if (command === 'inspect') {
    const result = await inspectArweaveJwk({
      inputPath: flags.input || '',
      expectedAddress: flags['expect-address'] || '',
    });
    console.log(JSON.stringify({
      command,
      source: result.source,
      inputPath: result.inputPath || null,
      address: result.address,
      expectedAddress: result.expectedAddress,
      matchesExpected: result.matchesExpected,
      ownerToAddressMatches: result.ownerToAddressMatches,
    }, null, 2));
    if (result.expectedAddress && result.matchesExpected === false) {
      process.exitCode = 1;
    }
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
