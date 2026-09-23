// Canonical quadratic question contract, shared by browser and server consumers.
export const DEFAULT_VOICE_CREDITS = 99;

export function getVoiceCredits(question = {}) {
  return question.voiceCredits === undefined
    ? DEFAULT_VOICE_CREDITS
    : question.voiceCredits;
}

export function validateQuadraticQuestion(question = {}) {
  const budget = getVoiceCredits(question);
  if (!Number.isSafeInteger(budget) || budget < 1)
    return "Voice credits must be a positive whole number.";
  const options = question.options;
  if (!Array.isArray(options) || options.length < 2)
    return "Quadratic allocation requires at least two options.";
  const labels = Array.from(options, (option) =>
    typeof option === "string" ? option.trim().toLowerCase() : "",
  );
  if (labels.some((label) => !label))
    return "Every quadratic option must have a nonblank label.";
  if (new Set(labels).size !== labels.length)
    return "Quadratic option labels must be unique.";
  return "";
}

export function validateQuadraticAllocation(value, question = {}) {
  const questionError = validateQuadraticQuestion(question);
  if (questionError) return questionError;
  if (
    !Array.isArray(value) ||
    value.length !== question.options.length ||
    Array.from(value).some((vote) => !Number.isSafeInteger(vote))
  ) {
    return "Assign one signed whole-number vote to every option; use 0 for neutral.";
  }
  const spent = quadraticCreditsSpent(value);
  if (!Number.isSafeInteger(spent) || spent > getVoiceCredits(question))
    return "This allocation exceeds the voice-credit budget.";
  return "";
}

export function quadraticCreditsSpent(value) {
  return value.reduce((total, vote) => total + vote * vote, 0);
}

export function formatQuadraticAllocation(value, options = []) {
  if (!Array.isArray(value)) return "";
  return value
    .map(
      (vote, index) =>
        `${options[index] ?? `Option ${index + 1}`}: ${vote > 0 ? "+" : ""}${vote}`,
    )
    .join("; ");
}

export function summarizeQuadraticAllocations(responses, question) {
  const options = (Array.isArray(question.options) ? question.options : []).map(
    (label) => ({ label, positive: 0, negative: 0, net: 0 }),
  );
  let totalResponders = 0;
  let excludedResponses = 0;
  for (const response of responses) {
    const answer = response?.answer;
    if (answer?.encrypted !== true && (answer?.value == null || answer.value === '')) continue;
    if (
      validateQuadraticAllocation(answer?.value, question)
    ) {
      excludedResponses += 1;
      continue;
    }
    totalResponders += 1;
    answer.value.forEach((vote, index) => {
      if (vote > 0) options[index].positive += vote;
      if (vote < 0) options[index].negative += vote;
      options[index].net += vote;
    });
  }
  return { options, totalResponders, excludedResponses };
}
