import { MAX_ANSWER_PLAINTEXT_BYTES, readAnswerTooLongMessage, sessionStoresAnswersInWorker } from './answerSizeBudget';

// Each value is counted as a JSON string, so a string's two quotes count too.
const textOfBytes = (bytes: number, char = 'x') => char.repeat(bytes - 2);

describe('answer size budget', () => {
  it("matches the session Worker's plaintext budget", () => {
    expect(MAX_ANSWER_PLAINTEXT_BYTES).toBe(49_152);
  });

  it('accepts an answer and comment that exactly fill the budget', () => {
    const half = MAX_ANSWER_PLAINTEXT_BYTES / 2;
    expect(readAnswerTooLongMessage(textOfBytes(half), textOfBytes(half))).toBe('');
    expect(readAnswerTooLongMessage(textOfBytes(MAX_ANSWER_PLAINTEXT_BYTES), undefined)).toBe('');
  });

  it('counts the comment with the answer and says how much to cut', () => {
    const half = MAX_ANSWER_PLAINTEXT_BYTES / 2;
    expect(readAnswerTooLongMessage(textOfBytes(half), textOfBytes(half + 1))).toBe(
      'This answer is too long to save. Shorten it by about 1 character.',
    );
    expect(readAnswerTooLongMessage(textOfBytes(MAX_ANSWER_PLAINTEXT_BYTES + 1500), '')).toBe(
      'This answer is too long to save. Shorten it by about 1,502 characters.',
    );
  });

  it('counts UTF-8 bytes and converts the excess back to characters', () => {
    // 'é' is 2 bytes in UTF-8, so 24,676 of them plus 2 quotes are 202 bytes
    // over: about 101 characters, rounded up because the quotes are 1 byte each.
    const message = readAnswerTooLongMessage('é'.repeat(MAX_ANSWER_PLAINTEXT_BYTES / 2 + 100), undefined);
    expect(message).toBe('This answer is too long to save. Shorten it by about 102 characters.');
  });

  it('measures structured answers as JSON', () => {
    const options = Array.from({ length: 5000 }, (_, index) => `option-${index}`);
    expect(readAnswerTooLongMessage(options, '')).toMatch(/^This answer is too long to save\./);
    expect(readAnswerTooLongMessage(['a', 'b'], { note: 'short' })).toBe('');
  });

  it('applies only where the session Worker stores answers', () => {
    expect(sessionStoresAnswersInWorker({ storageProfile: { backend: 'cloudflare' } })).toBe(true);
    expect(
      sessionStoresAnswersInWorker({ storageProfile: { backend: 'cloudflare', resources: { responses: 'staged' } } }),
    ).toBe(false);
    expect(sessionStoresAnswersInWorker({ storageProfile: { backend: 'arweave' } })).toBe(false);
    expect(sessionStoresAnswersInWorker({})).toBe(false);
  });
});
