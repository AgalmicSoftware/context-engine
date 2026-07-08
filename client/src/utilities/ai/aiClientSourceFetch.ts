import { resolveSessionConfigAliases } from '../session/sessionNaming';
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';
import { createLogger } from '../logging';
import { extractMainContent, readFileContent } from './aiClientSourceReaders';

type UnknownRecord = Record<string, unknown>;

type AdditionalSource = {
  name?: unknown;
  type?: unknown;
  value?: unknown;
};

const aiLog = createLogger('ai');

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' ? (value as UnknownRecord) : {};

const resolveSessionAliasesOpt = (opts: unknown = {}) => {
  const options = asRecord(opts);
  return resolveSessionConfigAliases({
    sessionSlug: options.sessionSlug,
    sessionConfig: options.sessionConfig,
  });
};

const resolveSessionSlugOpt = (opts: unknown = {}) => resolveSessionAliasesOpt(opts).sessionSlug;

const resolveSessionConfigOpt = (opts: unknown = {}) => resolveSessionAliasesOpt(opts).sessionConfig;

const readWorkerResponseJson = async (workerResponse: Response): Promise<UnknownRecord> => {
  try {
    const data = await workerResponse.json();
    return asRecord(data);
  } catch {
    return {};
  }
};

/**
 * Attempt to fetch HTML content from a URL directly; if it fails or is blocked,
 * fallback to the worker. Then parse the HTML to extract text.
 */
export const fetchContentFromURL = async (url: unknown, opts: unknown = {}): Promise<string> => {
  try {
    const options = asRecord(opts);
    const validatedUrl = new URL(String(url));
    if (!validatedUrl.protocol.match(/^https?:$/)) {
      throw new Error('URL must start with http:// or https://');
    }

    try {
      const directResp = await fetch(validatedUrl.href);
      if (!directResp.ok) throw new Error(`HTTP error! status: ${directResp.status}`);
      const contentType = directResp.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        const htmlContent = await directResp.text();
        const extractedContent = extractMainContent(htmlContent);
        if (extractedContent && extractedContent.length > 100) {
          return extractedContent;
        }
      }
    } catch (error) {
      aiLog.warn('Direct URL fetch failed; falling back to worker proxy:', error);
    }

    const sessionSlug = resolveSessionSlugOpt(options);
    const sessionConfig = resolveSessionConfigOpt(options);
    const corsWorkerUrl = await getCorsProxyUrlOrThrow({
      sessionSlug,
      sessionConfig,
      context: options.context,
      allowDemoFallback: defaultStrictAllowDemoFallback(),
    });
    const workerUrl = String(corsWorkerUrl || '');
    const baseUrl = workerUrl.replace(/\/+$/, '');
    const workerResponse = await fetchWorkerWithAuth(
      workerUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: validatedUrl.href, action: 'fetch_url' }),
      },
      {
        sessionSlug,
        context: options.context,
        workerUrl: baseUrl,
        allowDemoFallback: defaultStrictAllowDemoFallback(),
      },
    );

    const data = await readWorkerResponseJson(workerResponse);
    if (!workerResponse.ok) {
      throw new Error(String(data.error || 'Failed to fetch URL content'));
    }
    if (!data.content) throw new Error('No content received from URL');

    if (typeof data.content === 'string' && data.content.includes('<')) {
      return extractMainContent(data.content);
    }
    return data.content as string;
  } catch (error) {
    aiLog.error('Error fetching URL content:', error);
    throw new Error(`URL Error: ${String(asRecord(error).message || '')}`);
  }
};

/**
 * processAdditionalSources(sources)
 * Iterates through the list of additional sources (files/URLs),
 * fetches or reads their content, and returns a single concatenated string
 * with delimiters.
 */
export async function processAdditionalSources(sources: unknown, opts: unknown = {}): Promise<string> {
  if (!Array.isArray(sources) || sources.length === 0) return '';

  const results = await Promise.all(
    sources.map(async (sourceInput: AdditionalSource) => {
      const src = asRecord(sourceInput);
      let content: unknown = '';
      try {
        if (src.type === 'url') {
          content = await fetchContentFromURL(src.value, opts);
        } else if (src.type === 'file') {
          content = await readFileContent(src.value as File);
        } else if (src.type === 'photo') {
          throw new Error('Photo sources must be analyzed before text extraction.');
        }
      } catch (error) {
        content = `[Error reading source '${String(src.name)}': ${String(asRecord(error).message || '')}]`;
      }
      return `\n\n--- Source: ${String(src.name)} ---\n\n${content}`;
    }),
  );

  return results.join('');
}
