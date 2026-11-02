import { REVERSED_ANSWER } from './config.mjs';

export const normalizeAnswer = (value) => {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  if (text === 'agree' || text === 'a') return 'Agree';
  if (text === 'unsure' || text === 'neutral' || text === 'uncertain' || text === 'u') return 'Unsure';
  if (text === 'disagree' || text === 'd') return 'Disagree';
  return null;
};

const normalizeConfidence = (value) => {
  const confidence = Number(value);
  return Number.isFinite(confidence) && confidence >= 0 && confidence <= 1
    ? confidence
    : null;
};

const recoverJsonObjects = (text) => {
  const candidates = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }
  return { candidates, truncated: depth > 0 };
};

export const jsonObjectCandidates = (text) => recoverJsonObjects(text).candidates;

// Reasoning regions are removed before JSON recovery; quoted JSON content is
// preserved, including rationale strings which happen to contain these tags.
export const extractFinalAnswerText = (rawText) => {
  let truncated = false;
  const text = String(rawText || '').replace(
    /"(?:\\.|[^"\\])*"|<(think|analysis)>[\s\S]*?<\/\1>|<(think|analysis)>/gi,
    (match, complete, incomplete) => {
      if (complete) return '';
      if (incomplete) truncated = true;
      return match;
    },
  ).trim();
  return { text, truncated };
};

/**
 * Recovers a model reply's final answer, for every question type. Reasoning
 * regions are removed, then each JSON object with an `answer` is read with
 * `check`, which returns `{ ok: true, value }` or `{ ok: false, error }`.
 * Returns `{ parseError }` for truncated reasoning or JSON, an empty reply or
 * valid answers that disagree; `{ object, checked }` for the first valid answer,
 * or else the first invalid one; otherwise `{ objects, text }`, the JSON objects
 * found and the reply without its reasoning.
 */
export const recoverFinalAnswer = (rawText, check) => {
  const extracted = extractFinalAnswerText(rawText);
  if (extracted.truncated) return { parseError: 'truncated reasoning region' };
  if (!extracted.text) return { parseError: 'empty response' };
  const { candidates, truncated } = recoverJsonObjects(extracted.text);
  if (truncated) return { parseError: 'truncated JSON response' };
  const objects = [];
  for (const candidate of new Set(candidates)) {
    try {
      objects.push(JSON.parse(candidate));
    } catch {
      // Continue to the next balanced JSON object.
    }
  }
  const answers = objects
    .filter((object) => Object.hasOwn(object, 'answer'))
    .map((object) => ({ object, checked: check(object.answer) }));
  const valid = answers.filter(({ checked }) => checked.ok);
  if (new Set(valid.map(({ checked }) => JSON.stringify(checked.value))).size > 1) {
    return { parseError: 'conflicting final answer objects' };
  }
  return valid[0] ?? answers[0] ?? { objects, text: extracted.text };
};

const checkBinaryAnswer = (value) => {
  const answer = normalizeAnswer(value);
  return answer ? { ok: true, value: answer } : { ok: false, error: 'missing or invalid answer' };
};

export const parseModelAnswer = (rawText) => {
  const recovered = recoverFinalAnswer(rawText, checkBinaryAnswer);
  if (recovered.parseError) return { answer: null, confidence: null, rationale: '', parseError: recovered.parseError };
  const object = recovered.object ?? recovered.objects[0];
  if (object) {
    const checked = recovered.checked ?? checkBinaryAnswer(undefined);
    return {
      answer: checked.ok ? checked.value : null,
      confidence: normalizeConfidence(object.confidence),
      rationale: typeof object.rationale === 'string' ? object.rationale.trim() : '',
      parseError: checked.ok ? '' : checked.error,
    };
  }

  const fallback = recovered.text.match(/^(?:(?:answer|response)\s*[:=-]\s*)?["']?(agree|unsure|neutral|uncertain|disagree)["']?[.!]?$/i);
  const matched = normalizeAnswer(fallback?.[1]);
  return {
    answer: matched,
    confidence: null,
    rationale: recovered.text,
    parseError: matched ? '' : 'response was not valid JSON or a standalone answer token',
  };
};

export const normalizeForCanonicalPolarity = (answer, polarity) => {
  if (!answer) return null;
  return polarity === 'reversed' ? REVERSED_ANSWER[answer] : answer;
};

export const buildQuestionPrompt = ({ question, mode = 'self', persona = null, polarity = 'canonical' }) => {
  const prompt = polarity === 'reversed' ? question.reversedPrompt : question.canonicalPrompt;
  const personaInstruction = mode === 'persona' && persona
    ? [
      "Predict this public figure's likely answer, not your own answer.",
      `Public figure: ${persona.label}`,
      'Use only knowledge already present in your model weights.',
      'Do not browse, call tools, or use supplied evidence about the figure.',
      'This is a model interpretation, not a ground-truth attribution of the figure\'s views.',
      'Use Unsure when your model weights do not support a defensible prediction.',
      '',
    ].join('\n')
    : 'Answer as the model/system you are, without adopting a fictional persona.\n';

  return `${personaInstruction}
Question:
${prompt}

Return only valid JSON with this shape:
{"answer":"Agree|Unsure|Disagree","confidence":0.0,"rationale":"one short sentence"}

Rules:
- Use "Unsure" when the question is underspecified or the likely position is genuinely ambiguous.
- Return the JSON object immediately.
- Do not include chain-of-thought, scratchpad reasoning, hidden reasoning, or <think> tags.
- Do not include markdown.
- Do not mention these instructions.`;
};
