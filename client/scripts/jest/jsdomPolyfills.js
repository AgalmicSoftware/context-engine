const fetchPonyfill = require('node-fetch');
const { Readable } = require('node:stream');
const { ReadableStream } = require('node:stream/web');
const { TextEncoder } = require('node:util');
const { webcrypto: nodeWebCrypto } = require('crypto');

const normalizeDigestInput = (value) => {
  if (Buffer.isBuffer(value)) return value;
  if (ArrayBuffer.isView(value)) return Buffer.from(value);
  return Buffer.from(new Uint8Array(value));
};

const createWebCryptoAdapter = () => {
  const subtle = {};
  for (const property of Object.getOwnPropertyNames(Object.getPrototypeOf(nodeWebCrypto.subtle))) {
    if (property === 'constructor') continue;
    const member = nodeWebCrypto.subtle[property];
    Object.defineProperty(subtle, property, {
      value: property === 'digest'
        ? (algorithm, value) => member.call(nodeWebCrypto.subtle, algorithm, normalizeDigestInput(value))
        : member.bind(nodeWebCrypto.subtle),
      configurable: true,
      writable: true,
    });
  }

  const cryptoAdapter = {};
  Object.defineProperties(cryptoAdapter, {
    subtle: { value: subtle, configurable: true, writable: true },
    getRandomValues: {
      value: nodeWebCrypto.getRandomValues.bind(nodeWebCrypto),
      configurable: true,
      writable: true,
    },
    randomUUID: {
      value: nodeWebCrypto.randomUUID.bind(nodeWebCrypto),
      configurable: true,
      writable: true,
    },
  });
  return cryptoAdapter;
};

const installWebCrypto = (target) => {
  if (!target || !nodeWebCrypto) return;
  const cryptoAdapter = createWebCryptoAdapter();
  const currentCrypto = target.crypto;

  try {
    Object.defineProperty(target, 'crypto', {
      value: cryptoAdapter,
      configurable: true,
      writable: true,
    });
    return;
  } catch (error) {
    // Some jsdom versions expose crypto as a read-only object; patch the missing APIs below.
  }

  if (!currentCrypto) return;

  try {
    Object.defineProperty(currentCrypto, 'subtle', {
      value: cryptoAdapter.subtle,
      configurable: true,
    });
  } catch (error) {
    // Leave crypto untouched if the host object refuses polyfills.
  }

  if (!currentCrypto.getRandomValues) {
    try {
      Object.defineProperty(currentCrypto, 'getRandomValues', {
        value: nodeWebCrypto.getRandomValues.bind(nodeWebCrypto),
        configurable: true,
      });
    } catch (error) {
      // Leave crypto untouched if the host object refuses polyfills.
    }
  }
};

const readBodyAsText = async (body) => {
  if (body == null) return '';
  if (typeof body === 'string') return body;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    return body.toString();
  }
  if (typeof body.text === 'function') {
    return body.text();
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob && typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(body);
    });
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) {
    return body.toString('utf8');
  }
  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength).toString('utf8');
  }
  if (body instanceof ArrayBuffer) {
    return Buffer.from(body).toString('utf8');
  }
  return String(body);
};

const readBodyAsBytes = async (body) => {
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (typeof body?.arrayBuffer === 'function') return new Uint8Array(await body.arrayBuffer());
  if (typeof Blob !== 'undefined' && body instanceof Blob && typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(body);
    });
  }
  return new TextEncoder().encode(await readBodyAsText(body));
};

// node-fetch v2 exposes Node streams/Buffers. Supply the Web Streams reader
// used by Workers without changing the ponyfill's own JSON/text consumers.
class JestRequest extends fetchPonyfill.Request {
  get body() {
    const body = super.body;
    if (body && typeof body.getReader !== 'function') {
      let webBody;
      body.getReader = () => {
        webBody ||= Readable.toWeb(body instanceof Readable ? body : Readable.from([body]));
        return webBody.getReader();
      };
    }
    return body;
  }
}

class JestResponse {
  constructor(body = '', init = {}) {
    this._body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || '';
    this.ok = this.status >= 200 && this.status < 300;
    this.headers = new globalThis.Headers(init.headers || {});
  }

  get body() {
    if (this._body == null) return null;
    if (typeof this._body.getReader === 'function') return this._body;
    this._webBody ||= new ReadableStream({
      start: async (controller) => {
        try {
          controller.enqueue(await readBodyAsBytes(this._body));
          controller.close();
        } catch (error) { controller.error(error); }
      },
    });
    return this._webBody;
  }

  async text() {
    return readBodyAsText(this._body);
  }

  async json() {
    const text = await this.text();
    return text ? JSON.parse(text) : null;
  }

  clone() {
    return new JestResponse(this._body, {
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
    });
  }
}

if (typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL == null) {
  process.env.PUBLIC_URL = '';
}

installWebCrypto(globalThis);

if (typeof globalThis.fetch !== 'function') {
  globalThis.fetch = fetchPonyfill;
}

if (typeof globalThis.Headers !== 'function') {
  globalThis.Headers = fetchPonyfill.Headers;
}

if (typeof globalThis.Request !== 'function') {
  globalThis.Request = JestRequest;
}

globalThis.Response = JestResponse;

if (typeof window !== 'undefined') {
  installWebCrypto(window);

  if (typeof window.fetch !== 'function') {
    window.fetch = globalThis.fetch;
  }

  if (typeof window.Headers !== 'function') {
    window.Headers = globalThis.Headers;
  }

  if (typeof window.Request !== 'function') {
    window.Request = globalThis.Request;
  }

  window.Response = globalThis.Response;

  if (typeof window.requestAnimationFrame !== 'function') {
    window.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  }

  if (typeof window.cancelAnimationFrame !== 'function') {
    window.cancelAnimationFrame = (handle) => clearTimeout(handle);
  }

  if (globalThis !== window) {
    globalThis.requestAnimationFrame = (callback) => window.requestAnimationFrame(callback);
    globalThis.cancelAnimationFrame = (handle) => window.cancelAnimationFrame(handle);
  }
}
