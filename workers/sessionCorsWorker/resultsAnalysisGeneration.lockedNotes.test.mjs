// A public answer whose optional comment is encrypted ("Only me") should still count in
// the Worker results analysis; only the encrypted comment should be withheld.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndexKey, buildPayloadKey } from './storageRouteExecution.js';
import { loadAdminSnapshotResultsAnalysisSource, loadWorkerCanonicalResultsAnalysisSource } from './resultsAnalysisGeneration.js';

const sessionId = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const config = {
	slug: 'session-a',
	sessionIdHex: sessionId,
	sessionModeProfile: { authority: { mode: 'worker_canonical' }, storage: { backend: 'cloudflare' } },
	storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
	resultsAnalysis: {
		version: 1,
		generationMode: 'both',
		views: { circles: true, breakdown: true, riskMatrix: true },
		autoAfter: { threshold: 2, unit: 'distinctParticipants' },
		inputScope: 'submitted',
		publication: 'latest_success_visible',
	},
};
const b64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const createKv = () => {
	const store = new Map();
	return {
		async put(key, value) {
			store.set(key, value);
		},
		async get(key) {
			return store.get(key) || null;
		},
		async list({ prefix = '' } = {}) {
			return { keys: [...store.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
		},
	};
};
const putPayload = async ({ kv, resource, id, metadata = {}, payload }) => {
	const fullMetadata = {
		id,
		resource,
		backend: 'cloudflare',
		contentType: 'application/json',
		encrypted: false,
		createdAt: '2026-09-17T00:00:00.000Z',
		...metadata,
	};
	await kv.put(buildIndexKey({ slug: 'session-a', resource, id }), JSON.stringify(fullMetadata));
	await kv.put(buildPayloadKey({ slug: 'session-a', id }), JSON.stringify({ metadata: fullMetadata, payloadBase64url: b64url(payload) }));
};

test('a public answer with an encrypted comment is still analysed', async () => {
	const kv = createKv();
	await putPayload({
		kv,
		resource: 'questions',
		id: 'qmeta1',
		payload: { sessionSlug: 'session-a', sessionId, questionId: 'q1', prompt: 'Public answer?', type: 'text' },
	});
	const envelope = JSON.stringify({ v: 1, recipients: [{ type: 'self-eip712-v1' }], ciphertext: 'AAAA', iv: 'BBBB' });
	await putPayload({
		kv,
		resource: 'responses',
		id: 'r1',
		metadata: { responder: '0x1111111111111111111111111111111111111111' },
		payload: {
			sessionSlug: 'session-a',
			sessionId,
			questionId: 'q1',
			answer: { value: 'plain public answer', encrypted: false, hash: '', encryptedPortion: '' },
			additional: { value: '*', encrypted: true, encryptionAudience: 'self', hash: '0xh', encryptedPortion: envelope },
		},
	});
	await putPayload({
		kv,
		resource: 'responses',
		id: 'r2',
		metadata: { responder: '0x2222222222222222222222222222222222222222', createdAt: '2026-09-17T00:01:00.000Z' },
		payload: {
			sessionSlug: 'session-a',
			sessionId,
			questionId: 'q1',
			answer: { value: 'another public answer', encrypted: false, hash: '', encryptedPortion: '' },
			additional: { value: '', encrypted: false, hash: '', encryptedPortion: '' },
		},
	});
	const source = await loadWorkerCanonicalResultsAnalysisSource({ env: { CE_STORAGE_INDEX_KV: kv }, slug: 'session-a', config });
	assert.equal(source.ok, true, JSON.stringify(source));
	console.log('E1 counts', JSON.stringify(source.counts));
	const answers = JSON.stringify(source.snapshot || source.aiSnapshot || source);
	assert.equal(answers.includes('another public answer'), true);
	// Desired: the first responder's public answer is analysed too (comment withheld).
	assert.equal(answers.includes('plain public answer'), true, `counts=${JSON.stringify(source.counts)}`);
	assert.equal(answers.includes(envelope), false);
});

test('strict admin snapshots redact auxiliary locks and still reject answer or row locks', async () => {
	const row = {
		questionId: 'q1',
		participantId: 'fixture-participant',
		answer: { value: 'public answer' },
		additional: { value: 'private note', encrypted: true },
		importance: 9,
		importanceEncrypted: { ciphertext: 'private importance' },
		conviction: 3,
		convictionEncrypted: { ciphertext: 'private conviction' },
	};
	const load = (response) =>
		loadAdminSnapshotResultsAnalysisSource({
			slug: 'session-a',
			config,
			body: {
				source: {
					kind: 'admin-snapshot',
					snapshot: {
						sessionSlug: 'session-a',
						sessionId,
						questions: [{ id: 'q1', prompt: 'Public answer?', type: 'text' }],
						responses: [response],
					},
				},
			},
		});
	const source = await load(row);
	assert.equal(source.ok, true);
	assert.equal(source.snapshot.responses[0].answer, 'public answer');
	for (const field of ['additional', 'importance', 'conviction']) {
		assert.equal(Object.hasOwn(source.snapshot.responses[0], field), false);
	}
	assert.equal(JSON.stringify(source.aiSnapshot).includes('private'), false);
	for (const locked of [
		{ ...row, encrypted: true },
		{ ...row, answer: { value: 'private answer', encrypted: true } },
	]) {
		const rejected = await load(locked);
		assert.equal(rejected.ok, false);
		assert.equal(rejected.status, 400);
	}
});

// How clients up to 0.6.7 uploaded a cleared answer or comment that had been locked.
const clearedWithLockFlag = (extra = {}) => ({
	value: '',
	encrypted: true,
	encryptionAudience: 'self_admin',
	encryptionGateId: 'gate-1',
	audienceMode: 'explicit',
	hash: '',
	encryptedPortion: '',
	...extra,
});

test('a cleared field that kept its lock flag reads as cleared and withdraws the older answer', async () => {
	const kv = createKv();
	await putPayload({
		kv,
		resource: 'questions',
		id: 'qmeta1',
		payload: { sessionSlug: 'session-a', sessionId, questionId: 'q1', prompt: 'Say something', type: 'freeform' },
	});
	const blank = { value: '', encrypted: false, hash: '', encryptedPortion: '' };
	const putRow = (id, responder, createdAt, answer, additional) => putPayload({
		kv,
		resource: 'responses',
		id,
		metadata: { responder, createdAt },
		payload: { sessionSlug: 'session-a', sessionId, questionId: 'q1', answer, additional },
	});
	const [A, B, C] = ['1', '2', '3'].map((digit) => `0x${digit.repeat(40)}`);
	// A answers in public, then clears the locked answer.
	await putRow('a0', A, '2026-09-17T00:00:00.000Z', { value: 'older public answer', encrypted: false }, blank);
	await putRow('a1', A, '2026-09-18T00:00:00.000Z', clearedWithLockFlag(), blank);
	// B keeps a public answer and clears a locked comment.
	await putRow('b0', B, '2026-09-17T00:00:00.000Z', { value: 'kept answer', encrypted: false }, clearedWithLockFlag({ hash: '0xstale' }));
	// C clears both.
	await putRow('c0', C, '2026-09-17T00:00:00.000Z', blank, clearedWithLockFlag());
	const source = await loadWorkerCanonicalResultsAnalysisSource({ env: { CE_STORAGE_INDEX_KV: kv }, slug: 'session-a', config });
	assert.equal(source.ok, true);
	assert.deepEqual(source.snapshot.responses.map(({ answer, additional }) => ({ answer, additional })), [
		{ answer: 'kept answer', additional: undefined },
	]);
	assert.deepEqual([source.counts.lockedCount, source.counts.excludedCount], [0, 2]);
});

test('an admin snapshot reads a cleared field that kept its lock flag as cleared', async () => {
	const load = (responses) => loadAdminSnapshotResultsAnalysisSource({
		slug: 'session-a',
		config,
		body: {
			source: {
				kind: 'admin-snapshot',
				snapshot: { sessionSlug: 'session-a', sessionId, questions: [{ id: 'q1', prompt: 'Say something', type: 'text' }], responses },
			},
		},
	});
	const older = { questionId: 'q1', participantId: 'p1', answer: { value: 'older public answer' }, submittedAt: '2026-09-17T00:00:00.000Z' };
	const source = await load([
		older,
		{ questionId: 'q1', participantId: 'p1', answer: clearedWithLockFlag(), submittedAt: '2026-09-18T00:00:00.000Z' },
		{ questionId: 'q1', participantId: 'p2', answer: { value: 'kept answer' }, additional: clearedWithLockFlag() },
	]);
	assert.equal(source.ok, true, JSON.stringify(source));
	assert.deepEqual(source.snapshot.responses.map(({ answer }) => answer), ['kept answer']);
	assert.equal(source.counts.lockedCount, 0);
	// A field that still holds a mask or an envelope stays locked.
	for (const answer of [
		clearedWithLockFlag({ encryptedPortion: 'ciphertext' }),
		clearedWithLockFlag({ envelope: { ciphertext: 'AAAA' } }),
		clearedWithLockFlag({ value: '*' }),
		clearedWithLockFlag({ locked: true }),
	]) {
		const rejected = await load([{ ...older, answer }]);
		assert.equal(rejected.status, 400, JSON.stringify(answer));
	}
});
