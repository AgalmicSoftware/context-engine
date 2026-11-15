import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';

import { groupLockedAccess } from '../../shared/sessionContextSources.mjs';
import { ADMIN, PARTICIPANT, harness, idOf, json } from './contextSourceTestFixture.mjs';
import { buildSessionAgentExport } from '../../shared/sessionAgentExport.mjs';
import { SESSION_AGENT_EXPORT_ACTION, exportSessionAgent, sessionAgentExportGate } from './sessionAgentExport.js';
import { SLUG, createSessionEnv, signedAdminRequest } from './sessionWorkerRuntimeFixture.mjs';

const address = (digit) => `0x${digit.repeat(40)}`;
const [ANA, BEN, CAL, DEE] = ['a', 'b', 'c', 'd'].map(address);
const encode = (text) => new TextEncoder().encode(text);
const everyone = { match: 'any', conditions: [{ kind: 'agent_grant_scope', scope: 'ai' }] };
const salonMembers = { match: 'any', conditions: [{ kind: 'worker_group', groupIds: ['salon'] }] };
const SETTING = { audiences: [{ who: salonMembers, answers: 'detailed' }, { who: everyone, answers: 'general' }], minAnswers: 2 };
// A session its Worker runs, as a published Hosted & Fast session is.
const WORKER_RUN = { sessionModeProfile: { authority: { mode: 'worker_canonical' } }, workerAuthority: { version: 1 } };

const QUESTIONS = [
  { id: 'q1', prompt: 'Should meetings be shorter?', type: 'binary' },
  { id: 'q2', prompt: 'What should change first?', type: 'text' },
  { id: 'q3', prompt: 'How well did the last salon go?', type: 'rating', scale: { min: 1, max: 5, minLabel: 'Badly', maxLabel: 'Very well' } },
  { id: 'q4', prompt: 'Who should chair?', type: 'text' },
];
// Four members, each `participant_00N` in the session's own analysis.
const PEOPLE = [ANA, BEN, CAL, DEE];
const answer = (person, questionId, value, additional = '') => ({
  questionId, answer: value, additional, participantId: `participant_00${PEOPLE.indexOf(person) + 1}`,
});
const RESPONSES = [
  answer(ANA, 'q1', 'Agree', 'ANA-COMMENT fewer agenda items'),
  answer(BEN, 'q1', 'Agree'),
  answer(CAL, 'q1', 'Disagree'),
  answer(ANA, 'q2', 'ANA-WROTE start on time'),
  answer(BEN, 'q2', 'BEN-WROTE rotate the chair'),
  answer(CAL, 'q2', 'CAL-WROTE send notes before'),
  answer(ANA, 'q3', '4'),
  answer(BEN, 'q3', '5'),
  // One answer only: below this session's minimum of two.
  answer(DEE, 'q4', 'DEE-WROTE someone new'),
];
const SALON = [{ principal: { kind: 'evm_address', address: ANA } }, { principal: { kind: 'passkey_account', address: BEN } }, { principal: { kind: 'telegram', principalId: '77' } }];

// A session with one file of each reach, published results, members' answers and a group with two listed members.
const seeded = async ({ setting = SETTING, responses = RESPONSES, optedOut = [], unattributed = [], deps = {}, provider } = {}) => {
  const h = harness({ provider });
  Object.assign(h.state.config, WORKER_RUN, {
    sessionName: 'Salon planning',
    sessionContext: { title: 'Context', paragraphs: ['NOTE for everyone.'], links: [{ label: 'Charter', url: 'https://example.org/charter' }] },
  });
  if (setting) h.state.config.sessionAgent = setting;
  await idOf(await h.uploadFile({ name: 'agenda.md', type: 'text/markdown', bytes: encode('OPEN agenda') }));
  await idOf(await h.uploadFile({ name: 'board.txt', type: 'text/plain', bytes: encode('ADMINS plan'), adminsOnly: true }));
  await idOf(await h.uploadFile({
    name: 'group.txt', type: 'text/plain', bytes: encode('GROUP notes'), extra: { accessConditions: JSON.stringify(groupLockedAccess(['salon'])) },
  }));
  const run = (overrides = {}) => exportSessionAgent({
    env: h.env,
    slug: 'salon',
    config: h.state.config,
    address: ADMIN,
    deps: {
      ...h.deps,
      callSessionAgentOptOutStore: async () => ({ ok: true, body: { addresses: optedOut, unattributed } }),
      evaluateResultsAnalysisViewerEligibility: () => ({ ok: true }),
      readCoordinatedResultsAnalysisStatus: async () => ({ ok: true, state: {} }),
      readPublishedResultsAnalysisArtifact: async () => ({
        ok: true,
        artifact: { sections: { overview: { available: true, overview: 'RESULTS: shorter meetings.' }, themes: [{ title: 'Pace', summary: 'Most want less.' }] } },
      }),
      loadWorkerCanonicalResultsAnalysisSource: async () => ({
        ok: true,
        snapshot: { questions: QUESTIONS, responses },
        participantAddresses: new Map(PEOPLE.map((person, index) => [`participant_00${index + 1}`, person])),
      }),
      listWorkerGroupMembers: async ({ groupId }) => (groupId === 'salon'
        ? { ok: true, members: SALON, nextCursor: '' }
        : { ok: false, status: 404, reason: 'worker_group_not_found' }),
      ...deps,
      ...overrides,
    },
  });
  return { h, run };
};
const exported = async (options) => {
  const result = await (await seeded(options)).run();
  assert.equal(result.ok, true, JSON.stringify(result.body));
  return { ...result, file: JSON.parse(result.content) };
};
const of = (file, kind) => file.items.filter((item) => item.kind === kind);
const texts = (file, kind) => of(file, kind).map((item) => item.text);
// Refused with nothing exported, and a sentence that names the part that couldn't be read.
const refusedAsUnavailable = (result, part) => {
  assert.deepEqual([result.ok, result.status, result.body?.reason, result.content], [false, 503, 'session_agent_export_unavailable', undefined]);
  assert.equal(result.body.error, `The Session Agent’s material couldn’t all be read just now: ${part}. Nothing was exported; try again shortly.`);
};

test('the file holds what the agent may give a member, each item with the lowest style that may hear it', async () => {
  const { file, filename, manifest } = await exported();
  assert.equal(filename, 'salon.session-agent.json');
  assert.deepEqual([file.format, file.version], ['ce.session-agent-export', 1]);
  assert.deepEqual([file.session.slug, file.session.title], ['salon', 'Salon planning']);
  // The session's own two rules, as its Worker enforces them: anyone may sign in, and anyone signed in may read.
  assert.deepEqual(file.session.gate.signIn, { match: 'any', conditions: [] });
  assert.deepEqual(file.session.gate.read, { match: 'any', conditions: [{ kind: 'worker_role', role: 'admin' }, { kind: 'agent_grant_scope', scope: 'storage' }] });
  assert.deepEqual(file.agent.audiences, SETTING.audiences);
  assert.equal(file.agent.minAnswers, 2);
  assert.equal(file.agent.rules.length, 4);
  assert.match(file.agent.instructions.general, /shared material/);
  assert.match(file.agent.instructions.detailed, /members’ answers included/);

  // Every question, for anyone the session admits.
  assert.deepEqual(of(file, 'question').map((item) => item.question).sort(), QUESTIONS.map((question) => question.prompt).sort());
  assert.ok(of(file, 'question').every((item) => item.tier === 'general'));
  assert.equal(of(file, 'question').find((item) => item.question === QUESTIONS[2].prompt).text, 'type: rating, 1 (Badly) to 5 (Very well)');

  const byText = (text) => of(file, 'context').find((item) => item.text === text);
  assert.deepEqual([byText('NOTE for everyone.').tier, byText('OPEN agenda').tier], ['general', 'general']);
  assert.equal(byText('https://example.org/charter').title, 'Charter');
  // A file locked to a group is for Detailed answers, and only for that group's members.
  assert.deepEqual([byText('GROUP notes').tier, byText('GROUP notes').groups], ['detailed', ['salon']]);
  assert.equal(byText('OPEN agenda').groups, undefined);

  assert.deepEqual(texts(file, 'results').sort(), ['Pace: Most want less.', 'RESULTS: shorter meetings.']);
  assert.ok(of(file, 'results').every((item) => item.tier === 'general'));

  // Counts cover every answer; what members wrote is one item each. Both are for Detailed answers only.
  assert.deepEqual(of(file, 'counts').map((item) => [item.question, item.text]).sort(), [
    ['How well did the last salon go?', '2 answered. 4: 1, 5: 1'],
    ['Should meetings be shorter?', '3 answered. Agree: 2, Disagree: 1'],
  ]);
  assert.deepEqual(texts(file, 'written').sort(), [
    'ANA-COMMENT fewer agenda items', 'ANA-WROTE start on time', 'BEN-WROTE rotate the chair', 'CAL-WROTE send notes before',
  ]);
  assert.ok([...of(file, 'counts'), ...of(file, 'written')].every((item) => item.tier === 'detailed'));

  assert.deepEqual(manifest, file.manifest);
  assert.equal(file.manifest.itemCount, file.items.length);
  assert.deepEqual(file.manifest.byKind, { context: 4, counts: 2, question: 4, results: 2, written: 4 });
  // Every item has what a reader of the file needs, and ids are in order and never repeat.
  assert.ok(file.items.every((item) => /^[qcrnw]-[0-9a-f]{16}$/.test(item.id) && item.tier && item.text));
  assert.deepEqual(file.items.map((item) => item.id), [...new Set(file.items.map((item) => item.id))].sort());
});

test('what someone wrote or added carries their address, and nothing else that says who they are', async () => {
  const { file } = await exported();
  const writers = Object.fromEntries(of(file, 'written').map((item) => [item.text, item.by]));
  assert.deepEqual(writers, {
    'ANA-COMMENT fewer agenda items': ANA, 'ANA-WROTE start on time': ANA, 'BEN-WROTE rotate the chair': BEN, 'CAL-WROTE send notes before': CAL,
  });
  // A file says who added it; the session's own notes and links have no writer.
  const context = Object.fromEntries(of(file, 'context').map((item) => [item.text, item.by]));
  assert.deepEqual(context, { 'NOTE for everyone.': undefined, 'https://example.org/charter': undefined, 'OPEN agenda': ADMIN, 'GROUP notes': ADMIN });
  // Counts, questions and results are about everyone, so they never carry an address.
  assert.ok([...of(file, 'counts'), ...of(file, 'question'), ...of(file, 'results')].every((item) => !('by' in item)));
  // No name, no participant id, no other key for a person, anywhere in the items or the manifest.
  for (const key of ['responder', 'responderName', 'participantId', 'uploader', 'addedBy', 'address', 'name', 'from']) {
    assert.ok(file.items.every((item) => !(key in item)), `an item has a ${key}`);
  }
  const rest = JSON.stringify([file.items.map(({ by, ...item }) => item), file.manifest]);
  for (const identity of [...PEOPLE, ADMIN, PARTICIPANT, 'participant_001', 'participant_002']) {
    assert.ok(!rest.toLowerCase().includes(identity.toLowerCase()), `${identity} is outside an item’s address and the group lists`);
  }
});

test('someone who asked for their address to be left off keeps their answers and files in, without it', async () => {
  const shown = await exported();
  const { file } = await exported({ unattributed: [ANA, ADMIN.toUpperCase().replace('0X', '0x')] });
  assert.deepEqual(texts(file, 'written').sort(), texts(shown.file, 'written').sort());
  const writers = Object.fromEntries(of(file, 'written').map((item) => [item.text, item.by]));
  assert.deepEqual(writers, {
    'ANA-COMMENT fewer agenda items': undefined, 'ANA-WROTE start on time': undefined, 'BEN-WROTE rotate the chair': BEN, 'CAL-WROTE send notes before': CAL,
  });
  assert.ok(of(file, 'context').every((item) => !('by' in item)));
  // Her address is still in her group's list: that is who may ask, not who wrote what.
  assert.deepEqual(file.session.gate.groups, [{ groupId: 'salon', members: [ANA, BEN] }]);
  assert.equal(JSON.stringify(file.items).includes(ANA), false);
});

test('two people with no address shown who wrote the same words are one item with a count', async () => {
  const same = [answer(ANA, 'q2', 'SAME words'), answer(BEN, 'q2', 'SAME words'), answer(CAL, 'q2', 'SAME words')];
  const { file } = await exported({ responses: same, unattributed: [ANA, BEN] });
  assert.deepEqual(
    of(file, 'written').map(({ text, count, by }) => [text, count, by]).sort((a, b) => String(a[2]).localeCompare(String(b[2]))),
    [['SAME words', undefined, CAL], ['SAME words', 2, undefined]],
  );
});

test('admins-only context, and context under any rule but the session’s own or a group lock, is never exported', async () => {
  const { h, run } = await seeded();
  // Readable only with an SBT: neither the session's own rule nor a group lock. The upload route takes no such
  // rule, so the row is stored as an older or hand-written one would be.
  const other = { match: 'all', conditions: [{ kind: 'sbt_onchain', chainId: 10, contract: address('9'), anyOrAll: 'any' }] };
  assert.equal((await h.uploadFile({ name: 'refused.txt', type: 'text/plain', bytes: encode('x'), extra: { accessConditions: JSON.stringify(other) } })).status, 400);
  const id = await idOf(await h.uploadFile({ name: 'holders.txt', type: 'text/plain', bytes: encode('HOLDERS only') }));
  const key = `ce-storage:salon:docsContext:${id}`;
  await h.kv.put(key, JSON.stringify({ ...JSON.parse(h.kv.store.get(key)), accessConditions: other }), { metadata: h.kv.listMetadata.get(key) });
  const { content, manifest } = await run();
  assert.doesNotMatch(content, /ADMINS plan|board\.txt|HOLDERS only|holders\.txt/);
  assert.match(content, /OPEN agenda/);
  assert.deepEqual([manifest.leftOut.adminsOnlyContext, manifest.leftOut.otherRulesContext], [1, 1]);
});

test('the groups the rules and the items name are listed under the gate, and nowhere else', async () => {
  const { h, run } = await seeded();
  h.state.config.workerAuthority = { version: 1, loginGate: { match: 'any', conditions: [{ kind: 'worker_group', groupId: 'invited' }] } };
  await idOf(await h.uploadFile({
    name: 'two.txt', type: 'text/plain', bytes: encode('TWO groups'), extra: { accessConditions: JSON.stringify(groupLockedAccess(['salon', 'zeta'])) },
  }));
  const { content } = await run();
  const file = JSON.parse(content);
  // The gate's group and the item's second group no longer exist; the audience's has two members with an address and one without.
  assert.deepEqual(file.session.gate.groups, [
    { groupId: 'invited', members: [] }, { groupId: 'salon', members: [ANA, BEN] }, { groupId: 'zeta', members: [] },
  ]);
  assert.equal(file.manifest.leftOut.membersWithoutAddress, 1);
  assert.deepEqual(file.session.gate.signIn, { match: 'any', conditions: [{ kind: 'worker_group', groupIds: ['invited'] }] });
  assert.equal(file.members, undefined);
  // Opting out keeps answers out, not membership: Ana is still listed.
  const optedOut = JSON.parse((await run({ callSessionAgentOptOutStore: async () => ({ ok: true, body: { addresses: [ANA], unattributed: [] } }) })).content);
  assert.deepEqual(optedOut.session.gate.groups.find((group) => group.groupId === 'salon').members, [ANA, BEN]);
  assert.equal(JSON.stringify(optedOut.items).includes(ANA), false);
  assert.ok(content.includes('"groups"'));
});

test('a group too large to list in full says so, and a listing that can’t finish exports nothing', async () => {
  const many = (count, from = 0) => Array.from({ length: count }, (_, index) => ({
    principal: { kind: 'evm_address', address: `0x${(from + index + 1).toString(16).padStart(40, '0')}` },
  }));
  const { run } = await seeded();
  // 250 a page with more always to come: the export stops at its own limit of members.
  let pages = 0;
  const endless = await run({
    listWorkerGroupMembers: async ({ limit }) => { pages += 1; return { ok: true, members: many(limit, pages * 1000), nextCursor: `page-${pages}` }; },
  });
  const [group] = JSON.parse(endless.content).session.gate.groups;
  assert.deepEqual([group.groupId, group.members.length, group.complete], ['salon', 500, false]);
  assert.equal(pages, 2);
  // A cursor that never moves, a member list that throws, and a store that is down.
  for (const listWorkerGroupMembers of [
    async () => ({ ok: true, members: [], nextCursor: 'same' }),
    async () => { throw new Error('KV down'); },
    async () => ({ ok: false, status: 503, reason: 'worker_group_store_unavailable' }),
  ]) refusedAsUnavailable(await run({ listWorkerGroupMembers }), 'a group’s members');
});

test('someone who opted out has no answer or file in the file, and exporting again removes exactly theirs', async () => {
  const before = await exported();
  const after = await exported({ optedOut: [ANA] });
  assert.doesNotMatch(after.content, /ANA-WROTE|ANA-COMMENT/);
  assert.equal(after.file.manifest.leftOut.optedOut, 3);
  const ids = (file) => new Set(file.items.map((item) => item.id));
  const gone = before.file.items.filter((item) => !ids(after.file).has(item.id));
  const added = after.file.items.filter((item) => !ids(before.file).has(item.id));
  // Ana's two written items go; the two counts she was part of change; nothing else moves.
  assert.deepEqual(gone.map((item) => item.kind).sort(), ['counts', 'counts', 'written', 'written']);
  assert.deepEqual(added.map((item) => [item.kind, item.text]).sort(), [
    // Her rating was one of two, so that question now falls below the minimum and its count is gone.
    ['counts', '2 answered. Agree: 1, Disagree: 1'],
  ]);
  assert.equal(after.file.manifest.leftOut.belowMinAnswers, before.file.manifest.leftOut.belowMinAnswers + 1);
  assert.notEqual(after.file.manifest.itemsSha256, before.file.manifest.itemsSha256);
});

test('a file added by someone who opted out is left out too, with the AI’s reading of their PDF', async () => {
  const { h, run } = await seeded({ provider: async () => json({ content: [{ type: 'text', text: 'DECK text, as the AI read it.' }], stop_reason: 'end_turn' }) });
  h.state.config.contextAdditionPolicy = 'participants';
  const added = await h.uploadFile({ address: PARTICIPANT, name: 'mine.txt', type: 'text/plain', bytes: encode('PARTICIPANT file') });
  assert.equal(added.status, 200, JSON.stringify(await added.clone().json()));
  const deck = await idOf(await h.uploadFile({ address: PARTICIPANT, name: 'theirs.pdf' }));
  await idOf(await h.context({ action: 'read-pdf', id: deck }));
  const withThem = await run();
  assert.match(withThem.content, /PARTICIPANT file/);
  const reading = JSON.parse(withThem.content).items.find((item) => item.title === 'theirs.pdf');
  assert.deepEqual([reading.readByAi, reading.by], [true, PARTICIPANT]);
  const without = await run({ callSessionAgentOptOutStore: async () => ({ ok: true, body: { addresses: [PARTICIPANT], unattributed: [] } }) });
  assert.doesNotMatch(without.content, /PARTICIPANT file|mine\.txt|theirs\.pdf/);
  assert.equal(reading.text, 'DECK text, as the AI read it.');
  assert.doesNotMatch(without.content, /DECK text/);
  assert.equal(without.manifest.leftOut.optedOut, 2);
});

test('a question fewer than the session’s minimum answered gives no count and no written answer', async () => {
  const { content, file } = await exported();
  assert.doesNotMatch(content, /DEE-WROTE/);
  assert.equal(file.manifest.leftOut.belowMinAnswers, 1);
  // The question itself is still there: anyone admitted can read the question list.
  assert.ok(of(file, 'question').some((item) => item.question === 'Who should chair?'));
  // With the minimum off, the one answer is exported.
  const off = await exported({ setting: { ...SETTING, minAnswers: 1 } });
  assert.match(off.content, /DEE-WROTE someone new/);
  assert.equal(off.file.manifest.leftOut.belowMinAnswers, 0);
});

test('a written answer that names someone else is dropped whole and counted', async () => {
  const mail = ['dee', 'mail.example'].join('@');
  const naming = [
    answer(ANA, 'q2', `Ask ${mail} about it`),
    answer(BEN, 'q2', `Send it to ${DEE.replace('0x', '0X')} please`),
    answer(CAL, 'q2', 'talk to salonhost.eth'),
    answer(DEE, 'q2', 'call +44 20 7946 0958 after six'),
    answer(ANA, 'q1', 'Agree', 'or 555-867-5309'),
    answer(CAL, 'q1', 'Agree', 'tel 07700 900123'),
    answer(DEE, 'q1', 'Agree', `${'long answer '.repeat(30)}${mail}`),
    answer(BEN, 'q1', 'Agree', 'CLEAN comment, 3 of 10 meetings ran over in 2026'),
  ];
  const { content, file } = await exported({ responses: naming });
  assert.equal(file.manifest.leftOut.patternMatches, 7);
  assert.deepEqual(texts(file, 'written'), ['CLEAN comment, 3 of 10 meetings ran over in 2026']);
  const kept = JSON.stringify(file.items.map(({ by, ...item }) => item));
  for (const leaked of ['mail.example', DEE.slice(2), 'salonhost.eth', '7946', '867-5309', '900123']) assert.ok(!kept.includes(leaked), leaked);
  // The count still covers them: only what they wrote is dropped.
  assert.ok(content.includes('4 answered. Agree: 4'));
});

test('the same session gives the same bytes, whatever order its answers, members and choices are stored in', async () => {
  const first = await exported({ unattributed: [BEN, ANA], optedOut: [DEE] });
  const again = await exported({ unattributed: [BEN, ANA], optedOut: [DEE] });
  const reordered = await exported({
    responses: [...RESPONSES].reverse(),
    unattributed: [ANA, BEN],
    optedOut: [DEE],
    deps: { listWorkerGroupMembers: async () => ({ ok: true, members: [...SALON].reverse(), nextCursor: '' }) },
  });
  assert.equal(again.content, first.content);
  assert.equal(reordered.content, first.content);
  assert.ok(first.content.endsWith('}\n'));
  // Keys are in one order at every level, so a diff shows only what changed.
  assert.deepEqual(Object.keys(first.file), ['agent', 'format', 'items', 'manifest', 'session', 'version']);
  // Options chosen equally often go in the order of their words, not of who answered first.
  const tied = [answer(ANA, 'q1', 'Unsure'), answer(BEN, 'q1', 'Agree'), answer(CAL, 'q1', 'Disagree'), answer(DEE, 'q1', 'Agree')];
  assert.deepEqual(texts((await exported({ responses: tied })).file, 'counts'), ['4 answered. Agree: 2, Disagree: 1, Unsure: 1']);
});

test('one changed answer changes only its own items and the manifest', async () => {
  const before = await exported();
  const changed = RESPONSES.map((row) => (row.answer === 'BEN-WROTE rotate the chair' ? { ...row, answer: 'BEN-WROTE keep the chair' } : row));
  const after = await exported({ responses: changed });
  const strip = (file) => ({ ...file, items: file.items.filter((item) => !item.text.startsWith('BEN-WROTE')), manifest: null });
  assert.deepEqual(strip(after.file), strip(before.file));
  assert.equal(after.file.manifest.itemCount, before.file.manifest.itemCount);
  assert.notEqual(after.file.manifest.itemsSha256, before.file.manifest.itemsSha256);
});

test('results only some may see are not exported', async () => {
  const hidden = await exported({ deps: { evaluateResultsAnalysisViewerEligibility: () => ({ ok: false }) } });
  assert.deepEqual(texts(hidden.file, 'results'), []);
  assert.doesNotMatch(hidden.content, /RESULTS:/);
  assert.equal(hidden.file.manifest.leftOut.resultsNotForEveryone, 1);
});

test('context past the export’s reading limit is counted, never dropped without saying', async () => {
  const { h, run } = await seeded();
  for (let index = 0; index < 34; index += 1) {
    await idOf(await h.uploadFile({ name: `note-${index}.txt`, type: 'text/plain', bytes: encode(`EXTRA note ${index}`) }));
  }
  const { content, manifest } = await run();
  const read = JSON.parse(content).items.filter((item) => item.kind === 'context' && item.source === 'file').length;
  // 36 readable files, of which the export reads 32.
  assert.deepEqual([read, manifest.leftOut.contextNotRead], [32, 4]);
});

test('nothing is exported when the agent is off, or when anything it would hold can’t be read', async () => {
  const off = await (await seeded({ setting: null })).run();
  assert.deepEqual([off.ok, off.status, off.body.reason], [false, 409, 'session_agent_off']);
  // A session on the registry has no Session Agent, whatever its config holds.
  const onChain = await seeded();
  onChain.h.state.config.sessionModeProfile = { authority: { mode: 'evm_registry_canonical' } };
  assert.deepEqual([(await onChain.run()).status, (await onChain.run()).content], [409, undefined]);

  const { run } = await seeded();
  for (const [part, deps] of [
    ['people’s own choices', { callSessionAgentOptOutStore: async () => ({ ok: false, status: 503, body: {} }) }],
    // An older store that can't say who wants their address left off.
    ['people’s own choices', { callSessionAgentOptOutStore: async () => ({ ok: true, body: { addresses: [] } }) }],
    ['members’ answers', { loadWorkerCanonicalResultsAnalysisSource: async () => ({ ok: false, status: 503, reason: 'results_analysis_snapshot_unavailable' }) }],
    ['the results', { readPublishedResultsAnalysisArtifact: async () => { throw new Error('storage down'); } }],
    // The results' own storage is down: their reader would say "none yet".
    ['the results', {
      readCoordinatedResultsAnalysisStatus: async () => ({ ok: false, status: 503 }),
      readPublishedResultsAnalysisArtifact: async ({ deps: inner, ...args }) => {
        await inner.readCoordinatedResultsAnalysisStatus(args);
        return { ok: false, status: 404, error: 'No generated results analysis artifact is available yet.' };
      },
    }],
    ['a group’s members', { listWorkerGroupMembers: async () => ({ ok: false, status: 503, reason: 'worker_group_store_unavailable' }) }],
  ]) refusedAsUnavailable(await run(deps), part);
});

test('context that can’t be listed or read just now stops the export', async () => {
  const listDown = await seeded();
  const index = listDown.h.env.CE_STORAGE_INDEX_KV || listDown.h.kv;
  const list = index.list.bind(index);
  index.list = async (options) => {
    if (String(options?.prefix || '').includes('docsContext')) throw new Error('KV down');
    return list(options);
  };
  refusedAsUnavailable(await listDown.run(), 'its context');
  // The list answers, but a batch of its rows can't be fetched: some context is missing, so nothing is exported.
  index.list = list;
  const get = index.get.bind(index);
  index.get = async (key) => {
    if (Array.isArray(key) && key.some((name) => name.includes('docsContext'))) throw new Error('KV down');
    return get(key);
  };
  refusedAsUnavailable(await listDown.run(), 'its context');
  index.get = get;
  assert.equal((await listDown.run()).ok, true);

  const readDown = await seeded();
  const bucket = readDown.h.r2;
  const read = bucket.get.bind(bucket);
  bucket.get = async () => { throw new Error('R2 down'); };
  refusedAsUnavailable(await readDown.run(), 'its context');
  bucket.get = read;
  assert.equal((await readDown.run()).ok, true);
});

test('a storage error on a PDF’s reading, or on bytes held outside the bucket, stops the export instead of leaving them out', async () => {
  // The AI's reading of a PDF is found from the PDF's own row, by one read of its own.
  const pdf = await seeded({ provider: async () => json({ content: [{ type: 'text', text: 'DECK text, as the AI read it.' }], stop_reason: 'end_turn' }) });
  const deck = await idOf(await pdf.h.uploadFile({ name: 'deck.pdf' }));
  await idOf(await pdf.h.context({ action: 'read-pdf', id: deck }));
  assert.match((await pdf.run()).content, /DECK text/);
  const get = pdf.h.kv.get.bind(pdf.h.kv);
  pdf.h.kv.get = async (key) => {
    if (typeof key === 'string' && key.includes(':docsContext:')) throw new Error('KV down');
    return get(key);
  };
  refusedAsUnavailable(await pdf.run(), 'its context');
  pdf.h.kv.get = get;
  assert.equal((await pdf.run()).ok, true);

  // Bytes the bucket doesn't hold are looked for in the index's store: an error there is not "missing".
  const held = await seeded();
  held.h.r2.store.clear();
  const read = held.h.kv.get.bind(held.h.kv);
  held.h.kv.get = async (key) => {
    if (typeof key === 'string' && key.startsWith('ce-storage-payload:')) throw new Error('KV down');
    return read(key);
  };
  refusedAsUnavailable(await held.run(), 'its context');
  // With the store answering "nothing there", the bytes are gone for good: counted, and the rest exported.
  held.h.kv.get = read;
  const gone = await held.run();
  assert.deepEqual([gone.ok, gone.manifest.leftOut.unreadableContext], [true, 2]);
});

test('a context item too large to read here is counted as unreadable, not as a failure', async () => {
  const { h, run } = await seeded();
  const id = await idOf(await h.uploadFile({ name: 'huge.txt', type: 'text/plain', bytes: encode('HUGE text') }));
  const key = `ce-storage:salon:docsContext:${id}`;
  await h.kv.put(key, JSON.stringify({ ...JSON.parse(h.kv.store.get(key)), size: 64 * 1024 * 1024 }), { metadata: h.kv.listMetadata.get(key) });
  const { ok, content, manifest } = await run();
  assert.equal(ok, true);
  assert.doesNotMatch(content, /HUGE text/);
  assert.equal(manifest.leftOut.unreadableContext, 1);
});

test('answers from people with no address are left out and counted, and a link or file with no text is counted too', async () => {
  // Dee has no address: she joined some way that gives none, so she could never have set either switch.
  const { run } = await seeded();
  const withoutDee = new Map(PEOPLE.filter((person) => person !== DEE).map((person) => [`participant_00${PEOPLE.indexOf(person) + 1}`, person]));
  const { content, manifest } = await run({
    loadWorkerCanonicalResultsAnalysisSource: async () => ({
      ok: true,
      snapshot: { questions: QUESTIONS, responses: [...RESPONSES, answer(DEE, 'q1', 'Agree', 'DEE-COMMENT')] },
      participantAddresses: withoutDee,
    }),
  });
  assert.doesNotMatch(content, /DEE-/);
  assert.ok(content.includes('3 answered. Agree: 2, Disagree: 1'));
  assert.equal(manifest.leftOut.answersWithoutAddress, 2);
  assert.equal((await run()).manifest.leftOut.answersWithoutAddress, 0);

  const built = await buildSessionAgentExport({
    slug: 'salon', setting: SETTING, leftOut: { unreadableContext: 1 },
    sources: [
      { title: 'empty.txt', kind: 'file', url: '', text: '  ', everyone: true, groupIds: [], uploader: ANA },
      { title: 'Blank page', kind: 'link', url: 'https://example.org/blank', text: '', everyone: true, groupIds: [], uploader: ANA },
      { title: 'kept.txt', kind: 'file', url: '', text: 'KEPT', everyone: true, groupIds: [], uploader: ANA },
    ],
  });
  assert.deepEqual(built.items.map((item) => item.text), ['KEPT']);
  assert.equal(built.manifest.leftOut.unreadableContext, 3);
});

test('an answer names its question in the same words as the question’s own item, however long', async () => {
  const long = `${'Should the salon meet more often than it does now? '.repeat(8)}END`;
  assert.ok(long.length > 300);
  const { file } = await exported({
    deps: {
      loadWorkerCanonicalResultsAnalysisSource: async () => ({
        ok: true,
        snapshot: {
          questions: [{ id: 'q1', prompt: long, type: 'binary' }, { id: 'q2', prompt: `${long} Why?`, type: 'text' }],
          responses: [answer(ANA, 'q1', 'Agree'), answer(BEN, 'q1', 'Agree'), answer(ANA, 'q2', 'ANA-WROTE'), answer(BEN, 'q2', 'BEN-WROTE')],
        },
        participantAddresses: new Map(PEOPLE.map((person, index) => [`participant_00${index + 1}`, person])),
      }),
    },
  });
  const asked = new Set(of(file, 'question').map((item) => item.question));
  assert.deepEqual([...asked].sort(), [long, `${long} Why?`]);
  for (const item of [...of(file, 'counts'), ...of(file, 'written')]) assert.ok(asked.has(item.question), item.question.slice(-20));
  // The two questions differ only past 300 characters, and their answers stay apart.
  assert.deepEqual(of(file, 'written').map((item) => item.question), [`${long} Why?`, `${long} Why?`]);
});

test('a context item whose stored bytes are gone is counted, and the rest is exported', async () => {
  const { h, run } = await seeded();
  const id = await idOf(await h.uploadFile({ name: 'lost.txt', type: 'text/plain', bytes: encode('LOST text') }));
  const [key] = [...h.r2.store.keys()].filter((name) => name.includes(id));
  assert.ok(key, 'the file’s bytes are stored under its id');
  h.r2.store.delete(key);
  const { ok, content, manifest } = await run();
  assert.equal(ok, true);
  assert.doesNotMatch(content, /LOST text|lost\.txt/);
  assert.match(content, /OPEN agenda/);
  assert.equal(manifest.leftOut.unreadableContext, 1);
});

test('a session with more stored versions than the agent reads says so, and exports no answers', async () => {
  const { content, file } = await exported({
    deps: { loadWorkerCanonicalResultsAnalysisSource: async () => ({ ok: false, status: 503, reason: 'results_analysis_snapshot_limit' }) },
  });
  assert.equal(file.manifest.leftOut.answersNotRead, 1);
  assert.deepEqual([texts(file, 'counts'), texts(file, 'written'), texts(file, 'question')], [[], [], []]);
  assert.match(content, /OPEN agenda/);
});

test('the file carries the session’s sign-in rule and its reading rule as the Worker enforces them', () => {
  const gateOf = (loginGate, payloadAccessControl = { gate: 'none', encryption: 'none' }, base = WORKER_RUN) =>
    sessionAgentExportGate({ ...base, ...(loginGate ? { workerAuthority: { version: 1, loginGate } } : {}), storageProfile: { payloadAccessControl } });
  const open = { match: 'any', conditions: [] };
  const unknown = { match: 'all', conditions: [{ kind: 'unknown' }] };
  const group = (...groupIds) => ({ kind: 'worker_group', groupIds });
  assert.deepEqual(gateOf(), { signIn: open, read: open });
  // The sign-in rule names one group a condition; the file names them the way audiences do.
  assert.deepEqual(
    gateOf({ match: 'all', conditions: [{ kind: 'worker_group', groupId: 'B' }, { kind: 'worker_role' }, { kind: 'worker_role', role: 'Results_Admin' }] }).signIn,
    { match: 'all', conditions: [group('b'), { kind: 'worker_role', role: 'admin' }, { kind: 'worker_role', role: 'results_admin' }] },
  );
  // Signing in knows a role and one group. Any other rule admits no one there, which the file can't say, so it is unknown:
  // an SBT, a scope, and a group named the way audiences name several.
  const holders = { kind: 'sbt_onchain', chainId: 10, contract: address('9'), anyOrAll: 'any' };
  assert.deepEqual(
    gateOf({ match: 'any', conditions: [{ kind: 'something_new' }, { kind: 'worker_group' }, holders, { kind: 'agent_grant_scope', scope: 'ai' }, { kind: 'worker_group', groupIds: ['a'] }, 'junk'] }).signIn,
    { match: 'any', conditions: Array.from({ length: 5 }, () => ({ kind: 'unknown' })) },
  );
  // A session the Worker doesn't run under its own policy signs people in some other way: not guessed at.
  assert.deepEqual(gateOf(null, undefined, {}).signIn, unknown);
  assert.deepEqual(gateOf(null, undefined, { sessionModeProfile: WORKER_RUN.sessionModeProfile }).signIn, unknown);

  // The reading rule, in each form the Worker stores it.
  const reading = (...conditions) => gateOf(null, { gate: 'role_gate', encryption: 'none', accessConditions: { match: 'all', conditions } }).read.conditions;
  assert.deepEqual(gateOf(null, { gate: 'group_gate', encryption: 'none', groupIds: ['Readers', 'a'] }).read, { match: 'any', conditions: [group('a', 'readers')] });
  assert.deepEqual(reading({ ...holders, contract: address('9').toUpperCase().replace('0X', '0x'), anyOrAll: 'all' }, { ...holders, anyOrAll: undefined }), [
    { ...holders, anyOrAll: 'all' }, holders,
  ]);
  // The Worker reads older spellings of a role, a scope and a group; the file says what it reads.
  assert.deepEqual(reading({ kind: 'worker_role', name: 'results_admin' }, { kind: 'agent_grant_scope', value: 'storage' }, { kind: 'worker_group', groups: ['B', 'a'] }), [
    { kind: 'worker_role', role: 'results_admin' }, { kind: 'agent_grant_scope', scope: 'storage' }, group('a', 'b'),
  ]);
  // An SBT rule in any shape but one contract on a named chain is not restated, since a reader could take it for a wider one.
  for (const odd of [
    { ...holders, sbtAddresses: [address('8')] }, { ...holders, address: address('8') }, { ...holders, anyOrAll: undefined, mode: 'all' },
    { ...holders, anyOrAll: undefined, match: 'all' }, { ...holders, chainId: undefined, networkChainId: 10 }, { ...holders, contract: '0xabc' },
    { ...holders, anyOrAll: 'most' }, { kind: 'sbt_onchain', sbtAddresses: [address('8')] },
  ]) assert.deepEqual(reading(odd), [{ kind: 'unknown' }], JSON.stringify(odd));
  // Conditions stored under the gate's other names are the rule too.
  assert.deepEqual(gateOf(null, { gate: 'none', encryption: 'none', conditions: { match: 'any', conditions: [group('a')] } }).read, { match: 'any', conditions: [group('a')] });
  // A gate with nothing saying whom it admits is not guessed at: empty conditions don't open an SBT or role gate.
  assert.deepEqual(gateOf(null, { gate: 'sbt_gate', encryption: 'none' }).read, unknown);
  assert.deepEqual(gateOf(null, { gate: 'sbt_gate', encryption: 'none', accessConditions: { match: 'any', conditions: [] } }).read, unknown);
  assert.deepEqual(gateOf(null, { gate: 'role_gate', encryption: 'none', accessConditions: { match: 'any', conditions: ['junk'] } }).read, unknown);
  assert.deepEqual(gateOf(null, { gate: 'group_gate', encryption: 'none' }).read, unknown);
});

test('through the whole Worker: a full admin signs for the file, and a results admin is refused', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('No network in this test.'); });
  const resultsAdmin = Wallet.createRandom();
  const { admin, env } = createSessionEnv({
    // An audience that names no group: this fixture has no group store to list members from.
    configOverrides: { sessionName: 'Runtime salon', sessionAgent: { audiences: [{ who: everyone, answers: 'general' }] }, resultsAdminAddresses: [resultsAdmin.address.toLowerCase()] },
  });
  const refused = await signedAdminRequest({ env, wallet: resultsAdmin, action: SESSION_AGENT_EXPORT_ACTION });
  assert.equal(refused.status, 403, JSON.stringify(refused.body));
  assert.equal(refused.body.content, undefined);
  const answered = await signedAdminRequest({ env, wallet: admin, action: SESSION_AGENT_EXPORT_ACTION });
  assert.equal(answered.status, 200, JSON.stringify(answered.body));
  assert.equal(answered.body.filename, `${SLUG}.session-agent.json`);
  const file = JSON.parse(answered.body.content);
  assert.deepEqual([file.format, file.session.slug, file.session.title], ['ce.session-agent-export', SLUG, 'Runtime salon']);
  assert.deepEqual(file.agent.audiences, [{ who: everyone, answers: 'general' }]);
  assert.deepEqual([file.session.gate.groups, file.items], [[], []]);
  assert.deepEqual(answered.body.manifest, file.manifest);
});
