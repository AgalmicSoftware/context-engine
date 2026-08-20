export type BenchmarkReportEntry = {
  artifact: string;
  bytes: number;
  compression: 'gzip' | 'none';
  contentBytes: number;
  contentSha256: string;
  generatedAt: string;
  id: string;
  participantCount: number;
  publicationStatus: 'development-preview' | 'released';
  questionCount: number;
  releaseReportContentHash?: string | null;
  sha256: string;
  title: string;
  topic: string;
};

export const MAX_ARTIFACT_BYTES = 8 * 1024 * 1024;
export const MAX_REPORT_CONTENT_BYTES = 32 * 1024 * 1024;

const readStreamBytes = async (stream: ReadableStream<Uint8Array>, maximumBytes: number): Promise<Uint8Array> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maximumBytes) {
        throw new Error('The benchmark artifact exceeds the permitted size.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return bytes;
};

const readResponseBytes = async (
  response: Response,
  maximumBytes: number,
  allowTextFallback = false,
): Promise<Uint8Array> => {
  if (response.body) return readStreamBytes(response.body, maximumBytes);
  if (typeof response.arrayBuffer === 'function') {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maximumBytes) {
      throw new Error('The benchmark artifact exceeds the permitted size.');
    }
    return bytes;
  }
  if (allowTextFallback && typeof response.text === 'function') {
    const bytes = new TextEncoder().encode(await response.text());
    if (bytes.byteLength > maximumBytes) {
      throw new Error('The benchmark artifact exceeds the permitted size.');
    }
    return bytes;
  }
  throw new Error('The benchmark artifact response did not include a readable body.');
};

const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  if (!globalThis.crypto?.subtle) {
    throw new Error('This browser cannot verify the benchmark artifact integrity.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes.slice().buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const verifyBytes = async (
  bytes: Uint8Array,
  expectedBytes: number,
  expectedSha256: string,
  label: string,
): Promise<void> => {
  if (bytes.byteLength !== expectedBytes) {
    throw new Error(`The benchmark ${label} size does not match its manifest.`);
  }
  if ((await sha256Hex(bytes)) !== expectedSha256.toLowerCase()) {
    throw new Error(`The benchmark ${label} hash does not match its manifest.`);
  }
};

export const decodeBenchmarkReport = async (response: Response, report: BenchmarkReportEntry): Promise<string> => {
  // Browsers transparently decode HTTP Content-Encoding while retaining the header.
  const serverDecodedGzip =
    report.compression === 'gzip' && response.headers?.get('content-encoding')?.includes('gzip');
  let contentBytes: Uint8Array;
  if (report.compression === 'none' || serverDecodedGzip) {
    contentBytes = await readResponseBytes(response, MAX_REPORT_CONTENT_BYTES, true);
  } else {
    const artifactBytes = await readResponseBytes(response, MAX_ARTIFACT_BYTES);
    await verifyBytes(artifactBytes, report.bytes, report.sha256, 'artifact');
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser cannot decompress the benchmark report. Open the standalone artifact instead.');
    }
    const stream = new Response(artifactBytes).body;
    if (!stream) throw new Error('The benchmark artifact response did not include a readable body.');
    contentBytes = await readStreamBytes(stream.pipeThrough(new DecompressionStream('gzip')), MAX_REPORT_CONTENT_BYTES);
  }
  await verifyBytes(contentBytes, report.contentBytes, report.contentSha256, 'report content');
  return new TextDecoder('utf-8', { fatal: true }).decode(contentBytes);
};
