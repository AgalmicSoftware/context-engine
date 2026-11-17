import {
  buildQuestionRoutePath,
  isKnownOrGeneralSessionSlug,
  isMaskedQuestionPayload,
  parseQuestionSessionIdFromSearch,
  parseQuestionSessionSlugFromSearch,
  pickBetterQuestionPayload,
  resolveQuestionPayloadDisplayState,
  resolveStrictSessionValue,
  shouldRetryMaskedQuestionRefresh,
} from './questionRouting.js';

type KnownSessionConfig = {
  slug: string;
  __unresolved?: boolean;
};

describe('questionRouting session query helpers', () => {
  it('parses slug-based session hints from query params', () => {
    const legacySearch = `?${['group', 'EDGE_PRIVATE'].join('=')}`;
    expect(parseQuestionSessionSlugFromSearch('?session=edge-private')).toBe('edge-private');
    expect(parseQuestionSessionSlugFromSearch(legacySearch)).toBeNull();
  });

  it('parses session id hints from query params', () => {
    expect(parseQuestionSessionIdFromSearch('?sessionID=0xabc123')).toBe('0xabc123');
    expect(parseQuestionSessionIdFromSearch('?sid=my-session-id')).toBe('my-session-id');
    expect(parseQuestionSessionIdFromSearch('?session=edge')).toBeNull();
  });

  it('prefers session slug when both session slug and sessionId are provided', () => {
    const route = buildQuestionRoutePath('0xABC', {
      responderAddress: '0xDEADBEEF',
      sessionId: '0xsessionid',
      sessionSlug: 'edge-private',
    });
    expect(route).toBe('/question/0xabc?session=edge-private&responder=0xdeadbeef');
  });

  it('builds question routes with sessionId when slug is absent', () => {
    const route = buildQuestionRoutePath('0xABC', {
      responderAddress: '0xDEADBEEF',
      sessionId: '0xsessionid',
    });
    expect(route).toBe('/question/0xabc?sessionId=0xsessionid&responder=0xdeadbeef');
  });

  it('builds question routes with only responderAddress when no session hint is provided', () => {
    const route = buildQuestionRoutePath('0xABC', {
      responderAddress: '0xDEADBEEF',
    });
    expect(route).toBe('/question/0xabc?responder=0xdeadbeef');
  });

  it.each(['', 'general'])('preserves explicit General (%s) separately from discovery', (sessionSlug) => {
    expect(buildQuestionRoutePath('0xABC', { sessionSlug })).toBe('/question/0xabc?session=general');
    expect(parseQuestionSessionSlugFromSearch('?session=general')).toBe('');
  });

  it.each([undefined, null])('keeps a missing session available for discovery (%s)', (sessionSlug) => {
    expect(buildQuestionRoutePath('0xABC', { sessionSlug })).toBe('/question/0xabc');
  });

  it('prefers an explicit General pin over a conflicting session id', () => {
    expect(buildQuestionRoutePath('0xABC', { sessionSlug: '', sessionId: 'other' })).toBe(
      '/question/0xabc?session=general',
    );
  });

  it('builds bare question routes when no responder or session hint is provided', () => {
    const route = buildQuestionRoutePath('0xABC');
    expect(route).toBe('/question/0xabc');
  });
});

describe('question links for Worker-run sessions', () => {
  const remember = (slug: string, origins: string[]) =>
    localStorage.setItem(
      'ce:sessionWorkerConfigCache:v1',
      JSON.stringify({
        v: 3,
        bySession: Object.fromEntries(
          origins.map((workerOrigin, index) => [
            `record-${index}`,
            {
              slug,
              sessionIdHex: `0x${String(index + 1).repeat(32)}`,
              registryChainId: 0,
              authorityMode: 'worker_canonical',
              workerOrigin,
              config: { corsWorkerUrl: workerOrigin },
              canonicalConfig: { slug },
            },
          ]),
        ),
      }),
    );
  const openPage = (search: string) => window.history.replaceState({}, '', `/s/unlisted-room${search}`);
  const WORKER = 'https://unlisted-room.example';
  afterEach(() => {
    localStorage.clear();
    openPage('');
  });

  it('keeps the Worker of a page opened with worker= when this browser verified it for the linked session', () => {
    remember('unlisted-room', [WORKER]);
    openPage(`?worker=${encodeURIComponent(WORKER)}`);
    expect(buildQuestionRoutePath('0xABC', { sessionSlug: 'unlisted-room' })).toBe(
      '/question/0xabc?session=unlisted-room&worker=https%3A%2F%2Funlisted-room.example',
    );
  });

  it('adds no Worker from memory alone, so a registry session by the same name keeps a clean link', () => {
    remember('unlisted-room', [WORKER]);
    expect(buildQuestionRoutePath('0xABC', { sessionSlug: 'unlisted-room' })).toBe(
      '/question/0xabc?session=unlisted-room',
    );
  });

  it("does not lend the page's Worker to another session's link", () => {
    remember('unlisted-room', [WORKER]);
    openPage(`?worker=${encodeURIComponent(WORKER)}`);
    expect(buildQuestionRoutePath('0xABC', { sessionSlug: 'other-room' })).toBe('/question/0xabc?session=other-room');
    expect(buildQuestionRoutePath('0xABC', { sessionSlug: '' })).toBe('/question/0xabc?session=general');
    expect(buildQuestionRoutePath('0xABC')).toBe('/question/0xabc');
  });

  it('keeps a listed session link clean', () => {
    remember('eddy26', ['https://elsewhere.example']);
    openPage(`?worker=${encodeURIComponent('https://elsewhere.example')}`);
    expect(buildQuestionRoutePath('0xABC', { sessionSlug: 'eddy26' })).toBe('/question/0xabc?session=eddy26');
  });
});

describe('questionRouting helper regressions', () => {
  it('retries masked question refresh after login readiness changes', () => {
    const shouldRetry = shouldRetryMaskedQuestionRefresh({
      masked: true,
      prev: {
        account: '0xabc',
        provider: 'wagmi',
        loginComplete: false,
        litHooks: null,
        sbtCacheRevision: 0,
      },
      next: {
        account: '0xabc',
        provider: 'wagmi',
        loginComplete: true,
        litHooks: { getKey: jest.fn() },
        sbtCacheRevision: 1,
      },
    });
    expect(shouldRetry).toBe(true);
  });

  it('does not silently fall back to default group for unresolved non-general slug', () => {
    const fallbackResolver = jest.fn(() => 84532);
    const value = resolveStrictSessionValue('test-65', () => null, fallbackResolver);

    expect(value).toBeNull();
    expect(fallbackResolver).not.toHaveBeenCalled();
  });

  it('treats unresolved group sentinel as unknown in strict group resolution', () => {
    const fallbackResolver = jest.fn(() => 84532);
    const value = resolveStrictSessionValue(
      'test-65',
      () => ({ slug: 'test-65', __unresolved: true }),
      fallbackResolver,
    );

    expect(value).toBeNull();
    expect(fallbackResolver).not.toHaveBeenCalled();
  });

  it('upgrades masked payload to decrypted and never downgrades decrypted payloads', () => {
    const masked = {
      id: 'q1',
      prompt: '[encrypted]',
      promptEncrypted: { v: 2 },
    };
    const decrypted = {
      id: 'q1',
      prompt: 'Decrypted prompt',
      promptDecrypted: true,
    };

    const upgraded = pickBetterQuestionPayload(masked, decrypted);
    expect(upgraded).not.toBeNull();
    if (!upgraded) {
      throw new Error('Expected upgraded payload');
    }
    expect(isMaskedQuestionPayload(upgraded)).toBe(false);
    expect(upgraded.prompt).toBe('Decrypted prompt');

    const downgraded = pickBetterQuestionPayload(upgraded, masked);
    expect(downgraded).not.toBeNull();
    if (!downgraded) {
      throw new Error('Expected downgraded payload');
    }
    expect(downgraded.prompt).toBe('Decrypted prompt');
    expect(downgraded.promptDecrypted).toBe(true);
  });

  it('prefers fetched encrypted metadata over a pending route placeholder', () => {
    const pending = {
      id: 'q1',
      type: 'freeform',
      prompt: '[encrypted]',
      __ceQuestionMetadataPending: true,
    };
    const fetched = {
      id: 'q1',
      type: 'binary',
      prompt: '[encrypted]',
      promptEncrypted: '{"ciphertext":"cipher"}',
      arweaveTxId: 'tx1',
    };

    const picked = pickBetterQuestionPayload(pending, fetched);

    expect(picked).toBe(fetched);
  });

  it('preserves multichoice options when a later cache payload has no options', () => {
    const cached = {
      id: 'q1',
      type: 'multichoice',
      prompt: 'Which capability matters most?',
      options: ['Cross-site graph', 'Session memory'],
    };
    const promptOnlyRefresh = {
      id: 'q1',
      type: 'multichoice',
      prompt: 'Which capability matters most?',
      options: [],
      arweaveTxId: 'tx1',
    };

    expect(pickBetterQuestionPayload(cached, promptOnlyRefresh)).toEqual({
      ...promptOnlyRefresh,
      options: ['Cross-site graph', 'Session memory'],
    });
  });

  it('preserves poll alias options when a later cache payload has no options', () => {
    const cached = {
      id: 'q1',
      type: 'poll',
      prompt: 'Which capability matters most?',
      options: ['Cross-site graph', 'Session memory'],
    };
    const promptOnlyRefresh = {
      id: 'q1',
      type: 'poll',
      prompt: 'Which capability matters most?',
      options: [],
      arweaveTxId: 'tx1',
    };

    expect(pickBetterQuestionPayload(cached, promptOnlyRefresh)).toEqual({
      ...promptOnlyRefresh,
      options: ['Cross-site graph', 'Session memory'],
    });
  });

  it('labels masked prompts by payload access mode instead of surfacing the raw mask', () => {
    expect(
      resolveQuestionPayloadDisplayState(
        {
          id: 'q-public',
          prompt: '[encrypted]',
        },
        {
          storageProfile: {
            backend: 'cloudflare',
            payloadAccessControl: { mode: 'public_read' },
          },
        },
      ),
    ).toMatchObject({
      status: 'unavailable',
      label: 'Unavailable',
      requiresAuth: false,
    });

    expect(
      resolveQuestionPayloadDisplayState({
        id: 'q-gated',
        prompt: '[encrypted]',
        payloadAccessMode: 'worker_sbt_gate',
      }),
    ).toMatchObject({
      status: 'worker_sbt_gate',
      label: 'Requires session access',
      requiresAuth: true,
    });

    expect(
      resolveQuestionPayloadDisplayState({
        id: 'q-envelope',
        prompt: '[encrypted]',
        payloadAccessControl: { gate: 'sbt_gate', encryption: 'worker_envelope' },
      }),
    ).toMatchObject({
      status: 'worker_sbt_gate',
      label: 'Requires session access',
      requiresAuth: true,
    });

    expect(
      resolveQuestionPayloadDisplayState({
        id: 'q-lit',
        prompt: '[encrypted]',
        promptEncrypted: '{"ciphertext":"cipher"}',
        payloadAccessMode: 'lit_encrypted',
      }),
    ).toMatchObject({
      status: 'lit_encrypted',
      label: 'Encrypted',
      requiresAuth: true,
    });
  });

  it('does not treat unknown query slugs as known sessions', () => {
    const getSessionConfigBySlug = (slug: string | null): KnownSessionConfig | null =>
      slug === 'test-65' ? { slug: 'test-65' } : null;

    expect(isKnownOrGeneralSessionSlug('test-65', getSessionConfigBySlug)).toBe(true);
    expect(isKnownOrGeneralSessionSlug('', getSessionConfigBySlug)).toBe(true);
    expect(
      isKnownOrGeneralSessionSlug(
        parseQuestionSessionSlugFromSearch('?session=does-not-exist'),
        getSessionConfigBySlug,
      ),
    ).toBe(false);
  });

  it('keeps built question-route session decoration non-authoritative when strict slug lookup stays unresolved', () => {
    const route = buildQuestionRoutePath('0xABC', {
      sessionSlug: 'edge-demo',
      sessionId: '0xsessionid',
    });
    const search = route.includes('?') ? route.slice(route.indexOf('?')) : '';
    const getSessionConfigBySlug = jest.fn(() => ({ slug: 'edge-demo', __unresolved: true }));

    expect(route).toBe('/question/0xabc?session=edge-demo');
    expect(isKnownOrGeneralSessionSlug(parseQuestionSessionSlugFromSearch(search), getSessionConfigBySlug)).toBe(false);
    expect(getSessionConfigBySlug).toHaveBeenCalledWith('edge-demo');
  });
});
