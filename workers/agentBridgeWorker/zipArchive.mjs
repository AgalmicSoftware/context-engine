import { safeString } from './runtimePrimitives.mjs';

const textEncoder = new TextEncoder();

function concat(parts = []) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

function u16le(value) {
  return new Uint8Array([value & 255, (value >>> 8) & 255]);
}

function u32le(value) {
  return new Uint8Array([
    value & 255,
    (value >>> 8) & 255,
    (value >>> 16) & 255,
    (value >>> 24) & 255,
  ]);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function normalizeZipPath(path = '') {
  return safeString(path)
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .map((part) => part.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 96))
    .filter(Boolean)
    .join('/') || 'file';
}

function normalizeFileBytes(content = '') {
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (ArrayBuffer.isView(content)) {
    return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  }
  return textEncoder.encode(String(content ?? ''));
}

export function buildZipArchive(files = []) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const entries = (Array.isArray(files) ? files : [])
    .map((file, index) => ({
      path: normalizeZipPath(file?.path || `file-${index + 1}.txt`),
      bytes: normalizeFileBytes(file?.content ?? file?.bytes ?? ''),
    }));

  entries.forEach((entry) => {
    const name = textEncoder.encode(entry.path);
    const checksum = crc32(entry.bytes);
    const localHeader = concat([
      u32le(0x04034b50),
      u16le(20),
      u16le(0),
      u16le(0),
      u16le(0),
      u16le(0),
      u32le(checksum),
      u32le(entry.bytes.length),
      u32le(entry.bytes.length),
      u16le(name.length),
      u16le(0),
      name,
    ]);
    localParts.push(localHeader, entry.bytes);

    const centralHeader = concat([
      u32le(0x02014b50),
      u16le(20),
      u16le(20),
      u16le(0),
      u16le(0),
      u16le(0),
      u16le(0),
      u32le(checksum),
      u32le(entry.bytes.length),
      u32le(entry.bytes.length),
      u16le(name.length),
      u16le(0),
      u16le(0),
      u16le(0),
      u16le(0),
      u32le(0),
      u32le(offset),
      name,
    ]);
    centralParts.push(centralHeader);
    offset += localHeader.length + entry.bytes.length;
  });

  const localBytes = concat(localParts);
  const centralBytes = concat(centralParts);
  const end = concat([
    u32le(0x06054b50),
    u16le(0),
    u16le(0),
    u16le(entries.length),
    u16le(entries.length),
    u32le(centralBytes.length),
    u32le(localBytes.length),
    u16le(0),
  ]);
  return concat([localBytes, centralBytes, end]);
}
