// On-chain response submission pipeline
// Flow: local response → Arweave upload (via worker) → submitResponses() on Surveys contract
// Server-side signing with passkey-derived private key (testnet mode)

import { ethers } from 'ethers';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { debug, warn, error } from './log.mjs';
import {
  SURVEYS_ABI,
  DEFAULT_CHAIN_ID,
  resolveRpcUrlsForChain,
  SESSION_CONTRACTS_BY_CHAIN,
} from './constants.mjs';
import { getCorsWorkerUrl, getSessionMetadata } from './sessions.mjs';
import { decryptFromFile, isEncryptedFile, migrateToEncrypted } from './keyEncryption.mjs';
// Shared pure utilities (symlinked from client/src/utilities/shared/)
import {
  generateQuestionId as _generateQuestionId,
  hexToBase64url as _hexToBase64url,
  base64urlToHex as _base64urlToHex,
} from './shared/questionUtils.mjs';
import { encryptField } from './envelopeV1.mjs';
import { recordConfirmedSubmission } from './submissionState.mjs';
import {
  normalizeResponseAudienceSelections,
  isEncryptedAudience,
  deriveResponseGateOptionsFromMetadata,
} from './responseAudience.mjs';
import {
  buildSbtAccessControlConditions,
  createNodeLitHooks,
  resolveLitChain,
} from './litNodeHooks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(process.env.CE_CC_DATA_DIR || resolve(__dirname, '..', '.data'));
const WALLET_KEY_PATH = resolve(DATA_DIR, 'wallet.key');
const QUESTION_CACHE_DIR = resolve(DATA_DIR, 'question-cache');
const HASH_ZERO_LOWER = ethers.constants.HashZero.toLowerCase();

// --- Helpers ---

function base64urlToHex(b64url) {
  if (!b64url) return ethers.constants.HashZero;
  // Use shared conversion, then pad to 32 bytes for bytes32 contract compatibility
  const hex = _base64urlToHex(b64url);
  const buf = Buffer.from(hex.replace(/^0x/, ''), 'hex');
  if (buf.length < 32) {
    const padded = Buffer.alloc(32);
    buf.copy(padded);
    return ethers.utils.hexlify(padded);
  }
  return hex;
}

// Ensure a questionId is a valid bytes32 — hash it if not
function toBytes32(value) {
  if (!value) return ethers.constants.HashZero;
  // Already a valid 32-byte hex string (66 chars with 0x prefix)
  if (typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)) {
    return value;
  }
  // Otherwise hash it to get a consistent bytes32
  return ethers.utils.id(value);
}

function getStoredPrivateKey() {
  if (!existsSync(WALLET_KEY_PATH)) return null;
  const decrypted = decryptFromFile(WALLET_KEY_PATH);
  if (decrypted) return decrypted.toString('utf8').trim();
  if (isEncryptedFile(WALLET_KEY_PATH)) return null;

  const legacy = readFileSync(WALLET_KEY_PATH, 'utf8').trim();
  if (legacy) {
    try {
      migrateToEncrypted(WALLET_KEY_PATH);
    } catch {
      // Best-effort migration; keep using the plaintext key for this process.
    }
  }
  return legacy;
}

function sanitizeQuestionCacheKey(questionId) {
  return String(questionId || '').replace(/[^a-fA-F0-9x]/g, '_');
}

function normalizeAddressLower(value) {
  return String(value || '').trim().toLowerCase();
}

function shortAddress(value) {
  const normalized = normalizeAddressLower(value);
  return normalized ? normalized.slice(0, 10) : 'unknown';
}

function normalizeSurveyId(value) {
  const raw = String(value || '').trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) return ethers.constants.HashZero;
  return raw.toLowerCase();
}

// Fail-closed: treat any non-explicitly-false value as encryption requested.
// Only false, 'false', 0, '', null, undefined are treated as 'no encryption'.
function isEncryptionRequested(value) {
  if (value == null || value === '' || value === 0) return false;
  if (value === false || value === 'false') return false;
  return true; // fail closed - unknown truthy values treated as 'yes, encrypt'
}

// Look up associatedSurveyId from cached question data
function lookupSurveyId(slug, questionId) {
  try {
    const cacheFile = resolve(QUESTION_CACHE_DIR, slug, `${sanitizeQuestionCacheKey(questionId)}.json`);
    if (!existsSync(cacheFile)) return null;
    const q = JSON.parse(readFileSync(cacheFile, 'utf8'));
    const surveyId = normalizeSurveyId(q.associatedSurveyId);
    return surveyId === HASH_ZERO_LOWER ? ethers.constants.HashZero : surveyId;
  } catch { return null; }
}

function getCachedQuestion(slug, questionId) {
  try {
    const cacheFile = resolve(QUESTION_CACHE_DIR, slug, `${sanitizeQuestionCacheKey(questionId)}.json`);
    if (!existsSync(cacheFile)) return null;
    return JSON.parse(readFileSync(cacheFile, 'utf8'));
  } catch {
    return null;
  }
}

function determineSurveyAssociation(slug, responses, lookupSurveyIdFn = lookupSurveyId) {
  const list = Array.isArray(responses) ? responses : [];
  const uniqueSurveyIds = new Set();
  let hasStandalone = false;
  let hasUnknown = false;

  for (const response of list) {
    const questionId = String(response?.questionId || '').trim();
    if (!questionId) {
      hasUnknown = true;
      continue;
    }
    const cachedSurveyId = lookupSurveyIdFn(slug, questionId);
    if (!cachedSurveyId) {
      hasUnknown = true;
      continue;
    }
    const normalized = normalizeSurveyId(cachedSurveyId);
    if (normalized === HASH_ZERO_LOWER) {
      hasStandalone = true;
      continue;
    }
    uniqueSurveyIds.add(normalized);
  }

  if (uniqueSurveyIds.size === 1 && !hasStandalone && !hasUnknown) {
    return {
      isStandalone: false,
      surveyId: Array.from(uniqueSurveyIds)[0],
      reason: 'single-survey',
    };
  }

  if (uniqueSurveyIds.size > 1) {
    return { isStandalone: true, surveyId: ethers.constants.HashZero, reason: 'mixed-surveys' };
  }
  if (uniqueSurveyIds.size === 1 && hasStandalone) {
    return { isStandalone: true, surveyId: ethers.constants.HashZero, reason: 'mixed-standalone-and-survey' };
  }
  if (uniqueSurveyIds.size === 1 && hasUnknown) {
    return { isStandalone: true, surveyId: ethers.constants.HashZero, reason: 'unknown-question-association' };
  }
  if (hasUnknown) {
    return { isStandalone: true, surveyId: ethers.constants.HashZero, reason: 'unknown-question-association' };
  }
  return { isStandalone: true, surveyId: ethers.constants.HashZero, reason: 'standalone' };
}

function getProvider() {
  const rpcUrl = resolveRpcUrlsForChain(DEFAULT_CHAIN_ID)[0];
  return new ethers.providers.JsonRpcProvider(rpcUrl, DEFAULT_CHAIN_ID);
}

function makeSignTypedData(wallet) {
  return (domain, types, message) => wallet._signTypedData(domain, types, message);
}

function getSurveysAddress() {
  const contracts = SESSION_CONTRACTS_BY_CHAIN[DEFAULT_CHAIN_ID];
  return contracts?.surveys || null;
}

// Conviction label → numeric value (0-10 scale matching CE)
function convictionToNumber(conviction) {
  if (conviction == null || conviction === '') return null;
  if (typeof conviction === 'number') return Math.max(0, Math.min(10, Math.round(conviction)));
  const str = String(conviction).trim();
  const asNum = Number(str);
  if (!Number.isNaN(asNum) && str !== '') return Math.max(0, Math.min(10, Math.round(asNum)));
  const lower = str.toLowerCase();
  if (lower.includes('strongest') || lower.includes('10')) return 10;
  if (lower.includes('high')) return 8;
  if (lower.includes('medium')) return 5;
  if (lower.includes('low')) return 2;
  return null; // default — match client behavior
}

// --- Arweave upload via CE worker ---

async function uploadToArweave(workerUrl, token, data) {
  const payload = JSON.stringify(data);
  debug(`[submit] Uploading ${payload.length} bytes to Arweave via ${workerUrl}`);

  const res = await fetch(`${workerUrl}/arweave/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      data: payload,
      contentType: 'application/json',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Arweave upload failed (${res.status}): ${text}`);
  }

  const result = await res.json();
  const txId = result.id || result.txId || result.transactionId;
  if (!txId) {
    throw new Error('Arweave upload returned no transaction ID');
  }

  debug(`[submit] Arweave txId: ${txId}`);
  return txId;
}

// --- Build CE-compatible response payload ---

async function buildArweavePayload(
  response,
  slug,
  { signTypedData, account, chainId, surveyId, litHooks = null, gateOptions = [] } = {}
) {
  let answerValue = response.answer ?? '';
  const additionalValue = response.additional ?? '';
  const hasAdditionalValue = additionalValue != null && additionalValue !== '';
  const qType = String(response.questionType || 'unknown').toLowerCase().trim();
  const convictionNum = convictionToNumber(response.conviction);
  const importanceNum = (response.importance != null)
    ? convictionToNumber(response.importance)
    : null;
  const legacyEncryptAnswer = isEncryptionRequested(response?.encrypt);
  const hasExplicitEncryptAdditional = Object.prototype.hasOwnProperty.call(response || {}, 'encryptAdditional');
  const legacyEncryptAdditional = hasExplicitEncryptAdditional
    ? isEncryptionRequested(response?.encryptAdditional)
    : null;
  const normalizedAudiences = normalizeResponseAudienceSelections({
    answerAudience: response?.answerEncryptionAudience,
    answerGateId: response?.answerEncryptionGateId,
    additionalAudience: response?.additionalEncryptionAudience,
    additionalGateId: response?.additionalEncryptionGateId,
    encryptRequested: legacyEncryptAnswer,
    encryptAdditionalRequested: legacyEncryptAdditional,
    hasAdditionalText: hasAdditionalValue,
    gateOptions,
  });
  const shouldEncryptAnswer = isEncryptedAudience(normalizedAudiences.answerEncryptionAudience);
  const shouldEncryptAdditional = hasAdditionalValue
    ? isEncryptedAudience(normalizedAudiences.additionalEncryptionAudience)
    : false;
  const encryptionRequested = shouldEncryptAnswer || shouldEncryptAdditional;

  // Normalize answer by question type to match client format
  if (qType === 'rating') {
    let num = Number(answerValue);
    if (!Number.isFinite(num)) {
      const match = String(answerValue).match(/(\d+(?:\.\d+)?)/);
      num = match ? Number(match[1]) : NaN;
    }
    answerValue = Number.isFinite(num) ? Math.max(0, Math.min(10, num)) : 0;
  } else if (qType === 'binary') {
    const lower = String(answerValue).toLowerCase().trim();
    if (lower === 'yes' || lower === 'agree' || lower === 'true') answerValue = 'Agree';
    else if (lower === 'no' || lower === 'disagree' || lower === 'false') answerValue = 'Disagree';
    else if (lower === 'unsure') answerValue = 'Unsure';
  } else if (qType === 'multichoice') {
    if (typeof answerValue === 'string') answerValue = answerValue ? [answerValue] : [];
    if (Array.isArray(answerValue)) answerValue = answerValue.filter(v => v !== '');
    else answerValue = [String(answerValue)];
  }

  // Client leaves hash empty for binary/rating/multichoice — only freeform gets hashed
  const skipHash = ['binary', 'multichoice', 'rating'].includes(qType);

  // Look up original question prompt from cache
  const cachedQuestion = getCachedQuestion(slug, response.questionId);
  const questionPrompt = typeof cachedQuestion?.prompt === 'string' ? cachedQuestion.prompt : '';

  if (
    encryptionRequested
    && (
      typeof signTypedData !== 'function'
      || !String(account || '').trim()
      || chainId === undefined
      || chainId === null
    )
  ) {
    throw new Error('Encryption requested but no signer context provided — refusing to upload plaintext');
  }

  // Prefer stored response timestamp as epoch ms (matches client Date.now() format)
  let storedTs = null;
  if (response.timestamp != null) {
    const raw = response.timestamp;
    if (typeof raw === 'number') {
      storedTs = Number.isFinite(raw) ? raw : null;
    } else if (typeof raw === 'string' && raw.trim() !== '') {
      const asNum = Number(raw);
      storedTs = Number.isFinite(asNum) ? asNum : new Date(raw).getTime();
      if (!Number.isFinite(storedTs)) storedTs = null;
    }
  }

  const payload = {
    timeStamp: storedTs != null ? storedTs : Date.now(),
    sessionName: slug,
    questionID: response.questionId,
    type: response.questionType || 'unknown',
    prompt: questionPrompt,
    conviction: convictionNum,
    importance: importanceNum,
    answer: {
      value: answerValue,
      encrypted: false,
      encryptionAudience: normalizedAudiences.answerEncryptionAudience,
      encryptionGateId: normalizedAudiences.answerEncryptionGateId,
      audienceMode: 'explicit',
      hash: skipHash ? '' : ethers.utils.id(String(answerValue)),
      encryptedPortion: '',
    },
    additional: {
      value: additionalValue,
      encrypted: false,
      encryptionAudience: normalizedAudiences.additionalEncryptionAudience,
      encryptionGateId: normalizedAudiences.additionalEncryptionGateId,
      audienceMode: normalizedAudiences.additionalAudienceMode,
      hash: (additionalValue != null && additionalValue !== '') ? ethers.utils.id(String(additionalValue)) : '',
      encryptedPortion: '',
    },
    source: 'contextEngine-cc',
    responder: String(response.respondent ?? '').trim() || String(response.responder ?? '').trim(),
    encryptionRequested,
  };

  if (encryptionRequested) {
    const normalizedSurveyId = normalizeSurveyId(surveyId);
    const normalizedChainId = chainId ?? DEFAULT_CHAIN_ID;
    const buildLitOptsForAudience = (audience, gateId) => {
      if (audience !== 'gate') return undefined;
      if (!litHooks || typeof litHooks.saveKey !== 'function') {
        throw new Error('Gate audience requested but Lit saveKey hooks are unavailable.');
      }
      const gateOption = (Array.isArray(gateOptions) ? gateOptions : []).find(
        (entry) => String(entry?.gateId || '').trim() === String(gateId || '').trim()
      );
      if (!gateOption) {
        throw new Error(`Gate audience selected but gate "${String(gateId || '').trim() || '(missing)'}" is unavailable.`);
      }
      const gateChainId = Number(gateOption.chainId || normalizedChainId || DEFAULT_CHAIN_ID) || DEFAULT_CHAIN_ID;
      const resolvedChain = resolveLitChain({
        chainId: gateChainId,
        litChain: gateOption.litChain,
      });
      const accessControlConditions = buildSbtAccessControlConditions({
        sbtAddresses: gateOption.sbtAddresses,
        chainId: gateChainId,
        litChain: resolvedChain,
        mode: gateOption.mode,
      });
      if (!accessControlConditions) {
        throw new Error(`Gate "${gateOption.gateId}" is missing valid SBT access control conditions.`);
      }
      return {
        saveKey: litHooks.saveKey,
        accessControlConditions,
        chain: resolvedChain,
        chainId: gateChainId,
        rpcUrl: resolveRpcUrlsForChain(gateChainId)[0],
        chipotle: {
          sbtAddresses: gateOption.sbtAddresses,
          gateMode: gateOption.mode,
          chainId: gateChainId,
          rpcUrl: resolveRpcUrlsForChain(gateChainId)[0],
          litChain: resolvedChain,
        },
      };
    };

    if (shouldEncryptAnswer) {
      const normalizedKind = ['freeform', 'binary', 'rating', 'multichoice'].includes(qType) ? qType : 'freeform';
      if (qType === 'multichoice' && !Array.isArray(cachedQuestion?.options)) {
        throw new Error('Cannot encrypt multichoice response without cached question options — cache the question first');
      }
      const multichoiceOptions = qType === 'multichoice' ? cachedQuestion.options : [];
      const answerEncrypted = await encryptField({
        signTypedData,
        account,
        chainId: normalizedChainId,
        surveyId: normalizedSurveyId,
        qId: response.questionId,
        kind: normalizedKind,
        value: answerValue,
        optionsForKind: multichoiceOptions,
        litOpts: buildLitOptsForAudience(
          normalizedAudiences.answerEncryptionAudience,
          normalizedAudiences.answerEncryptionGateId
        ),
      });
      payload.answer = {
        value: '*',
        encrypted: true,
        encryptionAudience: normalizedAudiences.answerEncryptionAudience,
        encryptionGateId: normalizedAudiences.answerEncryptionGateId,
        audienceMode: 'explicit',
        hash: answerEncrypted.commitments.keccak256,
        encryptedPortion: answerEncrypted.envelopeJson,
      };
    }

    if (shouldEncryptAdditional && hasAdditionalValue) {
      const additionalEncrypted = await encryptField({
        signTypedData,
        account,
        chainId: normalizedChainId,
        surveyId: normalizedSurveyId,
        qId: response.questionId,
        kind: 'freeform',
        value: additionalValue,
        litOpts: buildLitOptsForAudience(
          normalizedAudiences.additionalEncryptionAudience,
          normalizedAudiences.additionalEncryptionGateId
        ),
      });
      payload.additional = {
        value: '*',
        encrypted: true,
        encryptionAudience: normalizedAudiences.additionalEncryptionAudience,
        encryptionGateId: normalizedAudiences.additionalEncryptionGateId,
        audienceMode: normalizedAudiences.additionalAudienceMode,
        hash: additionalEncrypted.commitments.keccak256,
        encryptedPortion: additionalEncrypted.envelopeJson,
      };
    }
  }

  return payload;
}

// --- Submit responses on-chain ---

function hasEncryptionRequests(responses) {
  return Array.isArray(responses)
    && responses.some((response) => (
      isEncryptionRequested(response?.encrypt)
      || isEncryptionRequested(response?.encryptAdditional)
      || isEncryptedAudience(response?.answerEncryptionAudience)
      || isEncryptedAudience(response?.additionalEncryptionAudience)
    ));
}

export async function submitResponses(responses, slug, token, deps = {}) {
  if (!responses || responses.length === 0) {
    return { ok: false, error: 'No responses to submit.' };
  }

  const requestedEncryption = hasEncryptionRequests(responses);

  // 1. Check for private key
  const privateKey = getStoredPrivateKey();
  if (!privateKey) {
    return { ok: false, error: 'No private key stored. Re-authenticate via PWA.' };
  }

  // 2. Get worker URL for Arweave uploads
  const getWorkerUrl = typeof deps.getCorsWorkerUrl === 'function'
    ? deps.getCorsWorkerUrl
    : getCorsWorkerUrl;
  let workerUrl;
  try {
    workerUrl = await getWorkerUrl(slug);
  } catch (err) {
    return { ok: false, error: `Failed to get worker URL: ${err.message}` };
  }
  if (!workerUrl) {
    return { ok: false, error: `No worker URL found for session "${slug}".` };
  }

  // 3. Get contract address
  const getSurveysAddressFn = typeof deps.getSurveysAddress === 'function'
    ? deps.getSurveysAddress
    : getSurveysAddress;
  const surveysAddress = getSurveysAddressFn();
  if (!surveysAddress) {
    return { ok: false, error: 'No surveys contract address configured.' };
  }

  // 4. Determine survey association before per-response encryption/upload.
  const association = determineSurveyAssociation(slug, responses);
  const associatedSurveyId = association.surveyId;
  const isStandalone = association.isStandalone;

  debug(`[submit] Submitting ${responses.length} responses for session "${slug}"`);
  if (requestedEncryption) {
    debug('[submit] One or more responses requested encryption');
  }
  debug(`[submit] Worker: ${workerUrl}, Contract: ${surveysAddress}`);

  try {
    // 5. Build signer context once and reuse for all encrypted fields.
    const getProviderFn = typeof deps.getProvider === 'function' ? deps.getProvider : getProvider;
    const provider = getProviderFn();
    const wallet = new ethers.Wallet(privateKey, provider);
    const walletAddress = normalizeAddressLower(wallet.address);

    const mismatchedResponse = responses.find(
      (response) => normalizeAddressLower(response?.respondent) !== walletAddress
    );
    if (mismatchedResponse) {
      return {
        ok: false,
        error: `Wallet key (${shortAddress(walletAddress)}) does not match respondent address (${shortAddress(mismatchedResponse.respondent)}). Re-authenticate with the correct wallet via the PWA.`,
      };
    }

    const signTypedData = makeSignTypedData(wallet);
    const chainId = DEFAULT_CHAIN_ID;
    const metadata = await getSessionMetadata(slug).catch(() => null);
    const gateOptions = deriveResponseGateOptionsFromMetadata(metadata, {
      isQuestionResponseFlow: association.isStandalone,
    }).gateOptions;
    const needsLitRecipients = responses.some((response) => {
      const hasAdditionalValue = response?.additional != null && response?.additional !== '';
      const normalizedAudiences = normalizeResponseAudienceSelections({
        answerAudience: response?.answerEncryptionAudience,
        answerGateId: response?.answerEncryptionGateId,
        additionalAudience: response?.additionalEncryptionAudience,
        additionalGateId: response?.additionalEncryptionGateId,
        encryptRequested: isEncryptionRequested(response?.encrypt),
        encryptAdditionalRequested: Object.prototype.hasOwnProperty.call(response || {}, 'encryptAdditional')
          ? isEncryptionRequested(response?.encryptAdditional)
          : null,
        hasAdditionalText: hasAdditionalValue,
        gateOptions,
      });
      return (
        normalizedAudiences.answerEncryptionAudience === 'gate' ||
        (hasAdditionalValue && normalizedAudiences.additionalEncryptionAudience === 'gate')
      );
    });
    const litHooks = needsLitRecipients
      ? await createNodeLitHooks({
          workerUrl,
          token,
          sessionSlug: slug,
          chainId,
        })
      : null;

    // 6. Upload each response to Arweave
    const questionIds = [];
    const responseHashes = [];
    const arweaveTxIds = [];

    for (const response of responses) {
      const payload = await buildArweavePayload(response, slug, {
        signTypedData,
        account: wallet.address,
        chainId,
        surveyId: associatedSurveyId,
        litHooks,
        gateOptions,
      });
      const txId = await uploadToArweave(workerUrl, token, payload);
      const hexHash = base64urlToHex(txId);

      questionIds.push(toBytes32(response.questionId));
      responseHashes.push(hexHash);
      arweaveTxIds.push(txId);
    }

    // 7. Determine surveyId from on-chain question data
    // The contract's submitResponses checks: if (surveyId != 0 && surveyResponseHash != 0)
    // then require(survey exists). For standalone questions (associatedSurveyId == 0x00),
    // we MUST pass HashZero for both to skip that check.
    let surveyId = ethers.constants.HashZero;
    let surveyResponseHash = ethers.constants.HashZero;
    let surveyTxId = null;

    if (!isStandalone) {
      // Questions belong to a real survey — upload survey-level response and use that surveyId
      surveyId = association.surveyId;
      const surveyPayload = {
        timeStamp: new Date().toISOString(),
        sessionName: slug,
        source: 'contextEngine-cc',
        responseCount: responses.length,
        questionIds,
      };
      surveyTxId = await uploadToArweave(workerUrl, token, surveyPayload);
      surveyResponseHash = base64urlToHex(surveyTxId);
      debug(`[submit] Using survey: ${surveyId.slice(0, 18)}...`);
    } else {
      debug(`[submit] Standalone/mixed questions — using HashZero surveyId (${association.reason})`);
    }

    // 8. Sign and send transaction
    debug(`[submit] Signing with wallet: ${wallet.address}`);
    debug(`[submit] questionIds: ${questionIds.length}, standalone: ${isStandalone}`);

    const contract = new ethers.Contract(surveysAddress, SURVEYS_ABI, wallet);
    const tx = await contract.submitResponses(
      questionIds,
      responseHashes,
      surveyId,
      surveyResponseHash,
    );

    debug(`[submit] TX sent: ${tx.hash}`);
    const receipt = await tx.wait();
    debug(`[submit] TX confirmed in block ${receipt.blockNumber}`);

    try {
      recordConfirmedSubmission({
        slug,
        walletAddress: wallet.address,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        questionIds: responses.map((response) => String(response?.questionId || '').trim()).filter(Boolean),
        arweaveTxIds,
        surveyId,
        surveyArweaveTxId: surveyTxId,
        submittedAt: new Date().toISOString(),
      });
    } catch (stateErr) {
      warn(`[submit] Failed to record local confirmed submission state: ${stateErr.message}`);
    }

    const result = {
      ok: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      arweaveTxIds,
      count: responses.length,
      standalone: isStandalone,
      submittedQuestionIds: responses
        .map((response) => String(response?.questionId || '').trim())
        .filter(Boolean),
    };
    if (!isStandalone && surveyTxId) result.surveyArweaveTxId = surveyTxId;
    return result;
  } catch (err) {
    error(`[submit] Failed:`, err.message);
    return { ok: false, error: err.message };
  }
}

// Question ID generation — delegated to shared utility (client/src/utilities/shared/questionUtils.mjs)
export const generateQuestionId = _generateQuestionId;

// --- Build Arweave payload for a question ---

function buildQuestionPayload(question, questionId, wallet, slug) {
  const payload = {
    id: questionId,
    type: question.type,
    prompt: question.prompt,
    tags: question.tags || [],
    creator: wallet.address,
    associatedSurveyId: ethers.constants.HashZero,
    sessionName: slug,
    groupName: '', // Reserved for future SBT-linked questions, always blank for now
    createdAt: new Date().toISOString(),
    source: 'contextEngine-cc',
  };
  // Only include multichoice-specific fields for multichoice questions
  if (question.type === 'multichoice') {
    payload.options = question.options || [];
    if (question.singleSelect) payload.singleSelect = true;
  }
  return payload;
}

// --- Submit questions on-chain ---

export async function submitQuestions(questions, slug, token) {
  if (!questions || questions.length === 0) {
    return { ok: false, error: 'No questions to submit.' };
  }

  // 1. Check for private key
  const privateKey = getStoredPrivateKey();
  if (!privateKey) {
    return { ok: false, error: 'No private key stored. Re-authenticate via PWA.' };
  }

  // 2. Get worker URL for Arweave uploads
  let workerUrl;
  try {
    workerUrl = await getCorsWorkerUrl(slug);
  } catch (err) {
    return { ok: false, error: `Failed to get worker URL: ${err.message}` };
  }
  if (!workerUrl) {
    return { ok: false, error: `No worker URL found for session "${slug}".` };
  }

  // 3. Get contract address
  const surveysAddress = getSurveysAddress();
  if (!surveysAddress) {
    return { ok: false, error: 'No surveys contract address configured.' };
  }

  debug(`[submit] Creating ${questions.length} questions for session "${slug}"`);
  debug(`[submit] Worker: ${workerUrl}, Contract: ${surveysAddress}`);

  try {
    const provider = getProvider();
    const wallet = new ethers.Wallet(privateKey, provider);

    // 4. Upload each question to Arweave and collect IDs
    const questionIds = [];
    const contentHashes = [];
    const surveyIds = [];
    const resultQuestions = [];

    for (const question of questions) {
      const questionId = generateQuestionId(question.type, question.prompt, question.options, question.singleSelect);
      const payload = buildQuestionPayload(question, questionId, wallet, slug);
      const txId = await uploadToArweave(workerUrl, token, payload);
      const hexHash = base64urlToHex(txId);

      questionIds.push(toBytes32(questionId));
      contentHashes.push(hexHash);
      surveyIds.push(ethers.constants.HashZero); // standalone
      resultQuestions.push({ questionId, arweaveTxId: txId, payload });
    }

    // 5. Sign and send transaction
    debug(`[submit] Signing with wallet: ${wallet.address}`);
    const contract = new ethers.Contract(surveysAddress, SURVEYS_ABI, wallet);
    const tx = await contract.addQuestions(questionIds, contentHashes, surveyIds);

    debug(`[submit] TX sent: ${tx.hash}`);
    const receipt = await tx.wait();
    debug(`[submit] TX confirmed in block ${receipt.blockNumber}`);

    // 6. Cache each question locally
    for (const rq of resultQuestions) {
      const cacheDir = resolve(QUESTION_CACHE_DIR, slug);
      mkdirSync(cacheDir, { recursive: true });
      const cacheFile = resolve(cacheDir, `${sanitizeQuestionCacheKey(rq.questionId)}.json`);
      writeFileSync(cacheFile, JSON.stringify(rq.payload, null, 2));
    }

    return {
      ok: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      questions: resultQuestions.map(rq => ({ questionId: rq.questionId, arweaveTxId: rq.arweaveTxId })),
    };
  } catch (err) {
    error(`[submit] Failed:`, err.message);
    return { ok: false, error: err.message };
  }
}

// --- Check if submission infrastructure is ready ---

export function canSubmit() {
  const hasKey = !!getStoredPrivateKey();
  const hasContract = !!getSurveysAddress();
  return { ready: hasKey && hasContract, hasKey, hasContract };
}

export const __test__submit = {
  base64urlToHex,
  buildArweavePayload,
  hasEncryptionRequests,
  sanitizeQuestionCacheKey,
  normalizeSurveyId,
  determineSurveyAssociation,
};
