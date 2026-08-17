#!/usr/bin/env node
/**
 * @module sync-abis
 * @description Extracts ABI arrays from Foundry build artifacts (out/) and writes them
 *              to client/src/contractsABI/ as standalone JSON files.
 *
 * Usage:  node scripts/sync-abis.mjs
 *         npm run abi:sync
 *         npm run abi:build   (forge build + sync)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ABI_CONTRACTS } from './abi-contracts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'out');
const ABI_DIR = resolve(ROOT, 'client/src/contractsABI');

const md5 = (str) => createHash('md5').update(str).digest('hex');

if (!existsSync(OUT_DIR)) {
  console.error(`Error: ${OUT_DIR} not found. Run "forge build" first.`);
  process.exit(1);
}

let errors = 0;
let updated = 0;
let unchanged = 0;

for (const { artifact, abi } of ABI_CONTRACTS) {
  const artifactPath = resolve(OUT_DIR, artifact);
  const abiPath = resolve(ABI_DIR, abi);

  if (!existsSync(artifactPath)) {
    console.error(`Error: Artifact not found — ${artifact}`);
    errors++;
    continue;
  }

  const forgeOutput = JSON.parse(readFileSync(artifactPath, 'utf8'));
  if (!Array.isArray(forgeOutput.abi)) {
    console.error(`Error: No abi array in ${artifact}`);
    errors++;
    continue;
  }

  const newContent = JSON.stringify(forgeOutput.abi, null, 2) + '\n';
  const newHash = md5(newContent);

  // Compare with existing file
  if (existsSync(abiPath)) {
    const existingHash = md5(readFileSync(abiPath, 'utf8'));
    if (existingHash === newHash) {
      console.log(`  ${abi} — unchanged`);
      unchanged++;
      continue;
    }
  }

  const funcs = forgeOutput.abi.filter((e) => e.type === 'function').length;
  const events = forgeOutput.abi.filter((e) => e.type === 'event').length;

  writeFileSync(abiPath, newContent);
  console.log(`  ${abi} — updated (${funcs} functions, ${events} events)`);
  updated++;
}

console.log(`\nSync complete: ${updated} updated, ${unchanged} unchanged, ${errors} errors`);
process.exit(errors > 0 ? 1 : 0);
