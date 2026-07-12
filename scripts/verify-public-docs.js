'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SKIP_DIRS = new Set(['.git', 'node_modules']);
const MARKDOWN_FILE_RE = /\.md$/i;
const REPO_PATH_RE = /^(?:client|docs|scripts|workers|contracts|foundry|tests|posts|whitepaper|ai-discourse-corpus)\//;
const ROOT_FILE_RE = /^(?:README|ARCHITECTURE|CONTRIBUTING|CHANGELOG|LICENSING|SECURITY|ROADMAP|spec|package)(?:\.[A-Za-z0-9]+)?$/;
const ALLOWED_UNTRACKED_PATH_RE = /^(?:client\/(?:build(?:-vite)?|vite-build)(?:\/|$)|client\/\.env(?:$|\.)|(?:dist|out|broadcast|cache|coverage|release-public)(?:\/|$))/;
const FORBIDDEN_MARKERS = Object.freeze([
  { label: 'internal planning identifier', re: /\bPRDs?(?:\s*(?:[#:_-]\s*)?\d+|\d+)\b/gi },
  { label: 'private planning path', re: /(?:^|[^\w])TODO\//gi },
  { label: 'private agent settings path', re: /(?:^|[^\w.-])\.(?:claude|codex)(?:\/|\b)|\bCLAUDE\.md\b/gi },
  { label: 'private companion path', re: /\bcontextEngine-cc(?:\/|\b)/gi },
  { label: 'private skill path', re: /\bclient\/public\/skill\.md\b/gi },
  { label: 'private E2E path', re: /\bscripts\/(?:lib\/)?e2e(?:\/|\b)|\bscripts\/(?:test|seed)-[^\s`'")]+/gi },
  { label: 'private artifact path', re: /\bartifacts\//gi },
  { label: 'private release branch', re: /\brelease-staging(?:[-\w]*)?\b|\b(?:private|dev) branch\b/gi },
]);

function normalizePath(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function walkFiles(rootDir, predicate) {
  const files = [];
  const walk = (absoluteDir) => {
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      const absolutePath = path.join(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(absolutePath);
      } else if (entry.isFile() && predicate(absolutePath)) {
        files.push(absolutePath);
      }
    }
  };
  walk(rootDir);
  return files.sort();
}

function lineForOffset(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

function collectPackageScripts(rootDir) {
  const scriptsByName = new Map();
  const scriptsByPackageDir = new Map();
  const packageFiles = walkFiles(rootDir, (absolutePath) => path.basename(absolutePath) === 'package.json');

  for (const packageFile of packageFiles) {
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    } catch {
      continue;
    }
    const packageScripts = new Set(Object.keys(manifest.scripts || {}));
    const packageDir = path.dirname(packageFile);
    scriptsByPackageDir.set(packageDir, packageScripts);
    for (const scriptName of packageScripts) {
      if (!scriptsByName.has(scriptName)) scriptsByName.set(scriptName, []);
      scriptsByName.get(scriptName).push(normalizePath(path.relative(rootDir, packageFile)));
    }
  }

  return { scriptsByName, scriptsByPackageDir };
}

function scanForbiddenMarkers(rootDir, relativePath, text) {
  const findings = [];
  for (const marker of FORBIDDEN_MARKERS) {
    marker.re.lastIndex = 0;
    let match;
    while ((match = marker.re.exec(text)) !== null) {
      findings.push({
        file: relativePath,
        line: lineForOffset(text, match.index),
        kind: marker.label,
        detail: match[0].trim(),
      });
    }
  }
  return findings;
}

function scanNpmCommands(rootDir, relativePath, text, packageScripts) {
  const findings = [];
  const commandRe = /\bnpm\s+(?:--prefix\s+([^\s]+)\s+)?run\s+(?:-s\s+)?([A-Za-z0-9:_-]+)/g;
  let match;

  while ((match = commandRe.exec(text)) !== null) {
    const rawPrefix = match[1] ? match[1].replace(/^['"]|['"]$/g, '') : '';
    const scriptName = match[2];
    let exists = packageScripts.scriptsByName.has(scriptName);

    if (rawPrefix && !/[<$]/.test(rawPrefix)) {
      const packageDir = path.resolve(rootDir, rawPrefix);
      exists = packageScripts.scriptsByPackageDir.get(packageDir)?.has(scriptName) === true;
    }

    if (!exists) {
      findings.push({
        file: relativePath,
        line: lineForOffset(text, match.index),
        kind: 'missing public npm script',
        detail: scriptName,
      });
    }
  }
  return findings;
}

function markdownLinesOutsideFences(text) {
  const lines = text.split('\n');
  let fenceMarker = null;
  return lines.map((line, index) => {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    if (fenceMatch) {
      if (!fenceMarker) fenceMarker = fenceMatch[1][0];
      else if (fenceMarker === fenceMatch[1][0]) fenceMarker = null;
      return null;
    }
    return fenceMarker ? null : { line, lineNumber: index + 1 };
  }).filter(Boolean);
}

function scanLocalLinks(rootDir, absolutePath, relativePath, text) {
  const findings = [];
  const linkRe = /!?\[[^\]]*\]\(([^)]+)\)/g;

  for (const entry of markdownLinesOutsideFences(text)) {
    linkRe.lastIndex = 0;
    let match;
    while ((match = linkRe.exec(entry.line)) !== null) {
      let target = match[1].trim();
      if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
      target = target.split(/\s+["']/)[0].split('#')[0].split('?')[0];
      if (!target || /^(?:https?:|mailto:|data:|#|\/)/i.test(target) || /[<>]/.test(target)) continue;
      try {
        target = decodeURIComponent(target);
      } catch {
        // Keep the original target so a malformed local URL fails as missing.
      }
      const resolved = path.resolve(path.dirname(absolutePath), target);
      if (!resolved.startsWith(`${rootDir}${path.sep}`) && resolved !== rootDir) continue;
      if (!fs.existsSync(resolved)) {
        findings.push({
          file: relativePath,
          line: entry.lineNumber,
          kind: 'broken local Markdown link',
          detail: match[1],
        });
      }
    }
  }
  return findings;
}

function scanInlineRepoPaths(rootDir, relativePath, text) {
  if (relativePath === 'CHANGELOG.md') return [];

  const findings = [];
  const codeSpanRe = /`([^`\n]+)`/g;
  let match;

  while ((match = codeSpanRe.exec(text)) !== null) {
    let candidate = match[1].trim().replace(/^\.\//, '').replace(/[.,;:]$/, '');
    if (!REPO_PATH_RE.test(candidate) && !ROOT_FILE_RE.test(candidate)) continue;
    if (/[ *?$<>{}|]/.test(candidate) || candidate.includes('...')) continue;

    candidate = candidate.replace(/#.*$/, '').replace(/:\d+(?::\d+)?$/, '');
    if (!candidate || ALLOWED_UNTRACKED_PATH_RE.test(candidate)) continue;
    if (fs.existsSync(path.join(rootDir, candidate))) continue;

    findings.push({
      file: relativePath,
      line: lineForOffset(text, match.index),
      kind: 'missing inline repository path',
      detail: candidate,
    });
  }

  return findings;
}

function verifyPublicDocs(rootDir = path.resolve(__dirname, '..')) {
  const absoluteRoot = path.resolve(rootDir);
  const markdownFiles = walkFiles(absoluteRoot, (absolutePath) => MARKDOWN_FILE_RE.test(absolutePath));
  const packageScripts = collectPackageScripts(absoluteRoot);
  const findings = [];

  for (const absolutePath of markdownFiles) {
    const relativePath = normalizePath(path.relative(absoluteRoot, absolutePath));
    const text = fs.readFileSync(absolutePath, 'utf8');
    findings.push(...scanForbiddenMarkers(absoluteRoot, relativePath, text));
    findings.push(...scanNpmCommands(absoluteRoot, relativePath, text, packageScripts));
    findings.push(...scanLocalLinks(absoluteRoot, absolutePath, relativePath, text));
    findings.push(...scanInlineRepoPaths(absoluteRoot, relativePath, text));
  }

  return {
    findings: findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.kind.localeCompare(b.kind)),
    scannedFiles: markdownFiles.length,
  };
}

function formatFindings(findings) {
  return findings.map((finding) => (
    `${finding.file}:${finding.line} ${finding.kind}: ${finding.detail}`
  )).join('\n');
}

function main(argv = process.argv.slice(2)) {
  const rootDir = argv[0] ? path.resolve(argv[0]) : path.resolve(__dirname, '..');
  const { findings, scannedFiles } = verifyPublicDocs(rootDir);

  if (findings.length > 0) {
    console.error('Public documentation verification failed:');
    console.error(formatFindings(findings));
    return 2;
  }

  console.log(`public documentation verification passed (${scannedFiles} Markdown files scanned)`);
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = {
  collectPackageScripts,
  formatFindings,
  scanForbiddenMarkers,
  scanLocalLinks,
  scanInlineRepoPaths,
  scanNpmCommands,
  verifyPublicDocs,
};
