// Sets the MCP package's version in every place that states it, in one step, for the release thread:
//   node scripts/set-mcp-version.mjs 0.9.35
// The MCP takes the application's version number, so a release that ships an MCP change runs this with the
// version it is preparing. It rewrites mcp/package.json, both version fields of mcp/package-lock.json, the
// README's "Upgrading to" heading for the unreleased MCP changes, and their heading in the changelog.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STABLE = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

const replaceOnce = (text, from, to, file) => {
  const parts = text.split(from);
  if (parts.length !== 2) throw new Error(`${file}: expected exactly one "${from}", found ${parts.length - 1}`);
  return parts.join(to);
};

/** Rewrites the version under `root` and returns the files it changed. */
export const setMcpVersion = (root, next) => {
  if (!STABLE.test(next)) throw new Error('a stable version is required, such as 0.9.35');
  const file = (name) => path.join(root, name);
  const read = (name) => fs.readFileSync(file(name), 'utf8');
  const manifest = JSON.parse(read('mcp/package.json'));
  const current = manifest.version;
  if (current === next) return [];
  const edits = {
    'mcp/package.json': (text) => replaceOnce(text, `"version": "${current}"`, `"version": "${next}"`, 'mcp/package.json'),
    // The lock states it twice: for the file and for its root package.
    'mcp/package-lock.json': (text) => {
      const lock = JSON.parse(text);
      if (lock.version !== current || lock.packages?.['']?.version !== current) {
        throw new Error('mcp/package-lock.json does not state the package version twice');
      }
      const parts = text.split(`"version": "${current}"`);
      // Only the first two are the package's own; a dependency may share the number.
      return [parts[0], `"version": "${next}"`, parts[1], `"version": "${next}"`, parts.slice(2).join(`"version": "${current}"`)].join('');
    },
    'mcp/README.md': (text) => replaceOnce(text, `## Upgrading to ${current}\n`, `## Upgrading to ${next}\n`, 'mcp/README.md'),
    'CHANGELOG.md': (text) => replaceOnce(text, `### MCP ${current} `, `### MCP ${next} `, 'CHANGELOG.md'),
  };
  const written = Object.entries(edits).map(([name, edit]) => [name, edit(read(name))]);
  for (const [name, text] of written) fs.writeFileSync(file(name), text);
  return written.map(([name]) => name);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const changed = setMcpVersion(root, process.argv[2] || '');
  console.log(changed.length ? `MCP version set in ${changed.join(', ')}` : 'MCP version already set');
}
