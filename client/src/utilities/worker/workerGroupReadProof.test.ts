import {
  forgetGroupReadHeader,
  groupReadHeaders,
  isKnownPrivateSession,
  readGroupReadHeader,
  readGroupReadProofSessionId,
  saveGroupReadHeader,
  withGroupReadHeader,
} from './workerGroupReadProof';

const header = `rxc.ra-2:0x${'ab'.repeat(65)}`;
const worker = 'https://salon.example.workers.dev';
const keep = () => saveGroupReadHeader({ workerUrl: `${worker}/`, sessionSlug: 'salon', sessionId: '0xABC', header });

beforeEach(() => {
  forgetGroupReadHeader(worker, 'salon');
  localStorage.clear();
});

it('keeps a session’s proof across reloads, for that session’s Worker only', () => {
  keep();
  expect(readGroupReadHeader(`${worker}/storage/read`, 'salon')).toBe(header);
  expect(readGroupReadProofSessionId(worker, 'salon')).toBe('0xabc');
  // What a reload reads: the stored copy, not this module's memory.
  expect(JSON.parse(localStorage.getItem('ce:group-read-proof:v1') || '{}')).toEqual({
    [`${worker} salon`]: { sessionId: '0xabc', header },
  });
  expect(readGroupReadHeader('https://other.example', 'salon')).toBe('');
  expect(readGroupReadHeader(worker, 'other')).toBe('');
});

it('adds the proof to a request’s headers, without replacing one already there', () => {
  keep();
  expect(withGroupReadHeader(new Headers(), worker, 'salon').get('X-CE-Group-Invite')).toBe(header);
  const set = new Headers({ 'X-CE-Group-Invite': 'mine' });
  expect(withGroupReadHeader(set, worker, 'salon').get('X-CE-Group-Invite')).toBe('mine');
  expect(withGroupReadHeader(new Headers(), worker, 'other').has('X-CE-Group-Invite')).toBe(false);
});

it('forgets a proof the Worker refused, and refuses to keep anything that is not one', () => {
  keep();
  forgetGroupReadHeader(worker, 'salon');
  expect(readGroupReadHeader(worker, 'salon')).toBe('');
  expect(localStorage.getItem('ce:group-read-proof:v1')).toBeNull();
  expect(() =>
    saveGroupReadHeader({ workerUrl: worker, sessionSlug: 'salon', sessionId: '0xabc', header: 'gp:secret' }),
  ).toThrow();
  localStorage.setItem('ce:group-read-proof:v1', JSON.stringify({ [`${worker} salon`]: { header: 'gp:x' } }));
  expect(readGroupReadHeader(worker, 'salon')).toBe('');
});

it('still works for the page when storage is refused', () => {
  const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('denied');
  });
  try {
    keep();
    expect(readGroupReadHeader(worker, 'salon')).toBe(header);
  } finally {
    setItem.mockRestore();
  }
});

it('sends a Worker before private sessions nothing new: without a proof, no header and no private mark', () => {
  // A 0.9.10 Worker's CORS allows no X-CE-Group-Invite header, so a request carrying one would never arrive.
  const plain = new Headers({ 'X-Session-Slug': 'open' });
  expect(groupReadHeaders('https://old.example', 'open')).toEqual({});
  expect([...withGroupReadHeader(plain, 'https://old.example', 'open').keys()]).toEqual(['x-session-slug']);
  expect(isKnownPrivateSession('https://old.example', 'open')).toBe(false);
});
