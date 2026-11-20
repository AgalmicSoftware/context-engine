// Which of a person's answers a personal analysis card shows. The card's AI chooses one answer of each kind by
// question id; every word shown from an answer is the person's own, taken from the same visible answers the
// analysis read. A choice that is not a real answer of the right kind falls back to the first answer of that
// kind. The session page and the MCP choose with this, so a card shows the same answers whoever made it.

const record = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const flat = (value) => (typeof value === 'string' || typeof value === 'number' ? String(value).replace(/\s+/g, ' ').trim() : '');
// Quote marks differ between what a person typed and what a model copies back.
const plain = (value) => flat(value).replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
const optionText = (option) => flat(record(option).text || record(option).label || option);

const QUOTE_MIN = 12;
const QUOTE_MAX = 160;

// The answers a card may show, by kind and question id, from the questions payload the analysis was given:
// [{ id, type, prompt, answer, additionalComment?, options? }].
const buildPool = (questions) => {
  const pool = { yesNo: new Map(), ownWords: new Map(), vote: new Map() };
  (Array.isArray(questions) ? questions : []).forEach((entry) => {
    const question = record(entry);
    const id = flat(question.id);
    const prompt = flat(question.prompt);
    const { answer, type } = question;
    if (!id || !prompt) return;
    const own = [];
    if (type === 'binary' && flat(answer)) pool.yesNo.set(id, { prompt, text: flat(answer) });
    if (type === 'freeform' && flat(answer)) own.push({ prompt, text: flat(answer), stance: '', trimmed: false });
    if (flat(question.additionalComment)) {
      own.push({ prompt, text: flat(question.additionalComment), stance: type === 'binary' ? flat(answer) : '', trimmed: false });
    }
    if (own.length) pool.ownWords.set(id, own);
    if (type === 'multichoice') {
      const items = (Array.isArray(answer) ? answer : [answer]).map(optionText).filter(Boolean);
      if (items.length) pool.vote.set(id, { prompt, kind: 'chose', items });
    }
    if (type === 'quadratic' && Array.isArray(answer) && Array.isArray(question.options)) {
      const votes = answer.map(Number);
      const top = Math.max(...votes);
      const items = top > 0 ? votes.map((vote, index) => (vote === top ? optionText(question.options[index]) : '')).filter(Boolean) : [];
      if (items.length) pool.vote.set(id, { prompt, kind: 'votes', items });
    }
  });
  return pool;
};

const first = (map) => map.values().next().value ?? null;

// Whether `quote` is a run of whole words of `text`. A quote that starts or ends inside a word could turn
// "unacceptable" into "acceptable", or "non-binding" into "binding": a hyphen or apostrophe joins a word, and so
// do the marks some scripts write their vowels with.
const isWholeWordsOf = (text, quote) => {
  const wordChar = /[\p{L}\p{N}\p{M}'’-]/u;
  const joins = (a, b) => wordChar.test(a) && wordChar.test(b);
  for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + 1)) {
    const cutsStart = joins(text[at - 1] || '', quote[0]);
    const cutsEnd = joins(quote[quote.length - 1], text[at + quote.length] || '');
    if (!cutsStart && !cutsEnd) return true;
  }
  return false;
};

const chooseOwnWords = (pool, chosen) => {
  const quote = flat(chosen.quote);
  const rows = pool.ownWords.get(flat(chosen.questionId)) || [];
  // The shorter passage is shown only when it is word for word the person's own; otherwise their whole answer.
  const quoted = quote.length >= QUOTE_MIN && quote.length <= QUOTE_MAX
    ? rows.find((row) => isWholeWordsOf(plain(row.text), plain(quote)))
    : undefined;
  if (quoted) return { ...quoted, text: quote, trimmed: true };
  return rows[0] || first(pool.ownWords)?.[0] || null;
};

/**
 * The card's answers, `{ yesNo, ownWords, vote }` (each null where the person gave none of that kind), from the
 * questions payload and the card reply's `answers` choice.
 */
export const chooseAnalysisCardAnswers = (questions, chosen) => {
  const pool = buildPool(questions);
  const picks = record(chosen);
  return {
    yesNo: pool.yesNo.get(flat(record(picks.yesNo).questionId)) || first(pool.yesNo),
    ownWords: chooseOwnWords(pool, record(picks.ownWords)),
    vote: pool.vote.get(flat(record(picks.vote).questionId)) || first(pool.vote),
  };
};
