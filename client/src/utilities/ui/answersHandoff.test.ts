import {
  ANSWERS_LINK_MAX_CHARS,
  answersCopyTextOnOneLine,
  buildAnswersCopyText,
  countUnsavedAnswers,
  loadCopiedAnswers,
  takeAnswersFromAddress,
  takeAnswersHandoffNote,
} from './answersHandoff';
import { buildSurveyDraftStorageKey } from '../../components/SurveyTool/surveyToolDraftState';
import { keptReviewOwner, readKeptReview } from '../../components/SurveyTool/sessionInterviewKeptReview';

const go = (path: string) => window.history.replaceState({}, '', path);
const TYPED = 'dg:surveyDraft:meadow-forum:84532:anon:all';
const REVIEW = 'ce:interview-review:v1:meadow-forum:browser';
const typed = (answers: Record<string, unknown>) => JSON.stringify({ answers, importance: { q1: 3 } });
const review = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    v: 1,
    owner: 'browser',
    savedAt: 1000,
    review: {
      packet: null,
      transcript: 'Responder: The garden matters to me.',
      drafts: [
        { questionId: 'q7', response: 'Yes' },
        { questionId: 'q8', response: 'No' },
      ],
      removedDraftIds: { q8: true },
      editedDrafts: { q7: { questionId: 'q7', response: 'Yes, mostly' } },
      researchSharingChoice: { contextToken: 'ctx', included: false },
      includeProvenance: true,
      ...extra,
    },
  });
// What the browser where sign-in failed copies, then a clean browser as the phone.
const copyThenMoveToPhone = async () => {
  const text = await buildAnswersCopyText();
  sessionStorage.clear();
  localStorage.clear();
  return String(text);
};

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  go('/session/meadow-forum');
});

describe('copying unsaved answers out of a browser', () => {
  it('counts typed answers and the interview drafts not removed, signed out only', () => {
    expect(countUnsavedAnswers()).toBe(0);
    sessionStorage.setItem(TYPED, typed({ q1: { value: 'Agree' }, q2: { value: 'More buses' } }));
    sessionStorage.setItem('dg:surveyDraft:meadow-forum:84532:0xabc:all', typed({ q3: { value: 'Mine' } }));
    localStorage.setItem(REVIEW, review());
    localStorage.setItem('ce:interview-review:v1:meadow-forum:account:0xabc', review());
    localStorage.setItem('ce:interview-review:v1:other-forum:browser', review());
    expect(countUnsavedAnswers()).toBe(3);
  });

  it('copies nothing when there is nothing unsaved', async () => {
    expect(await buildAnswersCopyText()).toBeNull();
  });

  it('carries typed answers and the interview review as they are, in the address fragment only', async () => {
    sessionStorage.setItem(TYPED, typed({ q1: { value: 'Agree' } }));
    localStorage.setItem(REVIEW, review());
    const link = await copyThenMoveToPhone();
    expect(link).toMatch(/^http:\/\/localhost\/session\/meadow-forum#answers=[A-Za-z0-9_-]+$/);
    expect(link).not.toContain('Agree');

    expect(await loadCopiedAnswers(link, 5000)).toEqual({ kind: 'loaded', typed: 1, interview: 1, kept: 0 });
    expect(JSON.parse(sessionStorage.getItem(TYPED) || '')).toEqual(JSON.parse(typed({ q1: { value: 'Agree' } })));
    const kept = JSON.parse(localStorage.getItem(REVIEW) || '');
    // The review starts its hour afresh on the phone; the edits and the research choice arrive as they were set.
    expect(kept).toMatchObject({ v: 1, owner: 'browser', savedAt: 5000 });
    expect(kept.review).toEqual(JSON.parse(review()).review);
  });

  it('copies a long set as a short link and a code, which loads from the pasted message', async () => {
    // Text that does not pack down: sixty answers, each with its own run of digits.
    const long = Object.fromEntries(
      Array.from({ length: 60 }, (_, index) => [
        `q${index}`,
        { value: Array.from({ length: 6 }, (_unused, part) => Math.sin(index * 7 + part)).join(' ') },
      ]),
    );
    sessionStorage.setItem(TYPED, typed(long));
    const message = await copyThenMoveToPhone();
    const [link, code] = message.split('\n');
    expect(link).toBe('http://localhost/session/meadow-forum#answers=paste');
    expect(link.length).toBeLessThan(ANSWERS_LINK_MAX_CHARS);
    expect(code.length).toBeGreaterThan(ANSWERS_LINK_MAX_CHARS);
    expect(await loadCopiedAnswers(`Here you go:\n${message}\n`)).toMatchObject({ kind: 'loaded', typed: 60 });

    // Copied by hand from a one-line box: the space keeps the short link apart from the code.
    const oneLine = answersCopyTextOnOneLine(message);
    expect(oneLine).toBe(`${link} ${code}`);
    sessionStorage.clear();
    expect(await loadCopiedAnswers(oneLine)).toMatchObject({ kind: 'loaded', typed: 60 });
    // A box that dropped the line break outright joins them; the link still reads, pasted or opened.
    sessionStorage.clear();
    expect(await loadCopiedAnswers(`${link}${code}`)).toMatchObject({ kind: 'loaded', typed: 60 });
    sessionStorage.clear();
    go(`${link}${code}`.replace('http://localhost', ''));
    await takeAnswersFromAddress();
    expect(takeAnswersHandoffNote()).toMatchObject({ kind: 'loaded', typed: 60 });
  });

  it('keeps the invite and drafts the page arrived with beside the answers', async () => {
    go('/session/meadow-forum#prefill=abc');
    sessionStorage.setItem(TYPED, typed({ q1: { value: 'Agree' } }));
    expect(await buildAnswersCopyText()).toMatch(/#prefill=abc&answers=[A-Za-z0-9_-]+$/);
  });
});

describe('loading copied answers into another browser', () => {
  it('lands where the page itself looks: the real draft key and the kept review reader', async () => {
    const key = buildSurveyDraftStorageKey({
      draftAuthorityKey: 'worker:https://worker.example.test',
      sessionSlug: 'meadow-forum',
      networkIdStr: 'worker',
      surveyScope: 'questions',
    });
    sessionStorage.setItem(key, typed({ q1: { value: 'Agree' } }));
    localStorage.setItem(REVIEW, review({ packet: null }));
    const link = await copyThenMoveToPhone();
    expect(await loadCopiedAnswers(link)).toEqual({ kind: 'loaded', typed: 1, interview: 1, kept: 0 });
    expect(JSON.parse(sessionStorage.getItem(key) || '').answers).toEqual({ q1: { value: 'Agree' } });
    const kept = readKeptReview('meadow-forum', keptReviewOwner('', false));
    expect(kept?.review.drafts.map((draft) => draft.questionId)).toEqual(['q7', 'q8']);
    expect(kept?.review.researchSharingChoice).toEqual({ contextToken: 'ctx', included: false });
    // Marked as copied, so a phone already signed in still offers it.
    expect(kept?.copied).toBe(true);
  });

  it('reads the answers code, not a longer AI-drafts code the same link carries', async () => {
    sessionStorage.setItem(TYPED, typed({ q1: { value: 'Agree' } }));
    const link = await copyThenMoveToPhone();
    const code = link.split('answers=')[1];
    const drafts = 'A'.repeat(code.length + 500);
    const message = `http://localhost/session/meadow-forum#prefillz=${drafts}&answers=paste\n${code}`;
    expect(await loadCopiedAnswers(message)).toMatchObject({ kind: 'loaded', typed: 1 });
    sessionStorage.clear();
    expect(await loadCopiedAnswers(`http://localhost/x#prefillz=${drafts}&answers=${code}`)).toMatchObject({
      kind: 'loaded',
      typed: 1,
    });
  });

  it('says a cut-off or foreign code could not be read, and loads nothing', async () => {
    sessionStorage.setItem(TYPED, typed({ q1: { value: 'Agree' } }));
    const link = await copyThenMoveToPhone();
    for (const broken of [link.slice(0, -12), 'not a code at all', '']) {
      expect(await loadCopiedAnswers(broken)).toMatchObject({ kind: 'paste', error: expect.stringMatching(/cut off/) });
    }
    expect(sessionStorage.length).toBe(0);
  });

  it('keeps answers this browser already holds, and says how many copied ones stayed out', async () => {
    sessionStorage.setItem(TYPED, typed({ q1: { value: 'Agree' }, q2: { value: 'Buses' } }));
    const link = await copyThenMoveToPhone();
    sessionStorage.setItem(TYPED, typed({ q9: { value: 'Typed on the phone' } }));
    expect(await loadCopiedAnswers(link)).toEqual({ kind: 'loaded', typed: 0, interview: 0, kept: 2 });
    expect(sessionStorage.getItem(TYPED)).toContain('Typed on the phone');
  });

  it('ignores records that are not a signed-out draft or review', async () => {
    // A code made by hand: one honest record beside keys for an account, a setting and a sign-in store.
    const { deflateLinkBytes, encodeBase64Url } = await import('../../../../shared/linkPayload.mjs');
    const code = encodeBase64Url(
      await deflateLinkBytes(
        new TextEncoder().encode(
          JSON.stringify({
            v: 1,
            t: {
              [TYPED]: JSON.parse(typed({ q1: { value: 'Agree' } })),
              'dg:surveyDraft:meadow-forum:84532:0xabc:all': JSON.parse(typed({ q2: { value: 'Planted' } })),
              'ce:theme': { answers: { q3: 1 } },
            },
            r: { 'ce:interview-review:v1:meadow-forum:account:0xabc': JSON.parse(review()) },
          }),
        ),
      ),
    );
    expect(await loadCopiedAnswers(code)).toEqual({ kind: 'loaded', typed: 1, interview: 0, kept: 0 });
    expect(Object.keys(sessionStorage)).toEqual([TYPED]);
    expect(localStorage.length).toBe(0);
  });

  it('takes the answers out of the address before anything else reads it, and leaves a notice once', async () => {
    sessionStorage.setItem(TYPED, typed({ q1: { value: 'Agree' } }));
    const link = await copyThenMoveToPhone();
    go(`${link.replace('http://localhost', '')}&groupInvite=kept`);
    await takeAnswersFromAddress();
    expect(window.location.hash).toBe('#groupInvite=kept');
    expect(sessionStorage.getItem(TYPED)).toContain('Agree');
    expect(takeAnswersHandoffNote()).toEqual({ kind: 'loaded', typed: 1, interview: 0, kept: 0 });
    expect(takeAnswersHandoffNote()).toBeNull();
  });

  it('opens the paste box for #answers=paste, and does nothing for an address without answers', async () => {
    await takeAnswersFromAddress();
    expect(takeAnswersHandoffNote()).toBeNull();
    go('/session/meadow-forum#answers=paste');
    await takeAnswersFromAddress();
    expect(window.location.hash).toBe('');
    expect(takeAnswersHandoffNote()).toEqual({ kind: 'paste', error: '' });
  });
});
