import {
  buildEnvelopeObject,
  buildResponseFieldAAD,
  encodePaddedEnvelopePlaintext,
} from '@ce-shared/encryption/envelopeV1Core.mjs';
import { validateStorageUploadPayload } from '../../../../workers/sessionCorsWorker/storageUploadValidation.js';
import {
  MAX_ANSWER_PLAINTEXT_BYTES,
  MAX_STORED_ANSWER_BYTES,
  readAnswerTooLongMessage,
  sessionStoresAnswersInWorker,
} from './answerSizeBudget';

const KIB = 1024;
const QUESTION_ID = `0x${'5d'.repeat(32)}`;
// Each value is counted as a JSON string, so a string's two quotes count too.
const textOfBytes = (bytes: number, char = 'x') => char.repeat(bytes - 2);
const field = (value: unknown, extra: Record<string, unknown> = {}) => ({ value, ...extra });
const lockedField = (value: unknown, encryptionAudience = 'self_admin') =>
  field(value, { encrypted: true, encryptionAudience });
const freeform = (prompt: string) => ({ id: QUESTION_ID, type: 'freeform', prompt });
const ANSWER_TOO_LONG = /^This answer is too long to save\. Shorten it by about [\d,]+ characters?\.$/;
const PROMPT_TOO_LONG =
  "Answers to this question can't be saved because its prompt is too long. Ask the session admin to shorten it.";
const LOCKED_TOO_LONG =
  "This locked answer can't be saved with this question's long prompt. Unlock it, or ask the session admin to shorten the question.";

// A stored answer built like the client's payload, with envelopes shaped like
// real locked fields (random bytes stand in for the ciphertext and keys).
const hex = (bytes: number) => `0x${'ab'.repeat(bytes)}`;
const randomB64 = (bytes: number) => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes))));
// The Worker's own check decides whether it would store the entry.
const workerAccepts = validateStorageUploadPayload as unknown as (input: { resource: string; bytes: Uint8Array }) => {
  ok: boolean;
};
const recipientsFor = (audience: string, context: string) => [
  {
    type: 'self-eip712-v1',
    context,
    wrap_iv: randomB64(12),
    wrapped_cek: randomB64(48),
    nonce: (2n ** 256n - 1n).toString(),
  },
  audience === 'gate'
    ? {
        type: 'lit-sbt-v1',
        lit: {
          chain: 'optimismSepolia',
          ciphertext: randomB64(768),
          dataToEncryptHash: `chipotle:v2:${hex(32)}:${hex(32)}`,
          chipotle: {
            version: 2,
            litActionCid: `bafybei${'a'.repeat(52)}`,
            litPkpId: hex(65),
            sbtAddresses: [hex(20)],
            gateMode: 'any',
            chainId: 11155420,
            policyFingerprint: hex(32),
            policy: {
              chainId: 11155420,
              gateMode: 'any',
              litActionCid: `bafybei${'a'.repeat(52)}`,
              litPkpId: hex(65),
              sbtAddresses: [hex(20)],
              version: 'chipotle-sbt-v2',
            },
          },
        },
      }
    : {
        type: 'worker-response-field-v1',
        policy: { owner: hex(20), audience, context, sessionSlug: 's'.repeat(128), sessionId: hex(16) },
        wrapped: { alg: 'AES-256-GCM', wrapAlg: 'AES-GCM-KW-v1', iv: 'i'.repeat(16), wrappedKey: 'k'.repeat(64) },
      },
];
const envelopeFor = (value: unknown, kind: string, audience: string, question: Record<string, unknown> = {}) => {
  const context = hex(32);
  const plaintext = encodePaddedEnvelopePlaintext({ v: 1, value, kind, salt: hex(32) }, question);
  return JSON.stringify(
    buildEnvelopeObject({
      iv: crypto.getRandomValues(new Uint8Array(12)),
      ciphertextBytes: crypto.getRandomValues(new Uint8Array(plaintext.byteLength + 16)),
      aadObj: buildResponseFieldAAD({
        contextHex: context,
        chainId: 11155420,
        surveyId: hex(32),
        qId: QUESTION_ID,
        fieldKey: kind,
      }),
      recipients: recipientsFor(audience, context),
      commitments: { keccak256: hex(32), poseidon: (2n ** 254n).toString() },
      kind,
    }),
  );
};
const storedField = (value: string, locked: boolean, kind: string, audience: string) => ({
  value: locked ? '*' : value,
  encrypted: locked,
  encryptionAudience: locked ? audience : 'public',
  encryptionGateId: audience === 'gate' ? hex(32) : null,
  audienceMode: 'explicit',
  hash: hex(32),
  encryptedPortion: locked ? envelopeFor(value, kind, audience) : '',
});
const storedEntryBytes = ({ prompt, answer, comment, locked, audience }: Record<string, any>) => {
  const entry = {
    questionID: QUESTION_ID,
    responder: hex(20),
    type: 'freeform',
    prompt,
    conviction: locked ? null : 7,
    importance: locked ? null : 4,
    answer: storedField(answer, locked, 'freeform', audience),
    additional: storedField(comment, locked, 'freeform', audience),
    ...(locked
      ? {
          importanceEncrypted: envelopeFor(4, 'rating', audience),
          convictionEncrypted: envelopeFor(7, 'rating', audience),
        }
      : {}),
    recruitment: { source: 'newsletter', campaign: 'spring' },
    responderName: 'Participant',
  };
  const bytes = new TextEncoder().encode(JSON.stringify(entry));
  return { size: bytes.byteLength, accepted: workerAccepts({ resource: 'responses', bytes }).ok };
};

describe('answer size budget', () => {
  it("matches the session Worker's stored and plaintext caps", () => {
    expect(MAX_STORED_ANSWER_BYTES).toBe(98_304);
    expect(MAX_ANSWER_PLAINTEXT_BYTES).toBe(49_152);
  });

  it('accepts an answer and comment that exactly fill the plaintext budget', () => {
    const half = MAX_ANSWER_PLAINTEXT_BYTES / 2;
    expect(readAnswerTooLongMessage({ answer: field(textOfBytes(half)), comment: field(textOfBytes(half)) })).toBe('');
    expect(
      readAnswerTooLongMessage({ answer: field(textOfBytes(MAX_ANSWER_PLAINTEXT_BYTES - 2)), comment: field('') }),
    ).toBe('');
  });

  it('counts the comment with the answer and says how much to cut', () => {
    const half = MAX_ANSWER_PLAINTEXT_BYTES / 2;
    expect(readAnswerTooLongMessage({ answer: field(textOfBytes(half)), comment: field(textOfBytes(half + 1)) })).toBe(
      'This answer is too long to save. Shorten it by about 1 character.',
    );
    expect(
      readAnswerTooLongMessage({ answer: field(textOfBytes(MAX_ANSWER_PLAINTEXT_BYTES + 1500)), comment: field('') }),
    ).toBe('This answer is too long to save. Shorten it by about 1,502 characters.');
  });

  it('counts UTF-8 bytes and converts the excess back to characters', () => {
    // 'é' is 2 bytes in UTF-8, so 24,676 of them plus quotes and an empty
    // comment are 204 bytes over: about 103 characters at this text's rate.
    const message = readAnswerTooLongMessage({
      answer: field('é'.repeat(MAX_ANSWER_PLAINTEXT_BYTES / 2 + 100)),
      comment: field(''),
    });
    expect(message).toBe('This answer is too long to save. Shorten it by about 103 characters.');
  });

  it('measures structured answers as JSON', () => {
    const options = Array.from({ length: 5000 }, (_, index) => `option-${index}`);
    expect(readAnswerTooLongMessage({ answer: field(options), comment: field('') })).toMatch(ANSWER_TOO_LONG);
    expect(readAnswerTooLongMessage({ answer: field(['a', 'b']), comment: field({ note: 'short' }) })).toBe('');
  });

  it('counts the prompt every stored answer repeats', () => {
    // Within the plaintext budget, but the 40 KiB prompt copy and the locked
    // envelopes take the stored entry past the Worker's cap.
    const question = freeform('p'.repeat(40 * KIB));
    const answer = lockedField(textOfBytes(24 * KIB));
    const comment = lockedField(textOfBytes(23 * KIB));
    expect(readAnswerTooLongMessage({ answer, comment })).toBe('');
    expect(readAnswerTooLongMessage({ question, answer, comment })).toMatch(ANSWER_TOO_LONG);
    // Unlocked, the same text fits beside the prompt.
    expect(
      readAnswerTooLongMessage({
        question,
        answer: field(textOfBytes(24 * KIB)),
        comment: field(textOfBytes(23 * KIB)),
      }),
    ).toBe('');
  });

  it('refuses every answer when the prompt alone fills the stored entry', () => {
    const question = freeform('p'.repeat(MAX_STORED_ANSWER_BYTES));
    expect(readAnswerTooLongMessage({ question, answer: field('Yes'), comment: field('') })).toBe(PROMPT_TOO_LONG);
    expect(readAnswerTooLongMessage({ question, answer: field(''), comment: field('') })).toBe(PROMPT_TOO_LONG);
    // A locked question stores a masked prompt instead.
    expect(readAnswerTooLongMessage({ question, promptLocked: true, answer: field('Yes'), comment: field('') })).toBe(
      '',
    );
  });

  it('says when locking leaves no room beside a long prompt', () => {
    const question = freeform('p'.repeat(93 * KIB));
    expect(readAnswerTooLongMessage({ question, answer: field('Yes'), comment: field('') })).toBe('');
    expect(readAnswerTooLongMessage({ question, answer: lockedField('Yes'), comment: field('') })).toBe(
      LOCKED_TOO_LONG,
    );
  });

  it('keeps an unchanged locked field at the size of its stored envelope', () => {
    const question = freeform('p'.repeat(4 * KIB));
    const answer = { ...lockedField('*'), encryptedPortion: 'e'.repeat(80 * KIB) };
    expect(
      readAnswerTooLongMessage({ question, answer: lockedField('*'), comment: field(textOfBytes(12 * KIB)) }),
    ).toBe('');
    // Only the comment can be shortened, so the count comes from its text alone.
    expect(readAnswerTooLongMessage({ question, answer, comment: field(textOfBytes(12 * KIB)) })).toBe(
      'This answer is too long to save. Shorten it by about 2,056 characters.',
    );
    expect(
      readAnswerTooLongMessage({
        question,
        answer: { ...answer, encryptedPortion: 'e'.repeat(95 * KIB) },
        comment: field(''),
      }),
    ).toBe(LOCKED_TOO_LONG);
  });

  it.each([
    ['unlocked', false, 'self_admin'],
    ['locked for the session admin', true, 'self_admin'],
    ['locked to an SBT gate', true, 'gate'],
  ])('agrees with the Worker on %s answers beside prompts of any length', (_label, locked, audience) => {
    const rows = [];
    for (const promptKiB of [0, 8, 16, 24, 40, 60, 90]) {
      for (const textKiB of [1, 8, 16, 23]) {
        const prompt = 'p'.repeat(promptKiB * KIB);
        const answer = textOfBytes(textKiB * KIB);
        const comment = textOfBytes(textKiB * KIB, 'c');
        const stored = storedEntryBytes({ prompt, answer, comment, locked, audience });
        const message = readAnswerTooLongMessage({
          question: freeform(prompt),
          answer: locked ? lockedField(answer, audience) : field(answer),
          comment: locked ? lockedField(comment, audience) : field(comment),
          ratingCount: locked ? 2 : 0,
        });
        rows.push({ promptKiB, textKiB, size: stored.size, accepted: stored.accepted, passes: message === '' });
      }
    }
    // Never passes an entry the Worker refuses.
    expect(rows.filter((row) => row.passes && !row.accepted)).toEqual([]);
    // Never refuses an entry with clear room under the cap.
    expect(rows.filter((row) => !row.passes && row.size <= MAX_STORED_ANSWER_BYTES - 8 * KIB)).toEqual([]);
    expect(rows.some((row) => !row.accepted)).toBe(true);
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
