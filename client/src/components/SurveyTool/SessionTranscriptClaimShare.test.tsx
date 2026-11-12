import { useState, type ComponentProps } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SessionTranscriptClaimShare from './SessionTranscriptClaimShare';
import { createClaimCollector, readClaimFrame, unpackClaim } from './sessionTranscriptClaim';
import { applySpeakerMerges, type SpeakerMerges } from '../../utilities/audio/speakerMerges';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

jest.mock('../../utilities/audio/useRecordingWakeLock', () => ({
  useRecordingWakeLock: jest.fn(() => ({ wakeLockHeld: true })),
}));
// The value each code holds, readable without rendering modules.
jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, title }: { value: string; title: string }) => (
    <svg data-testid="code" data-value={value} aria-label={title} />
  ),
}));
// The real pace is checked with the rest of the codes' rules; here the loop only has to come round.
jest.mock('./sessionTranscriptClaim', () => ({
  ...jest.requireActual<object>('./sessionTranscriptClaim'),
  CLAIM_CODE_MS: 5,
}));
const { useRecordingWakeLock } = jest.requireMock<{ useRecordingWakeLock: jest.Mock }>(
  '../../utilities/audio/useRecordingWakeLock',
);

// Varied, so it doesn't compress to a single code.
const long = `I think the garden brings neighbours together. ${Array.from({ length: 200 }, (_, index) => (index * 104729).toString(36)).join(' ')}`;
const TRANSCRIPT = `Person 1: Should we fund the garden? It would need a small grant.\nPerson 2: ${long}\nPerson 3: Yes.`;

// The share row as the recorder panel holds it: whose code is showing lives with the panel.
function Share(props: Omit<ComponentProps<typeof SessionTranscriptClaimShare>, 'person' | 'onPersonChange'>) {
  const [person, setPerson] = useState('');
  return <SessionTranscriptClaimShare {...props} person={person} onPersonChange={setPerson} />;
}

// With merging, as the panel wires it: the merges are kept beside the row and applied to its transcript.
function MergingShare({ initial = {} }: { initial?: SpeakerMerges }) {
  const [person, setPerson] = useState('');
  const [merges, setMerges] = useState<SpeakerMerges>(initial);
  return (
    <SessionTranscriptClaimShare
      transcript={applySpeakerMerges(TRANSCRIPT, merges)}
      sessionSlug="salon"
      person={person}
      onPersonChange={setPerson}
      speakerMerges={merges}
      onSpeakerMergesChange={setMerges}
    />
  );
}

// Reads the looping code to its end, as a phone would.
const readCode = async () => {
  const collector = createClaimCollector();
  let packed = '';
  await waitFor(
    () => {
      packed = collector.add(readClaimFrame(screen.getByTestId('code').getAttribute('data-value'))!).packed;
      expect(packed).not.toBe('');
    },
    { interval: 2, timeout: 4000 },
  );
  const unpacked = await unpackClaim(packed);
  if (!unpacked.ok) throw new Error('The code did not unpack.');
  return unpacked.claim;
};

describe('giving each person their part', () => {
  beforeEach(() => {
    useRecordingWakeLock.mockClear();
    window.history.replaceState({}, '', '/session/salon?joinGroup=salon-group&worker=https%3A%2F%2Fw.example');
  });

  it('pins a code to the session’s Worker as its own links do, unless it opens from a clean link', async () => {
    window.history.replaceState({}, '', '/session/salon');
    const config = {
      slug: 'salon',
      corsWorkerUrl: 'https://worker.example',
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    };
    const open = async (sessionSlug: string) => {
      const view = render(<Share transcript={TRANSCRIPT} sessionSlug={sessionSlug} sessionConfig={config} />);
      fireEvent.click(screen.getByRole('button', { name: 'Person 2' }));
      const value = (await screen.findByTestId('code')).getAttribute('data-value');
      view.unmount();
      return value;
    };
    expect(await open('salon')).toContain('/session/salon?worker=https%3A%2F%2Fworker.example#claim=');
    // A session the site ships with opens from its clean link anywhere.
    expect(await open('eddy26')).toContain('/session/salon#claim=');
  });

  it('offers a button to every speaker, however little they said, and nothing for an unlabelled transcript', () => {
    const { rerender } = render(<Share transcript={TRANSCRIPT} sessionSlug="salon" />);
    expect(screen.getByRole('button', { name: 'Person 1' })).toHaveStyle({ color: 'var(--ce-speaker-1)' });
    expect(screen.getByRole('button', { name: 'Person 2' })).toBeInTheDocument();
    // "Yes." is a part too.
    expect(screen.getByRole('button', { name: 'Person 3' })).toBeInTheDocument();
    rerender(<Share transcript="Plain notes with no labels at all, however long." sessionSlug="salon" />);
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_CLAIM_SHARE)).toBeNull();
  });

  it('opens a code only for a speaker with a button, and builds new codes for another person', async () => {
    const at = (person: string) => (
      <SessionTranscriptClaimShare
        transcript={TRANSCRIPT}
        sessionSlug="salon"
        person={person}
        onPersonChange={jest.fn()}
      />
    );
    const { rerender } = render(at('Person 9'));
    expect(screen.queryByTestId('code')).toBeNull();
    rerender(at('Person 1'));
    const first = (await screen.findByTestId('code')).getAttribute('data-value');
    rerender(at('Person 2'));
    await waitFor(() => expect(screen.getByTestId('code').getAttribute('data-value')).not.toBe(first));
  });

  it('opens no code while audio is still recording or transcribing, and says when parts failed', async () => {
    const { rerender } = render(<Share transcript={TRANSCRIPT} sessionSlug="salon" waiting />);
    expect(screen.getByText('Codes open once every part is transcribed.')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Person 1' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(screen.queryByRole('dialog')).toBeNull();
    // Once transcribed, the same tap opens the code; a failed part is named, not hidden.
    rerender(<Share transcript={TRANSCRIPT} sessionSlug="salon" failedParts={2} />);
    expect(screen.queryByText('Codes open once every part is transcribed.')).toBeNull();
    expect(screen.getByText(/2 parts failed to transcribe/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Person 1' }));
    expect(await screen.findByTestId('code')).toBeInTheDocument();
  });

  it('closes a speaker chosen from the transcript while audio is still waiting', () => {
    const onPersonChange = jest.fn();
    render(
      <SessionTranscriptClaimShare
        transcript={TRANSCRIPT}
        sessionSlug="salon"
        person="Person 2"
        onPersonChange={onPersonChange}
        waiting
      />,
    );
    expect(screen.queryByTestId('code')).toBeNull();
    expect(onPersonChange).toHaveBeenCalledWith('');
  });

  it('loops codes that rebuild the person’s part, keeps the screen on, and offers the same part as a link', async () => {
    render(<Share transcript={TRANSCRIPT} sessionSlug="salon" />);
    expect(useRecordingWakeLock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Person 2' }));
    const first = await screen.findByTestId('code');
    expect(useRecordingWakeLock).toHaveBeenCalledWith(true);
    expect(first.getAttribute('data-value')).toContain('/session/salon?worker=https%3A%2F%2Fw.example#claim=');

    const collector = createClaimCollector();
    let result = { collected: 0, total: 0, packed: '' };
    await waitFor(
      () => {
        result = collector.add(readClaimFrame(screen.getByTestId('code').getAttribute('data-value'))!);
        expect(result.packed).not.toBe('');
      },
      { interval: 2, timeout: 4000 },
    );
    expect(result.total).toBeGreaterThan(1);
    const unpacked = await unpackClaim(result.packed);
    expect(unpacked).toMatchObject({
      ok: true,
      claim: { sessionSlug: 'salon', person: 'Person 2', joinGroup: 'salon-group' },
    });
    expect(unpacked.ok && unpacked.claim.transcript).toContain('Responder: I think the garden');
    expect(unpacked.ok && unpacked.claim.transcript).toContain('Other person: Should we fund the garden?');
    expect(unpacked.ok && unpacked.claim.transcript).not.toContain('Person 3');

    const writeText = jest.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy link instead' })));
    const frame = readClaimFrame(writeText.mock.calls[0]?.[0 as never]);
    expect(frame).toMatchObject({ index: 0, total: 1 });
    expect(frame?.data).toBe(result.packed);
    expect(screen.getByRole('button', { name: 'Link copied' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByTestId('code')).toBeNull());
  });
});

// jsdom has no PointerEvent: a MouseEvent with a pointer id stands in, so a drag keeps its coordinates.
class PointerEventStandIn extends MouseEvent {
  pointerId: number;
  isPrimary: boolean;
  pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.isPrimary = init.isPrimary ?? true;
    this.pointerType = init.pointerType ?? 'mouse';
  }
}

describe('making two labels one person', () => {
  // What lies under the pointer, top first: the dragged button follows it, above the one it would land on.
  let under: Element[] = [];
  beforeEach(() => {
    window.history.replaceState({}, '', '/session/salon');
    under = [];
    Object.defineProperty(window, 'PointerEvent', { configurable: true, value: PointerEventStandIn });
    Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: jest.fn(() => under) });
  });
  afterEach(() => {
    delete (window as { PointerEvent?: unknown }).PointerEvent;
    delete (document as { elementsFromPoint?: unknown }).elementsFromPoint;
  });
  const press = (button: HTMLElement, pointerId: number) =>
    fireEvent.pointerDown(button, { pointerId, button: 0, clientX: 10, clientY: 10 });

  it('drops one person on another to make them one, with one code holding both parts', async () => {
    render(<MergingShare />);
    const third = screen.getByRole('button', { name: 'Person 3' });
    const first = screen.getByRole('button', { name: 'Person 1' });
    press(third, 1);
    under = [third, first];
    fireEvent.pointerMove(third, { pointerId: 1, clientX: 70, clientY: 14 });
    expect(first).toHaveClass('sessionClaimPersonTarget');
    expect(third).toHaveStyle({ transform: 'translate(60px, 4px)' });
    fireEvent.pointerUp(third, { pointerId: 1, clientX: 70, clientY: 14 });
    expect(screen.queryByRole('button', { name: 'Person 3' })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Person 3 joined Person 1.');

    fireEvent.click(screen.getByRole('button', { name: 'Person 1 + 3' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Person 1 + 3');
    const claim = await readCode();
    expect(claim.person).toBe('Person 1');
    expect(claim.transcript).toContain('Responder: Should we fund the garden?');
    expect(claim.transcript).toContain('Responder: Yes.');
  });

  it('opens a code on a tap, but not at the end of a drag that landed on no one', async () => {
    render(<MergingShare />);
    const second = screen.getByRole('button', { name: 'Person 2' });
    press(second, 1);
    under = [second];
    fireEvent.pointerMove(second, { pointerId: 1, clientX: 40, clientY: 40 });
    fireEvent.pointerUp(second, { pointerId: 1, clientX: 40, clientY: 40 });
    // The click that ends a drag.
    fireEvent.click(second);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Person \d$/ })).toHaveLength(3);
    // A press that hardly moves is a tap.
    press(second, 2);
    fireEvent.pointerMove(second, { pointerId: 2, clientX: 13, clientY: 12 });
    fireEvent.pointerUp(second, { pointerId: 2, clientX: 13, clientY: 12 });
    fireEvent.click(second);
    expect(await screen.findByRole('dialog')).toHaveTextContent('Person 2');
  });

  it('keeps a drag going when another finger lifts or is cancelled', () => {
    render(<MergingShare />);
    const third = screen.getByRole('button', { name: 'Person 3' });
    const first = screen.getByRole('button', { name: 'Person 1' });
    press(third, 1);
    under = [third, first];
    fireEvent.pointerMove(third, { pointerId: 1, clientX: 70, clientY: 14 });
    fireEvent.pointerUp(third, { pointerId: 2, clientX: 70, clientY: 14 });
    fireEvent.pointerCancel(third, { pointerId: 2 });
    expect(first).toHaveClass('sessionClaimPersonTarget');
    fireEvent.pointerUp(third, { pointerId: 1, clientX: 70, clientY: 14 });
    expect(screen.getByRole('button', { name: 'Person 1 + 3' })).toBeInTheDocument();
  });

  it('leaves later taps alone once a drag has merged its button away', async () => {
    render(<MergingShare />);
    const third = screen.getByRole('button', { name: 'Person 3' });
    press(third, 1);
    under = [third, screen.getByRole('button', { name: 'Person 1' })];
    fireEvent.pointerMove(third, { pointerId: 1, clientX: 70, clientY: 14 });
    fireEvent.pointerUp(third, { pointerId: 1, clientX: 70, clientY: 14 });
    // No click ends this drag: its button has gone. Split back, the button opens its code as before.
    await act(async () => new Promise((resolve) => setTimeout(resolve)));
    fireEvent.click(screen.getByRole('button', { name: 'Split Person 1 + 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Person 3' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Person 3');
  });

  it('drags under a finger only once it has held still, so a swipe over the buttons scrolls instead', () => {
    jest.useFakeTimers();
    try {
      render(<MergingShare />);
      const third = screen.getByRole('button', { name: 'Person 3' });
      const first = screen.getByRole('button', { name: 'Person 1' });
      const touch = { pointerId: 1, pointerType: 'touch', button: 0 };
      // A swipe that starts on Person 3 and lifts on Person 1.
      fireEvent.pointerDown(third, { ...touch, clientX: 10, clientY: 10 });
      under = [third, first];
      fireEvent.pointerMove(third, { ...touch, clientX: 10, clientY: 60 });
      act(() => jest.advanceTimersByTime(1000));
      fireEvent.pointerMove(third, { ...touch, clientX: 70, clientY: 14 });
      fireEvent.pointerUp(third, { ...touch, clientX: 70, clientY: 14 });
      expect(third).not.toHaveClass('sessionClaimPersonDragging');
      expect(screen.getByRole('button', { name: 'Person 3' })).toBeInTheDocument();
      // Held still, the button lifts and follows the finger.
      fireEvent.pointerDown(third, { ...touch, pointerId: 2, clientX: 10, clientY: 10 });
      under = [third];
      act(() => jest.advanceTimersByTime(400));
      expect(third).toHaveClass('sessionClaimPersonDragging');
      under = [third, first];
      fireEvent.pointerMove(third, { ...touch, pointerId: 2, clientX: 70, clientY: 14 });
      expect(first).toHaveClass('sessionClaimPersonTarget');
      fireEvent.pointerUp(third, { ...touch, pointerId: 2, clientX: 70, clientY: 14 });
      expect(screen.getByRole('button', { name: 'Person 1 + 3' })).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the keyboard on the row after a split, and after a merge made in a code', async () => {
    render(<MergingShare initial={{ 'Person 3': 'Person 1' }} />);
    const split = screen.getByRole('button', { name: 'Split Person 1 + 3' });
    split.focus();
    fireEvent.click(split);
    // The × has gone; its person keeps the focus.
    expect(screen.getByRole('button', { name: 'Person 1' })).toHaveFocus();
    const third = screen.getByRole('button', { name: 'Person 3' });
    third.focus();
    fireEvent.click(third);
    fireEvent.click(await screen.findByRole('button', { name: 'Same person as…' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Same person as' })).getByRole('button', { name: 'Person 1' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Person 3's button went with the merge; the keyboard lands on the button it joined.
    expect(screen.getByRole('button', { name: 'Person 1 + 3' })).toHaveFocus();
  });

  it('splits a merged button back into its people with its ×', () => {
    render(<MergingShare initial={{ 'Person 3': 'Person 1' }} />);
    expect(screen.queryByRole('button', { name: 'Person 3' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Split Person 1 + 3' }));
    expect(screen.getByRole('button', { name: 'Person 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Person 3' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Split/ })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Person 1, Person 3 are separate again.');
  });

  it('merges from a code’s Same person as, for phones and keyboards, and shows the merged code', async () => {
    render(<MergingShare />);
    fireEvent.click(screen.getByRole('button', { name: 'Person 3' }));
    const samePerson = await screen.findByRole('button', { name: 'Same person as…' });
    expect(screen.queryByRole('group', { name: 'Same person as' })).toBeNull();
    fireEvent.click(samePerson);
    const choices = screen.getByRole('group', { name: 'Same person as' });
    expect(within(choices).getByRole('button', { name: 'Person 1' })).toHaveFocus();
    fireEvent.click(within(choices).getByRole('button', { name: 'Person 1' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveTextContent('Person 1 + 3'));
    const claim = await readCode();
    expect(claim.transcript).toContain('Responder: Should we fund the garden?');
    expect(claim.transcript).toContain('Responder: Yes.');
  });

  it('offers no merging where merges can’t be kept', async () => {
    render(<Share transcript={TRANSCRIPT} sessionSlug="salon" />);
    const third = screen.getByRole('button', { name: 'Person 3' });
    press(third, 1);
    under = [third, screen.getByRole('button', { name: 'Person 1' })];
    fireEvent.pointerMove(third, { pointerId: 1, clientX: 70, clientY: 14 });
    fireEvent.pointerUp(third, { pointerId: 1, clientX: 70, clientY: 14 });
    expect(screen.getByRole('button', { name: 'Person 3' })).toBeInTheDocument();
    fireEvent.click(third);
    await screen.findByTestId('code');
    expect(screen.queryByRole('button', { name: 'Same person as…' })).toBeNull();
  });
});
