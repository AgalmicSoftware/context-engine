#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ABI_CONTRACTS } from './abi-contracts.mjs';

export { ABI_CONTRACTS };

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const parseContract = (value) => {
  const separator = String(value || '').lastIndexOf(':');
  if (separator <= 0 || separator === value.length - 1) {
    throw new Error('--contract requires <artifact-relative-path>:<abi-filename>');
  }
  return {
    artifact: value.slice(0, separator),
    abi: value.slice(separator + 1),
  };
};

const parseArgs = (argv) => {
  const options = {
    repoDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
    contracts: [],
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo') {
      options.repoDir = path.resolve(argv[++index] || '');
    } else if (arg === '--contract') {
      options.contracts.push(parseContract(argv[++index] || ''));
    } else if (arg === '--help') {
      options.help = true;
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }
  if (options.contracts.length === 0) options.contracts = ABI_CONTRACTS;
  return options;
};

const usage = () => `Usage: node scripts/verify-abi-sync.mjs [options]

Compares deterministic ABI extraction from Foundry artifacts under out/ with
the tracked client ABI files. This command never rewrites tracked files.

Options:
  --repo <path>       Repository root.
  --contract <pair>   Override with artifact-relative-path:abi-filename.
                      May be repeated.
  --help              Show this help.
`;

export function verifyAbiSync({ repoDir, contracts = ABI_CONTRACTS } = {}) {
  const rootDir = path.resolve(repoDir || '.');
  const failures = [];
  const verified = [];

  for (const { artifact, abi } of contracts) {
    const artifactPath = path.join(rootDir, 'out', artifact);
    const abiPath = path.join(rootDir, 'client/src/contractsABI', abi);
    if (!fs.existsSync(artifactPath)) {
      failures.push(`${abi}: missing generated artifact out/${artifact}`);
      continue;
    }
    if (!fs.existsSync(abiPath)) {
      failures.push(`${abi}: missing tracked ABI client/src/contractsABI/${abi}`);
      continue;
    }

    try {
      const artifactJson = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      if (!Array.isArray(artifactJson.abi)) {
        failures.push(`${abi}: generated artifact has no ABI array`);
        continue;
      }
      const expected = `${JSON.stringify(artifactJson.abi, null, 2)}\n`;
      const actual = fs.readFileSync(abiPath, 'utf8');
      if (actual !== expected) {
        failures.push(`${abi}: ABI drift (generated sha256 ${sha256(expected)}, tracked sha256 ${sha256(actual)})`);
        continue;
      }
      verified.push({ abi, sha256: sha256(actual) });
    } catch (error) {
      failures.push(`${abi}: ${error?.message || error}`);
    }
  }

  return { failures, verified };
}

const runCli = (argv) => {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(error?.message || error);
    console.error(usage());
    return 2;
  }
  if (options.help) {
    process.stdout.write(usage());
    return 0;
  }

  const result = verifyAbiSync(options);
  if (result.failures.length > 0) {
    console.error('ABI parity check failed:');
    result.failures.forEach((failure) => console.error(`  - ${failure}`));
    console.error('Run npm run abi:sync after reviewing the contract build output.');
    return 1;
  }
  result.verified.forEach(({ abi, sha256: digest }) => {
    console.log(`  ${abi} — verified sha256 ${digest}`);
  });
  console.log(`ABI parity check passed for ${result.verified.length} tracked contract ABIs.`);
  return 0;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exit(runCli(process.argv.slice(2)));
