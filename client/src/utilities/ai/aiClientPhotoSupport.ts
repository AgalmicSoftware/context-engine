type PhotoLike = {
  name?: unknown;
  type?: unknown;
};

type PhotoAnalysisFormat = 'anthropic' | 'openai-chat' | 'openai-responses';

type PhotoAnalysisSupport =
  | {
      format: PhotoAnalysisFormat;
      supported: true;
    }
  | {
      error: string;
      format: null;
      supported: false;
    };

const SUPPORTED_PHOTO_MIME_TYPES: Record<string, string> = Object.freeze({
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
});

const modelLeaf = (modelRaw: unknown = ''): string =>
  String(modelRaw || '')
    .trim()
    .toLowerCase()
    .split('/')
    .pop() || '';

export const getSupportedPhotoMimeType = (file: PhotoLike | null | undefined): string => {
  const declaredType = String(file?.type || '')
    .trim()
    .toLowerCase();
  if (Object.values(SUPPORTED_PHOTO_MIME_TYPES).includes(declaredType)) return declaredType;
  const name = String(file?.name || '')
    .trim()
    .toLowerCase();
  const extension = name.includes('.') ? name.split('.').pop() || '' : '';
  return SUPPORTED_PHOTO_MIME_TYPES[extension] || '';
};

export const readFileAsDataUrl = (file: Blob & PhotoLike): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Missing photo file.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Failed to read photo file: ${String(file?.name || 'upload')}`));
    reader.readAsDataURL(file);
  });

export const stripDataUrlPrefix = (dataUrl: unknown = ''): string => {
  const raw = String(dataUrl || '');
  const commaIndex = raw.indexOf(',');
  return commaIndex >= 0 ? raw.slice(commaIndex + 1) : raw;
};

export const isChatReasoningModel = (modelRaw: unknown = ''): boolean => /^o[13]/.test(modelLeaf(modelRaw));

export const usesOpenAiResponsesApi = (providerRaw: unknown = '', modelRaw: unknown = ''): boolean => {
  const provider = String(providerRaw || '')
    .trim()
    .toLowerCase();
  return provider === 'openai' && /^gpt-5/.test(modelLeaf(modelRaw));
};

export const resolvePhotoAnalysisSupport = ({
  provider,
  model,
}: {
  model?: unknown;
  provider?: unknown;
} = {}): PhotoAnalysisSupport => {
  const normalizedProvider = String(provider || '')
    .trim()
    .toLowerCase();
  const leaf = modelLeaf(model);

  if (normalizedProvider === 'openai') {
    if (/^(gpt-5|gpt-4o|gpt-4\.1)/.test(leaf)) {
      return {
        supported: true,
        format: usesOpenAiResponsesApi(normalizedProvider, leaf) ? 'openai-responses' : 'openai-chat',
      };
    }
  }

  if (normalizedProvider === 'anthropic') {
    if (/^claude-(3|4)/.test(leaf)) {
      return { supported: true, format: 'anthropic' };
    }
  }

  if (normalizedProvider === 'openrouter') {
    if (/^(gpt-5|gpt-4o|gpt-4\.1)/.test(leaf) || /claude-(3|4)/.test(leaf)) {
      return { supported: true, format: 'openai-chat' };
    }
  }

  return {
    supported: false,
    format: null,
    error:
      `Photo analysis requires a vision-capable OpenAI, Anthropic, or OpenRouter model. Current selection: ${normalizedProvider || 'unknown'} ${leaf || ''}`.trim(),
  };
};
