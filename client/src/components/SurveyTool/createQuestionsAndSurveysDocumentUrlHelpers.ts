import { toSafeLinkHref } from '../../utilities/arweave/arweaveUrls.js';
import { litStorage } from '../../utilities/crypto/litProtocol.js';

export const buildCreateSurveyDocUrlInputPatch = (docURLInput: unknown) => ({
  docURLInput: String(docURLInput ?? ''),
  docURLError: '',
});

export const buildCreateSurveyDocUrlErrorPatch = (docURLError: unknown) => ({
  docURLError: String(docURLError || ''),
});

export const buildCreateSurveyDocUrlClearPatch = () => ({
  docURLInput: '',
  docURLError: '',
});

export const buildCreateSurveyDocumentUrlsPatch = (documentURLs: unknown) => ({
  documentURLs: Array.isArray(documentURLs) ? documentURLs.map((url) => String(url || '')) : [],
});

const normalizeDocumentUrl = (value: unknown) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (litStorage.isLitArweaveUrl(trimmed)) return trimmed;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  // Store the author's text; the shared render-time check decides what is linkable.
  return toSafeLinkHref(trimmed) ? trimmed : '';
};

export const sanitizeDocumentUrls = (values: unknown[] = []) => {
  const out: string[] = [];
  const seen = new Set<string>();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const normalized = normalizeDocumentUrl(value);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  });
  return out;
};
