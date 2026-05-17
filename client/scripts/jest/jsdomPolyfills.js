const fetchPonyfill = require('node-fetch');

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

class JestResponse {
  constructor(body = '', init = {}) {
    this._body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || '';
    this.ok = this.status >= 200 && this.status < 300;
    this.headers = new globalThis.Headers(init.headers || {});
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

if (typeof globalThis.fetch !== 'function') {
  globalThis.fetch = fetchPonyfill;
}

if (typeof globalThis.Headers !== 'function') {
  globalThis.Headers = fetchPonyfill.Headers;
}

if (typeof globalThis.Request !== 'function') {
  globalThis.Request = fetchPonyfill.Request;
}

globalThis.Response = JestResponse;

if (typeof window !== 'undefined') {
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
}
