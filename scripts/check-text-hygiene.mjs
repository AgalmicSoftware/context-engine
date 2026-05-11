#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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

const WHITESPACE_ONLY_ISSUE_PATTERNS = Object.freeze([
  /: filename contains whitespace$/,
  /: contains CRLF or CR line endings$/,
  /: missing final newline$/,
  /:\d+: trailing whitespace$/,
]);

const CHANGELOG_INTERNAL_PLANNING_IDENTIFIER_PATTERN = /\bPRDs?[\s-]\d{1,4}(-[A-Z]\d+)?(-\d{1,4})?\b/g;

const isTrackedTextFile = (filePath) => {
  if (INCLUDED_SPECIAL_FILES.has(filePath)) {
    return true;
  }

  return [...INCLUDED_EXTENSIONS].some((extension) => filePath.endsWith(extension));
};

export const classifyTextHygieneIssue = (issue) => (
  WHITESPACE_ONLY_ISSUE_PATTERNS.some((pattern) => pattern.test(issue))
    ? 'warning'
    : 'failure'
);

export const collectTextHygieneIssues = ({ rootDir = process.cwd() } = {}) => {
  const trackedFilesBuffer = execFileSync('git', ['ls-files', '-z'], {
    cwd: rootDir,
    encoding: 'buffer',
  });

  const trackedFiles = trackedFilesBuffer
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .filter(isTrackedTextFile);

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
        for (const match of line.matchAll(CHANGELOG_INTERNAL_PLANNING_IDENTIFIER_PATTERN)) {
          issues.push(
            `${filePath}:${index + 1}: changelog must not reference internal planning identifier "${match[0]}"`
          );
        }
      }
    }
  }

  return {
    trackedFiles,
    issues,
    warnings: issues.filter((issue) => classifyTextHygieneIssue(issue) === 'warning'),
    failures: issues.filter((issue) => classifyTextHygieneIssue(issue) === 'failure'),
  };
};

export const runTextHygieneCheck = ({ rootDir = process.cwd() } = {}) => {
  const result = collectTextHygieneIssues({ rootDir });

  if (result.warnings.length > 0) {
    console.warn('Text hygiene warnings:\n');
    result.warnings.forEach((issue) => {
      console.warn(`- ${issue}`);
    });
  }

  if (result.failures.length > 0) {
    console.error('Text hygiene check failed:\n');
    result.failures.forEach((issue) => {
      console.error(`- ${issue}`);
    });
    return 1;
  }

  if (result.warnings.length > 0) {
    console.log(`Text hygiene check passed with warnings for ${result.trackedFiles.length} tracked files.`);
    return 0;
  }

  console.log(`Text hygiene check passed for ${result.trackedFiles.length} tracked files.`);
  return 0;
};

process.exit(runTextHygieneCheck());
