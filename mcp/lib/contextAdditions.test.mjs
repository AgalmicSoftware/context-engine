import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildNote, checkContextLink, contextUploadForm, readContextFile, workerReadsContext } from './contextAdditions.mjs';
import { loadOrCreateWallet } from './agentState.mjs';

const folder = async (t, prefix) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
};

test('a local file is read as a context file of its own type and within its size', async (t) => {
  const dir = await folder(t, 'ce-context-files-');
  const stateDir = await folder(t, 'ce-context-state-');
  const write = async (name, body) => {
    await fs.writeFile(path.join(dir, name), body);
    return path.join(dir, name);
  };
  const notes = await readContextFile(await write('notes.md', '# Notes\n'), { stateDir });
  assert.deepEqual({ ...notes, bytes: notes.bytes.toString() }, { name: 'notes.md', contentType: 'text/markdown', bytes: '# Notes\n' });
  assert.equal((await readContextFile(await write('deck.pdf', '%PDF-1.7 deck'), { stateDir })).contentType, 'application/pdf');
  assert.equal((await readContextFile(await write('table.csv', 'a,b\n1,2\n'), { stateDir })).contentType, 'text/csv');

  await assert.rejects(readContextFile(await write('image.png', 'png'), { stateDir }), /Add a PDF, Markdown, plain text, CSV or JSON file\./);
  await assert.rejects(readContextFile(await write('fake.pdf', 'not a pdf'), { stateDir }), /fake\.pdf is not a PDF\./);
  await assert.rejects(readContextFile(await write('latin.txt', Buffer.from([0xff, 0xfe, 0x41])), { stateDir }), /latin\.txt is not UTF-8 text\./);
  await assert.rejects(readContextFile(await write('big.txt', 'x'.repeat(1024 * 1024 + 1)), { stateDir }), /big\.txt is larger than 1 MB, the most for a text file\./);
  // A file over its limit is refused before it's read: this sparse one is larger than Node reads at once.
  const huge = await write('huge.txt', '');
  await fs.truncate(huge, 3 * 1024 ** 3);
  await assert.rejects(readContextFile(huge, { stateDir }), /huge\.txt is larger than 1 MB/);
  await assert.rejects(readContextFile(path.join(dir, 'missing.md'), { stateDir }), /There is no file at/);
  await assert.rejects(readContextFile(dir, { stateDir }), /is not a file\./);
  // A link's name doesn't change what it points at.
  await fs.symlink(await write('image.bin', 'binary'), path.join(dir, 'looks-like.md'));
  await assert.rejects(readContextFile(path.join(dir, 'looks-like.md'), { stateDir }), /Add a PDF/);
});

test('the agent’s key is never read: not from its state folder, not through a link, not from a copy', async (t) => {
  const stateDir = await folder(t, 'ce-context-key-');
  const elsewhere = await folder(t, 'ce-context-elsewhere-');
  await loadOrCreateWallet(stateDir);
  const keyFile = path.join(stateDir, 'agent-key.json');
  await assert.rejects(readContextFile(keyFile, { stateDir }), /state folder, which holds this agent’s key, are never added/);
  await fs.symlink(keyFile, path.join(elsewhere, 'key.json'));
  await assert.rejects(readContextFile(path.join(elsewhere, 'key.json'), { stateDir }), /state folder/);
  await fs.copyFile(keyFile, path.join(elsewhere, 'copy.json'));
  await assert.rejects(readContextFile(path.join(elsewhere, 'copy.json'), { stateDir }), /copy\.json looks like it holds a key, token or password, so nothing was added\./);
});

test('hidden folders and credential files are never read, while ordinary JSON is', async (t) => {
  const home = await folder(t, 'ce-context-home-');
  const stateDir = await folder(t, 'ce-context-state-');
  const write = async (relative, body) => {
    const file = path.join(home, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
    return file;
  };
  const hidden = /Hidden files, and files in hidden folders, often hold keys and settings, so they are never added\./;
  const adc = await write('.config/gcloud/application_default_credentials.json', '{"type": "authorized_user"}');
  await assert.rejects(readContextFile(adc, { stateDir }), hidden);
  await assert.rejects(readContextFile(await write('.notes.md', '# Notes'), { stateDir }), hidden);
  await fs.symlink(adc, path.join(home, 'shared.json'));
  await assert.rejects(readContextFile(path.join(home, 'shared.json'), { stateDir }), hidden, 'nor through a link');

  const secret = /looks like it holds a key, token or password, so nothing was added\./;
  for (const body of [
    '{"client_id": "764086051850.apps.example", "client_secret": "d-FL95Q19q7MQmFpd7hHD0Ty", "refresh_token": "1//0gLz9hT"}',
    '{"user": "kami", "password": "correct-horse"}',
    '{"AccessKeyId": "AKIA", "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG"}',
    'Session: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N',
  ]) {
    await assert.rejects(readContextFile(await write('creds.json', body), { stateDir }), secret, body);
  }
  const ordinary = await write('salon.json', '{"title": "Salon", "token": "UNI", "password": "", "notes": "a password manager"}');
  assert.equal((await readContextFile(ordinary, { stateDir })).contentType, 'application/json');
});

test('a note is a Markdown file named by its title or first line, without secrets', () => {
  const note = buildNote({ text: '\n# Evening sessions\n\nResidents asked for them.\n', title: '' });
  assert.deepEqual({ ...note, bytes: note.bytes.toString() }, {
    name: 'Evening sessions.md', contentType: 'text/markdown', bytes: '# Evening sessions\n\nResidents asked for them.',
  });
  assert.equal(buildNote({ text: 'Body', title: '  On\nnames.md ' }).name, 'On names.md');
  assert.equal(buildNote({ text: '###', title: '' }).name, 'Note.md');
  assert.throws(() => buildNote({ text: '  ' }), /Pass the text to add\./);
  assert.throws(() => buildNote({ text: 'Body', title: 'x'.repeat(121) }), /The title must be 120 characters or fewer\./);
  assert.throws(() => buildNote({ text: 'x'.repeat(1024 * 1024 + 1) }), /larger than 1 MB/);
  assert.throws(() => buildNote({ text: `Key: 0x${'ab'.repeat(32)}` }), /The text looks like it holds a key/);
  assert.throws(() => buildNote({ text: 'Body', title: 'Bearer abcdefghijklmnopqrstuvwxyz' }), /The title looks like it holds a key/);
});

test('a link is https, within its length, and carries no credentials', () => {
  assert.deepEqual(checkContextLink({ url: ' https://example.org/essay ', title: ' Essay ' }), { url: 'https://example.org/essay', title: 'Essay' });
  assert.throws(() => checkContextLink({ url: 'http://example.org/essay' }), /Pass an https:\/\/ link to a public page\./);
  assert.throws(() => checkContextLink({ url: `https://example.org/${'a'.repeat(1000)}` }), /1000 characters or fewer/);
  assert.throws(() => checkContextLink({ url: 'https://example.org/essay?token=abc' }), /The link looks like it holds a key/);
});

test('an upload is a participant’s context file, marked as an agent’s, for admins alone when asked', async () => {
  const form = contextUploadForm({ name: 'notes.md', contentType: 'text/markdown', bytes: Buffer.from('# Notes') }, { adminsOnly: true, adderName: 'Test Kami' });
  assert.deepEqual(Object.fromEntries([...form.entries()].filter(([key]) => key !== 'file' && key !== 'tags')), {
    backend: 'cloudflare', resource: 'docsContext', contentType: 'text/markdown', payloadEncrypted: 'false',
    accessConditions: JSON.stringify({ match: 'all', conditions: [{ kind: 'worker_role', role: 'admin' }] }),
  });
  assert.deepEqual(JSON.parse(form.get('tags')).slice(-3), [
    { name: 'CE-DocMime', value: 'text/markdown' },
    { name: 'CE-AdderKind', value: 'agent' },
    { name: 'CE-AdderName', value: 'Test Kami' },
  ]);
  assert.equal(await form.get('file').text(), '# Notes');
  assert.equal(form.get('file').name, 'notes.md');
  const open = contextUploadForm({ name: 'n.md', contentType: 'text/markdown', bytes: Buffer.from('n') });
  assert.equal(open.has('accessConditions'), false);
  assert.deepEqual(JSON.parse(open.get('tags')).at(-1), { name: 'CE-AdderKind', value: 'agent' });
  // A name is one line of plain text, as the Worker accepts it.
  const named = contextUploadForm({ name: 'n.md', contentType: 'text/markdown', bytes: Buffer.from('n') }, { adderName: ' Test\u0007Kami\n\tbot ' });
  assert.deepEqual(JSON.parse(named.get('tags')).at(-1), { name: 'CE-AdderName', value: 'Test Kami bot' });
  // Marks that reorder text could make a name read as another.
  const reordered = contextUploadForm({ name: 'n.md', contentType: 'text/markdown', bytes: Buffer.from('n') }, { adderName: 'Kami\u202Egnp.exe' });
  assert.deepEqual(JSON.parse(reordered.get('tags')).at(-1), { name: 'CE-AdderName', value: 'Kami gnp.exe' });
});

test('context goes only where the Session Worker keeps and reads it', () => {
  const profile = (backend, payloadAccessControl = {}) => ({ storageProfile: { backend, payloadAccessControl } });
  assert.equal(workerReadsContext(profile('cloudflare', { encryption: 'none' })), true);
  assert.equal(workerReadsContext(profile('cloudflare', { encryption: 'worker_envelope' })), true);
  assert.equal(workerReadsContext(profile('cloudflare', { encryption: 'lit' })), false);
  assert.equal(workerReadsContext(profile('cloudflare', { mode: 'lit_encrypted' })), false);
  assert.equal(workerReadsContext(profile('arweave')), false);
  assert.equal(workerReadsContext(profile('lit-arweave')), false);
  assert.equal(workerReadsContext({}), false);
});
