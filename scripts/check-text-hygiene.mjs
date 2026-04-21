#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const INCLUDED_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.scss',
  '.css',
  '.md',
  '.json',
  '.html',
  '.sol',
  '.yml',
  '.yaml',
  '.sh',
  '.txt',
]);

const INCLUDED_SPECIAL_FILES = new Set([
  '.editorconfig',
  '.gitattributes',
  '.gitignore',
]);

const EXCLUDED_PATHS = new Set([
  'dist/sessionCorsWorker.bundle.js',
]);

const CHANGELOG_PRD_IDENTIFIER_PATTERN = /\bPRDs?[\s-]\d{1,4}(-[A-Z]\d+)?(-\d{1,4})?\b/g;

const isTrackedTextFile = (filePath) => {
  if (INCLUDED_SPECIAL_FILES.has(filePath)) {
    return true;
  }

const trackedFiles = trackedFilesBuffer
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
  .filter((filePath) => {
    if (EXCLUDED_PATHS.has(filePath)) {
      return false;
    }

    if (INCLUDED_SPECIAL_FILES.has(filePath)) {
      return true;
    }

    return [...INCLUDED_EXTENSIONS].some((extension) => filePath.endsWith(extension));
  });

const issues = [];

  const issues = [];

  for (const filePath of trackedFiles) {
    const absolutePath = path.join(rootDir, filePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    if (/\s/.test(filePath)) {
      issues.push(`${filePath}: filename contains whitespace`);
    }

    if (filePath !== filePath.normalize('NFC')) {
      issues.push(`${filePath}: filename is not NFC-normalized`);
    }

    if (/[^\x20-\x7E]/.test(filePath)) {
      issues.push(`${filePath}: filename contains non-ASCII characters`);
    }

    const fileBuffer = fs.readFileSync(absolutePath);
    if (fileBuffer.length === 0) {
      continue;
    }

    if (fileBuffer.includes(0x0d)) {
      issues.push(`${filePath}: contains CRLF or CR line endings`);
    }

    if (fileBuffer[fileBuffer.length - 1] !== 0x0a) {
      issues.push(`${filePath}: missing final newline`);
    }

    const lines = fileBuffer.toString('utf8').split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].replace(/\r$/, '');
      if (/[ \t]+$/.test(line)) {
        issues.push(`${filePath}:${index + 1}: trailing whitespace`);
      }

      if (path.basename(filePath) === 'CHANGELOG.md') {
        for (const match of line.matchAll(CHANGELOG_PRD_IDENTIFIER_PATTERN)) {
          issues.push(
            `${filePath}:${index + 1}: changelog must not reference PRD identifier "${match[0]}"`
          );
        }
      }
    }
  }

  if (filePath !== filePath.normalize('NFC')) {
    issues.push(`${filePath}: filename is not NFC-normalized`);
  }

  if (/[^\x20-\x7E]/.test(filePath)) {
    issues.push(`${filePath}: filename contains non-ASCII characters`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  if (fileBuffer.length === 0) {
    continue;
  }

  if (fileBuffer.includes(0x0d)) {
    issues.push(`${filePath}: contains CRLF or CR line endings`);
  }

  if (fileBuffer[fileBuffer.length - 1] !== 0x0a) {
    issues.push(`${filePath}: missing final newline`);
  }

  const lines = fileBuffer.toString('utf8').split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(/\r$/, '');
    if (/[ \t]+$/.test(line)) {
      issues.push(`${filePath}:${index + 1}: trailing whitespace`);
    }
  }
}

if (issues.length > 0) {
  console.error('Text hygiene check failed:\n');
  issues.forEach((issue) => {
    console.error(`- ${issue}`);
  });
  process.exit(1);
}

console.log(`Text hygiene check passed for ${trackedFiles.length} tracked files.`);
