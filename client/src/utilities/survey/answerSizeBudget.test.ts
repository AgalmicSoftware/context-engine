import {
  buildEnvelopeObject,
  buildResponseFieldAAD,
  encodePaddedEnvelopePlaintext,
} from '@ce-shared/encryption/envelopeV1Core.mjs';
import { validateStorageUploadPayload } from '../../../../workers/sessionCorsWorker/storageUploadValidation.js';
import {
  MAX_LOCKED_TEXT_BYTES,
  MAX_STORED_ANSWER_BYTES,
  MAX_SUBMISSION_BYTES,
  nameQuestionForNotice,
  readAnswerTooLongMessage,
  readStoredAnswersUploadProblem,
  sessionStoresAnswersInWorker,
} from './answerSizeBudget';

const KIB = 1024;
const QUESTION_ID = `0x${'5d'.repeat(32)}`;
// Each value is counted as a JSON string, so a string's two quotes count too.
const textOfBytes = (bytes: number, char = 'x') => char.repeat(bytes - 2);
const field = (value: unknown, extra: Record<string, unknown> = {}) => ({ value, ...extra });
const lockedField = (value: unknown, encryptionAudience = 'self_admin', extra: Record<string, unknown> = {}) =>
  field(value, { encrypted: true, encryptionAudience, ...extra });
const freeform = (prompt: string) => ({ id: QUESTION_ID, type: 'freeform', prompt });
const ANSWER_TOO_LONG = /^This answer is too long to save\. Shorten it by about [\d,]+ characters?\.$/;
const TOO_LONG = /^This answer( or comment)? is too long to save\. Shorten (it|them) by about [\d,]+ characters?\.$/;
const PROMPT_TOO_LONG =
  "Answers to this question can't be saved because its prompt is too long. Ask the session admin to shorten it.";
const LOCKED_TOO_LONG =
  "This locked answer can't be saved with this question's long prompt. Unlock it, or ask the session admin to shorten the question.";
const characterCount = (message: string) => Number(/about ([\d,]+) character/.exec(message)?.[1].replace(/,/g, ''));

// A stored answer built like the client's payload, with envelopes shaped like
// real locked fields (random bytes stand in for the ciphertext and keys).
const hex = (bytes: number) => `0x${'ab'.repeat(bytes)}`;
const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));
const randomB64 = (length: number) => btoa(String.fromCharCode(...randomBytes(length)));
const sbtAddress = (index: number) => `0x${String(index).padStart(40, '0')}`;
// The Worker's own check decides whether it would store the entry.
const workerAccepts = validateStorageUploadPayload as unknown as (input: { resource: string; bytes: Uint8Array }) => {
  ok: boolean;
};
// The gate a field is locked to, as the client passes it to Lit (litProtocol's access conditions).
const gateRecipientsFor = (sbtCount: number) => {
  const conditions = Array.from({ length: sbtCount }, (_, index) => ({
    contractAddress: sbtAddress(index + 1),
    standardContractType: 'ERC721',
    chain: 'optimismSepolia',
    method: 'balanceOf',
    parameters: [':userAddress'],
    returnValueTest: { comparator: '>', value: '0' },
  }));
  const accessControlConditions = conditions.flatMap((condition, index) =>
    index ? [{ operator: 'or' }, condition] : [condition],
  );
  return [{ accessControlConditions, chain: 'optimismSepolia' }];
};
// The Lit recipient a gate-locked envelope stores: the access conditions, the
// Chipotle policy (which repeats the SBT list twice) and the wrapped key.
const litRecipientFor = (sbtCount: number) => {
  const [{ accessControlConditions, chain }] = gateRecipientsFor(sbtCount);
  const sbtAddresses = Array.from({ length: sbtCount }, (_, index) => sbtAddress(index + 1));
  const litActionCid = `bafybei${'a'.repeat(52)}`;
  const policy = { chainId: 11155420, gateMode: 'any', litActionCid, litPkpId: hex(65), sbtAddresses, version: 'v2' };
  const policyFingerprint = hex(32);
  const wrappedKey = JSON.stringify({ v: 2, cekHex: hex(32), policyFingerprint, policy });
  return {
    type: 'lit-sbt-v1',
    lit: {
      accessControlConditions,
      chain,
      chipotle: { ...policy, version: 2, policyFingerprint, policy },
      ciphertext: randomB64(wrappedKey.length + 64),
      dataToEncryptHash: ['chipotle-v3', litActionCid, 11155420, 'any', sbtAddresses.join(','), policyFingerprint].join(
        ':',
      ),
    },
  };
};
const recipientsFor = (audience: string, context: string, sbtCount: number) => [
  {
    type: 'self-eip712-v1',
    context,
    wrap_iv: randomB64(12),
    wrapped_cek: randomB64(48),
    nonce: (2n ** 256n - 1n).toString(),
  },
  audience === 'gate'
    ? litRecipientFor(sbtCount)
    : {
        type: 'worker-response-field-v1',
        policy: { owner: hex(20), audience, context, sessionSlug: 's'.repeat(128), sessionId: hex(16) },
        wrapped: { alg: 'AES-256-GCM', wrapAlg: 'AES-GCM-KW-v1', iv: 'i'.repeat(16), wrappedKey: 'k'.repeat(64) },
      },
];
const envelopeFor = (value: unknown, kind: string, audience: string, sbtCount = 1) => {
  const context = hex(32);
  const plaintext = encodePaddedEnvelopePlaintext({ v: 1, value, kind, salt: hex(32) }, {});
  return JSON.stringify(
    buildEnvelopeObject({
      iv: randomBytes(12),
      ciphertextBytes: randomBytes(plaintext.byteLength + 16),
      aadObj: buildResponseFieldAAD({
        contextHex: context,
        chainId: 11155420,
        surveyId: hex(32),
        qId: QUESTION_ID,
        fieldKey: kind,
      }),
      recipients: recipientsFor(audience, context, sbtCount),
      commitments: { keccak256: hex(32), poseidon: hex(32) },
      kind,
    }),
  );
};
const storedField = (value: string, locked: boolean, audience: string, sbtCount: number) => ({
  value: locked ? '*' : value,
  encrypted: locked,
  encryptionAudience: locked ? audience : 'public',
  encryptionGateId: audience === 'gate' ? hex(32) : null,
  audienceMode: 'explicit',
  hash: hex(32),
  encryptedPortion: locked ? envelopeFor(value, 'freeform', audience, sbtCount) : '',
});
const storedEntry = ({ prompt, answer, comment, locked, audience, sbtCount = 1 }: Record<string, any>) => ({
  questionID: QUESTION_ID,
  responder: hex(20),
  type: 'freeform',
  prompt,
  conviction: locked ? null : 7,
  importance: locked ? null : 4,
  answer: storedField(answer, locked, audience, sbtCount),
  additional: storedField(comment, locked, audience, sbtCount),
  ...(locked
    ? {
        importanceEncrypted: envelopeFor(4, 'rating', audience, sbtCount),
        convictionEncrypted: envelopeFor(7, 'rating', audience, sbtCount),
      }
    : {}),
  recruitment: { source: 'newsletter', campaign: 'spring' },
  responderName: 'Participant',
  sessionId: hex(16),
  sessionSlug: 'pilot-session',
});
const storedEntryBytes = (input: Record<string, any>) => {
  const bytes = new TextEncoder().encode(JSON.stringify(storedEntry(input)));
  return { size: bytes.byteLength, accepted: workerAccepts({ resource: 'responses', bytes }).ok };
};

describe('answer size budget', () => {
  it("matches the session Worker's caps", () => {
    expect(MAX_STORED_ANSWER_BYTES).toBe(98_304);
    expect(MAX_SUBMISSION_BYTES).toBe(2_097_152);
    expect(MAX_LOCKED_TEXT_BYTES).toBe(49_152);
  });

  it('accepts locked text that exactly fills the locked-text budget', () => {
    const half = MAX_LOCKED_TEXT_BYTES / 2;
    expect(
      readAnswerTooLongMessage({ answer: lockedField(textOfBytes(half)), comment: lockedField(textOfBytes(half)) }),
    ).toBe('');
    expect(
      readAnswerTooLongMessage({ answer: lockedField(textOfBytes(MAX_LOCKED_TEXT_BYTES - 2)), comment: field('') }),
    ).toBe('');
  });

  it('counts locked comment text with the answer and says how much to cut', () => {
    const half = MAX_LOCKED_TEXT_BYTES / 2;
    expect(
      readAnswerTooLongMessage({ answer: lockedField(textOfBytes(half)), comment: lockedField(textOfBytes(half + 1)) }),
    ).toBe('This answer or comment is too long to save. Shorten them by about 1 character.');
    expect(
      readAnswerTooLongMessage({
        answer: lockedField(textOfBytes(MAX_LOCKED_TEXT_BYTES + 1500)),
        comment: field(''),
      }),
    ).toBe('This answer is too long to save. Shorten it by about 1,500 characters.');
  });

  it('counts UTF-8 bytes and converts the excess back to characters', () => {
    // 'é' is 2 bytes in UTF-8, so 24,676 of them plus quotes are 202 bytes
    // over: about 102 characters at this text's rate.
    const message = readAnswerTooLongMessage({
      answer: lockedField('é'.repeat(MAX_LOCKED_TEXT_BYTES / 2 + 100)),
      comment: field(''),
    });
    expect(message).toBe('This answer is too long to save. Shorten it by about 102 characters.');
  });

  it('lets unlocked text use the whole stored cap', () => {
    // 60 KiB of unlocked text fits; only locked text has the 48 KiB budget.
    const answer = field(textOfBytes(40 * KIB));
    const comment = field(textOfBytes(20 * KIB, 'c'));
    expect(readAnswerTooLongMessage({ question: freeform('Short prompt'), answer, comment })).toBe('');
    expect(
      storedEntryBytes({
        prompt: 'Short prompt',
        answer: answer.value,
        comment: comment.value,
        locked: false,
        audience: 'public',
      }).accepted,
    ).toBe(true);
    expect(
      readAnswerTooLongMessage({
        question: freeform('Short prompt'),
        answer: field(textOfBytes(60 * KIB)),
        comment: field(textOfBytes(40 * KIB, 'c')),
      }),
    ).toMatch(ANSWER_TOO_LONG);
  });

  it('measures structured answers as JSON', () => {
    const options = Array.from({ length: 8000 }, (_, index) => `option-${index}`);
    expect(readAnswerTooLongMessage({ answer: field(options), comment: field('') })).toMatch(ANSWER_TOO_LONG);
    expect(readAnswerTooLongMessage({ answer: field(['a', 'b']), comment: field({ note: 'short' }) })).toBe('');
  });

  it('counts the prompt every stored answer repeats', () => {
    // Within the locked-text budget, but the 40 KiB prompt copy and the locked
    // envelopes take the stored answer past the Worker's cap.
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

  it('refuses every answer when the prompt alone fills the stored answer', () => {
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
      'This answer or comment is too long to save. Shorten them by about 2,056 characters.',
    );
    expect(
      readAnswerTooLongMessage({
        question,
        answer: { ...answer, encryptedPortion: 'e'.repeat(95 * KIB) },
        comment: field(''),
      }),
    ).toBe(LOCKED_TOO_LONG);
  });

  it('counts saved rating envelopes the upload carries', () => {
    // The answer's lock is unchanged and the comment is newly locked; both saved
    // ratings keep their envelopes. Without them the answer looks like it fits.
    const prompt = 'p'.repeat(28 * KIB);
    const answer = { ...lockedField('*'), encryptedPortion: envelopeFor('Saved answer', 'freeform', 'self_admin') };
    const comment = lockedField(textOfBytes(46 * KIB));
    const savedRatings = [
      { value: null, savedEnvelope: envelopeFor(4, 'rating', 'self_admin') },
      { value: null, savedEnvelope: envelopeFor(7, 'rating', 'self_admin') },
    ];
    expect(readAnswerTooLongMessage({ question: freeform(prompt), answer, comment })).toBe('');
    expect(readAnswerTooLongMessage({ question: freeform(prompt), answer, comment, ratings: savedRatings })).toMatch(
      TOO_LONG,
    );
    // An unlocked answer drops the envelope of a rating it knows, and keeps one it never decrypted.
    expect(
      readAnswerTooLongMessage({
        question: freeform(prompt),
        answer: field(textOfBytes(64 * KIB)),
        comment: field(''),
        ratings: [{ value: 4, savedEnvelope: 'e'.repeat(4 * KIB) }],
      }),
    ).toBe('');
    expect(
      readAnswerTooLongMessage({
        question: freeform(prompt),
        answer: field(textOfBytes(64 * KIB)),
        comment: field(''),
        ratings: [{ value: null, savedEnvelope: 'e'.repeat(4 * KIB) }],
      }),
    ).toMatch(ANSWER_TOO_LONG);
  });

  it('scales the gate allowance with the SBTs a gate lists', () => {
    // An 8-SBT gate's Lit recipients outgrow a one-SBT allowance.
    const prompt = 'p'.repeat(12 * KIB);
    const gated = (sbtCount: number) => ({ gateRecipients: gateRecipientsFor(sbtCount) });
    const text = textOfBytes(23 * KIB);
    const input = (sbtCount: number) => ({
      question: freeform(prompt),
      answer: lockedField(text, 'gate', gated(sbtCount)),
      comment: lockedField(text, 'gate', gated(sbtCount)),
      ratings: [{ value: 4 }, { value: 7 }],
    });
    expect(
      storedEntryBytes({ prompt, answer: text, comment: text, locked: true, audience: 'gate', sbtCount: 8 }).accepted,
    ).toBe(false);
    expect(readAnswerTooLongMessage(input(8))).toMatch(TOO_LONG);
    expect(readAnswerTooLongMessage(input(1))).toBe('');
  });

  it('counts copies of the text in the stored answer, such as an interview record', () => {
    const text = textOfBytes(33 * KIB);
    const answer = field(text);
    // With prediction-comparison consent the submitted answer is stored three times.
    const entry = {
      questionID: QUESTION_ID,
      prompt: 'Short prompt',
      answer: { value: text, encrypted: false, encryptedPortion: '' },
      additional: { value: '', encrypted: false, encryptedPortion: '' },
      interviewProvenance: {
        finalSubmitted: { answer: text, additionalComments: '' },
        predictionComparison: { submitted: { answer: text, additionalComments: '' } },
      },
    };
    expect(readAnswerTooLongMessage({ question: freeform('Short prompt'), answer, comment: field('') })).toBe('');
    const message = readAnswerTooLongMessage({ question: freeform('Short prompt'), entry, answer, comment: field('') });
    expect(message).toMatch(ANSWER_TOO_LONG);
    // Each character cut shortens all three copies, so the count is a third of the excess.
    const overBytes = 3 * (33 * KIB) - MAX_STORED_ANSWER_BYTES;
    expect(characterCount(message)).toBeLessThan(overBytes / 2);
  });

  it.each([
    ['unlocked', false, 'self_admin', 1],
    ['locked for the session admin', true, 'self_admin', 1],
    ['locked to a one-SBT gate', true, 'gate', 1],
    ['locked to an eight-SBT gate', true, 'gate', 8],
    ['locked to a twelve-SBT gate', true, 'gate', 12],
  ])('agrees with the Worker on %s answers beside prompts of any length', (_label, locked, audience, sbtCount) => {
    const rows = [];
    for (const promptKiB of [0, 8, 16, 24, 40, 60, 90]) {
      for (const textKiB of [1, 8, 16, 23]) {
        const prompt = 'p'.repeat(promptKiB * KIB);
        const answer = textOfBytes(textKiB * KIB);
        const comment = textOfBytes(textKiB * KIB, 'c');
        const stored = storedEntryBytes({ prompt, answer, comment, locked, audience, sbtCount });
        const lockedAs = { gateRecipients: gateRecipientsFor(sbtCount) };
        const message = readAnswerTooLongMessage({
          question: freeform(prompt),
          answer: locked ? lockedField(answer, audience, lockedAs) : field(answer),
          comment: locked ? lockedField(comment, audience, lockedAs) : field(comment),
          ratings: [{ value: 4 }, { value: 7 }],
        });
        rows.push({ promptKiB, textKiB, size: stored.size, accepted: stored.accepted, passes: message === '' });
      }
    }
    // Never passes an answer the Worker refuses.
    expect(rows.filter((row) => row.passes && !row.accepted)).toEqual([]);
    // Never refuses one with clear room under the cap.
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

describe('naming questions in notices', () => {
  it('uses a short form of the prompt, or the id when the prompt is locked', () => {
    expect(nameQuestionForNotice('  Should the city fund\n parks?  ', QUESTION_ID)).toBe(
      '“Should the city fund parks?”',
    );
    expect(nameQuestionForNotice('q'.repeat(80), QUESTION_ID)).toBe(`“${'q'.repeat(57)}…”`);
    expect(nameQuestionForNotice('[encrypted]', QUESTION_ID)).toBe('Question 0x5d5d5d5d…');
    expect(nameQuestionForNotice('', '')).toBe('A question');
  });
});

describe('the final check on the answers as uploaded', () => {
  const row = (prompt: string, text: string) => ({
    questionID: QUESTION_ID,
    prompt,
    answer: { value: text, encrypted: false, encryptedPortion: '' },
  });

  it('names the first answer the Worker would refuse and how much to cut', () => {
    const fits = row('Fits', 'Yes');
    const tooLong = row('Tell us more', textOfBytes(97 * KIB));
    const overBytes = new TextEncoder().encode(JSON.stringify(tooLong)).byteLength - MAX_STORED_ANSWER_BYTES;
    expect(readStoredAnswersUploadProblem([fits, tooLong])).toBe(
      `Nothing was submitted: “Tell us more” is too long to save. Shorten its answer or comment by about ${overBytes.toLocaleString('en-US')} characters and submit again.`,
    );
    expect(readStoredAnswersUploadProblem([row('[encrypted]', textOfBytes(97 * KIB))])).toMatch(
      /^Nothing was submitted: Question 0x5d5d5d5d… is too long to save\./,
    );
    expect(readStoredAnswersUploadProblem([fits])).toBe('');
  });

  it('refuses a submission over the Worker cap even when each answer fits', () => {
    const rows = Array.from({ length: 24 }, () => row('Fits', textOfBytes(90 * KIB)));
    expect(readStoredAnswersUploadProblem(rows, { responses: rows })).toBe(
      'These answers are too large to save in one submission. Shorten the longest ones and submit again.',
    );
    expect(readStoredAnswersUploadProblem(rows.slice(0, 2), { responses: rows.slice(0, 2) })).toBe('');
  });
});
