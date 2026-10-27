// Canonical question ids, shared by browser, MCP and CE-CC consumers.
// Ids are referenced on-chain and in storage, so every id the legacy text
// encoding gives unambiguously stays byte-identical. Only multichoice inputs
// that text cannot tell apart hash a versioned JSON encoding instead.
// Consumers pass their own ethers v5, so this module imports no packages.

const validOptions = (options) => (Array.isArray(options) ? options.filter((o) => o && o.trim() !== '') : []);

const legacyPreimage = (type, prompt, options, singleSelect, voiceCredits) => {
  let preimage = `${type}:${(prompt || '').trim().toLowerCase()}`;
  const validOpts = validOptions(options);
  if (type === 'multichoice') {
    if (validOpts.length > 0)
      preimage += `:${validOpts
        .map((o) => o.trim())
        .join(',')
        .toLowerCase()}`;
    if (singleSelect) preimage += ':single';
  }
  if (type === 'quadratic') {
    preimage += `:${JSON.stringify(validOpts.map((option) => option.trim().toLowerCase()))}:${voiceCredits}`;
  }
  return preimage;
};

// Legacy multichoice text decodes uniquely only when there is an option, no
// option holds a delimiter, and a lone "single" option cannot pass for the
// single-select suffix. Prompts come first, so a ":" in them is harmless.
const legacyIsAmbiguous = (type, options, singleSelect) => {
  if (type !== 'multichoice') return false;
  const labels = validOptions(options).map((o) => o.trim().toLowerCase());
  return (
    labels.length === 0 ||
    labels.some((label) => label.includes(':') || label.includes(',')) ||
    (!singleSelect && labels.length === 1 && labels[0] === 'single')
  );
};

const v2Text = (text) => (text || '').trim().toLowerCase().normalize('NFC');

// Legacy text always starts "<type>:", so this JSON array cannot collide with
// it. singleSelect counts by truthiness, as the legacy suffix always has.
const v2Preimage = (type, prompt, options, singleSelect) =>
  JSON.stringify(['ce-question-id', 2, type, v2Text(prompt), validOptions(options).map(v2Text), !!singleSelect]);

export const createQuestionIdDerivation = (ethers) => {
  const { id: hash } = ethers.utils;

  const generateQuestionId = (type, prompt, options = [], singleSelect = false, voiceCredits = 99) =>
    hash(
      legacyIsAmbiguous(type, options, singleSelect)
        ? v2Preimage(type, prompt, options, singleSelect)
        : legacyPreimage(type, prompt, options, singleSelect, voiceCredits),
    );

  // Legacy ids already published for ambiguous content are genuine, so a
  // multichoice id matches its content under either encoding.
  const questionIdMatchesContent = (id, { type, prompt, options = [], singleSelect = false, voiceCredits = 99 } = {}) => {
    const wanted = String(id).toLowerCase();
    return (
      hash(legacyPreimage(type, prompt, options, singleSelect, voiceCredits)) === wanted ||
      (type === 'multichoice' && hash(v2Preimage(type, prompt, options, singleSelect)) === wanted)
    );
  };

  return Object.freeze({ generateQuestionId, questionIdMatchesContent });
};
