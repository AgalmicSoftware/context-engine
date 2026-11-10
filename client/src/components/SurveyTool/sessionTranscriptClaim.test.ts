import {
  CLAIM_CODE_MS,
  buildClaimCodes,
  buildClaimLink,
  claimablePeople,
  claimTranscriptFor,
  clearClaimHash,
  createClaimCollector,
  createClaimShareId,
  hasClaimHash,
  packClaim,
  readClaimFrame,
  unpackClaim,
} from './sessionTranscriptClaim';

const BASE = 'https://contextengine.sh/session/rxc-ra-test-5';
const TRANSCRIPT = [
  'Person 1: Should the group fund the shared garden this year?',
  'Person 2: I think we should, because it brings neighbours together.',
  'Person 2: And it costs little.',
  'Person 3: Yes.',
  '[Recording gap: audio could not be transcribed.]',
  'Person 1: What about next year?',
  'Person 2: Let us decide then.',
].join('\n');

describe('a speaker’s part', () => {
  it('offers a code to each person who said anything, by number', () => {
    expect(claimablePeople(TRANSCRIPT)).toEqual(['Person 1', 'Person 2', 'Person 3']);
    expect(claimablePeople('Person 10: Words.\nPerson 2: So too.\nPerson 4: \nPerson 5:  ')).toEqual([
      'Person 2',
      'Person 10',
    ]);
    expect(claimablePeople('No labels in this one, however long it goes on.')).toEqual([]);
  });

  it('labels the person’s lines as the responder’s and keeps only the line before each from others', () => {
    expect(claimTranscriptFor(TRANSCRIPT, 'Person 2')).toBe(
      [
        'Other person: Should the group fund the shared garden this year?',
        'Responder: I think we should, because it brings neighbours together.',
        'Responder: And it costs little.',
        'Other person: What about next year?',
        'Responder: Let us decide then.',
      ].join('\n'),
    );
    // A gap isn't a turn, so no one is said to have answered it.
    expect(claimTranscriptFor(TRANSCRIPT, 'Person 1')).toBe(
      ['Responder: Should the group fund the shared garden this year?', 'Responder: What about next year?'].join('\n'),
    );
  });

  it('keeps only the end of a long line from someone else, and says when earlier lines went', () => {
    const long = `Person 1: ${'x'.repeat(500)}\nPerson 2: Short reply here.`;
    expect(claimTranscriptFor(long, 'Person 2')).toBe(`Other person: ${'x'.repeat(240)}\nResponder: Short reply here.`);
    const huge = claimTranscriptFor(`Person 1: ${'y'.repeat(130_000)}`, 'Person 1');
    expect(huge.startsWith('[Earlier lines left out.]\n')).toBe(true);
    expect(huge.length).toBeLessThan(121_000);
  });
});

it('changes codes slowly enough for a shared screen to settle, and never as fast as flashing', () => {
  expect(CLAIM_CODE_MS).toBeGreaterThanOrEqual(500);
  expect(1000 / CLAIM_CODE_MS).toBeLessThan(3);
});

describe('moving it between phones', () => {
  const claim = {
    sessionSlug: 'rxc-ra-test-5',
    person: 'Person 2',
    transcript: claimTranscriptFor(TRANSCRIPT, 'Person 2').repeat(40),
    joinGroup: '7824a38f-6946-4351-b74b-81307b406180',
  };

  it('rebuilds the part exactly from codes read in any order, some of them twice', async () => {
    const packed = await packClaim(claim);
    const codes = buildClaimCodes(packed, BASE, 'ab12');
    expect(codes.length).toBeGreaterThan(1);
    const collector = createClaimCollector();
    let result = { collected: 0, total: 0, packed: '' };
    for (const code of [...codes.slice(1), codes[1], codes[0]]) {
      const frame = readClaimFrame(code);
      expect(frame).not.toBeNull();
      result = collector.add(frame!);
    }
    expect(result).toMatchObject({ collected: codes.length, total: codes.length });
    expect(await unpackClaim(result.packed)).toEqual({ ok: true, claim });
  });

  it('keeps every code within what one QR code holds, and opens the session with an ordinary camera', async () => {
    const codes = buildClaimCodes(await packClaim(claim), BASE, createClaimShareId());
    for (const code of codes) {
      expect(new TextEncoder().encode(code).length).toBeLessThanOrEqual(287);
      expect(code.startsWith(`${BASE}#claim=`)).toBe(true);
    }
    expect(codes.join('').length).toBeGreaterThan(0);
  });

  it('refuses a session link with no room left for data', () => {
    expect(() => buildClaimCodes('data', `https://example.org/${'a'.repeat(260)}`, 'ab12')).toThrow(/too long/);
  });

  it('starts over on a frame from another share, so two people’s parts never mix', async () => {
    const collector = createClaimCollector();
    const first = buildClaimCodes(await packClaim(claim), BASE, 'aaaa');
    const second = buildClaimCodes(await packClaim({ ...claim, person: 'Person 1' }), BASE, 'bbbb');
    collector.add(readClaimFrame(first[1])!);
    const switched = collector.add(readClaimFrame(second[0])!);
    expect(switched.collected).toBe(1);
    let result = switched;
    for (const code of second.slice(1)) result = collector.add(readClaimFrame(code)!);
    expect((await unpackClaim(result.packed)).ok && (await unpackClaim(result.packed))).toMatchObject({
      claim: { person: 'Person 1' },
    });
  });

  it('carries the whole part in one link as well', async () => {
    const packed = await packClaim(claim);
    const frame = readClaimFrame(buildClaimLink(packed, BASE, 'ab12'));
    expect(frame).toMatchObject({ id: 'ab12', index: 0, total: 1 });
    expect(createClaimCollector().add(frame!).packed).toBe(packed);
  });

  it('reads nothing from other codes or malformed frames', () => {
    for (const value of [
      `${BASE}?mode=interview&joinGroup=abc`,
      `${BASE}#prefill=abc`,
      `${BASE}#claim=ab12.5.5.data`,
      `${BASE}#claim=ab12.x`,
      `${BASE}#claim=TOOLONG.0.1.data`,
      null,
    ]) {
      expect(readClaimFrame(value)).toBeNull();
    }
  });

  it('says a damaged part can’t be read', async () => {
    for (const packed of ['', 'not base64url!', 'AAAA', await packClaim({ ...claim, transcript: '   ' })]) {
      expect(await unpackClaim(packed)).toMatchObject({ ok: false });
    }
    expect(await unpackClaim(buildBomb())).toMatchObject({ ok: false });
  });

  it('finds and clears the fragment, leaving the rest of the link', () => {
    expect(hasClaimHash('#claim=ab12.0.1.x')).toBe(true);
    expect(hasClaimHash('#prefill=x')).toBe(false);
    expect(clearClaimHash({ pathname: '/session/a', search: '?mode=x', hash: '#claim=ab12.0.1.x&other=1' })).toBe(
      '/session/a?mode=x#other=1',
    );
  });
});

function buildBomb(): string {
  return 'z'.repeat(100_001);
}
