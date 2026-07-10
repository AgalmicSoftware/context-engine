export function isArrayBufferLike(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer || Object.prototype.toString.call(value) === '[object ArrayBuffer]';
}

export function bufferSourceToUint8Array(buffer: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (isArrayBufferLike(buffer)) {
    return new Uint8Array(buffer);
  }

  if (ArrayBuffer.isView(buffer)) {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  throw new Error('Expected an ArrayBuffer or ArrayBufferView.');
}

type NodeBufferConstructor = {
  from(input: Uint8Array): BufferSource;
};

function getNodeBufferConstructor(): NodeBufferConstructor | null {
  const runtime = globalThis as typeof globalThis & {
    Buffer?: NodeBufferConstructor;
    process?: { versions?: { node?: string } };
  };
  if (!runtime.process?.versions?.node || typeof runtime.Buffer?.from !== 'function') return null;
  return runtime.Buffer;
}

export function bufferSourceToWebCryptoBufferSource(buffer: ArrayBuffer | ArrayBufferView): BufferSource {
  const bytes = bufferSourceToUint8Array(buffer);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  // Regression guard: Node 20 WebCrypto needs a Node-realm Buffer; browsers keep an isolated ArrayBuffer copy.
  const nodeBuffer = getNodeBufferConstructor();
  return nodeBuffer ? nodeBuffer.from(copy) : copy.buffer;
}

export function bufferToBase64URL(buffer: ArrayBuffer | ArrayBufferView): string {
  let bytes: Uint8Array;
  if (isArrayBufferLike(buffer)) {
    bytes = new Uint8Array(buffer);
  } else if (ArrayBuffer.isView(buffer)) {
    bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } else {
    throw new Error('Expected an ArrayBuffer or ArrayBufferView.');
  }
  let value = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    value += String.fromCharCode(bytes[i]);
  }
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64URLToBuffer(base64url: string): ArrayBuffer {
  const base64 = String(base64url || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const binary = atob(base64 + '='.repeat(padLen));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function randomBytes(length: number): Uint8Array {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('WebCrypto random source is not available.');
  }
  return crypto.getRandomValues(new Uint8Array(length));
}

export function randomBase64Url(length: number): string {
  return bufferToBase64URL(randomBytes(length));
}
