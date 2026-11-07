import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionTranscriptClaimShare from './SessionTranscriptClaimShare';
import { createClaimCollector, readClaimFrame, unpackClaim } from './sessionTranscriptClaim';
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
const { useRecordingWakeLock } = jest.requireMock('../../utilities/audio/useRecordingWakeLock');

// Varied, so it doesn't compress to a single code.
const long = `I think the garden brings neighbours together. ${Array.from({ length: 200 }, (_, index) => (index * 104729).toString(36)).join(' ')}`;
const TRANSCRIPT = `Person 1: Should we fund the garden? It would need a small grant.\nPerson 2: ${long}\nPerson 3: Yes.`;

describe('giving each person their part', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/session/salon?joinGroup=salon-group&worker=https%3A%2F%2Fw.example');
  });

  it('offers a button per speaker with enough to claim, and nothing for an unlabelled transcript', () => {
    const { rerender } = render(<SessionTranscriptClaimShare transcript={TRANSCRIPT} sessionSlug="salon" />);
    expect(screen.getByRole('button', { name: 'Person 1' })).toHaveStyle({ color: 'var(--ce-speaker-1)' });
    expect(screen.getByRole('button', { name: 'Person 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Person 3' })).toBeNull();
    rerender(
      <SessionTranscriptClaimShare transcript="Plain notes with no labels at all, however long." sessionSlug="salon" />,
    );
    expect(screen.queryByTestId(E2E_TESTIDS.SESSION_CLAIM_SHARE)).toBeNull();
  });

  it('loops codes that rebuild the person’s part, keeps the screen on, and offers the same part as a link', async () => {
    render(<SessionTranscriptClaimShare transcript={TRANSCRIPT} sessionSlug="salon" />);
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
