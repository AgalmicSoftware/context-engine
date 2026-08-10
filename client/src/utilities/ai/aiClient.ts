/**
 * @module aiClient
 * @description AI orchestration layer — unified entry point for AI API calls, streaming responses,
 *              survey analysis, audio transcription, and comparison toolkit dispatch.
 *
 * Key exports: callAI, analyzeClusterOpinions, rankQuestionsAI, requestAiRewrite, transcribeAudio, runCompareToolkit
 */
// Purpose: AI orchestration only — unified compare entry + toolkit calls.
// All math/heuristics live in utilities/survey/compareUsers.ts

import { aiRewritePrompt } from '../../prompts/aiRewritePrompt.js';
import buildClusterAnalysisPrompt, { CLUSTER_ANALYSIS_SYSTEM_PROMPT } from '../../prompts/clusterAnalysisPrompt.js';
import buildCompareToolkitPrompt from '../../prompts/compareToolkitPrompt.js';
import buildPhotoAnalysisPrompt from '../../prompts/photoAnalysisPrompt.js';
import { rankQuestionsPrompt } from '../../prompts/rankQuestionsPrompt.js';
import { getEffectiveAiConfig, getEffectiveTranscriptionConfig } from './aiSettings.js';
import {
  TRANSCRIBE_MAX_UPLOAD_BYTES,
  TRANSCRIBE_WAV_TARGET_HZ,
  extractSpeechAudio,
  mergeTranscriptText,
  normalizeAudioToWav,
  splitAudioBlobToWavChunks,
} from './aiClientAudioTranscription.js';
import { buildCompareFallbackTree, sanitizeCompareTreePayload } from './aiClientCompareTree.js';
import { getEffectiveArweaveKey } from '../session/resourceKeys.js';
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy.js';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';
import { normalizeBaseUrl } from '../urlUtils.js';
import {
  buildE2eMockClusterAnalysis,
  buildE2eMockCompareBullets,
  buildE2eMockDrilldownTree,
  isE2eAiMockEnabled,
} from './aiClientE2eMocks.js';
import {
  asParsedJsonRecord,
  buildHeuristicClusterSummary,
  deriveFallbackClusterName,
  parseJsonFlexible,
  pickParsedString,
  readParsedLegacyString,
  readParsedString,
  stripEnclosingMarkdownFences as _stripEnclosingMarkdownFences,
} from './aiClientParsing.js';
import {
  getSupportedPhotoMimeType,
  readFileAsDataUrl,
  resolvePhotoAnalysisSupport,
  stripDataUrlPrefix,
} from './aiClientPhotoSupport.js';
import {
  buildAiConfigRequest,
  buildArweaveKeyRequest,
  buildTranscriptionConfigRequest,
  inferAiTaskType,
  normalizeAiClientOptions,
  pickAiRequestOpts,
  readAiErrorMessage,
  readAiOptionTaskType,
  readAiOptionThinking,
  readAiOptionThrowOnError,
  readAiOptionWorkerUrl,
  readArweaveJwkOption,
  readNumericOption,
  resolveAudioSummaryOptions,
  resolveAiSessionOptions,
  resolveAiSessionSelection,
  resolveTranscriptionUploadOptions,
  withAiTaskTypeFallback,
} from './aiClientRequestOptions.js';
import {
  mergeCompareVennWithEvidence,
  normalizeCompareBullets,
  readCompareToolkitTask,
  resolveCompareToolkitPayload,
} from './aiCompareContracts.js';
import {
  buildAiWorkerRequestPlan,
  parseAiWorkerCompletion,
  readAiWorkerFirstMessageContentLength,
  resolveAiWorkerEndpoint,
} from './aiClientWorkerTransport.js';
import {
  resolveTranscriptionWorkerEndpoint,
  uploadAudioForTranscription,
} from './aiClientTranscriptionWorkerTransport.js';
import { enqueueAiCallWithRetry } from './aiClientQueue.js';

import {
  pcaLiteCompass,
  computeVennEvidence,
  computeOverlapMatrix,
  sanitizeCompass as sanitizeCompassPure,
  fallbackBullets,
  type CompareUser,
} from '../survey/compareUsers.js';
import { createLogger } from '../logging.js';
import type { UnknownRecord } from '../session/sessionTypes.js';

const aiLog = createLogger('ai');
type PhotoUploadFile = {
  name?: string;
  type?: string;
};
type AudioUploadBlob = Blob & {
  name?: string;
  size?: number;
  type?: string;
};
type AiClientOptions = Record<string, unknown>;
type CompareBundleOptions = AiClientOptions & {
  needCompass?: unknown;
  needMatrix?: unknown;
  needVenn?: unknown;
};

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const readCompareUsers = (value: unknown, maxUsers = Infinity): CompareUser[] =>
  (Array.isArray(value) ? value.slice(0, maxUsers) : []) as CompareUser[];

export { TRANSCRIBE_MAX_UPLOAD_BYTES, extractSpeechAudio } from './aiClientAudioTranscription.js';
export { isE2eAiMockEnabled } from './aiClientE2eMocks.js';
export { fetchContentFromURL, processAdditionalSources } from './aiClientSourceFetch.js';

/* ======================================================================
 * Dev/E2E-only AI mock mode
 * ====================================================================== */

export const analyzePhotoForQuestionGeneration = async (file: PhotoUploadFile, opts: unknown = {}) => {
  if (!file) throw new Error('Missing photo file.');

  const mimeType = getSupportedPhotoMimeType(file);
  if (!mimeType) {
    throw new Error('Unsupported photo format. Use png, jpg, jpeg, webp, or gif.');
  }

  const ai = await getEffectiveAiConfig(buildAiConfigRequest(opts));
  const support = resolvePhotoAnalysisSupport(ai);
  if (!support.supported) {
    throw new Error(support.error || 'Configured AI provider/model does not support photo analysis.');
  }

  const dataUrl = await readFileAsDataUrl(file as Blob & { name?: unknown; type?: unknown });
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
let __vadTrimConfig: UnknownRecord = {};
export function setVadTrimEnabled(v: unknown) {
  __vadTrimEnabled = !!v;
}
export function setVadTrimConfig(cfg: unknown) {
  if (cfg && typeof cfg === 'object') {
    __vadTrimConfig = { ...__vadTrimConfig, ...cfg };
  }
}

/* ======================================================================
 * Core fetch + AI helpers
 * ====================================================================== */

/**
 * Call AI via the Cloudflare Worker AI proxy using resolved settings.
 * The worker must support:
 *   POST { action:'ai', provider, model, temperature?, max_tokens?, messages:[{role, content}] }
 * And respond with: { completion: "<text>" }
 */
export const callAI = async (prompt: unknown, opts: unknown = {}): Promise<string> => {
  try {
    const thinkingRequested = readAiOptionThinking(opts);
    const aiRequestOpts = normalizeAiClientOptions(opts);
    const { context, sessionConfig, sessionSlug } = resolveAiSessionOptions(opts);
    const ai = await getEffectiveAiConfig(buildAiConfigRequest(opts, { thinking: thinkingRequested }));
    const taskType = inferAiTaskType(prompt, aiRequestOpts);

    const thinking = thinkingRequested && ai.provider === 'anthropic';

    const { endpointLabel, maxTokens, messages, requestBody, shouldUseAnonymousFirst, tokenBudgetKey } =
      buildAiWorkerRequestPlan({
        ai,
        prompt,
        opts: {
          ...aiRequestOpts,
          thinking,
        },
        taskType,
      });

    const corsWorkerUrl = await getCorsProxyUrlOrThrow({
      sessionSlug,
      sessionConfig,
      context,
      allowDemoFallback: defaultStrictAllowDemoFallback(),
    });
    const { endpoint, baseUrl } = resolveAiWorkerEndpoint(corsWorkerUrl);
    const sessionSelection = resolveAiSessionSelection(opts);
    aiLog.log('[aiClient] worker route selected', {
      sessionSlug: String(sessionSlug || ''),
      workerUrl: baseUrl,
      gateStatus: String(sessionSelection?.gateStatus || ''),
      reason: String(sessionSelection?.reason || ''),
    });
    aiLog.log('[aiClient] AI request params', {
      provider: ai.provider,
      model: ai.model,
      endpoint: endpointLabel,
      tokenBudgetKey,
      tokenBudgetValue: maxTokens,
      messageCount: messages.length,
      firstMessageLength: readAiWorkerFirstMessageContentLength(messages),
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
        context,
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

    return parseAiWorkerCompletion(data);
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
export const callAIQueued = (prompt: unknown, opts: unknown = {}): Promise<string> => {
  return enqueueAiCallWithRetry(() => callAI(prompt, opts));
};

/* ======================================================================
 * Lightweight utilities for other product areas (unchanged behavior)
 * ====================================================================== */

export const analyzeSurveyResponses = async (responses: unknown, opts: unknown = {}): Promise<string> => {
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
export async function rankQuestionsAI(
  userQuery: unknown,
  questionList: unknown,
  topX = 10,
  opts: unknown = {},
): Promise<string[]> {
  const throwOnError = readAiOptionThrowOnError(opts);
  try {
    const candidates = (Array.isArray(questionList) ? questionList : [])
      .map((q: unknown) => {
        const question = asRecord(q);
        return {
          id: String(question.id || '').trim(),
          prompt: String(question.prompt || ''),
        };
      })
      .filter((q) => q.id.trim());
    const questionListJson = JSON.stringify(candidates, null, 2);

    const finalPrompt = rankQuestionsPrompt
      .replace('{{userQueryJson}}', JSON.stringify(String(userQuery || '')))
      .replace('{{questionListJson}}', questionListJson)
      .replace('{{topX}}', String(topX));

    const rawOutput = await callAI(finalPrompt.trim(), {
      ...pickAiRequestOpts(opts),
      taskType: readAiOptionTaskType(opts, 'rank'),
    });

    let parsed: unknown;
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

    const selectedQuestionIDs = asRecord(parsed).selectedQuestionIDs;
    if (!parsed || !Array.isArray(selectedQuestionIDs)) {
      if (throwOnError) {
        throw new Error('AI ranking response missing selectedQuestionIDs array');
      }
      return [];
    }

    const allowedIds = new Set(candidates.map((q) => q.id));
    const seenIds = new Set();
    const ids = selectedQuestionIDs
      .filter((id: unknown) => typeof id === 'string' && id.trim() !== '')
      .map((id: string) => id.trim())
      .filter((id: string) => {
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
export async function requestAiRewrite(originalText: unknown, opts: unknown = {}): Promise<unknown> {
  try {
    const finalPrompt = aiRewritePrompt.replace('<USER_TEXT>', String(originalText));
    const cleaned = await callAI(finalPrompt, {
      ...(opts && typeof opts === 'object' ? opts : {}),
      taskType: readAiOptionTaskType(opts, 'rewrite'),
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
export async function transcribeAudio(audioBlobOrFile: AudioUploadBlob, opts: unknown = {}): Promise<string> {
  if (!audioBlobOrFile) throw new Error('No audio provided');
  const { maxUploadBytes, signal } = resolveTranscriptionUploadOptions(opts, {
    defaultMaxUploadBytes: TRANSCRIBE_MAX_UPLOAD_BYTES,
  });

  // Helper: coerce to a File when available to preserve filename
  const toFileLike = (blob: Blob & { name?: string }, nameFallback?: string): File | (Blob & { name?: string }) => {
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
  const ext = lowerName.includes('.') ? lowerName.split('.').pop() || '' : '';
  const mime = String(audioBlobOrFile.type || '').toLowerCase();

  // Phone-format coverage
  const allowedExt = new Set(['m4a', 'mp3', 'aac', 'wav', 'webm', 'mp4', '3gp', 'ogg', 'opus']);
  const looksSupported = allowedExt.has(ext) || /^audio\/|^video\//i.test(mime);

  const isTooBig = typeof audioBlobOrFile.size === 'number' && audioBlobOrFile.size > maxUploadBytes;
  const needsNormalization = !looksSupported;

  let uploadFile: AudioUploadBlob = audioBlobOrFile;

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
    const sizeThreshold = readNumericOption(__vadTrimConfig, 'sizeThresholdBytes');
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
        onJsonParseError: (error) => aiLog.warn('Transcription response JSON parse failed:', error),
        signal,
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
      onJsonParseError: (error) => aiLog.warn('Transcription response JSON parse failed:', error),
      signal,
    },
  );
}

const resolveTranscriptionTransport = async (opts: unknown = {}) => {
  const { context, sessionConfig, sessionSlug } = resolveAiSessionOptions(opts);
  const transcriptionCfg = await getEffectiveTranscriptionConfig(buildTranscriptionConfigRequest(opts));

  if (transcriptionCfg.provider === 'local') {
    throw new Error('Local transcription is not configured in this build.');
  }

  const explicitWorkerUrl = normalizeBaseUrl(readAiOptionWorkerUrl(opts) || '');
  const corsWorkerUrl =
    explicitWorkerUrl ||
    (await getCorsProxyUrlOrThrow({
      sessionSlug,
      sessionConfig,
      context,
      allowDemoFallback: defaultStrictAllowDemoFallback(),
    }));
  const { endpoint, baseUrl } = resolveTranscriptionWorkerEndpoint(corsWorkerUrl);

  return {
    endpoint,
    baseUrl,
    sessionSlug,
    sessionConfig,
    context,
    transcriptionCfg,
  };
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
export async function analyzeClusterOpinions(
  clusterData: unknown,
  allClustersData: unknown = null,
  opts: unknown = {},
) {
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
    const aiCallOpts = withAiTaskTypeFallback(opts, 'summarize');

    try {
      raw = await callAIQueued(finalPrompt, { ...aiCallOpts, thinking: true });
    } catch (err) {
      try {
        raw = await callAIQueued(finalPrompt, { ...aiCallOpts, thinking: false });
      } catch (fallbackErr) {
        const message = readAiErrorMessage(fallbackErr, readAiErrorMessage(err, 'AI request failed'));
        throw new Error(message);
      }
    }

    const parsed = asParsedJsonRecord(parseJsonFlexible(raw));
    if (parsed) {
      short = readParsedLegacyString(parsed, 'short').trim() || '';
      long = readParsedLegacyString(parsed, 'long').trim() || '';
      name = readParsedLegacyString(parsed, 'name').trim() || null;
    } else {
      // Fallback for older/freeform responses
      long = String(raw || '').trim();
      short = (long.split('\n').shift() || '').slice(0, 200);
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
export async function analyzeUserOpinions(userData: unknown, opts: unknown = {}) {
  try {
    const { default: buildUserAnalysisPrompt } = await import('../../prompts/userAnalysisPrompt.js');
    const prompt = buildUserAnalysisPrompt(userData);
    const aiCallOpts = withAiTaskTypeFallback(opts, 'summarize');
    const raw = await callAIQueued(prompt, { ...aiCallOpts, thinking: true });

    const parsed = asParsedJsonRecord(parseJsonFlexible(raw)) || {};

    const name = readParsedLegacyString(parsed, 'name').trim() || 'Profile Summary';
    const summary =
      readParsedLegacyString(parsed, 'summary').trim() ||
      'Neutral overview of user affiliations and consistent answer themes.';
    const details =
      readParsedLegacyString(parsed, 'details').trim() || 'No additional details were derived from the provided data.';

    // Safely parse historicalAlignment
    const ha = asParsedJsonRecord(parsed.historicalAlignment) || {};
    const historicalAlignment = {
      figure: readParsedLegacyString(ha, 'figure').trim() || '',
      reasoning: readParsedLegacyString(ha, 'reasoning').trim() || '',
    };

    return { name, summary, details, historicalAlignment };
  } catch (err) {
    // Let gate-unavailable errors propagate for session-level retry.
    if (/on-chain gate data unavailable/i.test(readAiErrorMessage(err, ''))) {
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
export async function drillDownComparisonPoint(
  users: unknown,
  pointText: unknown,
  type: unknown,
  opts: unknown = {},
): Promise<string> {
  const safeUsers = readCompareUsers(users, Number.POSITIVE_INFINITY);
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
    const parsed = asParsedJsonRecord(parseJsonFlexible(String(raw || '')));
    if (parsed) {
      const candidate = pickParsedString(parsed, ['text', 'explanation', 'message', 'output', 'content']);
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
export async function drillDownComparisonTree(users: unknown, pointText: unknown, type: unknown, opts: unknown = {}) {
  const safeUsers = readCompareUsers(users, 10);
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

    const sanitizedTree = sanitizeCompareTreePayload(parsed, `Why this ${t} holds`);
    if (sanitizedTree) {
      return sanitizedTree;
    }

    // Fallback to plain-text summary wrapped as a tiny tree
    const text = await drillDownComparisonPoint(safeUsers, pointText, t, aiCallOpts);
    return buildCompareFallbackTree(`Why this ${t} holds`, text);
  } catch (err) {
    aiLog.error('drillDownComparisonTree error:', err);
    const text = await drillDownComparisonPoint(users, pointText, type, aiCallOpts);
    return buildCompareFallbackTree(`Why this ${type || 'agreement'} holds`, text);
  }
}

/**
 * Unified entry for LLM-powered comparison subtasks.
 * This function is **AI-only** and returns raw model outputs (parsed),
 * leaving deterministic fallbacks to higher-level orchestrators.
 *
 * @param {"compare"|"drilldown"|"axes"|"venn"} task
 * @param {{users:Array, pointText?:string, type?:"agreement"|"disagreement"}} payload
 * @returns {Promise<unknown>} Parsed JSON per task, or a plain string for drilldown fallback.
 */
export async function runCompareToolkit(task: unknown, payload: unknown = {}, opts: unknown = {}) {
  const t = readCompareToolkitTask(task);
  const comparePayload = resolveCompareToolkitPayload(payload);
  const safeUsers = comparePayload.users;
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
          pointText: comparePayload.pointText,
          type: comparePayload.type,
        }
      : {}),
  };

  try {
    const prompt = buildCompareToolkitPrompt(envelope);
    const raw = await callAIQueued(prompt, { ...aiCallOpts, thinking: true });
    const parsed = parseJsonFlexible(raw);

    if (t === 'drilldown') {
      const parsedTree = asParsedJsonRecord(parsed);
      if (readParsedString(parsedTree, 'title') && Array.isArray(parsedTree?.nodes)) {
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
  users: unknown,
  opts: CompareBundleOptions = {
    needCompass: true,
    needVenn: false,
    needMatrix: false,
  },
) {
  const safeUsers = readCompareUsers(users, 10);
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
  const val = (i: number) => {
    const result = settled[i];
    return result && result.status === 'fulfilled' ? result.value : null;
  };

  // Bullets (prefer LLM)
  const bullets = normalizeCompareBullets(val(0), fallbackBullets(safeUsers));

  // Compass (prefer LLM, sanitize)
  let compassRaw = val(1) || val(3) || null;
  let compass = compassRaw
    ? sanitizeCompassPure(
        compassRaw,
        safeUsers.map((u) => u.address),
      )
    : null;

  // Venn (prefer LLM, guarantee non-empty evidence for positive regions)
  let venn = null;
  const vennCandidate = needVenn ? val(2) || val(4) || null : null;
  if (vennCandidate) {
    // Compute deterministic labels as a safety net for evidence
    const ensure = computeVennEvidence(safeUsers);
    venn = mergeCompareVennWithEvidence(vennCandidate, ensure);
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
export async function generateAudioDiscussionSummary(transcript: unknown, opts: unknown = {}): Promise<string> {
  const t = String(transcript || '').trim();
  if (!t || t.length < 20) {
    throw new Error('Transcript is empty or too short (need ≥ 20 characters).');
  }

  const { aiCallOptions: aiCallOpts, sessionTitle, style } = resolveAudioSummaryOptions(opts);

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
    const msg = readAiErrorMessage(err, 'Failed to generate audio discussion summary.');
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
export async function uploadMarkdownSummaryToArweave(markdown: unknown, opts: unknown = {}) {
  const md = String(markdown || '').trim();
  if (!md) throw new Error('Cannot upload empty Markdown summary.');

  try {
    const { arweaveClient } = await import('../arweave/arweaveClient.js');
    const { context, preferLocal, sessionConfig, sessionSlug } = buildArweaveKeyRequest(opts);
    const { arweaveJwk, hasArweaveJwk } = readArweaveJwkOption(opts);
    const arweaveKey = hasArweaveJwk
      ? { arweaveJwk }
      : {
          arweaveJwk:
            (
              await getEffectiveArweaveKey({
                sessionSlug,
                sessionConfig,
                preferLocal,
                context,
              })
            )?.arweaveJwk || '',
        };
    const uploadOpts = {
      ...arweaveKey,
      sessionSlug,
      sessionConfig,
      context,
    };

    let txId;
    try {
      // Preferred path per spec
      txId = await arweaveClient.uploadDataToArweave(md, 'md', uploadOpts);
    } catch (e) {
      // Graceful fallback for environments where 'md' is not supported by the uploader
      if (/Unsupported format:\s*md/i.test(readAiErrorMessage(e, ''))) {
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
    const msg = readAiErrorMessage(err, 'Failed to upload summary to Arweave.');
    throw new Error(msg);
  }
}
