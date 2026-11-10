// Rules several AI prompts share, written once so every prompt states them the
// same way. Prompts run on OpenAI and Claude models alike.

// How a quadratic answer is written.
export const QUADRATIC_ANSWER_RULE =
  'A quadratic answer is one signed whole-number vote per option, in option order: positive supports, negative opposes and zero is neutral. The squares of the votes add up to at most voiceCredits (99 when unset), and unused credits are allowed.';

// How to read quadratic answers when analysing them.
export const QUADRATIC_READING_RULE = `${QUADRATIC_ANSWER_RULE} Read stance from the signed votes, not from the credits they cost, and treat an all-zero answer as an explicit neutral answer, not a missing one.`;

// How to write a quadratic question.
export const QUADRATIC_QUESTION_RULE =
  'A quadratic question lists at least two distinct options and sets "voiceCredits" to 99 unless a different positive whole-number budget is requested.';

// How to tag a question.
export const QUESTION_TAG_RULE =
  'Give each question 2 to 5 tags of one to three words: general, reusable topics, with no duplicates and nothing that identifies a person. Prefer a suggested tag when it fits; otherwise make a new one.';
