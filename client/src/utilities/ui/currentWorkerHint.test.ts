import { readCurrentWorkerHint, withCurrentWorkerHint } from './currentWorkerHint';

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
});
