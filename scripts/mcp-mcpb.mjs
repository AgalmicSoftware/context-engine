// Packs the built MCP server as a Claude Desktop bundle (.mcpb), which Claude Desktop installs from a double-click
// and runs with its own Node. Run `npm --prefix mcp run build` first; the bundle is written to dist/.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

/** A zip of [name, bytes] entries. No timestamps, so the same input gives the same file on one Node version. */
export const zip = (entries) => {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, bytes] of entries) {
    const path = Buffer.from(name);
    const data = deflateRawSync(bytes, { level: 9 });
    // version 2.0, UTF-8 names, deflate, 1 Jan 1980, CRC, sizes, name length, no extra field
    const fields = Buffer.alloc(26);
    fields.writeUInt16LE(20, 0);
    fields.writeUInt16LE(0x0800, 2);
    fields.writeUInt16LE(8, 4);
    fields.writeUInt16LE(0, 6);
    fields.writeUInt16LE(0x21, 8);
    fields.writeUInt32LE(crc32(bytes), 10);
    fields.writeUInt32LE(data.length, 14);
    fields.writeUInt32LE(bytes.length, 18);
    fields.writeUInt16LE(path.length, 22);
    const local = Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), fields, path, data]);
    // The central entry repeats the fields, then: comment length, disk, attributes (regular file, 0644), offset.
    const tail = Buffer.alloc(14);
    tail.writeUInt32LE((0o100644 << 16) >>> 0, 6);
    tail.writeUInt32LE(offset, 10);
    central.push(Buffer.concat([Buffer.from([0x50, 0x4b, 1, 2, 20, 3]), fields, tail, path]));
    locals.push(local);
    offset += local.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
};

/** The files in a zip this script wrote, read back from its directory as an installer reads them. */
export const unzip = (bytes) => {
  const end = bytes.length - 22;
  if (bytes.readUInt32LE(end) !== 0x06054b50) throw new Error('not a bundle this script wrote');
  const files = new Map();
  let at = bytes.readUInt32LE(end + 16);
  for (let index = 0; index < bytes.readUInt16LE(end + 10); index += 1) {
    const packed = bytes.readUInt32LE(at + 20);
    const nameLength = bytes.readUInt16LE(at + 28);
    const local = bytes.readUInt32LE(at + 42);
    const name = bytes.toString('utf8', at + 46, at + 46 + nameLength);
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    files.set(name, inflateRawSync(bytes.subarray(start, start + packed)));
    at += 46 + nameLength;
  }
  return files;
};

/** The bundle's files: the manifest at the MCP package's version, the server it names, and the licences. */
export const bundleEntries = (root) => {
  const read = (path) => readFileSync(join(root, path));
  const json = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  const { name, version } = JSON.parse(read('mcp/package.json'));
  const manifest = { ...JSON.parse(read('mcp/mcpb/manifest.json')), version };
  return [
    ['manifest.json', json(manifest)],
    // The server reads its version from the package.json one folder above it, as in the npm package.
    ['package.json', json({ name, version, type: 'module' })],
    [manifest.server.entry_point, read('mcp/dist/contextengine.mjs')],
    ['LICENSE', read('mcp/LICENSE')],
    ['THIRD_PARTY_LICENSES.txt', read('mcp/dist/THIRD_PARTY_LICENSES.txt')],
  ];
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const out = process.argv[2] || join(root, 'dist/context-engine.mcpb');
  mkdirSync(dirname(out), { recursive: true });
  const bundle = zip(bundleEntries(root));
  writeFileSync(out, bundle);
  console.error(`Claude Desktop bundle written: ${out} (${bundle.length} bytes)`);
}
