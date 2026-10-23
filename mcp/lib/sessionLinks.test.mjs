import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSessionWebUrl, normalizeWorkerOrigin, parseSessionLink } from './sessionLinks.mjs';

const WORKER = 'https://ce-town-hall.example.workers.dev';
const SBT = '0x00000000000000000000000000000000000000Aa';

test('parses a hosted session link with group and SBT invite parameters', () => {
  const link = `https://contextengine.sh/session/town-hall?worker=${encodeURIComponent(WORKER)}&joinGroup=grp_1&sbt=${SBT}&inv=code-1&auto=1&sbt2=${SBT.replace('Aa', 'bb')}&gp2=pw&src=delvetown`;
  const parsed = parseSessionLink(link);
  assert.equal(parsed.appOrigin, 'https://contextengine.sh');
  assert.equal(parsed.slug, 'town-hall');
  assert.equal(parsed.workerOrigin, WORKER);
  assert.equal(parsed.joinGroupId, 'grp_1');
  assert.equal(parsed.recruitmentSource, 'delvetown');
  assert.deepEqual(parsed.sbtClaims, [
    { sbt: SBT, groupPassword: '', inviteCode: 'code-1', auto: true },
    { sbt: SBT.replace('Aa', 'bb'), groupPassword: 'pw', inviteCode: '', auto: true },
  ]);
});

test('parses normal registry links without changing explicit Worker links', () => {
  const parsed = parseSessionLink('https://contextengine.sh/session/town-hall?src=agent');
  assert.equal(parsed.kind, 'registry');
  assert.equal(parsed.chainId, 11155420);
  assert.equal(parsed.workerOrigin, '');
  assert.equal(parsed.recruitmentSource, 'agent');
  assert.equal(buildSessionWebUrl(parsed), 'https://contextengine.sh/session/town-hall');
});

test('rejects links with duplicate Workers, no slug, or an unsafe Worker origin', () => {
  assert.throws(() => parseSessionLink(`https://contextengine.sh/session/town-hall?worker=${WORKER}&worker=${WORKER}`), /exactly one/);
  assert.throws(() => parseSessionLink(`https://contextengine.sh/?worker=${WORKER}`), /session\/<slug>/);
  assert.throws(() => parseSessionLink('not a url'), /full URL/);
  assert.throws(() => parseSessionLink('https://contextengine.sh/session/Bad!Slug?worker=https://w.example'), /slug/);
  assert.throws(() => parseSessionLink('https://contextengine.sh/session/a?worker=http://w.example'), /HTTPS/);
  assert.throws(() => parseSessionLink('https://contextengine.sh/session/a?worker=https://10.0.0.5'), /private/);
  assert.throws(() => parseSessionLink('https://contextengine.sh/session/a?worker=https://localhost:8787'), /private/);
});

test('allows localhost Workers only when explicitly enabled', () => {
  assert.equal(normalizeWorkerOrigin('http://localhost:8787/', { allowLocalWorkers: true }), 'http://localhost:8787');
  assert.throws(() => normalizeWorkerOrigin('http://localhost:8787'), /HTTPS/);
});

test('builds the web URL a human would open', () => {
  assert.equal(
    buildSessionWebUrl({ appOrigin: 'https://contextengine.sh', slug: 'town-hall', workerOrigin: WORKER }),
    `https://contextengine.sh/session/town-hall?worker=${encodeURIComponent(WORKER)}`,
  );
});
