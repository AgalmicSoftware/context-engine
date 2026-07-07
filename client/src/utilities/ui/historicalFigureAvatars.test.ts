import historicalFigures from '../../variables/demo/historical_figure_users.json';
import demoPolisData from '../../variables/demo/demo_polis_data.json';
import {
  getHistoricalFigureAvatar,
  getHistoricalFigureAvatarOrBlockie,
  getHistoricalFigureAvatarUsernames,
  hasHistoricalFigureAvatar,
} from './historicalFigureAvatars.js';

describe('historicalFigureAvatars', () => {
  const expectHistoricalPhotoUrl = (url: string) => {
    expect(url).toMatch(
      /^(\/historical-avatars\/|https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/|https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/)/,
    );
  };
  const createMockCanvas = (dataUrl: string) => {
    const getContext = jest.fn(
      () =>
        ({
          fillStyle: '',
          fillRect: jest.fn(),
        }) as unknown as CanvasRenderingContext2D,
    );
    const toDataURL = jest.fn(() => dataUrl);
    const canvas = {
      width: 0,
      height: 0,
      getContext,
      toDataURL,
    } as unknown as HTMLCanvasElement;

    return { canvas, getContext, toDataURL };
  };

  const mockCanvasCreateElement = (canvas: HTMLCanvasElement) => {
    const nativeCreateElement = document.createElement.bind(document);
    const createElement = ((tagName: string, options?: ElementCreationOptions) => {
      if (tagName === 'canvas') {
        return canvas;
      }
      return nativeCreateElement(tagName, options);
    }) as typeof document.createElement;
    return jest.spyOn(document, 'createElement').mockImplementation(createElement);
  };

  it('provides Wikimedia photo URLs for every historical figure in the demo Polis dataset', () => {
    const demoUsernames = (demoPolisData?.participantsVotes || []).map((entry) => entry?.xid).filter(Boolean);

    demoUsernames.forEach((username) => {
      expect(hasHistoricalFigureAvatar(username)).toBe(true);
      expectHistoricalPhotoUrl(getHistoricalFigureAvatar(username));
    });
  });

  it('covers the usernames declared in historical_figure_users.json and keeps extra atlas-only photo entries available', () => {
    const allUsernames = historicalFigures.map((entry) => entry?.username).filter(Boolean);
    const avatarUsernames = getHistoricalFigureAvatarUsernames();

    allUsernames.forEach((username) => {
      expect(avatarUsernames).toContain(username);
    });
    expect(avatarUsernames).toContain('Hypatia');
  });

  it('returns an empty string for unknown usernames', () => {
    expect(hasHistoricalFigureAvatar('UnknownFigure')).toBe(false);
    expect(getHistoricalFigureAvatar('UnknownFigure')).toBe('');
  });

  it('keeps the Wikimedia photo path for known historical figures by default', () => {
    expectHistoricalPhotoUrl(getHistoricalFigureAvatarOrBlockie('Franklin'));
  });

  it('keeps remote-only historical figures available when no local asset is shipped yet', () => {
    expectHistoricalPhotoUrl(getHistoricalFigureAvatar('Aristotle'));
  });

  it('can prefer a deterministic blockie for known historical figures', () => {
    const { canvas, getContext, toDataURL } = createMockCanvas('data:image/png;base64,known-figure-blockie');
    const createElementSpy = mockCanvasCreateElement(canvas);

    expect(getHistoricalFigureAvatarOrBlockie('Franklin', { preferBlockie: true })).toBe(
      'data:image/png;base64,known-figure-blockie',
    );
    expect(getContext).toHaveBeenCalledWith('2d');
    expect(toDataURL).toHaveBeenCalledWith('image/png');

    createElementSpy.mockRestore();
  });

  it('falls back to a deterministic blockie for unknown usernames', () => {
    const { canvas, getContext, toDataURL } = createMockCanvas('data:image/png;base64,unknown-figure-blockie');
    const createElementSpy = mockCanvasCreateElement(canvas);

    expect(getHistoricalFigureAvatarOrBlockie('UnknownFigure')).toBe('data:image/png;base64,unknown-figure-blockie');
    expect(getContext).toHaveBeenCalledWith('2d');
    expect(toDataURL).toHaveBeenCalledWith('image/png');

    createElementSpy.mockRestore();
  });
});
