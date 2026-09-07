#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const START_MARKER = '# CE_PUBLIC_RELEASE_STRIP_START';
const END_MARKER = '# CE_PUBLIC_RELEASE_STRIP_END';
const PRIVATE_COMPANION_PATH = /contextEngine-cc(?:\/|\b)/i;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function indentation(line) {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function stripMarkedBlocks(lines, relativePath) {
  const kept = [];
  let insideBlock = false;
  let removedBlocks = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === START_MARKER) {
      if (insideBlock) {
        fail(`Nested public-release strip marker in ${relativePath}.`);
      }
      insideBlock = true;
      removedBlocks += 1;
      continue;
    }
    if (trimmed === END_MARKER) {
      if (!insideBlock) {
        fail(`Unmatched public-release strip end marker in ${relativePath}.`);
      }
      insideBlock = false;
      continue;
    }
    if (!insideBlock) {
      kept.push(line);
    }
  }

  if (insideBlock) {
    fail(`Unmatched public-release strip start marker in ${relativePath}.`);
  }

  return { lines: kept, removedBlocks };
}

function stripLegacyPrivateSteps(lines) {
  const kept = [];
  let removedBlocks = 0;

  for (let index = 0; index < lines.length;) {
    const stepMatch = lines[index].match(/^(\s*)-\s+name:/);
    if (!stepMatch) {
      kept.push(lines[index]);
      index += 1;
      continue;
    }

    const stepIndent = stepMatch[1].length;
    let end = index + 1;
    while (end < lines.length) {
      const line = lines[end];
      if (line.trim() && indentation(line) <= stepIndent) {
        break;
      }
      end += 1;
    }

    const block = lines.slice(index, end);
    if (PRIVATE_COMPANION_PATH.test(block.join(''))) {
      removedBlocks += 1;
    } else {
      kept.push(...block);
    }
    index = end;
  }

  return { lines: kept, removedBlocks };
}

function workflowFiles(rootDir) {
  const workflowDir = path.join(rootDir, '.github', 'workflows');
  if (!fs.existsSync(workflowDir)) {
    return [];
  }

  return fs.readdirSync(workflowDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => path.join(workflowDir, entry.name));
}

const rootDir = path.resolve(process.argv[2] ?? process.cwd());
let removedBlocks = 0;

for (const workflowPath of workflowFiles(rootDir)) {
  const relativePath = path.relative(rootDir, workflowPath);
  const original = fs.readFileSync(workflowPath, 'utf8');
  const originalLines = original.split(/(?<=\n)/);
  const marked = stripMarkedBlocks(originalLines, relativePath);
  const legacy = stripLegacyPrivateSteps(marked.lines);
  const scrubbed = legacy.lines.join('');

  if (PRIVATE_COMPANION_PATH.test(scrubbed)) {
    fail(`Private companion path remains outside a removable workflow step in ${relativePath}.`);
  }
  if (scrubbed !== original) {
    fs.writeFileSync(workflowPath, scrubbed);
  }
  removedBlocks += marked.removedBlocks + legacy.removedBlocks;
}

if (removedBlocks > 0) {
  process.stderr.write(`scrubbed ${removedBlocks} private workflow block(s)\n`);
}
