import { readWorkerCapabilities } from '../worker/workerCapabilities';
import {
  AgentSignInError,
  __test__agentSignIn,
  attachPasskeyToAgentAccount,
  buildPasskeyAttachMessage,
  dropAgentSignInCode,
  exchangeHeldAgentSignInCode,
  hasAgentSignInCodeFor,
  isSignInNonce,
  readAgentSignInCodeArrivals,
  removeAgentSignInCodeFromAddress,
  subscribeAgentSignInCode,
  watchAddressForAgentSignInCode,
  workerHasAgentSignIn,
} from './agentSignIn';
import {
  AgentLinkNoKeyError,
  agentLinkProvider,
  forgetAgentLinkAccount,
  forgetAgentLinkHints,
  holdAgentLinkAccount,
  holdsAgentLinkAccountForPath,
  isAgentLinkProvider,
  noteAttachedPasskey,
  noteLinkedAgentAccount,
  readAttachedPasskeyNotice,
  readLinkedAgentAccountHintCount,
  readAgentLinkAccount,
  renewAgentLinkSignIn,
  setAgentLinkRenewer,
  takeLinkedAgentAccountHint,
} from './agentLinkAccount';

jest.mock('../worker/workerCapabilities', () => ({ readWorkerCapabilities: jest.fn() }));

const WORKER = 'https://ce-salon.example.workers.dev';
const CODE = `cesi_${'A'.repeat(43)}`;
const ACCOUNT = `0x${'a1'.repeat(20)}`;
const PASSKEY = `0x${'b2'.repeat(20)}`;
const target = { workerUrl: WORKER, sessionSlug: 'salon', sessionId: `0x${'3'.repeat(32)}` };
const open = (hash: string, search = `?worker=${encodeURIComponent(WORKER)}`, path = '/session/salon'): void => {
  window.history.replaceState({ kept: true }, '', `${path}${search}${hash}`);
};
const fetchMock = jest.fn();
const reply = (body: unknown, status = 200): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;
const everythingStored = (): string =>
  JSON.stringify([{ ...window.localStorage }, { ...window.sessionStorage }, window.location.href, document.cookie]);

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  dropAgentSignInCode();
  forgetAgentLinkAccount();
  setAgentLinkRenewer(null);
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
});

describe('a sign-in code in a link', () => {
  it('leaves the address before anything is fetched, and is kept nowhere but page memory', () => {
    open(`#agentSignIn=${CODE}`);
    removeAgentSignInCodeFromAddress();
    expect(window.location.hash).toBe('');
    expect(window.location.href).not.toContain(CODE);
    expect(window.history.state).toEqual({ kept: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(everythingStored()).not.toContain(CODE);
    expect(hasAgentSignInCodeFor(target)).toBe(true);
    // What the page can say of it holds no code.
    expect(JSON.stringify(__test__agentSignIn.held())).not.toContain(CODE);
  });

  it('keeps the rest of the fragment, and is for the one session and Worker its link names', () => {
    open(`#prefill=abc&agentSignIn=${CODE}&other=1`);
    removeAgentSignInCodeFromAddress();
    expect(window.location.hash).toBe('#prefill=abc&other=1');
    expect(hasAgentSignInCodeFor({ ...target, sessionSlug: 'another' })).toBe(false);
    expect(hasAgentSignInCodeFor({ ...target, workerUrl: 'https://impostor.example' })).toBe(false);
    expect(hasAgentSignInCodeFor({ ...target, workerUrl: `${WORKER}/` })).toBe(true);
  });

  it.each([
    ['a malformed code', '#agentSignIn=not-a-code', undefined, undefined],
    ['two codes', `#agentSignIn=${CODE}&agentSignIn=${CODE}`, undefined, undefined],
    ['no Worker named', `#agentSignIn=${CODE}`, '', undefined],
    ['two Workers named', `#agentSignIn=${CODE}`, `?worker=${WORKER}&worker=https://impostor.example`, undefined],
    ['a page that is not a session', `#agentSignIn=${CODE}`, undefined, '/about'],
  ])('is taken out of the address and dropped when the link has %s', (_name, hash, search, path) => {
    open(hash, search, path);
    removeAgentSignInCodeFromAddress();
    expect(window.location.href).not.toContain('agentSignIn');
    expect(__test__agentSignIn.held()).toBeNull();
  });

  it('is sent once, in the body of one request to its Worker, and then forgotten', async () => {
    open(`#agentSignIn=${CODE}`);
    removeAgentSignInCodeFromAddress();
    fetchMock.mockResolvedValue(
      reply({
        token: 'signed-in',
        exp: 1800000000,
        address: ACCOUNT.toUpperCase().replace('0X', '0x'),
        via: 'agent_link',
        agentAccess: 'active',
      }),
    );
    const signedIn = await exchangeHeldAgentSignInCode(target);
    expect(signedIn).toEqual({
      token: 'signed-in',
      exp: 1800000000,
      address: ACCOUNT,
      via: 'agent_link',
      passkey: '',
      agentAccess: 'active',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${WORKER}/auth/agent-link/exchange`);
    expect(String(url)).not.toContain(CODE);
    expect(JSON.parse(init.body)).toEqual({ sessionSlug: 'salon', sessionId: target.sessionId, code: CODE });
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    });
    expect(init.headers.Authorization).toBeUndefined();
    expect(everythingStored()).not.toContain(CODE);
    // Used, so gone: a second try has nothing to send.
    expect(hasAgentSignInCodeFor(target)).toBe(false);
    await expect(exchangeHeldAgentSignInCode(target)).rejects.toMatchObject({ reason: 'no_code' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('is gone after a refusal too, and the refusal is the Worker’s own words', async () => {
    open(`#agentSignIn=${CODE}`);
    removeAgentSignInCodeFromAddress();
    fetchMock.mockResolvedValue(
      reply(
        {
          error: 'This sign-in link has expired or was already used. Ask your agent for a new one.',
          reason: 'sign_in_code_invalid',
        },
        401,
      ),
    );
    const refused = await exchangeHeldAgentSignInCode(target).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(AgentSignInError);
    expect(refused).toMatchObject({
      reason: 'sign_in_code_invalid',
      status: 401,
      message: expect.stringContaining('Ask your agent for a new one'),
    });
    expect(hasAgentSignInCodeFor(target)).toBe(false);
    // A sign-in the page can't read is not one.
    open(`#agentSignIn=${CODE}`);
    removeAgentSignInCodeFromAddress();
    fetchMock.mockResolvedValue(reply({ token: 'x', exp: 1, address: 'nobody' }));
    await expect(exchangeHeldAgentSignInCode(target)).rejects.toMatchObject({ reason: 'unreadable' });
  });

  it('is used only where the Worker says it signs people in this way', async () => {
    jest.mocked(readWorkerCapabilities).mockResolvedValueOnce({ features: ['worker_groups'] } as never);
    await expect(workerHasAgentSignIn(target)).resolves.toBe(false);
    jest.mocked(readWorkerCapabilities).mockResolvedValueOnce({ features: ['agent_sign_in_link_v1'] } as never);
    await expect(workerHasAgentSignIn(target)).resolves.toBe(true);
    jest.mocked(readWorkerCapabilities).mockRejectedValueOnce(new Error('offline'));
    await expect(workerHasAgentSignIn(target)).resolves.toBe(false);
  });
});

describe('a sign-in code that arrives without a page load, or in an odd place', () => {
  it('leaves the address when a link is pasted into a tab already on the session, and whoever waits hears of it', () => {
    watchAddressForAgentSignInCode();
    const heard = jest.fn();
    const stop = subscribeAgentSignInCode(heard);
    const before = readAgentSignInCodeArrivals();
    open('');
    expect(hasAgentSignInCodeFor(target)).toBe(false);
    // What the browser does for a change after `#`: the address changes, then the page is told.
    window.history.pushState(
      { kept: true },
      '',
      `/session/salon?worker=${encodeURIComponent(WORKER)}#agentSignIn=${CODE}`,
    );
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(window.location.href).not.toContain(CODE);
    expect(hasAgentSignInCodeFor(target)).toBe(true);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(readAgentSignInCodeArrivals()).toBe(before + 1);
    // Using or dropping it is not an arrival.
    dropAgentSignInCode();
    expect(heard).toHaveBeenCalledTimes(1);
    window.history.pushState({}, '', `/session/salon?worker=${encodeURIComponent(WORKER)}#agentSignIn=${CODE}`);
    window.dispatchEvent(new Event('hashchange'));
    expect(window.location.href).not.toContain(CODE);
    expect(hasAgentSignInCodeFor(target)).toBe(true);
    stop();
    expect(everythingStored()).not.toContain(CODE);
  });

  it('is found under a percent-encoded key, and taken out of the query without being used', () => {
    open(`#agentSignIn%3D${CODE}&view=results`);
    removeAgentSignInCodeFromAddress();
    expect(window.location.href).not.toContain(CODE);
    expect(window.location.hash).toBe('#view=results');
    expect(hasAgentSignInCodeFor(target)).toBe(true);
    dropAgentSignInCode();

    // In the query it went to the site's server with the page request: removed, and never a sign-in.
    open('#view=results', `?worker=${encodeURIComponent(WORKER)}&agentSignIn=${CODE}&mode=interview`);
    removeAgentSignInCodeFromAddress();
    expect(window.location.href).not.toContain(CODE);
    expect(window.location.search).toBe(`?worker=${encodeURIComponent(WORKER)}&mode=interview`);
    expect(window.location.hash).toBe('#view=results');
    expect(hasAgentSignInCodeFor(target)).toBe(false);
    // Both places at once: still not used.
    open(`#agentSignIn=${CODE}`, `?worker=${encodeURIComponent(WORKER)}&agentSignIn%3D=${CODE}`);
    removeAgentSignInCodeFromAddress();
    expect(window.location.href).not.toContain(CODE);
    expect(hasAgentSignInCodeFor(target)).toBe(false);
  });

  it('is taken out and dropped where the session’s name can’t be read, without stopping the page', () => {
    open(`#agentSignIn=${CODE}`, `?worker=${encodeURIComponent(WORKER)}`, '/session/%E0%A4%A');
    expect(() => removeAgentSignInCodeFromAddress()).not.toThrow();
    expect(window.location.href).not.toContain(CODE);
    expect(__test__agentSignIn.held()).toBeNull();
  });
});

describe('attaching a passkey', () => {
  it('signs nothing when the Worker’s nonce could add a line to the message', async () => {
    expect(['0123456789abcdef0123456789abcdef', 'n1abcDEF9'].every(isSignInNonce)).toBe(true);
    for (const bad of ['', 'short', 'abc12345\nURI: https://evil.example', 'abc 12345', 'abc-12345', 12345678, null]) {
      expect(isSignInNonce(bad)).toBe(false);
    }
    fetchMock.mockResolvedValueOnce(reply({ nonce: 'abc12345\nResources:\n- https://evil.example' }));
    const sign = jest.fn(async () => '0xsigned');
    await expect(
      attachPasskeyToAgentAccount({
        target,
        account: ACCOUNT,
        token: 'from-link',
        passkeyAddress: PASSKEY,
        appOrigin: 'https://contextengine.sh',
        sign,
        newPasskey: true,
      }),
    ).rejects.toMatchObject({ reason: 'unreadable' });
    expect(sign).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('has the passkey sign a message that names the account, and sends it with the sign-in from the link', async () => {
    const now = new Date('2026-11-20T10:00:00Z');
    const message = buildPasskeyAttachMessage({
      account: ACCOUNT,
      passkeyAddress: PASSKEY,
      nonce: 'n1abc2345',
      target,
      appOrigin: 'https://contextengine.sh',
      now,
    });
    expect(message).toContain(
      `Attach this passkey to the Context Engine account ${ACCOUNT}, which my AI agent set up.`,
    );
    expect(message).toContain(`contextengine.sh wants you to sign in with your Ethereum account:\n${PASSKEY}`);
    expect(message).toContain(`Resources:\n- ${WORKER}\n- urn:context-engine:session:id:${target.sessionId}`);
    expect(message).toContain('Expiration Time: 2026-11-20T10:05:00.000Z');

    fetchMock.mockResolvedValueOnce(reply({ nonce: 'n1abc2345' })).mockResolvedValueOnce(
      reply({
        token: 'kept',
        exp: 1800000000,
        address: ACCOUNT,
        via: 'passkey_link',
        passkey: PASSKEY,
        agentAccess: 'active',
      }),
    );
    const signed: string[] = [];
    const attached = await attachPasskeyToAgentAccount({
      target,
      account: ACCOUNT,
      token: 'from-link',
      passkeyAddress: PASSKEY,
      appOrigin: 'https://contextengine.sh',
      newPasskey: false,
      sign: async (text) => {
        signed.push(text);
        return '0xsigned';
      },
    });
    expect(attached).toMatchObject({ token: 'kept', via: 'passkey_link', passkey: PASSKEY });
    expect(signed).toHaveLength(1);
    expect(signed[0]).toContain(`account ${ACCOUNT}, which my AI agent set up.`);
    const [nonceCall, attachCall] = fetchMock.mock.calls;
    expect(nonceCall[0]).toBe(`${WORKER}/auth/nonce`);
    expect(JSON.parse(nonceCall[1].body)).toMatchObject({ address: PASSKEY, sessionSlug: 'salon' });
    expect(attachCall[0]).toBe(`${WORKER}/auth/agent-link/attach`);
    expect(attachCall[1].headers.Authorization).toBe('Bearer from-link');
    // The page says whether the passkey was made just now; here it was one the person already had.
    expect(JSON.parse(attachCall[1].body).newPasskey).toBe(false);
    expect(JSON.parse(attachCall[1].body).passkey).toEqual({
      address: PASSKEY,
      message: signed[0],
      signature: '0xsigned',
    });
  });
});

describe('an account held without its key', () => {
  const held = { address: ACCOUNT, ...target, via: 'agent_link', passkey: '', agentAccess: 'active' } as const;

  it('says who it is and refuses to sign', async () => {
    expect(isAgentLinkProvider(' Agent_Link ')).toBe(true);
    expect(isAgentLinkProvider('passkey_eoa')).toBe(false);
    await expect(agentLinkProvider.request({ method: 'eth_accounts' })).resolves.toEqual([]);
    holdAgentLinkAccount(held);
    expect(readAgentLinkAccount()).toEqual(held);
    await expect(agentLinkProvider.request({ method: 'eth_accounts' })).resolves.toEqual([ACCOUNT]);
    await expect(agentLinkProvider.request({ method: 'eth_requestAccounts' })).resolves.toEqual([ACCOUNT]);
    for (const method of ['personal_sign', 'eth_signTypedData_v4', 'eth_sendTransaction', 'eth_sign']) {
      await expect(agentLinkProvider.request({ method })).rejects.toBeInstanceOf(AgentLinkNoKeyError);
    }
    // What the tab keeps for a reload holds addresses and the session, never a sign-in.
    expect(window.sessionStorage.getItem('ce:agentLinkAccount:v1')).not.toMatch(/token|signed-in/);
    forgetAgentLinkAccount();
    expect(readAgentLinkAccount()).toBeNull();
    expect(window.sessionStorage.getItem('ce:agentLinkAccount:v1')).toBeNull();
    expect(holdAgentLinkAccount({ address: 'nobody' })).toBeNull();
  });

  it('gets a new sign-in only through its attached passkey, for the same account, session and Worker', async () => {
    const renewer = jest.fn(async (_account: unknown, _options: unknown) => ({ token: 'renewed', exp: 1800000000 }));
    setAgentLinkRenewer(renewer);
    const ask = { address: ACCOUNT, workerUrl: WORKER, sessionSlug: 'salon', prompt: false };
    // From the link alone there is nothing to renew with.
    holdAgentLinkAccount(held);
    await expect(renewAgentLinkSignIn(ask)).resolves.toBeNull();
    holdAgentLinkAccount({ ...held, via: 'passkey_link', passkey: PASSKEY });
    await expect(renewAgentLinkSignIn(ask)).resolves.toEqual({ token: 'renewed', exp: 1800000000 });
    expect(renewer).toHaveBeenCalledWith(expect.objectContaining({ address: ACCOUNT, passkey: PASSKEY }), {
      prompt: false,
    });
    for (const other of [{ address: PASSKEY }, { sessionSlug: 'another' }, { workerUrl: 'https://impostor.example' }]) {
      await expect(renewAgentLinkSignIn({ ...ask, ...other })).resolves.toBeNull();
    }
    forgetAgentLinkAccount();
    await expect(renewAgentLinkSignIn(ask)).resolves.toBeNull();
    expect(renewer).toHaveBeenCalledTimes(1);
  });

  it('makes one new sign-in when it is asked for twice at once, and never has a quiet request wait on a prompt', async () => {
    let finish: (value: { token: string; exp: number }) => void = () => undefined;
    const renewer = jest.fn(
      (_account: unknown, _options: unknown) =>
        new Promise<{ token: string; exp: number }>((resolve) => {
          finish = resolve;
        }),
    );
    setAgentLinkRenewer(renewer);
    holdAgentLinkAccount({ address: ACCOUNT, ...target, via: 'passkey_link', passkey: PASSKEY, agentAccess: 'active' });
    const ask = { address: ACCOUNT, workerUrl: WORKER, sessionSlug: 'salon' };
    const first = renewAgentLinkSignIn({ ...ask, prompt: false });
    const second = renewAgentLinkSignIn({ ...ask, prompt: false });
    const asked = renewAgentLinkSignIn({ ...ask, prompt: true });
    expect(renewer).toHaveBeenCalledTimes(1);
    finish({ token: 'renewed', exp: 1800000000 });
    await expect(Promise.all([first, second, asked])).resolves.toEqual(
      Array(3).fill({ token: 'renewed', exp: 1800000000 }),
    );
    // While the person is being asked, what the page does by itself does not wait on them.
    const prompting = renewAgentLinkSignIn({ ...ask, prompt: true });
    const quiet = renewAgentLinkSignIn({ ...ask, prompt: false });
    expect(renewer).toHaveBeenCalledTimes(3);
    finish({ token: 'again', exp: 1800000001 });
    await quiet;
    void prompting.catch(() => undefined);
  });

  it('hears once that a passkey is attached to an agent’s account, for the session and passkey it was said of', () => {
    const said = {
      workerUrl: WORKER,
      sessionSlug: 'salon',
      sessionId: target.sessionId,
      passkey: PASSKEY,
      linked: { address: ACCOUNT },
      token: 'passkey-sign-in',
    };
    const noted = readLinkedAgentAccountHintCount();
    noteLinkedAgentAccount({ ...said, linked: null });
    expect(takeLinkedAgentAccountHint(target, PASSKEY)).toBeNull();
    expect(readLinkedAgentAccountHintCount()).toBe(noted);
    noteLinkedAgentAccount(said);
    expect(readLinkedAgentAccountHintCount()).toBe(noted + 1);
    // It carries the passkey's sign-in, so only the Worker and session that sign-in was made at get it: not a
    // session of the same name on another Worker, nor another session id on the same one.
    expect(takeLinkedAgentAccountHint({ ...target, sessionSlug: 'another' }, PASSKEY)).toBeNull();
    expect(takeLinkedAgentAccountHint({ ...target, workerUrl: 'https://impostor.example' }, PASSKEY)).toBeNull();
    expect(takeLinkedAgentAccountHint({ ...target, sessionId: `0x${'4'.repeat(32)}` }, PASSKEY)).toBeNull();
    expect(takeLinkedAgentAccountHint({ ...target, sessionId: '' }, PASSKEY)).toBeNull();
    expect(takeLinkedAgentAccountHint(target, ACCOUNT)).toBeNull();
    expect(takeLinkedAgentAccountHint({ ...target, workerUrl: `${WORKER}/` }, PASSKEY)).toMatchObject({
      account: ACCOUNT,
      passkeyToken: 'passkey-sign-in',
    });
    expect(takeLinkedAgentAccountHint(target, PASSKEY)).toBeNull();
    expect(everythingStored()).not.toContain('passkey-sign-in');
  });

  it('forgets on sign-out what a sign-in said of passkeys, and shows it for its own Worker and session only', () => {
    noteLinkedAgentAccount({ ...target, passkey: PASSKEY, linked: { address: ACCOUNT }, token: 'passkey-sign-in' });
    noteAttachedPasskey({ ...target, account: ACCOUNT, attached: { address: PASSKEY } });
    expect(readAttachedPasskeyNotice(target, ACCOUNT)).toMatchObject({ passkey: PASSKEY });
    expect(readAttachedPasskeyNotice({ ...target, workerUrl: 'https://impostor.example' }, ACCOUNT)).toBeNull();
    expect(readAttachedPasskeyNotice({ ...target, sessionId: `0x${'4'.repeat(32)}` }, ACCOUNT)).toBeNull();
    expect(readAttachedPasskeyNotice(null, ACCOUNT)).toBeNull();
    forgetAgentLinkHints();
    expect(readAttachedPasskeyNotice(target, ACCOUNT)).toBeNull();
    expect(takeLinkedAgentAccountHint(target, PASSKEY)).toBeNull();
  });

  it('knows the session page a held account belongs to, so a reload of it is not taken over by a saved passkey', () => {
    expect(holdsAgentLinkAccountForPath('/session/salon')).toBe(false);
    holdAgentLinkAccount({ address: ACCOUNT, ...target, via: 'agent_link', passkey: '', agentAccess: 'active' });
    expect(holdsAgentLinkAccountForPath('/session/salon')).toBe(true);
    expect(holdsAgentLinkAccountForPath('/session/Salon/')).toBe(true);
    for (const elsewhere of ['/', '/session/another', '/session/salon/results', '/session/%E0%A4%A', '']) {
      expect(holdsAgentLinkAccountForPath(elsewhere)).toBe(false);
    }
  });
});
