import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { createWorkerClient, resolveLoginOrigin } from './workerClient.mjs';
import { parseSiweMessage, validateSiweResources } from '../../workers/sessionCorsWorker/siweMessageValidation.js';

const TRUSTED = ['https://contextengine.sh', 'https://www.contextengine.sh'];
const SESSION_ID = '0x00112233445566778899aabbccddeeff';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('registry sign-in loads chain config and signs the slug without sending a session id', async () => {
  for (const slug of ['town-hall', 'general']) {
    const calls = [];
    const config = { sessionId: SESSION_ID, networkChainId: 11155420 };
    const client = createWorkerClient({
      workerOrigin: 'https://w.example.dev', slug, trustedOrigins: TRUSTED,
      wallet: ethers.Wallet.createRandom(), registryConfigLoader: async () => config,
      fetchImpl: async (url, init) => {
        const path = new URL(url).pathname;
        const body = JSON.parse(init.body);
        calls.push(path);
        assert.equal(Object.hasOwn(body, 'sessionId'), false);
        if (path === '/auth/nonce') return json({ nonce: 'n1abcdefgh' });
        assert.equal(path, '/auth/login');
        const siwe = parseSiweMessage(body.message);
        assert.equal(siwe.resources[1], `urn:context-engine:session:slug:${slug === 'general' ? '' : slug}`);
        assert.deepEqual(validateSiweResources({ siwe, request: new Request(url), config, targetSlug: slug }), { ok: true });
        return json({ token: 'e30.sig', exp: 9999999999 });
      },
    });
    await client.login();
    assert.deepEqual(calls, ['/auth/nonce', '/auth/login']);
    assert.equal(client.config.networkChainId, 11155420);
  }
});

test('signs in only as a trusted origin the session allows', () => {
  assert.equal(resolveLoginOrigin({}, TRUSTED), 'https://contextengine.sh');
  assert.equal(resolveLoginOrigin({ allowOrigins: ['https://www.contextengine.sh', 'https://evil.example'] }, TRUSTED), 'https://www.contextengine.sh');
  assert.throws(() => resolveLoginOrigin({ allowOrigins: ['https://app.third-party.example'] }, TRUSTED), /Ask the session admin to allow https:\/\/contextengine.sh/);
});

test('sign-in messages expire after ten minutes and carry the Worker and session', async () => {
  const wallet = ethers.Wallet.createRandom();
  let message = '';
  const fetchImpl = async (url, init = {}) => {
    const path = new URL(url).pathname;
    if (path === '/session-config') return json({ sessionSlug: 's', config: { sessionId: SESSION_ID } });
    if (path === '/auth/nonce') return json({ nonce: 'n1abcdefgh' });
    message = JSON.parse(init.body).message;
    return json({ token: 'e30.sig', exp: 9999999999 });
  };
  const client = createWorkerClient({ workerOrigin: 'https://w.example.dev', slug: 's', trustedOrigins: TRUSTED, wallet, fetchImpl, now: () => Date.parse('2026-10-16T12:00:00.000Z') });
  await client.login();
  assert.match(message, /Issued At: 2026-10-16T12:00:00.000Z\nExpiration Time: 2026-10-16T12:10:00.000Z\n/);
  assert.match(message, /Resources:\n- https:\/\/w\.example\.dev\n- urn:context-engine:session:id:0x00112233445566778899aabbccddeeff$/);
});

test('refuses redirects and oversized responses', async () => {
  const wallet = ethers.Wallet.createRandom();
  const redirecting = createWorkerClient({
    workerOrigin: 'https://w.example.dev',
    slug: 's',
    trustedOrigins: TRUSTED,
    wallet,
    fetchImpl: async (_url, init) => {
      assert.equal(init.redirect, 'error');
      return new Response(null, { status: 308, headers: { Location: 'http://169.254.169.254/' } });
    },
  });
  await assert.rejects(redirecting.loadConfig(), /redirect/);
  const huge = createWorkerClient({
    workerOrigin: 'https://w.example.dev',
    slug: 's',
    trustedOrigins: TRUSTED,
    wallet,
    fetchImpl: async () => new Response('x'.repeat(9 * 1024 * 1024)),
  });
  await assert.rejects(huge.loadConfig(), /too large/);
});

test('stops listing at the item cap and reports the list as incomplete', async () => {
  const wallet = ethers.Wallet.createRandom();
  let pages = 0;
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname;
    if (path === '/session-config') return json({ sessionSlug: 's', config: { sessionId: SESSION_ID } });
    if (path === '/auth/nonce') return json({ nonce: 'n1abcdefgh' });
    if (path === '/auth/login') return json({ token: 'e30.sig', exp: 9999999999 });
    pages += 1;
    return json({ items: Array.from({ length: 100 }, (_, index) => ({ storageRef: { id: `${pages}-${index}` } })), cursor: String(pages), listComplete: false });
  };
  const client = createWorkerClient({ workerOrigin: 'https://w.example.dev', slug: 's', trustedOrigins: TRUSTED, wallet, fetchImpl });
  const { items, complete } = await client.listAll('responses', { maxItems: 250 });
  assert.equal(items.length, 250);
  assert.equal(complete, false);
  assert.equal(pages, 3);
});
