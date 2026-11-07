import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionTranscriptClaimScanner from './SessionTranscriptClaimScanner';
import { buildClaimCodes, buildClaimLink, packClaim, readClaimFrame } from './sessionTranscriptClaim';

const mockReadQrCode = jest.fn();
jest.mock('jsqr', () => ({ __esModule: true, default: (...args: unknown[]) => mockReadQrCode(...args) }));

const BASE = `${window.location.origin}/session/salon`;
const claim = {
  sessionSlug: 'salon',
  person: 'Person 2',
  // Varied, so it doesn't compress to a single code.
  transcript: `Responder: We should fund the garden. ${Array.from({ length: 200 }, (_, index) => (index * 104729).toString(36)).join(' ')}`,
};

const startCamera = () => {
  const stopTrack = jest.fn();
  const getUserMedia = jest.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] }));
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: jest.fn(async () => undefined),
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, value: 1280 });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, value: 720 });
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', { configurable: true, writable: true, value: null });
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: jest.fn(),
    getImageData: (_x: number, _y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
    }),
  } as unknown as RenderingContext);
  return { getUserMedia, stopTrack };
};
const showCodes = (codes: Array<string | null>) => {
  let next = 0;
  mockReadQrCode.mockImplementation(() => {
    const data = codes[next % codes.length];
    next += 1;
    return data ? { data } : null;
  });
};

describe('scanning someone’s code', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/session/salon');
    mockReadQrCode.mockReset();
  });
  afterEach(() => jest.restoreAllMocks());

  it('collects the codes it sees, then hands over the part and turns the camera off', async () => {
    const { getUserMedia, stopTrack } = startCamera();
    const codes = buildClaimCodes(await packClaim(claim), BASE, 'ab12');
    expect(codes.length).toBeGreaterThan(1);
    // A blurred view reads nothing, and a code seen twice counts once.
    showCodes([null, ...codes.slice(1), codes[1], null, codes[0]]);
    const onClaim = jest.fn();
    render(<SessionTranscriptClaimScanner sessionSlug="salon" onClaim={onClaim} onCancel={jest.fn()} />);
    await waitFor(() => expect(onClaim).toHaveBeenCalledWith(claim), { timeout: 4000 });
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: false,
        video: expect.objectContaining({ facingMode: { ideal: 'environment' } }),
      }),
    );
    expect(stopTrack).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(`Got ${codes.length} of ${codes.length}`);
  });

  it('counts the code that opened the page, so only the rest are needed', async () => {
    startCamera();
    const codes = buildClaimCodes(await packClaim(claim), BASE, 'ab12');
    showCodes(codes.slice(1));
    const onClaim = jest.fn();
    render(
      <SessionTranscriptClaimScanner
        sessionSlug="salon"
        firstFrame={readClaimFrame(codes[0])}
        onClaim={onClaim}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(`Got 1 of ${codes.length}`);
    await waitFor(() => expect(onClaim).toHaveBeenCalledWith(claim), { timeout: 4000 });
  });

  it('takes a link’s whole part without touching the camera', async () => {
    const { getUserMedia } = startCamera();
    const frame = readClaimFrame(buildClaimLink(await packClaim(claim), BASE, 'ab12'));
    const onClaim = jest.fn();
    render(
      <SessionTranscriptClaimScanner sessionSlug="salon" firstFrame={frame} onClaim={onClaim} onCancel={jest.fn()} />,
    );
    await waitFor(() => expect(onClaim).toHaveBeenCalledWith(claim));
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('points to another session’s code rather than mixing it in, and ignores other codes', async () => {
    startCamera();
    const elsewhere = buildClaimCodes(await packClaim(claim), `${window.location.origin}/session/other`, 'ab12');
    showCodes([`${BASE}?mode=interview`]);
    const onClaim = jest.fn();
    const view = render(<SessionTranscriptClaimScanner sessionSlug="salon" onClaim={onClaim} onCancel={jest.fn()} />);
    expect(await screen.findByText('That code isn’t someone’s part of a conversation.')).toBeInTheDocument();
    view.unmount();

    showCodes([elsewhere[0]]);
    render(<SessionTranscriptClaimScanner sessionSlug="salon" onClaim={onClaim} onCancel={jest.fn()} />);
    expect(await screen.findByRole('link', { name: 'Open that session' })).toHaveAttribute('href', elsewhere[0]);
    expect(onClaim).not.toHaveBeenCalled();
  });

  it('refuses a whole part from another session', async () => {
    startCamera();
    const frame = readClaimFrame(buildClaimLink(await packClaim({ ...claim, sessionSlug: 'other' }), BASE, 'ab12'));
    const onClaim = jest.fn();
    render(
      <SessionTranscriptClaimScanner sessionSlug="salon" firstFrame={frame} onClaim={onClaim} onCancel={jest.fn()} />,
    );
    expect(await screen.findByText('This code is for another session.')).toBeInTheDocument();
    expect(onClaim).not.toHaveBeenCalled();
  });

  it('says what to do when the camera is refused, and stops it when cancelled', async () => {
    const { getUserMedia, stopTrack } = startCamera();
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    const refused = render(
      <SessionTranscriptClaimScanner sessionSlug="salon" onClaim={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Allow the camera');
    refused.unmount();

    showCodes([null]);
    const onCancel = jest.fn();
    const open = render(<SessionTranscriptClaimScanner sessionSlug="salon" onClaim={jest.fn()} onCancel={onCancel} />);
    await waitFor(() => expect(mockReadQrCode).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    await act(async () => open.unmount());
    expect(stopTrack).toHaveBeenCalled();
  });
});
