// The client's feedback messages and the Session Worker's feedback route, checked against each other: what the
// page sends is what the Worker takes, and what the Worker refuses with is what the page shows.
import {
  FEEDBACK_LIMITS,
  normalizeFeedback,
  sendSessionFeedback,
} from '../../../../workers/sessionCorsWorker/sessionFeedbackRoute.js';
import { feedbackView } from '../../components/OnePageSession/SessionFeedbackSection';
import { FEEDBACK_REACH_MAX, FEEDBACK_TEXT_MAX, sendFeedback } from './sessionFeedbackPorts';
import { getCorsProxyUrlOrThrow } from '../../utilities/worker/corsProxy';

jest.mock('../../utilities/worker/corsProxy', () => ({ getCorsProxyUrlOrThrow: jest.fn() }));
jest.mock('../../utilities/worker/workerAuth', () => ({
  fetchWorkerWithAuth: jest.fn(),
  buildSignedAdminActionAuth: jest.fn(),
}));

const VISITOR = { sessionSlug: 'salon', sessionConfig: { slug: 'salon' }, account: '' };
const draft = (extra = {}) => ({
  text: 'The map was hard to read.',
  view: 'questions',
  theme: 'civic',
  screen: 'phone',
  ...extra,
});

// What the page would put on the wire for a draft.
const sentBody = async (message) => {
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
  await sendFeedback(message, VISITOR);
  return JSON.parse(global.fetch.mock.calls[0][1].body);
};

// The Worker's real handler, with the storage and the daily count stood in.
const workerAnswer = (body, { config = {}, allowed = true, stored = { ok: true } } = {}) =>
  sendSessionFeedback({
    env: {},
    slug: 'salon',
    config,
    body,
    identity: 'anon:203.0.113.7',
    checkRateLimit: async () => allowed,
    release: '0.9.8',
    store: async () => stored,
  });

describe('feedback: the page and the Session Worker agree', () => {
  beforeEach(() => {
    jest.mocked(getCorsProxyUrlOrThrow).mockResolvedValue('https://worker.example');
  });

  it('takes every message the page can send', async () => {
    const drafts = [
      draft(),
      draft({ appRelease: '0.9.8' }),
      draft({ reachMe: 'sam on Signal' }),
      draft({ text: 'x'.repeat(FEEDBACK_TEXT_MAX), reachMe: 'y'.repeat(FEEDBACK_REACH_MAX), screen: 'desktop' }),
      // The names the two session pages give for the open view, and each theme.
      ...['questions', 'results:polis', 'results:debateAtlas', 'results:riskMatrix', 'agent:polis', ''].map((view) =>
        draft({ view: feedbackView(view) }),
      ),
      ...['civic', 'context-engine', 'classic-95'].map((theme) => draft({ theme, screen: 'tablet' })),
    ];
    for (const message of drafts) {
      const body = await sentBody(message);
      expect(normalizeFeedback(body)).toMatchObject({ ok: true });
      expect(await workerAnswer(body)).toEqual({ status: 200, body: { ok: true } });
    }
    // The limits the page enforces are the Worker's.
    expect(FEEDBACK_LIMITS).toMatchObject({ textChars: FEEDBACK_TEXT_MAX, reachMeChars: FEEDBACK_REACH_MAX });
  });

  it('never has an address in the view, whatever the page was showing', async () => {
    const body = await sentBody(
      draft({ view: feedbackView('https://x.example/session/salon?joinGroup=g#groupInvite=s') }),
    );
    expect(normalizeFeedback(body)).toMatchObject({ ok: true });
    // The Worker refuses one outright, should a page ever send it.
    expect(normalizeFeedback({ ...body, view: '/session/salon?joinGroup=g' })).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it('shows each of the Worker’s refusals in the Worker’s own words', async () => {
    const body = await sentBody(draft());
    const refusals = [
      await workerAnswer(body, { config: { feedbackEnabled: false } }),
      await workerAnswer(body, { allowed: false }),
      await workerAnswer(body, { stored: { ok: false, body: { reason: 'feedback_session_limit' } } }),
      await workerAnswer(body, { stored: { ok: false, body: { reason: 'feedback_full' } } }),
      await workerAnswer(body, { stored: { ok: false, body: {} } }),
      await workerAnswer({ ...body, text: '   ' }),
    ];
    expect(refusals.map(({ status }) => status)).toEqual([403, 429, 429, 409, 503, 400]);
    for (const { status, body: answer } of refusals) {
      expect(answer.reason).toMatch(/^feedback_/);
      global.fetch = jest.fn(async () => ({ ok: false, status, json: async () => answer }));
      await expect(sendFeedback(draft(), VISITOR)).rejects.toThrow(answer.error);
    }
  });
});
