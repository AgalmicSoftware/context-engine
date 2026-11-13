/** @jest-environment node */
// The page's feedback calls, run through the whole Session Worker: its routing, its sign-in, its storage. What
// the page sends is what the Worker takes, what the Worker refuses with is what the page shows, and an admin's
// read and deletes reach the routes the Worker has. Either side changing a path, a field or how the session is
// named fails here.
import { Wallet } from 'ethers';

import {
  SESSION_ID,
  SLUG,
  createSessionEnv,
  fetchWorker,
  login,
  makeRequest,
  signedAdminRequest,
} from '../../../../workers/sessionCorsWorker/sessionWorkerRuntimeFixture.mjs';
import { FEEDBACK_LIMITS } from '../../../../workers/sessionCorsWorker/sessionFeedbackRoute.js';
import { FEATURES } from '../../../../workers/sessionCorsWorker/workerCapabilities.js';
import {
  FEEDBACK_FEATURE,
  FEEDBACK_REACH_MAX,
  FEEDBACK_TEXT_MAX,
  deleteFeedback,
  feedbackView,
  listFeedback,
  sendFeedback,
} from './sessionFeedbackPorts';
import { getCorsProxyUrlOrThrow } from '../../utilities/worker/corsProxy';
import { postSignedAdminWorkerRequest } from '../../utilities/worker/signedAdminWorkerRequest';
import { fetchWorkerWithAuth } from '../../utilities/worker/workerAuth';

jest.mock('../../utilities/worker/corsProxy', () => ({ getCorsProxyUrlOrThrow: jest.fn() }));
jest.mock('../../utilities/worker/workerAuth', () => ({
  fetchWorkerWithAuth: jest.fn(),
  buildSignedAdminActionAuth: jest.fn(),
}));
jest.mock('../../utilities/worker/signedAdminWorkerRequest', () => ({ postSignedAdminWorkerRequest: jest.fn() }));

const WORKER = 'https://worker.example';
const draft = (extra = {}) => ({
  text: 'The map was hard to read.',
  view: 'questions',
  theme: 'civic',
  screen: 'phone',
  ...extra,
});

// One Worker and the page's three ways of reaching it: a plain request, one with a sign-in, and a signed admin
// action. Each hands the page's own address and body to the Worker unchanged.
const connect = ({ pinned = true, configOverrides } = {}) => {
  const { admin, env } = createSessionEnv({ configOverrides });
  // The fixture signs as ethers 6 does; the client's ethers names the same call differently.
  admin.signTypedData ||= admin._signTypedData.bind(admin);
  // A Worker that serves many sessions knows which one only from the request.
  if (!pinned) delete env.DEFAULT_SESSION_SLUG;
  const state = { token: '' };
  const toWorker = (url, init = {}, token = '') => {
    const { pathname, search, origin } = new URL(url);
    expect(origin).toBe(WORKER);
    return fetchWorker(
      makeRequest(`${pathname}${search}`, {
        method: init.method,
        token,
        ...(init.body === undefined ? {} : { body: JSON.parse(init.body) }),
      }),
      env,
    );
  };
  jest.mocked(getCorsProxyUrlOrThrow).mockResolvedValue(WORKER);
  global.fetch = jest.fn((url, init) => toWorker(url, init));
  jest.mocked(fetchWorkerWithAuth).mockImplementation((url, init) => toWorker(url, init, state.token));
  jest.mocked(postSignedAdminWorkerRequest).mockImplementation(async ({ action, path, body }) => {
    expect(path).toBe(`/admin/${action}`);
    const { sessionId, ...rest } = body;
    expect(sessionId).toBe(SESSION_ID);
    const answer = await signedAdminRequest({ env, wallet: admin, action, body: rest });
    if (answer.status !== 200) throw new Error(answer.body.error || `Refused (${answer.status}).`);
    return { data: answer.body };
  });
  const signIn = async (wallet = admin) => {
    state.token = await login({ env, wallet });
  };
  const person = (account = '') => ({ sessionSlug: SLUG, sessionConfig: { slug: SLUG }, account });
  const adminOf = {
    workerOrigin: WORKER,
    sessionSlug: SLUG,
    sessionConfig: { slug: SLUG },
    sessionIdHex: SESSION_ID,
    account: admin.address,
    chainId: 1,
  };
  return { admin, state, signIn, person, adminOf };
};

describe('feedback: the page and the Session Worker agree', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('names the feature and the limits the same way', () => {
    expect(FEATURES).toContain(FEEDBACK_FEATURE);
    expect(FEEDBACK_LIMITS).toMatchObject({ textChars: FEEDBACK_TEXT_MAX, reachMeChars: FEEDBACK_REACH_MAX });
  });

  it('takes a visitor’s message on a Worker that serves many sessions, and an admin reads it back', async () => {
    const worker = connect({ pinned: false });
    await sendFeedback(
      draft({ view: feedbackView('results:debateAtlas'), appRelease: '0.9.8', reachMe: 'sam on Signal' }),
      worker.person(),
    );
    await sendFeedback(
      draft({ text: 'x'.repeat(FEEDBACK_TEXT_MAX), reachMe: 'y'.repeat(FEEDBACK_REACH_MAX), screen: 'desktop' }),
      worker.person(),
    );
    // The names the two session pages give for the open view, and an address that must never be one.
    const views = ['questions', 'agent:polis', 'https://x.example/session/s?joinGroup=g#groupInvite=i'];
    for (const view of views) {
      await sendFeedback(draft({ view: feedbackView(view), theme: 'classic-95', screen: 'tablet' }), worker.person());
    }
    expect(fetchWorkerWithAuth).not.toHaveBeenCalled();

    await worker.signIn();
    const messages = await listFeedback(worker.adminOf);
    expect(messages).toHaveLength(5);
    // Newest first, each as the page's reader expects it.
    expect(messages.at(-1)).toMatchObject({
      text: 'The map was hard to read.',
      view: 'results:debateAtlas',
      theme: 'civic',
      screen: 'phone',
      appRelease: '0.9.8',
      signedIn: false,
      contact: { address: '', reachMe: 'sam on Signal' },
    });
    expect(messages.at(-1).workerRelease).toEqual(expect.any(String));
    // What was an address arrives as letters only: no path, query or fragment survives.
    expect(messages[0].view).toBe('https:xexamplesessionsjoinGroupggroupInvitei');
    expect(messages[0].contact).toBeNull();
    expect(messages.every((message) => message.id && !Number.isNaN(Date.parse(message.createdAt)))).toBe(true);
  });

  it('takes a signed-in person’s message with their sign-in, and their address only with the contact box', async () => {
    const worker = connect();
    await worker.signIn();
    await sendFeedback(draft({ text: 'Anonymous, though signed in.' }), worker.person(worker.admin.address));
    await sendFeedback(draft({ text: 'Reach me.', reachMe: 'by post' }), worker.person(worker.admin.address));
    expect(global.fetch).not.toHaveBeenCalled();
    const [reachable, anonymous] = await listFeedback(worker.adminOf);
    expect(anonymous).toMatchObject({ text: 'Anonymous, though signed in.', signedIn: true, contact: null });
    expect(reachable).toMatchObject({
      signedIn: true,
      contact: { address: worker.admin.address.toLowerCase(), reachMe: 'by post' },
    });
  });

  it('sends as a visitor when the Worker won’t take the sign-in', async () => {
    const worker = connect();
    worker.state.token = 'not-a-token';
    await sendFeedback(draft({ text: 'My sign-in is broken.' }), worker.person(worker.admin.address));
    expect(global.fetch).toHaveBeenCalledTimes(1);
    await worker.signIn();
    expect(await listFeedback(worker.adminOf)).toEqual([
      expect.objectContaining({ text: 'My sign-in is broken.', signedIn: false }),
    ]);
  });

  it('shows the Worker’s own words when it refuses: the box turned off, the daily limit', async () => {
    const off = connect({ configOverrides: { feedbackEnabled: false } });
    await expect(sendFeedback(draft(), off.person())).rejects.toThrow('This session isn’t taking feedback.');
    const limited = connect();
    for (let sent = 0; sent < FEEDBACK_LIMITS.perPersonPerDay; sent += 1) {
      await sendFeedback(draft(), limited.person());
    }
    await expect(sendFeedback(draft(), limited.person())).rejects.toThrow(
      'You’ve sent 5 today. Thanks! Try again tomorrow.',
    );
  });

  it('lets only a full admin read, and deletes one message or all those read with one signature each', async () => {
    const worker = connect();
    for (const text of ['first', 'second', 'third']) await sendFeedback(draft({ text }), worker.person());
    // Someone else's sign-in reads nothing, in the Worker's words.
    await worker.signIn(Wallet.createRandom());
    await expect(listFeedback(worker.adminOf)).rejects.toThrow('Only the session’s admins can read feedback.');

    await worker.signIn();
    const listed = await listFeedback(worker.adminOf);
    expect(listed.map((message) => message.text)).toEqual(['third', 'second', 'first']);
    expect(postSignedAdminWorkerRequest).not.toHaveBeenCalled();

    await deleteFeedback(worker.adminOf, { ids: [listed[1].id] });
    expect((await listFeedback(worker.adminOf)).map((message) => message.text)).toEqual(['third', 'first']);

    // One that arrives after the read survives "all": everything up to the newest one read goes.
    await sendFeedback(draft({ text: 'arrived since' }), worker.person());
    await deleteFeedback(worker.adminOf, { through: listed[0].id });
    expect((await listFeedback(worker.adminOf)).map((message) => message.text)).toEqual(['arrived since']);
    expect(postSignedAdminWorkerRequest).toHaveBeenCalledTimes(2);
  });
});
