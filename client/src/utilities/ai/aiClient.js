/**
 * @module aiClient
 * @description AI orchestration layer — unified entry point for AI API calls, streaming responses,
 *              survey analysis, audio transcription, and comparison toolkit dispatch.
 *
 * Key exports: callAI, analyzeClusterOpinions, rankQuestionsAI, requestAiRewrite, transcribeAudio, runCompareToolkit
 */
// Purpose: AI orchestration only — unified compare entry + toolkit calls.
// All math/heuristics live in utilities/compareUsers.js

import { aiRewritePrompt } from '../../prompts/aiRewritePrompt.js';
import buildClusterAnalysisPrompt, { CLUSTER_ANALYSIS_SYSTEM_PROMPT } from '../../prompts/clusterAnalysisPrompt.js';
import buildCompareToolkitPrompt from '../../prompts/compareToolkitPrompt.js';
import buildPhotoAnalysisPrompt from '../../prompts/photoAnalysisPrompt.js';
import { rankQuestionsPrompt } from '../../prompts/rankQuestionsPrompt.js';
import { getEffectiveAiConfig, getEffectiveTranscriptionConfig } from './aiSettings.js';
import { getEffectiveArweaveKey } from '../session/resourceKeys.js';
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy.js';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';
import { resolveSessionConfigAliases } from '../session/sessionNaming.js';
import { normalizeBaseUrl } from '../urlUtils.js';



import {
  pcaLiteCompass,
  computeVennEvidence,
  computeOverlapMatrix,
  sanitizeCompass as sanitizeCompassPure,
  fallbackBullets,
} from '../survey/compareUsers.js';
import { createLogger } from '../logging.js';

const aiLog = createLogger('ai');
// OpenAI's speech-to-text docs cap each /transcribe file upload at 25 MB.
// We stay below that with a 24 MiB client-side ceiling to leave multipart headroom.
export const TRANSCRIBE_MAX_UPLOAD_BYTES = 24 * 1024 * 1024;
const TRANSCRIBE_WAV_TARGET_HZ = 16000;
const TRANSCRIBE_CHUNK_HEADROOM_BYTES = 64 * 1024;
const TRANSCRIBE_CHUNK_OVERLAP_MS = 250;

/* ======================================================================
 * Dev/E2E-only AI mock mode
 * ====================================================================== */

const _readLocalStorageFlag = (key) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(String(key || '')) === '1';
  } catch (_) {
    return false;
  }
};

const _readQueryFlag = (key) => {
  try {
    if (typeof window === 'undefined' || !window.location) return false;
    const qp = new URLSearchParams(String(window.location.search || ''));
    return qp.get(String(key || '')) === '1';
  } catch (_) {
    return false;
  }
};

export const isE2eAiMockEnabled = () => {
  // Never enable in production bundles.
  if (process.env.NODE_ENV === 'production') return false;

  try {
    if (globalThis && globalThis.CE_E2E_AI_MOCK === true) return true;
  } catch (e) {
    aiLog.warn('AI mock flag lookup failed:', e);
  }

  if (_readLocalStorageFlag('ce-e2e-ai-mock')) return true;
  if (_readQueryFlag('aiMock')) return true;

  return false;
};

const SUPPORTED_PHOTO_MIME_TYPES = Object.freeze({
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
});

const getSupportedPhotoMimeType = (file) => {
  const declaredType = String(file?.type || '').trim().toLowerCase();
  if (Object.values(SUPPORTED_PHOTO_MIME_TYPES).includes(declaredType)) return declaredType;
  const name = String(file?.name || '').trim().toLowerCase();
  const extension = name.includes('.') ? name.split('.').pop() : '';
  return SUPPORTED_PHOTO_MIME_TYPES[extension] || '';
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  if (!file) {
    reject(new Error('Missing photo file.'));
    return;
  }
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error(`Failed to read photo file: ${String(file?.name || 'upload')}`));
  reader.readAsDataURL(file);
});

const stripDataUrlPrefix = (dataUrl = '') => {
  const raw = String(dataUrl || '');
  const commaIndex = raw.indexOf(',');
  return commaIndex >= 0 ? raw.slice(commaIndex + 1) : raw;
};

const resolvePhotoAnalysisSupport = ({ provider, model } = {}) => {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  const modelLeaf = String(model || '').trim().toLowerCase().split('/').pop();

  if (normalizedProvider === 'openai') {
    if (/^(gpt-5|gpt-4o|gpt-4\.1)/.test(modelLeaf)) {
      return {
        supported: true,
        format: usesOpenAiResponsesApi(normalizedProvider, modelLeaf) ? 'openai-responses' : 'openai-chat',
      };
    }
  }

  if (normalizedProvider === 'anthropic') {
    if (/^claude-(3|4)/.test(modelLeaf)) {
      return { supported: true, format: 'anthropic' };
    }
  }

  if (normalizedProvider === 'openrouter') {
    if (/^(gpt-5|gpt-4o|gpt-4\.1)/.test(modelLeaf) || /claude-(3|4)/.test(modelLeaf)) {
      return { supported: true, format: 'openai-chat' };
    }
  }

  return {
    supported: false,
    format: null,
    error: `Photo analysis requires a vision-capable OpenAI, Anthropic, or OpenRouter model. Current selection: ${normalizedProvider || 'unknown'} ${modelLeaf || ''}`.trim(),
  };
};

export const analyzePhotoForQuestionGeneration = async (file, opts = {}) => {
  if (!file) throw new Error('Missing photo file.');

  const mimeType = getSupportedPhotoMimeType(file);
  if (!mimeType) {
    throw new Error('Unsupported photo format. Use png, jpg, jpeg, webp, or gif.');
  }

  const sessionSlug = resolveSessionSlugOpt(opts);
  const sessionConfig = resolveSessionConfigOpt(opts);
  const ai = await getEffectiveAiConfig({
    sessionSlug,
    sessionConfig,
    preferLocal: opts.preferLocal,
    provider: opts.provider,
    model: opts.model,
    context: opts.context,
  });
  const support = resolvePhotoAnalysisSupport(ai);
  if (!support.supported) {
    throw new Error(support.error || 'Configured AI provider/model does not support photo analysis.');
  }

  const dataUrl = await readFileAsDataUrl(file);
  const prompt = buildPhotoAnalysisPrompt(file?.name || '');
  const messages = (() => {
    if (support.format === 'openai-responses') {
      return [{
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          { type: 'input_image', image_url: dataUrl },
        ],
      }];
    }
    if (support.format === 'anthropic') {
      return [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: stripDataUrlPrefix(dataUrl),
            },
          },
        ],
      }];
    }
    return [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    }];
  })();

  const text = await callAI('', {
    ...pickAiRequestOpts(opts),
    provider: ai.provider,
    model: ai.model,
    messages,
    maxTokens: 1200,
    temperature: 0.2,
    taskType: 'summarize',
  });
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    throw new Error('Photo analysis returned no usable text.');
  }
  return {
    text: trimmed,
    provider: ai.provider,
    model: ai.model,
    requestFormat: support.format,
  };
};

const _shortAddr = (addr) => {
  const s = String(addr || '').trim();
  if (!s) return '';
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
};

const _hashStr32 = (value) => {
  const s = String(value || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    h = Math.imul(h, 16777619);
  }
  // eslint-disable-next-line no-bitwise
  return h >>> 0;
};

const buildE2eMockCompareBullets = (users = []) => {
  const safe = Array.isArray(users) ? users : [];
  const addrs = safe.map((u) => String(u?.address || '').trim()).filter(Boolean);
  const label = (a) => _shortAddr(a) || 'unknown';
  const joined = addrs.slice(0, 3).map(label).join(', ');
  const seed = addrs.join('|') || String(safe.length);
  const h = _hashStr32(seed);

  const totalSbt = safe.reduce((acc, u) => acc + (Array.isArray(u?.sbts) ? u.sbts.length : 0), 0);
  const totalQuestions = safe.reduce((acc, u) => acc + (Array.isArray(u?.questions) ? u.questions.length : 0), 0);
  const totalSurveys = safe.reduce((acc, u) => acc + (Array.isArray(u?.surveys) ? u.surveys.length : 0), 0);

  const agreements = [
    `Compared ${safe.length} participant(s): ${joined || '(none)'}.`,
    `Observed signals (cache-derived): ${totalQuestions} question response(s), ${totalSurveys} survey response(s), ${totalSbt} SBT(s).`,
  ];

  const a = addrs[0] || '';
  const b = addrs[1] || '';
  const pick = (arr) => arr[h % arr.length];
  const disagreements = [
    pick([
      `Most distinct themes: ${label(a)} vs ${label(b)} differ on participation footprint (mock).`,
      `Most distinct themes: ${label(a)} vs ${label(b)} differ on voting certainty (mock).`,
      `Most distinct themes: ${label(a)} vs ${label(b)} differ on observed topic clusters (mock).`,
    ]),
    pick([
      `Next step: open drilldowns to see which statements drive the gap (mock).`,
      `Next step: check SBT overlap and stance clusters for a sharper split (mock).`,
      `Next step: review high-divergence prompts for explainers (mock).`,
    ]),
  ];

  return {
    agreements: agreements.filter(Boolean),
    disagreements: disagreements.filter(Boolean),
  };
};

const buildE2eMockClusterAnalysis = (clusterData) => {
  const idxRaw = clusterData?.clusterIndex ?? clusterData?.cluster ?? clusterData?.index ?? 0;
  const idx = Number(idxRaw);
  const clusterIndex = Number.isFinite(idx) ? idx : 0;
  const sizeRaw = clusterData?.clusterSize ?? clusterData?.size ?? 0;
  const size = Number(sizeRaw);
  const clusterSize = Number.isFinite(size) ? size : 0;

  const statements = Array.isArray(clusterData?.topStatements) ? clusterData.topStatements : [];
  const withPrompt = statements
    .filter((s) => s && typeof s === 'object' && typeof s.prompt === 'string' && s.prompt.trim())
    .slice()
    .sort((a, b) => Math.abs((b.differenceScore ?? 0) - 0) - Math.abs((a.differenceScore ?? 0) - 0));

  const collapseSpace = (text) => String(text || '').replace(/\s+/g, ' ').trim();
  const truncate = (text, max = 110) => {
    const clean = collapseSpace(text);
    if (clean.length <= max) return clean;
    return `${clean.slice(0, Math.max(0, max - 3))}...`;
  };

  const top = withPrompt[0] || null;
  const topPrompt = top ? truncate(top.prompt, 120) : '';
  const topDelta = top && Number.isFinite(Number(top.differenceScore)) ? Number(top.differenceScore) : null;
  const deltaText = topDelta == null ? '' : ` (Δ=${topDelta.toFixed(2)})`;

  const namePrefix = clusterSize >= 12 ? 'Large' : clusterSize >= 6 ? 'Mid' : clusterSize >= 1 ? 'Small' : 'Empty';
  const name = `${namePrefix} Group ${clusterIndex}`;

  const short = topPrompt
    ? `Top differentiator: "${topPrompt}"${deltaText}.`
    : (clusterSize ? `Cluster ${clusterIndex} has ${clusterSize} participant(s).` : `Cluster ${clusterIndex} has no participants.`);

  const otherPrompts = withPrompt.slice(1, 4).map((s) => `"${truncate(s.prompt, 90)}"`).filter(Boolean);
  const longParts = [];
  if (clusterSize) longParts.push(`This cluster has ${clusterSize} participant(s).`);
  if (topPrompt) longParts.push(`It stands out most on "${topPrompt}".`);
  if (otherPrompts.length) longParts.push(`Other differentiators: ${otherPrompts.join('; ')}.`);
  if (!longParts.length) longParts.push('Not enough statement data to summarize this cluster.');

  return { name, short, long: longParts.join(' ') };
};






// === Client-side silence trimming feature flag and config (runtime-controlled from UI) ===
let __vadTrimEnabled = true;
let __vadTrimConfig = {};
export function setVadTrimEnabled(v) { __vadTrimEnabled = !!v; }
export function setVadTrimConfig(cfg) {
  if (cfg && typeof cfg === 'object') {
    __vadTrimConfig = { ...__vadTrimConfig, ...cfg };
  }
}

/* ======================================================================
 * Core fetch + AI helpers
 * ====================================================================== */

/**
 * Extract main content from HTML by removing scripts, styles, footers, etc.
 */
const extractMainContent = (htmlString) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  const elementsToRemove = ['script', 'style', 'iframe', 'nav', 'footer', 'header', 'aside'];
  elementsToRemove.forEach((tag) => {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  });

  const contentSelectors = [
    'main',
    'article',
    '.content',
    '#content',
    '.main-content',
    '#main-content',
    'body',
  ];

  for (const selector of contentSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      const text = element.textContent.replace(/\s+/g, ' ').trim();
      if (text.length > 100) {
        return text;
      }
    }
  }

  return doc.body.textContent.replace(/\s+/g, ' ').trim();
};

const resolveSessionAliasesOpt = (opts = {}) => resolveSessionConfigAliases({
  sessionSlug: opts?.sessionSlug,
  sessionConfig: opts?.sessionConfig,
});

const resolveSessionSlugOpt = (opts = {}) => resolveSessionAliasesOpt(opts).sessionSlug;

const resolveSessionConfigOpt = (opts = {}) => resolveSessionAliasesOpt(opts).sessionConfig;

const isChatReasoningModel = (modelRaw = '') => {
  const modelLeaf = String(modelRaw || '').trim().toLowerCase().split('/').pop();
  return /^o[13]/.test(modelLeaf);
};

const usesOpenAiResponsesApi = (providerRaw = '', modelRaw = '') => {
  const provider = String(providerRaw || '').trim().toLowerCase();
  const modelLeaf = String(modelRaw || '').trim().toLowerCase().split('/').pop();
  return provider === 'openai' && /^gpt-5/.test(modelLeaf);
};

const inferAiTaskType = (prompt = '', opts = {}) => {
  const explicit = String(opts?.taskType || '').trim().toLowerCase();
  if (explicit) return explicit;

  const promptText = String(prompt || '');
  // Older question-generation flows still call `callAI` directly, so fall back
  // to the seed-generation prompt signature when no explicit task type is passed.
  if (
    /numberOfSeedStatementsOrPrompts:/i.test(promptText) &&
    /"surveyTitle"\s*:/i.test(promptText)
  ) {
    return 'generate';
  }
  return null;
};

const pickAiRequestOpts = (input = {}) => {
  const src = (input && typeof input === 'object') ? input : {};
  const out = {};
  const copy = (key) => {
    if (Object.prototype.hasOwnProperty.call(src, key) && src[key] !== undefined) {
      out[key] = src[key];
    }
  };
  [
    'sessionSlug',
    'sessionConfig',
    'context',
    'workerUrl',
    'preferLocal',
    'provider',
    'model',
    'apiKey',
    'rpcUrl',
    'max_tokens',
    'maxTokens',
    'max_completion_tokens',
    'max_output_tokens',
    'response_format',
    'temperature',
    'endpoint',
    'reasoning_effort',
    'reasoningEffort',
    'taskType',
    'messages',
  ].forEach(copy);
  return out;
};

/**
 * Call AI via the Cloudflare Worker AI proxy using resolved settings.
 * The worker must support:
 *   POST { action:'ai', provider, model, temperature?, max_tokens?, messages:[{role, content}] }
 * And respond with: { completion: "<text>" }
 */
export const callAI = async (prompt, opts = {}) => {
  try {
    const thinkingRequested = !!opts.thinking;
    const sessionSlug = resolveSessionSlugOpt(opts);
    const sessionConfig = resolveSessionConfigOpt(opts);
    const ai = await getEffectiveAiConfig({
      sessionSlug,
      preferLocal: opts.preferLocal,
      provider: opts.provider,
      model: opts.model,
      thinking: thinkingRequested,
      context: opts.context,
    });
    const taskType = inferAiTaskType(prompt, opts);

    const thinking = thinkingRequested && ai.provider === 'anthropic';

    const messages = Array.isArray(opts.messages)
      ? opts.messages
      : [{ role: 'user', content: prompt }];
    const usesResponsesApi = usesOpenAiResponsesApi(ai.provider, ai.model);
    const usesCompletionTokens = !usesResponsesApi && isChatReasoningModel(ai.model);

    const maxTokens =
      opts.max_tokens ??
      opts.maxTokens ??
      (ai.provider === 'anthropic' ? 32568 : 16384);

    const requestBody = {
      action: 'ai',
      provider: ai.provider,
      model: ai.model,
      ...(usesResponsesApi ? { endpoint: 'responses' } : {}),
      ...(
        typeof (opts.max_output_tokens ?? (usesResponsesApi ? maxTokens : undefined)) === 'number'
          ? { max_output_tokens: opts.max_output_tokens ?? maxTokens }
          : {}
      ),
      ...(
        typeof (opts.max_completion_tokens ?? (usesCompletionTokens ? maxTokens : undefined)) === 'number'
          ? { max_completion_tokens: opts.max_completion_tokens ?? maxTokens }
          : {}
      ),
      ...(
        !usesResponsesApi && !usesCompletionTokens && typeof maxTokens === 'number'
          ? { max_tokens: maxTokens }
          : {}
      ),
      ...(opts.response_format ? { response_format: opts.response_format } : {}),
      ...(
        !usesResponsesApi && !usesCompletionTokens
          ? (typeof opts.temperature === 'number' ? { temperature: opts.temperature } : { temperature: 0.7 })
          : {}
      ),
      messages,
      ...(thinking ? { thinking: true } : {}),
    };
    const taskOverride = taskType ? ai.taskReasoningEffort?.[taskType] : null;
    const reasoningEffort =
      opts.reasoning_effort ||
      opts.reasoningEffort ||
      taskOverride ||
      ai.reasoning_effort ||
      ai.reasoningEffort ||
      'medium';
    const modelLeaf = (ai.model || '').toLowerCase().split('/').pop();
    if (modelLeaf && /^(gpt-5|o[13])/.test(modelLeaf)) {
      requestBody.reasoning_effort = reasoningEffort;
    }

    const useLocalOverride = ai.apiKeySource === 'local';
    if (useLocalOverride && ai.apiKey) {
      requestBody.apiKey = ai.apiKey;
    }
    if (ai.provider === 'custom') {
      if (ai.customFunctionsParsed) requestBody.functions = ai.customFunctionsParsed;
      else if (ai.customFunctions) requestBody.functions = ai.customFunctions;
      if (useLocalOverride && ai.customRpcUrl) requestBody.rpcUrl = ai.customRpcUrl;
    }
    const shouldUseAnonymousFirst = !(
      ai.provider === 'custom' &&
      useLocalOverride &&
      !!String(ai.apiKey || '').trim() &&
      !String(ai.customRpcUrl || '').trim()
    );

    const corsWorkerUrl = await getCorsProxyUrlOrThrow({
      sessionSlug,
      sessionConfig,
      context: opts.context,
      allowDemoFallback: defaultStrictAllowDemoFallback(),
    });
    const endpoint = corsWorkerUrl.endsWith('/ai')
      ? corsWorkerUrl
      : `${corsWorkerUrl.replace(/\/+$/, '')}/ai`;
    const baseUrl = corsWorkerUrl
      .replace(/\/+$/, '')
      .replace(/\/ai$/i, '');
    const sessionSelection = (
      opts && typeof opts.sessionSelection === 'object'
        ? opts.sessionSelection
        : null
    );
    aiLog.log('[aiClient] worker route selected', {
      sessionSlug: String(sessionSlug || ''),
      workerUrl: baseUrl,
      gateStatus: String(sessionSelection?.gateStatus || ''),
      reason: String(sessionSelection?.reason || ''),
    });
    aiLog.log('[aiClient] AI request params', {
      provider: ai.provider,
      model: ai.model,
      endpoint: usesResponsesApi ? 'responses' : 'chat_completions',
      tokenBudgetKey: usesResponsesApi ? 'max_output_tokens' : (usesCompletionTokens ? 'max_completion_tokens' : 'max_tokens'),
      tokenBudgetValue: maxTokens,
      messageCount: messages.length,
      firstMessageLength: messages[0]?.content?.length || 0,
    });
    const gateStatus = String(sessionSelection?.gateStatus ?? '').trim().toLowerCase();
    // For open-gate sessions, skip auth fallback when gate data is unavailable.
    // Auth retries still depend on the same on-chain gate RPC resolution.
    const fallbackOnGateUnavailable = gateStatus !== 'no-gate';
    const response = await fetchWorkerWithAuth(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }, {
      sessionSlug,
      context: opts.context,
      workerUrl: baseUrl,
      preferAnonymous: shouldUseAnonymousFirst,
      fallbackOnGateUnavailable,
      allowDemoFallback: defaultStrictAllowDemoFallback(),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || 'AI request failed');
    }

    if (data?.completion) return data.completion;
    if (data?.content && Array.isArray(data.content) && data.content[0]?.text) {
      return data.content[0].text;
    }
    throw new Error('Unexpected AI response format');
  } catch (error) {
    aiLog.error('Error calling AI via Worker:', error);
    throw error;
  }
};

/**
 * In-process queue wrapper for AI calls (concurrency = 1) with small
 * exponential backoff + jitter to soften transient 429/overload errors.
 *
 * Attempts: up to 3 (initial + 2 retries).
 */
let __aiQueue = Promise.resolve();

export const callAIQueued = (prompt, opts = {}) => {
  const run = async () => {
    let attempt = 0;
    while (attempt < 3) {
      try {
        return await callAI(prompt, opts);
      } catch (err) {
        const msg = String(err?.message || '');
        const isTransient = /rate\s*limit|concurrent|overload|overloaded|busy|temporarily|try\s*again|429/i.test(
          msg,
        );
        if (!isTransient || attempt >= 2) {
          throw err;
        }
        const delay = 500 * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
        await new Promise((r) => setTimeout(r, delay));
        attempt += 1;
      }
    }
  };

  __aiQueue = __aiQueue.then(run, run);
  return __aiQueue;
};

/**
 * Attempt to fetch HTML content from a URL directly; if it fails or is blocked,
 * fallback to the worker. Then parse the HTML to extract text.
 */
export const fetchContentFromURL = async (url, opts = {}) => {
  try {
    const validatedUrl = new URL(url);
    if (!validatedUrl.protocol.match(/^https?:$/)) {
      throw new Error('URL must start with http:// or https://');
    }

    // Try direct fetch first
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
      // Fallback to worker below
    }

    // Fallback to Worker proxy
    const sessionSlug = resolveSessionSlugOpt(opts);
    const sessionConfig = resolveSessionConfigOpt(opts);
    const corsWorkerUrl = await getCorsProxyUrlOrThrow({
      sessionSlug,
      sessionConfig,
      context: opts.context,
      allowDemoFallback: defaultStrictAllowDemoFallback(),
    });
    const baseUrl = corsWorkerUrl.replace(/\/+$/, '');
    const workerResponse = await fetchWorkerWithAuth(corsWorkerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: validatedUrl.href, action: 'fetch_url' }),
    }, {
      sessionSlug,
      context: opts.context,
      workerUrl: baseUrl,
      allowDemoFallback: defaultStrictAllowDemoFallback(),
    });

    const data = await workerResponse.json().catch(() => ({}));
    if (!workerResponse.ok) {
      throw new Error(data?.error || 'Failed to fetch URL content');
    }
    if (!data.content) throw new Error('No content received from URL');

    // Clean up HTML if needed
    if (typeof data.content === 'string' && data.content.includes('<')) {
      return extractMainContent(data.content);
    }
    return data.content;
  } catch (error) {
    aiLog.error('Error fetching URL content:', error);
    throw new Error(`URL Error: ${error.message}`);
  }
};

/**
 * Reads a File object as text.
 * - Text-like types (.txt, .md, .csv) are read directly.
 * - Binary types (.pdf, .ppt) return a placeholder to prevent hallucination on raw bytes.
 */
function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const name = file.name.toLowerCase();
    // Basic text-like extensions
    const isText =
      name.endsWith('.txt') ||
      name.endsWith('.md') ||
      name.endsWith('.csv') ||
      name.endsWith('.json') ||
      name.endsWith('.xml') ||
      file.type.startsWith('text/');

    // Known binaries that we explicitly don't parse client-side yet
    const isBinary =
      name.endsWith('.pdf') ||
      name.endsWith('.ppt') ||
      name.endsWith('.pptx') ||
      name.endsWith('.doc') ||
      name.endsWith('.docx') ||
      name.endsWith('.xls') ||
      name.endsWith('.xlsx');

    if (isBinary) {
      resolve(`[Binary content parsing not currently supported client-side for file: ${file.name}]`);
      return;
    }

    if (!isText) {
      // Fallback: try reading as text, but might be garbage if unknown binary.
      // Given constraints, we attempt reading.
    }

    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsText(file);
  });
}

/**
 * processAdditionalSources(sources)
 * Iterates through the list of additional sources (files/URLs),
 * fetches or reads their content, and returns a single concatenated string
 * with delimiters.
 *
 * @param {Array<{type: 'url'|'file', value: string|File, name: string}>} sources
 * @returns {Promise<string>}
 */
export async function processAdditionalSources(sources, opts = {}) {
  if (!sources || sources.length === 0) return '';

  const results = await Promise.all(
    sources.map(async (src) => {
      let content = '';
      try {
        if (src.type === 'url') {
          content = await fetchContentFromURL(src.value, opts);
        } else if (src.type === 'file') {
          content = await readFileContent(src.value);
        } else if (src.type === 'photo') {
          throw new Error('Photo sources must be analyzed before text extraction.');
        }
      } catch (err) {
        content = `[Error reading source '${src.name}': ${err.message}]`;
      }
      return `\n\n--- Source: ${src.name} ---\n\n${content}`;
    })
  );

  return results.join('');
}

/* ======================================================================
 * Lightweight utilities for other product areas (unchanged behavior)
 * ====================================================================== */

export const analyzeSurveyResponses = async (responses, opts = {}) => {
  const prompt = `Analyze the following survey responses and provide a summary of the key findings: ${JSON.stringify(
    responses,
  )}`;
  try {
    const analysis = await callAI(prompt, pickAiRequestOpts(opts));
    return analysis;
  } catch (error) {
    aiLog.error('Error analyzing survey responses:', error);
    throw error;
  }
};

/**
 * rankQuestionsAI
 * Given a user query string, a list of question objects, and an integer topX,
 * calls the AI to produce a JSON object with a "selectedQuestionIDs" array in
 * descending order of relevance.
 */
export async function rankQuestionsAI(userQuery, questionList, topX = 10, opts = {}) {
  const throwOnError = !!opts?.throwOnError;
  try {
    const candidates = (Array.isArray(questionList) ? questionList : [])
      .map((q) => ({
        id: String(q?.id || '').trim(),
        prompt: String(q?.prompt || ''),
      }))
      .filter((q) => q.id.trim());
    const questionListJson = JSON.stringify(candidates, null, 2);

    const finalPrompt = rankQuestionsPrompt
      .replace('{{userQueryJson}}', JSON.stringify(String(userQuery || '')))
      .replace('{{questionListJson}}', questionListJson)
      .replace('{{topX}}', String(topX));

    const rawOutput = await callAI(finalPrompt.trim(), {
      ...pickAiRequestOpts(opts),
      taskType: opts?.taskType || 'rank',
    });

    let parsed;
    try {
      parsed = JSON.parse(rawOutput.trim());
    } catch (_err) {
      const match = rawOutput.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (_fallbackErr) {
          parsed = null;
        }
      }
    }

    if (!parsed || !Array.isArray(parsed.selectedQuestionIDs)) {
      if (throwOnError) {
        throw new Error('AI ranking response missing selectedQuestionIDs array');
      }
      return [];
    }

    const allowedIds = new Set(candidates.map((q) => q.id));
    const seenIds = new Set();
    const ids = parsed.selectedQuestionIDs
      .filter((id) => typeof id === 'string' && id.trim() !== '')
      .map((id) => id.trim())
      .filter((id) => {
        if (!allowedIds.has(id) || seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      });

    return ids.length > topX ? ids.slice(0, topX) : ids;
  } catch (error) {
    aiLog.error('Error in rankQuestionsAI:', error);
    if (throwOnError) throw error;
    return [];
  }
}

/**
 * Minimal rewriting of user text to remove filler words and add punctuation.
 * Uses the imported aiRewritePrompt and callAI to do minimal edits.
 */
export async function requestAiRewrite(originalText, opts = {}) {
  try {
    const finalPrompt = aiRewritePrompt.replace('<USER_TEXT>', originalText);
    const cleaned = await callAI(finalPrompt, {
      ...(opts && typeof opts === 'object' ? opts : {}),
      taskType: opts?.taskType || 'rewrite',
    });
    return cleaned.trim();
  } catch (error) {
    aiLog.error('requestAiRewrite error:', error);
    return originalText;
  }
}

/**
 * Audio transcription via Worker -> OpenAI Whisper.
 * Worker must expose POST /transcribe and return { text: "<transcript>" }.
 * Accepts a File or Blob. Preserves original filename/type when possible.
 * If the file uses an odd/unknown container, we try a minimal client-side
 * normalization to mono WAV (~16 kHz) using Web Audio.
 * Files above the upstream 25 MB limit are chunked client-side before upload.
 *
 * Return contract unchanged: resolves to string (may be empty) or throws on error.
 */
export async function transcribeAudio(audioBlobOrFile, opts = {}) {
  if (!audioBlobOrFile) throw new Error('No audio provided');
  const maxUploadBytes = Number.isFinite(opts?.maxUploadBytes)
    ? Math.max(1024, Math.floor(Number(opts.maxUploadBytes)))
    : TRANSCRIBE_MAX_UPLOAD_BYTES;

  // Helper: coerce to a File when available to preserve filename
  const toFileLike = (blob, nameFallback) => {
    try {
      return new File([blob], nameFallback || 'audio.wav', { type: blob.type || 'audio/wav' });
    } catch (error) {
      aiLog.warn('Audio File construction failed; falling back to Blob:', error);
      // Older browsers: attach name on Blob for worker-side filename hints
      blob.name = nameFallback || 'audio.wav';
      return blob;
    }
  };

  const originalName = String(audioBlobOrFile.name || 'audio').trim();
  const lowerName = originalName.toLowerCase();
  const ext = lowerName.includes('.') ? lowerName.split('.').pop() : '';
  const mime = String(audioBlobOrFile.type || '').toLowerCase();

  // Phone-format coverage
  const allowedExt = new Set(['m4a', 'mp3', 'aac', 'wav', 'webm', 'mp4', '3gp', 'ogg', 'opus']);
  const looksSupported = allowedExt.has(ext) || /^audio\/|^video\//i.test(mime);

  const isTooBig = typeof audioBlobOrFile.size === 'number' && audioBlobOrFile.size > maxUploadBytes;
  const needsNormalization = !looksSupported;

  let uploadFile = audioBlobOrFile;

  if (needsNormalization) {
    try {
      const normalized = await normalizeAudioToWav(audioBlobOrFile, TRANSCRIBE_WAV_TARGET_HZ);
      if (normalized) uploadFile = normalized;
    } catch (error) {
      aiLog.warn('Audio normalization failed; using original upload:', error);
      // Soft-fail: keep original; server may still accept it.
    }
  }

  // Optional client-side VAD-based silence trimming (runtime-configured; no hardcoded tunables here)
  try {
    const sizeThreshold =
      (__vadTrimConfig && typeof __vadTrimConfig.sizeThresholdBytes === 'number')
        ? __vadTrimConfig.sizeThresholdBytes
        : null;
    if (__vadTrimEnabled && sizeThreshold != null && (uploadFile?.size || 0) > sizeThreshold) {
      const trimmed = await extractSpeechAudio(uploadFile, __vadTrimConfig || {});
      if (trimmed && trimmed.size > 0 && trimmed.size < (uploadFile.size || Infinity)) {
        uploadFile = trimmed; // replace only if smaller
      }
    }
  } catch (error) {
    aiLog.warn('Speech trimming failed; using original upload:', error);
    // Trimming failed — silent fallback to original
  }

  const transport = await resolveTranscriptionTransport(opts);

  // Regression guard: OpenAI's /transcribe endpoint accepts at most 25 MB per file.
  // Oversize uploads must be chunked client-side or they fail after multipart wrapping.
  if ((uploadFile?.size || 0) > maxUploadBytes || isTooBig) {
    const chunkedUploads = await splitAudioBlobToWavChunks(uploadFile, {
      maxUploadBytes,
      targetHz: TRANSCRIBE_WAV_TARGET_HZ,
    });
    if (!chunkedUploads.length) {
      throw new Error('Audio exceeds the /transcribe 25 MB upload limit and could not be chunked client-side.');
    }

    let merged = '';
    for (const chunk of chunkedUploads) {
      const chunkText = await uploadAudioForTranscription(chunk, transport, {
        signal: opts?.signal,
      });
      merged = mergeTranscriptText(merged, chunkText);
    }
    return merged.trim();
  }

  const fname =
    uploadFile.name ||
    (looksSupported ? `audio.${ext || 'wav'}` : 'audio.wav');
  return uploadAudioForTranscription(uploadFile instanceof Blob ? toFileLike(uploadFile, fname) : uploadFile, transport, {
    fileName: fname,
    signal: opts?.signal,
  });
}

const downsampleMonoFloat32 = (input, srcRate, targetHz) => {
  if (!(input instanceof Float32Array)) return new Float32Array();
  if (!Number.isFinite(srcRate) || !Number.isFinite(targetHz) || srcRate <= 0 || targetHz <= 0) {
    return input;
  }
  if (srcRate === targetHz) return input;

  const ratio = srcRate / targetHz;
  const newLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const pos = i * ratio;
    const left = Math.floor(pos);
    const right = Math.min(left + 1, input.length - 1);
    const frac = pos - left;
    out[i] = input[left] * (1 - frac) + input[right] * frac;
  }
  return out;
};

const float32ToInt16 = (input) => {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return out;
};

const writeAsciiToDataView = (view, offset, text) => {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
};

const buildMonoWavBlob = (pcmI16, sampleRate) => {
  const dataSize = pcmI16.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAsciiToDataView(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAsciiToDataView(view, 8, 'WAVE');
  writeAsciiToDataView(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAsciiToDataView(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < pcmI16.length; i++) {
    view.setInt16(offset, pcmI16[i], true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

const createNamedAudioFile = (blob, name = 'audio.wav', type = 'audio/wav') => {
  try {
    return new File([blob], name, { type });
  } catch {
    blob.name = name;
    return blob;
  }
};

const readBlobAsArrayBuffer = async (blob) => {
  if (blob && typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  if (typeof FileReader === 'undefined') {
    throw new Error('Blob.arrayBuffer is not supported in this environment');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Failed to read audio blob'));
    reader.readAsArrayBuffer(blob);
  });
};

const mixAudioBufferToMono = (audioBuf) => {
  const channelCount = Math.max(1, audioBuf?.numberOfChannels || 1);
  const frameCount = Math.max(0, audioBuf?.length || 0);
  const mono = new Float32Array(frameCount);
  for (let channelIndex = 0; channelIndex < channelCount; channelIndex++) {
    const channelData = audioBuf.getChannelData(channelIndex);
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      mono[frameIndex] += channelData[frameIndex] / channelCount;
    }
  }
  return mono;
};

const decodeAudioToMonoFloat32 = async (inputBlob, label = 'Audio decode failed') => {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;

  const arrayBuf = await readBlobAsArrayBuffer(inputBlob);
  const ctx = new AC();
  try {
    const audioBuf = await new Promise((res, rej) => {
      const r = ctx.decodeAudioData(arrayBuf, res, rej);
      if (r && typeof r.then === 'function') r.then(res).catch(rej);
    });
    return {
      mono: mixAudioBufferToMono(audioBuf),
      sampleRate: audioBuf.sampleRate || 44100,
    };
  } catch (error) {
    aiLog.warn(label, error);
    return null;
  } finally {
    try { await ctx.close(); } catch {}
  }
};

const mergeTranscriptText = (prev, next) => {
  const a = String(prev || '').trim();
  const b = String(next || '').trim();
  if (!a) return b;
  if (!b) return a;

  const tokenize = (s) => s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const A = tokenize(a);
  const B = tokenize(b);
  let bestK = 0;
  const maxK = Math.min(A.length, B.length);
  for (let k = maxK; k >= 1; k--) {
    let ok = true;
    for (let i = 0; i < k; i++) {
      if (A[A.length - k + i] !== B[i]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      bestK = k;
      break;
    }
  }

  if (bestK > 0) {
    const overlappedChars = B.slice(0, bestK).join(' ').length;
    if (overlappedChars < 8) bestK = 0;
  }

  let bTrimmed = b;
  if (bestK > 0) {
    const re = new RegExp(`^(([\\s\\W]*\\w+[\\s\\W]*){${bestK}})`);
    bTrimmed = b.replace(re, '');
  }

  return `${a}${a && bTrimmed && !/\s$/.test(a) ? ' ' : ''}${bTrimmed}`.trim();
};

const splitAudioBlobToWavChunks = async (
  inputBlob,
  {
    maxUploadBytes = TRANSCRIBE_MAX_UPLOAD_BYTES,
    targetHz = TRANSCRIBE_WAV_TARGET_HZ,
    overlapMs = TRANSCRIBE_CHUNK_OVERLAP_MS,
  } = {},
) => {
  const decoded = await decodeAudioToMonoFloat32(inputBlob, 'Audio decode failed during chunked transcription:');
  if (!decoded) return [];

  const downsampled = downsampleMonoFloat32(decoded.mono, decoded.sampleRate, targetHz);
  if (!(downsampled instanceof Float32Array) || downsampled.length === 0) return [];

  const safeMaxBytes = Math.max(1024, Math.floor(maxUploadBytes) - TRANSCRIBE_CHUNK_HEADROOM_BYTES);
  const maxSamplesPerChunk = Math.max(1, Math.floor((safeMaxBytes - 44) / 2));
  const overlapSamples = Math.max(0, Math.min(
    Math.floor((overlapMs / 1000) * targetHz),
    Math.floor(maxSamplesPerChunk / 8),
  ));
  const chunks = [];
  let start = 0;
  let index = 0;

  while (start < downsampled.length) {
    const end = Math.min(downsampled.length, start + maxSamplesPerChunk);
    const slice = downsampled.subarray(start, end);
    const wavBlob = buildMonoWavBlob(float32ToInt16(slice), targetHz);
    const fname = `audio-part-${String(index + 1).padStart(4, '0')}.wav`;
    chunks.push(createNamedAudioFile(wavBlob, fname, 'audio/wav'));
    if (end >= downsampled.length) break;
    start = Math.max(end - overlapSamples, start + 1);
    index += 1;
  }

  return chunks;
};

const resolveTranscriptionTransport = async (opts = {}) => {
  const sessionSlug = resolveSessionSlugOpt(opts);
  const sessionConfig = resolveSessionConfigOpt(opts);
  const transcriptionCfg = await getEffectiveTranscriptionConfig({
    sessionSlug,
    preferLocal: opts.preferLocal,
    provider: opts.provider,
    model: opts.model,
    apiKey: opts.apiKey,
    rpcUrl: opts.rpcUrl,
    context: opts.context,
  });

  if (transcriptionCfg.provider === 'local') {
    throw new Error('Local transcription is not configured in this build.');
  }

  const explicitWorkerUrl = normalizeBaseUrl(opts?.workerUrl || '');
  const corsWorkerUrl = explicitWorkerUrl || await getCorsProxyUrlOrThrow({
    sessionSlug,
    sessionConfig,
    context: opts.context,
    allowDemoFallback: defaultStrictAllowDemoFallback(),
  });
  const endpoint = corsWorkerUrl.endsWith('/transcribe')
    ? corsWorkerUrl
    : `${corsWorkerUrl.replace(/\/+$/, '')}/transcribe`;
  const baseUrl = corsWorkerUrl
    .replace(/\/+$/, '')
    .replace(/\/transcribe$/i, '');

  return {
    endpoint,
    baseUrl,
    sessionSlug,
    sessionConfig,
    context: opts?.context,
    transcriptionCfg,
  };
};

const uploadAudioForTranscription = async (
  audioFileOrBlob,
  transport,
  { fileName = '', signal } = {},
) => {
  const fileLike = audioFileOrBlob instanceof Blob
    ? createNamedAudioFile(
        audioFileOrBlob,
        fileName || audioFileOrBlob.name || 'audio.wav',
        audioFileOrBlob.type || 'audio/wav',
      )
    : audioFileOrBlob;
  const resolvedName = fileName || fileLike?.name || 'audio.wav';
  const form = new FormData();
  form.append('file', fileLike, resolvedName);
  if (transport?.transcriptionCfg?.provider) form.append('provider', transport.transcriptionCfg.provider);
  if (transport?.transcriptionCfg?.model) form.append('model', transport.transcriptionCfg.model);
  if (transport?.transcriptionCfg?.apiKey) form.append('apiKey', transport.transcriptionCfg.apiKey);
  if (transport?.transcriptionCfg?.rpcUrl) form.append('rpcUrl', transport.transcriptionCfg.rpcUrl);

  const resp = await fetchWorkerWithAuth(
    transport.endpoint,
    { method: 'POST', body: form, ...(signal ? { signal } : {}) },
    {
      sessionSlug: transport.sessionSlug,
      sessionConfig: transport.sessionConfig,
      context: transport.context,
      workerUrl: transport.baseUrl,
      preferAnonymous: true,
      fallbackOnGateUnavailable: true,
      allowDemoFallback: defaultStrictAllowDemoFallback(),
    },
  );
  let data = {};
  try {
    data = await resp.json();
  } catch (error) {
    aiLog.warn('Transcription response JSON parse failed:', error);
    data = {};
  }

  if (!resp.ok) {
    const msg =
      (typeof data?.error === 'string' && data.error) ||
      data?.error?.message ||
      data?.message ||
      `Transcription failed (${resp.status}).`;
    throw new Error(msg);
  }

  return typeof data.text === 'string' ? data.text : '';
};

/**
 * Minimal client-side normalization to mono WAV using Web Audio.
 * Returns a File when possible, else a Blob (with .name set).
 */
async function normalizeAudioToWav(inputBlob, targetHz = 16000) {
  const decoded = await decodeAudioToMonoFloat32(inputBlob, 'Audio decode failed during WAV normalization:');
  if (!decoded) return null;
  const monoF32 = downsampleMonoFloat32(decoded.mono, decoded.sampleRate, targetHz);
  const pcmI16 = float32ToInt16(monoF32);

  const wavBlob = buildMonoWavBlob(pcmI16, targetHz);
  try {
    return new File([wavBlob], 'normalized.wav', { type: 'audio/wav' });
  } catch {
    wavBlob.name = 'normalized.wav';
    return wavBlob;
  }
}

/* =========================
 * Helpers for AI JSON parsing / fallbacks
 * ========================= */

/**
 * Try to parse JSON from a string that may include ```json code fences
 * or extra text around the JSON object.
 */
function parseJsonFlexible(text) {
  if (!text || typeof text !== 'string') return null;
  let body = text.trim();

  const fenced = body.match(/```json\s*([\s\S]*?)```/i) || body.match(/```\s*([\s\S]*?)```/);
  if (fenced && fenced[1]) {
    body = fenced[1].trim();
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    aiLog.warn('Flexible JSON parse failed on primary body:', error);
    const firstBrace = body.indexOf('{');
    const lastBrace = body.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(body.slice(firstBrace, lastBrace + 1));
      } catch (innerError) {
        aiLog.warn('Flexible JSON parse failed on extracted body:', innerError);
        return null;
      }
    }
    return null;
  }
}

/**
 * Fallback name when the model doesn't provide one.
 */
function deriveFallbackClusterName(payload) {
  const size = payload?.clusterSize ?? 0;
  return size >= 12 ? 'Large Cohort' : size >= 6 ? 'Small Cohort' : 'Tiny Cohort';
}

function buildHeuristicClusterSummary(payload) {
  const statements = Array.isArray(payload?.topStatements) ? payload.topStatements : [];
  const withPrompt = statements.filter((s) => s && typeof s.prompt === 'string' && s.prompt.trim());

  if (!withPrompt.length) {
    return {
      short: 'Summary unavailable.',
      long: 'Not enough statement data to summarize this cluster.',
    };
  }

  const collapseSpace = (text) => text.replace(/\s+/g, ' ').trim();
  const truncate = (text, max = 90) => {
    const clean = collapseSpace(text);
    if (clean.length <= max) return clean;
    return `${clean.slice(0, max - 3)}...`;
  };
  const describe = (s) => truncate(s.prompt || '');

  const positive = withPrompt.filter((s) => (s.differenceScore ?? 0) > 0).slice(0, 1);
  const negative = withPrompt.filter((s) => (s.differenceScore ?? 0) < 0).slice(0, 1);

  let short = '';
  if (positive.length && negative.length) {
    short = `More agreement with "${describe(positive[0])}" and more disagreement with "${describe(negative[0])}".`;
  } else if (positive.length) {
    short = `Stronger agreement with "${describe(positive[0])}" compared to the overall group.`;
  } else if (negative.length) {
    short = `More disagreement with "${describe(negative[0])}" compared to the overall group.`;
  } else {
    short = `Aligned around "${describe(withPrompt[0])}".`;
  }

  const highlights = withPrompt.slice(0, 3).map((s) => `"${describe(s)}"`).join('; ');
  const size = typeof payload?.clusterSize === 'number'
    ? `This cluster has ${payload.clusterSize} participants.`
    : 'This cluster has a distinct voting pattern.';
  const long = `${size} The largest opinion gaps appear on ${highlights}.`;
  return { short, long };
}

/**
 * Analyze a single cluster's opinions using the new prompt with naming support.
 * Expects `clusterData` to include:
 *   - clusterIndex (number)
 *   - clusterSize (number)
 *   - totalClusters (number)
 *   - topStatements: Array<{ label, questionIndex, prompt, cluster: {agree,disagree,unsure,responded,agreeRate,disagreeRate,unsureRate}, overall: {...}, differenceScore }>
 *
 * Returns: { name: string, short: string, long: string }
 * Backward compatible with older prompts that only returned { short, long }.
 */
export async function analyzeClusterOpinions(clusterData, allClustersData = null, opts = {}) {
  try {
    if (isE2eAiMockEnabled()) {
      return buildE2eMockClusterAnalysis(clusterData);
    }

    // Build the user-facing prompt and prepend a simple system instruction inline.
    // (Our Worker call sends a single 'user' message; this keeps behavior minimal-change.)
    const userPrompt = buildClusterAnalysisPrompt(clusterData, allClustersData);
    const finalPrompt = `${CLUSTER_ANALYSIS_SYSTEM_PROMPT}\n\n${userPrompt}`;

    let name = null;
    let short = '';
    let long = '';
    let raw = '';
    const aiCallOpts = opts && typeof opts === 'object'
      ? { ...opts, taskType: opts.taskType || 'summarize' }
      : { taskType: 'summarize' };

    try {
      raw = await callAIQueued(finalPrompt, { ...aiCallOpts, thinking: true });
    } catch (err) {
      try {
        raw = await callAIQueued(finalPrompt, { ...aiCallOpts, thinking: false });
      } catch (fallbackErr) {
        const message = fallbackErr?.message || err?.message || 'AI request failed';
        throw new Error(message);
      }
    }

    const parsed = parseJsonFlexible(raw);
    if (parsed && typeof parsed === 'object') {
      short = String(parsed.short || '').trim() || '';
      long = String(parsed.long || '').trim() || '';
      name = parsed.name ? String(parsed.name).trim() : null;
    } else {
      // Fallback for older/freeform responses
      long = String(raw || '').trim();
      short = long.split('\n').shift().slice(0, 200);
    }

    if (!short || !long) {
      const fallback = buildHeuristicClusterSummary(clusterData);
      short = short || fallback.short;
      long = long || fallback.long;
    }

    if (!name) {
      name = deriveFallbackClusterName(clusterData);
    }

    return { name, short, long };
  } catch (err) {
    aiLog.error('analyzeClusterOpinions error:', err);
    const fallback = buildHeuristicClusterSummary(clusterData);
    return {
      name: deriveFallbackClusterName(clusterData),
      short: fallback.short,
      long: fallback.long,
    };
  }
}

/**
 * Analyze a single user's visible profile data (SBTs + answers).
 * Robust JSON parsing with safe fallbacks.
 *
 * @param {object} userData - { address, username?, sbts: [{name,address}], questions: [{id,type,prompt,answer}], surveys: [{surveyId,title,answeredCount,sample?}] }
 * @returns {Promise<{name:string, summary:string, details:string, historicalAlignment?:{figure:string, reasoning:string}}>}
 */
export async function analyzeUserOpinions(userData, opts = {}) {
  try {
    const { default: buildUserAnalysisPrompt } = await import('../../prompts/userAnalysisPrompt.js');
    const prompt = buildUserAnalysisPrompt(userData);
    const aiCallOpts = opts && typeof opts === 'object'
      ? { ...opts, taskType: opts.taskType || 'summarize' }
      : { taskType: 'summarize' };
    const raw = await callAIQueued(prompt, { ...aiCallOpts, thinking: true });

    let parsed = parseJsonFlexible(raw);
    if (!parsed || typeof parsed !== 'object') parsed = {};

    const name = String(parsed.name || '').trim() || 'Profile Summary';
    const summary =
      String(parsed.summary || '').trim() ||
      'Neutral overview of user affiliations and consistent answer themes.';
    const details =
      String(parsed.details || '').trim() ||
      'No additional details were derived from the provided data.';

    // Safely parse historicalAlignment
    const ha = parsed && typeof parsed.historicalAlignment === 'object' ? parsed.historicalAlignment : {};
    const historicalAlignment = {
      figure: String(ha?.figure || '').trim() || '',
      reasoning: String(ha?.reasoning || '').trim() || '',
    };

    return { name, summary, details, historicalAlignment };
  } catch (err) {
    // Let gate-unavailable errors propagate for session-level retry.
    if (/on-chain gate data unavailable/i.test(String(err?.message || ''))) {
      throw err;
    }
    aiLog.error('analyzeUserOpinions error:', err);
    return {
      name: 'Profile Summary',
      summary: 'We could not generate an AI summary at the moment.',
      details: 'Please try again later.',
      historicalAlignment: { figure: '', reasoning: '' },
    };
  }
}

/* ======================================================================
 * Compare Toolkit — AI calls only (no math here)
 * ====================================================================== */

/**
 * Plain-text drilldown explainer as a minimal fallback (≤ ~6 sentences).
 */
export async function drillDownComparisonPoint(users, pointText, type, opts = {}) {
  const safeUsers = Array.isArray(users) ? users : [];
  const safePoint = typeof pointText === 'string' ? pointText : '';
  const t = (typeof type === 'string' && type.toLowerCase().includes('dis')) ? 'disagreement' : 'agreement';
  const aiCallOpts = pickAiRequestOpts(opts);

  try {
    const drillPrompt =
`You are an impartial analyst expanding on a ${t} found in a multi-user comparison.
Focus ONLY on the evidence in USERS (JSON) below: overlaps/divergences in SBTs, similar/different answers (binary/rating/multichoice/freeform), optional "importance"/"additionalComment", and created content ("questionsCreated","surveysCreated","createdCounts").

Point to elaborate (${t}):
${JSON.stringify(safePoint)}

Instructions:
- Explain why this point arises, referencing specific signals in the provided data (e.g., shared SBT names, matched/different prompts & answers, recurring tags, authored content themes).
- Keep it neutral, factual, and privacy-preserving; do not infer identities or any PII.
- Do NOT use external knowledge; rely solely on USERS (JSON).
- Return ONLY plain text (no JSON/markdown), at most 6 sentences.

USERS (JSON):
${JSON.stringify(safeUsers, null, 2)}`;
    const raw = await callAIQueued(drillPrompt, { ...aiCallOpts, thinking: true });

    // Parse/sanitize to plain string
    let text = '';
    const parsed = parseJsonFlexible(String(raw || ''));
    if (parsed && typeof parsed === 'object') {
      const candidate =
        (typeof parsed.text === 'string' && parsed.text) ||
        (typeof parsed.explanation === 'string' && parsed.explanation) ||
        (typeof parsed.message === 'string' && parsed.message) ||
        (typeof parsed.output === 'string' && parsed.output) ||
        (typeof parsed.content === 'string' && parsed.content) ||
        '';
      if (candidate) text = candidate;
    }
    if (!text) {
      let s = String(raw || '');
      // Strip common code fences if present
      const fence = s.match(/```(?:json|md|markdown)?\s*([\s\S]*?)```/i);
      if (fence && fence[1]) s = fence[1];
      // Remove any stray HTML tags and surrounding quotes/backticks
      s = s.replace(/<[^>]+>/g, '').replace(/^[\s"'`]+|[\s"'`]+$/g, '');
      text = s;
    }

    text = String(text || '').trim();
    return text || 'No additional details available.';
  } catch (err) {
    aiLog.error('drillDownComparisonPoint error:', err);
    return 'Sorry—couldn’t expand that point right now.';
  }
}

/**
 * Hierarchical drill-down explanation (tree). AI-only; if invalid, falls back to a tiny tree
 * wrapping the plain-text explainer above.
 */
export async function drillDownComparisonTree(users, pointText, type, opts = {}) {
  const safeUsers = Array.isArray(users) ? users.slice(0, 10) : [];
  const t = (typeof type === 'string' && type.toLowerCase().includes('dis')) ? 'disagreement' : 'agreement';
  const aiCallOpts = pickAiRequestOpts(opts);

  try {
    const envelope = {
      task: 'drilldown',
      users: safeUsers,
      pointText: String(pointText || ''),
      type: t,
    };
    const prompt = buildCompareToolkitPrompt(envelope);
    const raw = await callAIQueued(prompt, { ...aiCallOpts, thinking: true });
    const parsed = parseJsonFlexible(raw);

    const ok = parsed && typeof parsed === 'object' && typeof parsed.title === 'string' && Array.isArray(parsed.nodes);
    if (ok) {
      // Micro-sanitize (depth/len clamps), preserving optional participants
      const sanitizeNode = (n, depth = 0) => {
        if (!n || typeof n !== 'object') return null;
        const label = String(n.label || '').slice(0, 240);
        const evidence = Array.isArray(n.evidence)
          ? n.evidence.slice(0, 4).map((s) => String(s || '').slice(0, 280))
          : [];

        // NEW: participants passthrough (optional, compact)
        let participants = undefined;
        if (Array.isArray(n.participants)) {
          participants = n.participants
            .slice(0, 10)
            .map((p) => {
              if (typeof p === 'string') {
                const a = String(p).toLowerCase();
                return a ? { address: a } : null;
              }
              if (p && typeof p === 'object') {
                const a = String(p.address || '').toLowerCase();
                const stance = p.stance != null ? String(p.stance).slice(0, 32) : undefined;
                return a ? { address: a, ...(stance ? { stance } : {}) } : null;
              }
              return null;
            })
            .filter(Boolean);
          if (participants.length === 0) participants = undefined;
        }

        const childrenIn = Array.isArray(n.children) ? n.children : [];
        if (depth >= 3) return { label, evidence, ...(participants ? { participants } : {}), children: [] };
        const children = childrenIn.slice(0, 6).map((c) => sanitizeNode(c, depth + 1)).filter(Boolean);
        return { label, evidence, ...(participants ? { participants } : {}), children };
      };

      return {
        title: String(parsed.title || `Why this ${t} holds`).slice(0, 120),
        nodes: parsed.nodes.slice(0, 6).map((n) => sanitizeNode(n, 0)).filter(Boolean),
      };
    }

    // Fallback to plain-text summary wrapped as a tiny tree
    const text = await drillDownComparisonPoint(safeUsers, pointText, t, aiCallOpts);
    return { title: `Why this ${t} holds`, nodes: [{ label: 'Summary', evidence: [text], children: [] }] };
  } catch (err) {
    aiLog.error('drillDownComparisonTree error:', err);
    const text = await drillDownComparisonPoint(users, pointText, type, aiCallOpts);
    return { title: `Why this ${type || 'agreement'} holds`, nodes: [{ label: 'Summary', evidence: [text], children: [] }] };
  }
}

/**
 * Unified entry for LLM-powered comparison subtasks.
 * This function is **AI-only** and returns raw model outputs (parsed),
 * leaving deterministic fallbacks to higher-level orchestrators.
 *
 * @param {"compare"|"drilldown"|"axes"|"venn"} task
 * @param {{users:Array, pointText?:string, type?:"agreement"|"disagreement"}} payload
 * @returns {Promise<any>} Parsed JSON per task, or a plain string for drilldown fallback.
 */
export async function runCompareToolkit(task, payload = {}, opts = {}) {
  const t = String(task || '').toLowerCase();
  const safeUsers = Array.isArray(payload.users) ? payload.users.slice(0, 10) : [];
  const aiCallOpts = {
    ...pickAiRequestOpts(payload),
    ...pickAiRequestOpts(opts),
  };

  if (isE2eAiMockEnabled()) {
    if (t === 'compare') return buildE2eMockCompareBullets(safeUsers);
    if (t === 'drilldown') {
      const kind = payload.type === 'disagreement' ? 'disagreement' : 'agreement';
      const pointText = String(payload.pointText || '').trim();
      const evidence = safeUsers
        .map((u) => _shortAddr(u?.address))
        .filter(Boolean)
        .slice(0, 4);
      return {
        title: `Mock drilldown (${kind})`,
        nodes: [
          {
            label: pointText ? `Point: ${pointText.slice(0, 160)}` : 'Point',
            evidence,
            children: [],
          },
        ],
      };
    }
    return null;
  }

  const envelope = {
    task: (t === 'compare' || t === 'drilldown' || t === 'axes' || t === 'venn') ? t : 'compare',
    users: safeUsers,
    ...(t === 'drilldown'
      ? {
          pointText: String(payload.pointText || ''),
          type: payload.type === 'disagreement' ? 'disagreement' : 'agreement',
        }
      : {}),
  };

  try {
    const prompt = buildCompareToolkitPrompt(envelope);
    const raw = await callAIQueued(prompt, { ...aiCallOpts, thinking: true });
    const parsed = parseJsonFlexible(raw);

    if (t === 'drilldown') {
      if (parsed && typeof parsed === 'object' && typeof parsed.title === 'string' && Array.isArray(parsed.nodes)) {
        return parsed;
      }
      // Provide plain-text fallback (string)
      return await drillDownComparisonPoint(safeUsers, envelope.pointText, envelope.type, aiCallOpts);
    }

    // For compare/axes/venn: return parsed raw (may be null/invalid; caller handles fallbacks)
    return parsed || null;
  } catch (err) {
    aiLog.error('runCompareToolkit error:', err);
    if (t === 'drilldown') {
      return await drillDownComparisonPoint(safeUsers, envelope.pointText, envelope.type, aiCallOpts);
    }
    return null;
  }
}

/* ======================================================================
 * Single public entry: normalized bundle for Compare UI
 * ====================================================================== */

/**
 * getComparisonBundle(users, opts) → one normalized bundle for Compare UI.
 * - Kicks off LLM tasks and deterministic fallbacks in parallel.
 * - Prefers valid LLM outputs; else uses fallbacks from compareUsers.js.
 * - Always sanitizes compass; guarantees non-empty Venn evidence where counts>0.
 */
export async function getComparisonBundle(
  users,
  opts = {
    needCompass: true,
    needVenn: false,
    needMatrix: false,
  },
) {
  const safeUsers = Array.isArray(users) ? users.slice(0, 10) : [];
  const needCompass = !!opts.needCompass;
  const needVenn = !!opts.needVenn && safeUsers.length === 3;
  const needMatrix = !!opts.needMatrix;
  const aiCallOpts = pickAiRequestOpts(opts);

  // LLM tasks
  const pBullets = runCompareToolkit('compare', { users: safeUsers }, aiCallOpts);
  const pAxes = needCompass ? runCompareToolkit('axes', { users: safeUsers }, aiCallOpts) : null;
  const pVenn = needVenn ? runCompareToolkit('venn', { users: safeUsers }, aiCallOpts) : null;

  // Deterministic fallbacks
  const fAxes = needCompass ? pcaLiteCompass(safeUsers) : null;
  const fVenn = needVenn ? computeVennEvidence(safeUsers) : null;
  const fMatrix = needMatrix ? computeOverlapMatrix(safeUsers, 20) : null;

  const settled = await Promise.allSettled([pBullets, pAxes, pVenn, fAxes, fVenn, fMatrix]);
  const val = (i) => (settled[i] && settled[i].status === 'fulfilled' ? settled[i].value : null);

  // Bullets (prefer LLM)
  let bullets = val(0);
  if (!bullets || !Array.isArray(bullets.agreements) || !Array.isArray(bullets.disagreements)) {
    bullets = fallbackBullets(safeUsers);
  }
  bullets = {
    agreements: (bullets.agreements || []).slice(0, 12),
    disagreements: (bullets.disagreements || []).slice(0, 12),
  };

  // Compass (prefer LLM, sanitize)
  let compassRaw = val(1) || val(3) || null;
  let compass = compassRaw
    ? sanitizeCompassPure(compassRaw, safeUsers.map((u) => u.address))
    : null;

  // Venn (prefer LLM, guarantee non-empty evidence for positive regions)
  let venn = needVenn ? (val(2) || val(4) || null) : null;
  if (venn && venn.counts) {
    // Compute deterministic labels as a safety net for evidence
    const ensure = computeVennEvidence(safeUsers);
    const out = {
      counts: { ...ensure.counts, ...venn.counts },
      semantics: venn.semantics || ensure.semantics,
      evidenceMap: { ...ensure.evidenceMap, ...(venn.evidenceMap || {}) },
    };
    for (const k of ['a', 'b', 'c', 'ab', 'ac', 'bc', 'abc']) {
      if ((out.counts[k] || 0) > 0 && (!Array.isArray(out.evidenceMap[k]) || out.evidenceMap[k].length === 0)) {
        out.evidenceMap[k] = ensure.evidenceMap[k];
      }
    }
    venn = out;
  }

  // Matrix (deterministic only)
  const matrix = needMatrix ? (val(5) || computeOverlapMatrix(safeUsers, 20)) : null;

  return {
    bullets,
    compass,
    venn,
    matrix,
  };
}

// AI Summarization of Audio

/* ======================================================================
 * NEW (appended): Audio discussion summary generator + Arweave uploader
 * ====================================================================== */

/** Tiny local helper: strip a single pair of enclosing ``` fences (if present). */
function _stripEnclosingMarkdownFences(s) {
  if (typeof s !== 'string') return '';
  let out = s.trim();
  // Match one outer code fence with optional language tag
  const m = out.match(/^\s*```(?:md|markdown|text|json)?\s*\n?([\s\S]*?)\n?\s*```\s*$/i);
  if (m && m[1]) out = m[1];
  // Trim stray leading/trailing quotes/backticks and any BOM
  out = out.replace(/^\uFEFF/, '').replace(/^[`'"]+|[`'"]+$/g, '');
  return out.trim();
}

/**
 * generateAudioDiscussionSummary(transcript, opts?)
 * - Uses the reading-group Markdown prompt to summarize a multi-speaker discussion.
 * - Reuses callAIQueued for backoff/queue behavior.
 * - Returns plain Markdown (no fences).
 *
 * @param {string} transcript
 * @param {{style?: string, sessionTitle?: string}} opts
 * @returns {Promise<string>} Markdown
 */
export async function generateAudioDiscussionSummary(transcript, opts = {}) {
  const t = (transcript || '').trim();
  if (!t || t.length < 20) {
    throw new Error('Transcript is empty or too short (need ≥ 20 characters).');
  }

  const aiCallOpts = opts && typeof opts === 'object' ? { ...opts } : {};
  const style = (typeof aiCallOpts.style === 'string' && aiCallOpts.style.trim()) ? aiCallOpts.style.trim() : 'reading-group';
  const sessionTitle = (typeof aiCallOpts.sessionTitle === 'string' && aiCallOpts.sessionTitle.trim()) ? aiCallOpts.sessionTitle.trim() : '';
  delete aiCallOpts.style;
  delete aiCallOpts.sessionTitle;

  try {
    const { audioSummaryPrompt } = await import('../../prompts/audioSummaryPrompt.js');

    // Fill placeholders (keep global to replace all occurrences)
    let prompt = String(audioSummaryPrompt || '');
    prompt = prompt.replace(/<TRANSCRIPT>/g, t);
    prompt = prompt.replace(/<STYLE>/g, style);
    prompt = prompt.replace(/<SESSION_TITLE\?>/g, sessionTitle);

    const raw = await callAIQueued(prompt, { ...aiCallOpts, thinking: true });
    const md = _stripEnclosingMarkdownFences(String(raw || ''));
    if (!md) throw new Error('AI returned an empty summary.');
    return md;
  } catch (err) {
    const msg = String(err?.message || 'Failed to generate audio discussion summary.');
    throw new Error(msg);
  }
}

/**
 * uploadMarkdownSummaryToArweave(markdown)
 * - Uploads the given Markdown to Arweave via arweaveScripts.
 * - Returns { txId, url }.
 * - Throws on empty input or upload failures with a clear message.
 *
 * Note: Tries "md" format first as requested. If the helper does not support
 *       "md", falls back to "json" to avoid breaking the flow.
 */
export async function uploadMarkdownSummaryToArweave(markdown, opts = {}) {
  const md = (markdown || '').trim();
  if (!md) throw new Error('Cannot upload empty Markdown summary.');

  try {
    const { arweaveScripts } = await import('../arweave/arweaveScriptsLazy.js');
    const sessionSlug = resolveSessionSlugOpt(opts);
    const sessionConfig = resolveSessionConfigOpt(opts);
    const arweaveKey = opts?.arweaveJwk
      ? { arweaveJwk: opts.arweaveJwk }
      : {
          arweaveJwk: (await getEffectiveArweaveKey({
            sessionSlug,
            sessionConfig,
            preferLocal: opts?.preferLocal,
            context: opts?.context,
          }))?.arweaveJwk || '',
        };
    const uploadOpts = {
      ...arweaveKey,
      sessionSlug,
      sessionConfig,
      context: opts?.context,
    };

    let txId;
    try {
      // Preferred path per spec
      txId = await arweaveScripts.uploadDataToArweave(md, 'md', uploadOpts);
    } catch (e) {
      // Graceful fallback for environments where 'md' is not supported by the uploader
      if (/Unsupported format:\s*md/i.test(String(e?.message || ''))) {
        txId = await arweaveScripts.uploadDataToArweave(md, 'json', uploadOpts);
      } else {
        throw e;
      }
    }

    if (!txId || typeof txId !== 'string') {
      throw new Error('Upload failed: missing transaction ID.');
    }

    const url = arweaveScripts.buildArweaveGatewayUrl(txId);
    const mdUrl = `[${url}](${url})`;
    return { txId, url, mdUrl };
  } catch (err) {
    const msg = String(err?.message || 'Failed to upload summary to Arweave.');
    throw new Error(msg);
  }
}

/* ======================================================================
 * NEW (appended): Speech-only audio extractor (VAD + trim + downsample)
 * ====================================================================== */

/**
 * extractSpeechAudio(inputBlob, opts?)
 * - Decodes with Web Audio, does short-time RMS VAD using values provided in `opts`,
 *   merges short inter-utterance silences, drops short speech blips, concatenates
 *   only speech, downsamples to mono `opts.targetHz`, and returns a WAV blob.
 * - Returns File/Blob named "speech-only.wav" or null on failure.
 * - Note: No hardcoded VAD tunables here; all thresholds/window sizes/bitrates must
 *         be supplied via `opts` (e.g., set via setVadTrimConfig from the UI).
 *
 * Expected `opts` shape (all numbers, provided by caller):
 *   {
 *     thresholdDb,
 *     frameMs,
 *     hopMs,
 *     minSilenceMs,
 *     minSpeechMs,
 *     targetHz,
 *     sizeThresholdBytes?,   // not used here; only by transcribeAudio gate
 *     crossfadeMs?           // optional small fade at segment joins
 *   }
 */
export async function extractSpeechAudio(inputBlob, opts = {}) {
  try {
    if (!inputBlob || typeof inputBlob.arrayBuffer !== 'function') return null;
    if (typeof window === 'undefined') return null; // SSR guard

    const {
      thresholdDb,
      frameMs,
      hopMs,
      minSilenceMs,
      minSpeechMs,
      targetHz,
      crossfadeMs
    } = opts || {};

    // Require all core tunables; UI supplies them (avoids hardcoded defaults here)
    const reqNums = [thresholdDb, frameMs, hopMs, minSilenceMs, minSpeechMs, targetHz];
    if (!reqNums.every((n) => Number.isFinite(n))) return null;

    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;

    const ctx = new AC();
    let audioBuf = null;
    try {
      const ab = await readBlobAsArrayBuffer(inputBlob);
      audioBuf = await new Promise((res, rej) => {
        const r = ctx.decodeAudioData(ab, res, rej);
        if (r && typeof r.then === 'function') r.then(res).catch(rej);
      });
    } catch (error) {
      aiLog.warn('Audio decode failed during speech extraction:', error);
      try { await ctx.close(); } catch {}
      return null;
    }

    const sr = Math.max(8000, Math.min(192000, audioBuf.sampleRate || 44100));
    const ch = Math.max(1, audioBuf.numberOfChannels || 1);
    const len = audioBuf.length || 0;
    if (!len) { try { await ctx.close(); } catch {}; return null; }

    // Mix to mono (average channels)
    const mono = new Float32Array(len);
    for (let c = 0; c < ch; c++) {
      const d = audioBuf.getChannelData(c);
      for (let i = 0; i < len; i++) mono[i] += d[i] / ch;
    }

    // Window sizes in samples
    const frameSamples = Math.max(1, Math.round((frameMs / 1000) * sr));
    const hopSamples   = Math.max(1, Math.round((hopMs   / 1000) * sr));
    const minSilenceS  = Math.max(0, Math.round((minSilenceMs / 1000) * sr));
    const minSpeechS   = Math.max(0, Math.round((minSpeechMs  / 1000) * sr));

    // Prefix sum of squares for RMS
    const ps = new Float32Array(len + 1);
    for (let i = 1; i <= len; i++) {
      const s = mono[i - 1];
      ps[i] = ps[i - 1] + s * s;
    }

    const frameStarts = [];
    const isSpeech = [];
    for (let start = 0; start + frameSamples <= len; start += hopSamples) {
      const end = start + frameSamples;
      const sumsq = ps[end] - ps[start];
      const rms = Math.sqrt(sumsq / frameSamples);
      const db = 20 * Math.log10(rms + 1e-12);
      frameStarts.push(start);
      isSpeech.push(db > thresholdDb);
    }

    // Accumulate raw segments
    const segments = [];
    let runStart = -1;
    for (let i = 0; i < isSpeech.length; i++) {
      const s = isSpeech[i];
      const start = frameStarts[i];
      const end = start + frameSamples;
      if (s && runStart < 0) runStart = start;
      const atEnd = i === isSpeech.length - 1;
      if ((s && atEnd) || (!s && runStart >= 0)) {
        const segEnd = s && atEnd ? end : start;
        if (segEnd > runStart) segments.push({ start: runStart, end: segEnd });
        runStart = -1;
      }
    }
    if (!segments.length) { try { await ctx.close(); } catch {}; return null; }

    // Merge short silences
    const merged = [];
    for (const seg of segments) {
      if (!merged.length) { merged.push({ ...seg }); continue; }
      const last = merged[merged.length - 1];
      const gap = seg.start - last.end;
      if (gap <= minSilenceS) {
        last.end = Math.max(last.end, seg.end);
      } else {
        merged.push({ ...seg });
      }
    }

    // Drop tiny speech blips
    const kept = merged.filter(seg => (seg.end - seg.start) >= minSpeechS);
    if (!kept.length) { try { await ctx.close(); } catch {}; return null; }

    // Concatenate speech segments
    let total = 0;
    for (const seg of kept) total += (seg.end - seg.start);
    if (!total) { try { await ctx.close(); } catch {}; return null; }

    const trimmed = new Float32Array(total);
    let w = 0;
    const fadeS = Number.isFinite(crossfadeMs) && crossfadeMs > 0 ? Math.round((crossfadeMs / 1000) * sr) : 0;

    for (let s = 0; s < kept.length; s++) {
      const { start, end } = kept[s];
      const slice = mono.subarray(start, end);
      trimmed.set(slice, w);

      // Optional tiny crossfade to reduce clicks
      if (fadeS > 1) {
        if (s < kept.length - 1) {
          for (let i = 0; i < fadeS && i < slice.length; i++) {
            const t = (fadeS - i) / fadeS;
            trimmed[w + slice.length - 1 - i] *= t;
          }
        }
        if (s > 0) {
          const head = Math.min(fadeS, slice.length);
          for (let i = 0; i < head; i++) {
            const t = (i + 1) / fadeS;
            trimmed[w + i] *= t;
          }
        }
      }

      w += slice.length;
    }

    const dsF32 = downsampleMonoFloat32(trimmed, sr, targetHz);
    const pcmI16 = float32ToInt16(dsF32);

    try { await ctx.close(); } catch {}

    const wavBlob = buildMonoWavBlob(pcmI16, targetHz);
    try {
      return new File([wavBlob], 'speech-only.wav', { type: 'audio/wav' });
    } catch (error) {
      aiLog.warn('Speech extraction File construction failed; falling back to Blob:', error);
      wavBlob.name = 'speech-only.wav';
      return wavBlob;
    }
  } catch (error) {
    aiLog.warn('Speech extraction failed:', error);
    return null;
  }
}
