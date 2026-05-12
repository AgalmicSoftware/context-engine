import { parseArweaveTxId } from '../../utilities/arweave/arweaveUrls.js';
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
  if (trimmed.startsWith('ar://')) {
    return parseArweaveTxId(trimmed) ? trimmed : '';
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    const protocol = String(parsed.protocol || '').toLowerCase();
    return protocol === 'http:' || protocol === 'https:' ? trimmed : '';
  } catch (_) {
    return '';
  }
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
