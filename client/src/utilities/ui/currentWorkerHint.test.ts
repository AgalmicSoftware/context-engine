import { readCurrentWorkerHint, withCurrentWorkerHint, withWorkerHintForSession } from './currentWorkerHint';

describe('the page’s own worker on its links', () => {
  afterEach(() => window.history.replaceState({}, '', '/'));

  it('keeps an unlisted session’s Worker on a same-site link, before any fragment', () => {
    window.history.replaceState({}, '', '/session/salon?worker=https%3A%2F%2Fsalon.example.workers.dev%2F');
    expect(readCurrentWorkerHint()).toBe('https://salon.example.workers.dev');
    expect(withCurrentWorkerHint('/u/0xabc?session=salon#answers')).toBe(
      '/u/0xabc?session=salon&worker=https%3A%2F%2Fsalon.example.workers.dev#answers',
    );
    expect(withCurrentWorkerHint('/session/salon/docs')).toBe(
      '/session/salon/docs?worker=https%3A%2F%2Fsalon.example.workers.dev',
    );
    // A link that names its own Worker keeps it.
    expect(withCurrentWorkerHint('/u/0xabc?worker=https%3A%2F%2Fother.example')).toBe(
      '/u/0xabc?worker=https%3A%2F%2Fother.example',
    );
  });

  it('adds nothing where the page has no Worker, or one discovery refuses', () => {
    expect(withCurrentWorkerHint('/u/0xabc?session=salon')).toBe('/u/0xabc?session=salon');
    window.history.replaceState({}, '', '/session/salon?worker=http%3A%2F%2F10.0.0.1');
    expect(readCurrentWorkerHint()).toBe('');
    expect(withCurrentWorkerHint('/u/0xabc')).toBe('/u/0xabc');
    window.history.replaceState({}, '', '/session/salon?worker=https%3A%2F%2Fa.example&worker=https%3A%2F%2Fb.example');
    expect(readCurrentWorkerHint()).toBe('');
  });

  it('keeps the Worker only on a link to the session the page is showing', () => {
    const worker = 'worker=https%3A%2F%2Fsalon.example.workers.dev';
    window.history.replaceState({}, '', `/session/salon?${worker}`);
    expect(withWorkerHintForSession('/u/0xabc?session=salon', ' salon ')).toBe(`/u/0xabc?session=salon&${worker}`);
    // Another session's page would be sent to this session's Worker.
    expect(withWorkerHintForSession('/u/0xabc?session=other', 'other')).toBe('/u/0xabc?session=other');
    expect(withWorkerHintForSession('/u/0xabc', '')).toBe('/u/0xabc');

    // Off the session's own page, the address names the session in its query.
    window.history.replaceState({}, '', `/compare?session=salon&${worker}`);
    expect(withWorkerHintForSession('/u/0xabc?session=salon', 'salon')).toBe(`/u/0xabc?session=salon&${worker}`);
    window.history.replaceState({}, '', `/groups?sessionSlug=salon&${worker}`);
    expect(withWorkerHintForSession('/u/0xabc?session=salon', 'salon')).toBe(`/u/0xabc?session=salon&${worker}`);
    // A session named in the query is the one the page shows, over one in its path.
    window.history.replaceState({}, '', `/session/salon?session=other&${worker}`);
    expect(withWorkerHintForSession('/u/0xabc?session=salon', 'salon')).toBe('/u/0xabc?session=salon');
    expect(withWorkerHintForSession('/u/0xabc?session=other', 'other')).toBe(`/u/0xabc?session=other&${worker}`);

    // A page that names no session lends its Worker to no link, a link without a session included.
    window.history.replaceState({}, '', `/about?${worker}`);
    expect(withWorkerHintForSession('/u/0xabc?session=salon', 'salon')).toBe('/u/0xabc?session=salon');
    expect(withWorkerHintForSession('/u/0xabc', '')).toBe('/u/0xabc');
  });
});
