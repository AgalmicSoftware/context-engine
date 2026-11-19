import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import UserPageAnalysisCard from './UserPageAnalysisCard';

const pages = { page1: { id: 'page 1' }, page2: { id: 'page 2' }, theme: {} };
const mockDraw = jest.fn((..._args: unknown[]) => pages);
const mockDownload = jest.fn((..._args: unknown[]) => Promise.resolve());
let mockVideo: { mime: string; extension: string } | null = { mime: 'video/mp4', extension: 'mp4' };

jest.mock('utilities/analysisCard/analysisCardCanvas', () => ({
  CARD_WIDTH: 1080,
  CARD_HEIGHT: 1920,
  loadAnalysisCardFonts: () => Promise.resolve(),
  drawAnalysisCardPages: (...args: unknown[]) => mockDraw(...args),
}));
jest.mock('utilities/analysisCard/analysisCardExport', () => ({
  downloadAnalysisCard: (...args: unknown[]) => mockDownload(...args),
}));
jest.mock('utilities/analysisCard/analysisCardVideoType', () => ({
  analysisCardVideoType: () => mockVideo,
}));
jest.mock('reactstrap', () => ({
  UncontrolledDropdown: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownToggle: ({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) => (
    <button type="button" disabled={disabled}>
      {children}
    </button>
  ),
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div role="menu">{children}</div>,
  DropdownItem: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <button type="button" role="menuitem" onClick={onClick}>
      {children}
    </button>
  ),
}));

const card = {
  own: true,
  link: 'contextengine.sh/session/demo',
  account: '0xabab…abab',
  title: 'Wants AI doing paperwork, not governing',
  matchNote: 'Favored participant-made rules.',
  figure: 'Elinor Ostrom (1933–2012)',
  figureName: 'Elinor Ostrom',
  years: '1933–2012',
  tastes: { book: null, game: null, film: null, song: null },
  answers: { yesNo: null, ownWords: null, vote: null },
};

describe('UserPageAnalysisCard', () => {
  let drawImage: jest.Mock;

  beforeEach(() => {
    mockDraw.mockClear();
    mockDownload.mockClear();
    mockVideo = { mime: 'video/mp4', extension: 'mp4' };
    drawImage = jest.fn();
    // jsdom never loads an image; here one loads when its address is a data: URL and fails otherwise.
    jest.spyOn(global, 'Image').mockImplementation(() => {
      const image = { onload: null as null | (() => void), onerror: null as null | (() => void) };
      return Object.defineProperty(image, 'src', {
        set: (source: string) => {
          setTimeout(() => (source.startsWith('data:') ? image.onload?.() : image.onerror?.()));
        },
      }) as unknown as HTMLImageElement;
    });
    jest
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('draws the card without a picture and turns between its two pages', async () => {
    render(<UserPageAnalysisCard card={card} picture={{ status: 'none' }} />);

    await waitFor(() => expect(drawImage).toHaveBeenCalledWith(pages.page1, 0, 0, 540, 960));
    // No picture; the site's mark is asked for but jsdom loads no images, so the card is drawn without it.
    expect(mockDraw).toHaveBeenCalledWith(card, null, null);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'Picture card, page 1 of 2: Wants AI doing paperwork, not governing. Closest historical match: Elinor Ostrom (1933–2012).',
    );
    expect((screen.getByLabelText('Show page 1 of the card') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('Show page 2 of the card'));
    await waitFor(() => expect(drawImage).toHaveBeenLastCalledWith(pages.page2, 0, 0, 540, 960));
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('page 2 of 2');
  });

  it('offers every kind of file from the one Download button', async () => {
    render(<UserPageAnalysisCard card={card} picture={{ status: 'none' }} />);
    await waitFor(() => expect((screen.getByText('Download') as HTMLButtonElement).disabled).toBe(false));

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Picture, both pages',
      'Picture, page 1',
      'Picture, page 2',
      'GIF, moving between the pages',
      'Video (MP4), moving between the pages',
    ]);

    await act(async () => {
      fireEvent.click(screen.getByText('GIF, moving between the pages'));
    });
    expect(mockDownload).toHaveBeenCalledWith(pages, 'gif');
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(''));
  });

  it('leaves video out where the browser cannot record one, and says when a file fails', async () => {
    mockVideo = null;
    mockDownload.mockRejectedValueOnce(new Error('no encoder'));
    render(<UserPageAnalysisCard card={card} picture={null} />);
    await waitFor(() => expect((screen.getByText('Download') as HTMLButtonElement).disabled).toBe(false));

    expect(screen.queryByText(/Video/)).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByText('Picture, both pages'));
    });
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        'The file could not be made. Try again, or choose another kind.',
      ),
    );
  });

  it('draws the picture in once it arrives, and saves only from the pages that have it', async () => {
    const { rerender } = render(<UserPageAnalysisCard card={card} picture={{ status: 'none' }} />);
    await waitFor(() => expect((screen.getByText('Download') as HTMLButtonElement).disabled).toBe(false));

    rerender(
      <UserPageAnalysisCard
        card={card}
        picture={{ status: 'ready', dataUrl: 'data:image/jpeg;base64,AAAA', accentHex: '#aa3311' }}
      />,
    );
    // Until the pages are redrawn with the picture, a click saves nothing.
    expect((screen.getByText('Download') as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect((screen.getByText('Download') as HTMLButtonElement).disabled).toBe(false));
    expect(mockDraw).toHaveBeenLastCalledWith(card, { image: expect.anything(), accentHex: '#aa3311' }, null);
  });

  it('says so when the card cannot be drawn, and stops saying so once it can', async () => {
    mockDraw.mockImplementationOnce(() => {
      throw new Error('no canvas');
    });
    const { rerender } = render(<UserPageAnalysisCard card={card} picture={null} />);

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('The card could not be drawn in this browser.'),
    );
    expect((screen.getByText('Download') as HTMLButtonElement).disabled).toBe(true);

    rerender(<UserPageAnalysisCard card={{ ...card }} picture={null} />);
    await waitFor(() => expect((screen.getByText('Download') as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('says so where the browser gives no canvas to draw on', async () => {
    mockDraw.mockReturnValueOnce(null as unknown as typeof pages);
    render(<UserPageAnalysisCard card={card} picture={null} />);

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('The card could not be drawn in this browser.'),
    );
  });

  it('holds the download until the picture has arrived', async () => {
    const { rerender } = render(<UserPageAnalysisCard card={card} picture={{ status: 'loading' }} />);
    await waitFor(() => expect(mockDraw).toHaveBeenCalled());

    expect((screen.getByText('Download') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toMatch(/^Drawing the picture/);

    rerender(<UserPageAnalysisCard card={card} picture={{ status: 'none' }} />);
    await waitFor(() => expect((screen.getByText('Download') as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByRole('status').textContent).toBe('');
  });
});
