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
import {
  TRANSCRIBE_MAX_UPLOAD_BYTES,
  TRANSCRIBE_WAV_TARGET_HZ,
  createNamedAudioFile,
  extractSpeechAudio,
  mergeTranscriptText,
  normalizeAudioToWav,
  splitAudioBlobToWavChunks,
} from './aiClientAudioTranscription.js';
import { getEffectiveArweaveKey } from '../session/resourceKeys.js';
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy.js';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';
import { resolveSessionConfigAliases } from '../session/sessionNaming.js';
import { normalizeBaseUrl } from '../urlUtils.js';
import {
  buildE2eMockClusterAnalysis,
  buildE2eMockCompareBullets,
  buildE2eMockDrilldownTree,
  isE2eAiMockEnabled,
} from './aiClientE2eMocks.js';
import {
  buildHeuristicClusterSummary,
  deriveFallbackClusterName,
  parseJsonFlexible,
  stripEnclosingMarkdownFences as _stripEnclosingMarkdownFences,
} from './aiClientParsing.js';

import {
  pcaLiteCompass,
  computeVennEvidence,
  computeOverlapMatrix,
  sanitizeCompass as sanitizeCompassPure,
  fallbackBullets,
} from '../survey/compareUsers.js';
import { createLogger } from '../logging.js';

const aiLog = createLogger('ai');
export { TRANSCRIBE_MAX_UPLOAD_BYTES, extractSpeechAudio } from './aiClientAudioTranscription.js';
export { isE2eAiMockEnabled } from './aiClientE2eMocks.js';

/* ======================================================================
 * Dev/E2E-only AI mock mode
 * ====================================================================== */

const SUPPORTED_PHOTO_MIME_TYPES = Object.freeze({
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
});

const getSupportedPhotoMimeType = (file) => {
  const declaredType = String(file?.type || '')
    .trim()
    .toLowerCase();
  if (Object.values(SUPPORTED_PHOTO_MIME_TYPES).includes(declaredType)) return declaredType;
  const name = String(file?.name || '')
    .trim()
    .toLowerCase();
  const extension = name.includes('.') ? name.split('.').pop() : '';
  return SUPPORTED_PHOTO_MIME_TYPES[extension] || '';
};

const readFileAsDataUrl = (file) =>
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

const stripDataUrlPrefix = (dataUrl = '') => {
  const raw = String(dataUrl || '');
  const commaIndex = raw.indexOf(',');
  return commaIndex >= 0 ? raw.slice(commaIndex + 1) : raw;
};

const resolvePhotoAnalysisSupport = ({ provider, model } = {}) => {
  const normalizedProvider = String(provider || '')
    .trim()
    .toLowerCase();
  const modelLeaf = String(model || '')
    .trim()
    .toLowerCase()
    .split('/')
    .pop();

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
    error:
      `Photo analysis requires a vision-capable OpenAI, Anthropic, or OpenRouter model. Current selection: ${normalizedProvider || 'unknown'} ${modelLeaf || ''}`.trim(),
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
      return [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: dataUrl },
          ],
        },
      ];
    }
    if (support.format === 'anthropic') {
      return [
        {
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
        },
      ];
    }
    return [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ];
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

// === Client-side silence trimming feature flag and config (runtime-controlled from UI) ===
let __vadTrimEnabled = true;
let __vadTrimConfig = {};
export function setVadTrimEnabled(v) {
  __vadTrimEnabled = !!v;
}
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

  const contentSelectors = ['main', 'article', '.content', '#content', '.main-content', '#main-content', 'body'];

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

const resolveSessionAliasesOpt = (opts = {}) =>
  resolveSessionConfigAliases({
    sessionSlug: opts?.sessionSlug,
    sessionConfig: opts?.sessionConfig,
  });

const resolveSessionSlugOpt = (opts = {}) => resolveSessionAliasesOpt(opts).sessionSlug;

const resolveSessionConfigOpt = (opts = {}) => resolveSessionAliasesOpt(opts).sessionConfig;

const isChatReasoningModel = (modelRaw = '') => {
  const modelLeaf = String(modelRaw || '')
    .trim()
    .toLowerCase()
    .split('/')
    .pop();
  return /^o[13]/.test(modelLeaf);
};

const usesOpenAiResponsesApi = (providerRaw = '', modelRaw = '') => {
  const provider = String(providerRaw || '')
    .trim()
    .toLowerCase();
  const modelLeaf = String(modelRaw || '')
    .trim()
    .toLowerCase()
    .split('/')
    .pop();
  return provider === 'openai' && /^gpt-5/.test(modelLeaf);
};

const inferAiTaskType = (prompt = '', opts = {}) => {
  const explicit = String(opts?.taskType || '')
    .trim()
    .toLowerCase();
  if (explicit) return explicit;

  const promptText = String(prompt || '');
  // Older question-generation flows still call `callAI` directly, so fall back
  // to the seed-generation prompt signature when no explicit task type is passed.
  if (/numberOfSeedStatementsOrPrompts:/i.test(promptText) && /"surveyTitle"\s*:/i.test(promptText)) {
    return 'generate';
  }
  return null;
};

const pickAiRequestOpts = (input = {}) => {
  const src = input && typeof input === 'object' ? input : {};
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

    const messages = Array.isArray(opts.messages) ? opts.messages : [{ role: 'user', content: prompt }];
    const usesResponsesApi = usesOpenAiResponsesApi(ai.provider, ai.model);
    const usesCompletionTokens = !usesResponsesApi && isChatReasoningModel(ai.model);

    const maxTokens = opts.max_tokens ?? opts.maxTokens ?? (ai.provider === 'anthropic' ? 32568 : 16384);

    const requestBody = {
      action: 'ai',
      provider: ai.provider,
      model: ai.model,
      ...(usesResponsesApi ? { endpoint: 'responses' } : {}),
      ...(typeof (opts.max_output_tokens ?? (usesResponsesApi ? maxTokens : undefined)) === 'number'
        ? { max_output_tokens: opts.max_output_tokens ?? maxTokens }
        : {}),
      ...(typeof (opts.max_completion_tokens ?? (usesCompletionTokens ? maxTokens : undefined)) === 'number'
        ? { max_completion_tokens: opts.max_completion_tokens ?? maxTokens }
        : {}),
      ...(!usesResponsesApi && !usesCompletionTokens && typeof maxTokens === 'number' ? { max_tokens: maxTokens } : {}),
      ...(opts.response_format ? { response_format: opts.response_format } : {}),
      ...(!usesResponsesApi && !usesCompletionTokens
        ? typeof opts.temperature === 'number'
          ? { temperature: opts.temperature }
          : { temperature: 0.7 }
        : {}),
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
    const endpoint = corsWorkerUrl.endsWith('/ai') ? corsWorkerUrl : `${corsWorkerUrl.replace(/\/+$/, '')}/ai`;
    const baseUrl = corsWorkerUrl.replace(/\/+$/, '').replace(/\/ai$/i, '');
    const sessionSelection = opts && typeof opts.sessionSelection === 'object' ? opts.sessionSelection : null;
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
      tokenBudgetKey: usesResponsesApi
        ? 'max_output_tokens'
        : usesCompletionTokens
          ? 'max_completion_tokens'
          : 'max_tokens',
      tokenBudgetValue: maxTokens,
      messageCount: messages.length,
      firstMessageLength: messages[0]?.content?.length || 0,
    });
    const gateStatus = String(sessionSelection?.gateStatus ?? '')
      .trim()
      .toLowerCase();
    // For open-gate sessions, skip auth fallback when gate data is unavailable.
    // Auth retries still depend on the same on-chain gate RPC resolution.
    const fallbackOnGateUnavailable = gateStatus !== 'no-gate';
    const response = await fetchWorkerWithAuth(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      },
      {
        sessionSlug,
        context: opts.context,
        workerUrl: baseUrl,
        preferAnonymous: shouldUseAnonymousFirst,
        fallbackOnGateUnavailable,
        allowDemoFallback: defaultStrictAllowDemoFallback(),
      },
    );

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
        const isTransient = /rate\s*limit|concurrent|overload|overloaded|busy|temporarily|try\s*again|429/i.test(msg);
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
    const workerResponse = await fetchWorkerWithAuth(
      corsWorkerUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: validatedUrl.href, action: 'fetch_url' }),
      },
      {
        sessionSlug,
        context: opts.context,
        workerUrl: baseUrl,
        allowDemoFallback: defaultStrictAllowDemoFallback(),
      },
    );

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
    }),
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
      __vadTrimConfig && typeof __vadTrimConfig.sizeThresholdBytes === 'number'
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

  const fname = uploadFile.name || (looksSupported ? `audio.${ext || 'wav'}` : 'audio.wav');
  return uploadAudioForTranscription(
    uploadFile instanceof Blob ? toFileLike(uploadFile, fname) : uploadFile,
    transport,
    {
      fileName: fname,
      signal: opts?.signal,
    },
  );
}

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
  const corsWorkerUrl =
    explicitWorkerUrl ||
    (await getCorsProxyUrlOrThrow({
      sessionSlug,
      sessionConfig,
      context: opts.context,
      allowDemoFallback: defaultStrictAllowDemoFallback(),
    }));
  const endpoint = corsWorkerUrl.endsWith('/transcribe')
    ? corsWorkerUrl
    : `${corsWorkerUrl.replace(/\/+$/, '')}/transcribe`;
  const baseUrl = corsWorkerUrl.replace(/\/+$/, '').replace(/\/transcribe$/i, '');

  return {
    endpoint,
    baseUrl,
    sessionSlug,
    sessionConfig,
    context: opts?.context,
    transcriptionCfg,
  };
};

const uploadAudioForTranscription = async (audioFileOrBlob, transport, { fileName = '', signal } = {}) => {
  const fileLike =
    audioFileOrBlob instanceof Blob
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
    const aiCallOpts =
      opts && typeof opts === 'object'
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
    const aiCallOpts =
      opts && typeof opts === 'object'
        ? { ...opts, taskType: opts.taskType || 'summarize' }
        : { taskType: 'summarize' };
    const raw = await callAIQueued(prompt, { ...aiCallOpts, thinking: true });

    let parsed = parseJsonFlexible(raw);
    if (!parsed || typeof parsed !== 'object') parsed = {};

    const name = String(parsed.name || '').trim() || 'Profile Summary';
    const summary =
      String(parsed.summary || '').trim() || 'Neutral overview of user affiliations and consistent answer themes.';
    const details = String(parsed.details || '').trim() || 'No additional details were derived from the provided data.';

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
  const t = typeof type === 'string' && type.toLowerCase().includes('dis') ? 'disagreement' : 'agreement';
  const aiCallOpts = pickAiRequestOpts(opts);

  try {
    const drillPrompt = `You are an impartial analyst expanding on a ${t} found in a multi-user comparison.
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
  const t = typeof type === 'string' && type.toLowerCase().includes('dis') ? 'disagreement' : 'agreement';
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
        const children = childrenIn
          .slice(0, 6)
          .map((c) => sanitizeNode(c, depth + 1))
          .filter(Boolean);
        return { label, evidence, ...(participants ? { participants } : {}), children };
      };

      return {
        title: String(parsed.title || `Why this ${t} holds`).slice(0, 120),
        nodes: parsed.nodes
          .slice(0, 6)
          .map((n) => sanitizeNode(n, 0))
          .filter(Boolean),
      };
    }

    // Fallback to plain-text summary wrapped as a tiny tree
    const text = await drillDownComparisonPoint(safeUsers, pointText, t, aiCallOpts);
    return { title: `Why this ${t} holds`, nodes: [{ label: 'Summary', evidence: [text], children: [] }] };
  } catch (err) {
    aiLog.error('drillDownComparisonTree error:', err);
    const text = await drillDownComparisonPoint(users, pointText, type, aiCallOpts);
    return {
      title: `Why this ${type || 'agreement'} holds`,
      nodes: [{ label: 'Summary', evidence: [text], children: [] }],
    };
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
      return buildE2eMockDrilldownTree(payload, safeUsers);
    }
    return null;
  }

  const envelope = {
    task: t === 'compare' || t === 'drilldown' || t === 'axes' || t === 'venn' ? t : 'compare',
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
    ? sanitizeCompassPure(
        compassRaw,
        safeUsers.map((u) => u.address),
      )
    : null;

  // Venn (prefer LLM, guarantee non-empty evidence for positive regions)
  let venn = needVenn ? val(2) || val(4) || null : null;
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
  const matrix = needMatrix ? val(5) || computeOverlapMatrix(safeUsers, 20) : null;

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
  const style =
    typeof aiCallOpts.style === 'string' && aiCallOpts.style.trim() ? aiCallOpts.style.trim() : 'reading-group';
  const sessionTitle =
    typeof aiCallOpts.sessionTitle === 'string' && aiCallOpts.sessionTitle.trim() ? aiCallOpts.sessionTitle.trim() : '';
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
 * - Uploads the given Markdown to Arweave via arweaveClient.
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
    const { arweaveClient } = await import('../arweave/arweaveClientLazy.js');
    const sessionSlug = resolveSessionSlugOpt(opts);
    const sessionConfig = resolveSessionConfigOpt(opts);
    const arweaveKey = opts?.arweaveJwk
      ? { arweaveJwk: opts.arweaveJwk }
      : {
          arweaveJwk:
            (
              await getEffectiveArweaveKey({
                sessionSlug,
                sessionConfig,
                preferLocal: opts?.preferLocal,
                context: opts?.context,
              })
            )?.arweaveJwk || '',
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
      txId = await arweaveClient.uploadDataToArweave(md, 'md', uploadOpts);
    } catch (e) {
      // Graceful fallback for environments where 'md' is not supported by the uploader
      if (/Unsupported format:\s*md/i.test(String(e?.message || ''))) {
        txId = await arweaveClient.uploadDataToArweave(md, 'json', uploadOpts);
      } else {
        throw e;
      }
    }

    if (!txId || typeof txId !== 'string') {
      throw new Error('Upload failed: missing transaction ID.');
    }

    const url = arweaveClient.buildArweaveGatewayUrl(txId);
    const mdUrl = `[${url}](${url})`;
    return { txId, url, mdUrl };
  } catch (err) {
    const msg = String(err?.message || 'Failed to upload summary to Arweave.');
    throw new Error(msg);
  }
}
