import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndexKey, buildPayloadKey } from './storageRouteExecution.js';
import { loadWorkerCanonicalResultsAnalysisSource } from './resultsAnalysisGeneration.js';

const sessionId = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const config = {
	slug: 'session-a',
	sessionIdHex: sessionId,
	sessionName: 'Session A',
	sessionModeProfile: { authority: { mode: 'worker_canonical' }, storage: { backend: 'cloudflare' } },
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

const field = (value, extra = {}) => ({
	value,
	encrypted: false,
	encryptionAudience: 'public',
	encryptionGateId: '',
	audienceMode: 'explicit',
	hash: '',
	encryptedPortion: '',
	...extra,
});
const QUESTIONS = [
	{ questionId: 'qbin', prompt: 'Agree?', type: 'binary' },
	{ questionId: 'qtext', prompt: 'Say something', type: 'freeform' },
	{ questionId: 'qmc', prompt: 'Pick one', type: 'multichoice', options: ['Locked', 'Open'] },
];
const ROWS = [
	{ id: 'control', questionId: 'qbin', answer: field('Agree'), additional: field('') },
	{
		id: 'public-answer-encrypted-comment',
		questionId: 'qbin',
		answer: field('Agree'),
		additional: field('*', { encrypted: true, encryptionAudience: 'self', encryptedPortion: 'ciphertext' }),
	},
	{ id: 'freeform-text-Redacted', questionId: 'qtext', answer: field('Redacted'), additional: field('') },
	{ id: 'freeform-text-***', questionId: 'qtext', answer: field('***'), additional: field('') },
	{ id: 'multichoice-option-Locked', questionId: 'qmc', answer: field(['Locked']), additional: field('') },
	{
		id: 'encrypted-answer',
		questionId: 'qtext',
		answer: field('*', { encrypted: true, encryptionAudience: 'self', encryptedPortion: 'ciphertext' }),
		additional: field(''),
	},
];

test('Worker analysis: which stored rows count', async () => {
	const kv = createKv();
	for (const [index, question] of QUESTIONS.entries()) {
		await putPayload({ kv, resource: 'questions', id: `qm${index}`, payload: { sessionSlug: 'session-a', sessionId, ...question } });
	}
	for (const [index, row] of ROWS.filter((row) => row.questionId === 'qbin' || row.id === 'encrypted-answer').entries()) {
		await putPayload({
			kv,
			resource: 'responses',
			id: row.id,
			metadata: { responder: `0x${String(index + 1).repeat(40)}`, createdAt: `2026-09-17T00:0${index}:00.000Z` },
			payload: {
				sessionSlug: 'session-a',
				sessionId,
				questionID: row.questionId,
				questionId: row.questionId,
				answer: row.answer,
				additional: row.additional,
				type: QUESTIONS.find((q) => q.questionId === row.questionId).type,
			},
		});
	}
	const source = await loadWorkerCanonicalResultsAnalysisSource({ env: { CE_STORAGE_INDEX_KV: kv }, slug: 'session-a', config });
	assert.equal(source.ok, true);
	const counted = source.snapshot.responses.map((row) => `${row.questionId}=${row.answer}`).sort();
	// The client report counts every row except the encrypted answer (see the Jest probe).
	assert.deepEqual(counted, ['qbin=Agree', 'qbin=Agree']);
});
