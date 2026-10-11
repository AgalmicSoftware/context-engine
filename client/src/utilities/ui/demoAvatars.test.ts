import { getDemoAvatarByName } from './demoAvatars.js';

describe('demoAvatars', () => {
  const expectHistoricalPhotoUrl = (url: string) => {
    expect(url).toMatch(
      /^(\/historical-avatars\/|https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/|https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/)/,
    );
  };

  const requireAvatarInfo = (avatarInfo: ReturnType<typeof getDemoAvatarByName>) => {
    expect(avatarInfo).not.toBeNull();
    if (!avatarInfo) {
      throw new Error('Expected demo avatar metadata.');
    }
    return avatarInfo;
  };

  it('resolves merged demo figures to avatar metadata', () => {
    const avatarInfo = requireAvatarInfo(getDemoAvatarByName('Abraham Lincoln'));

    expect(avatarInfo).toEqual(
      expect.objectContaining({
        name: 'Abraham Lincoln',
        fallbackInitials: 'AL',
      }),
    );
    expectHistoricalPhotoUrl(avatarInfo.url);
    expect(avatarInfo.fallbackColor).toMatch(/^var\(--ce-data-series-[1-5]\)$/);
  });

  it('resolves policy atlas figures to avatar metadata', () => {
    const avatarInfo = requireAvatarInfo(getDemoAvatarByName('Alan Turing'));

    expect(avatarInfo).toEqual(
      expect.objectContaining({
        name: 'Alan Turing',
        fallbackInitials: 'AT',
      }),
    );
    expectHistoricalPhotoUrl(avatarInfo.url);
  });

  it('resolves policy atlas-only figures through the local historical avatar manifest by name', () => {
    const avatarInfo = requireAvatarInfo(getDemoAvatarByName('Marcus Aurelius'));

    expect(avatarInfo).toEqual(
      expect.objectContaining({
        name: 'Marcus Aurelius',
        fallbackInitials: 'MA',
      }),
    );
    expectHistoricalPhotoUrl(avatarInfo.url);
  });

  it('supports name-based lookup for spaced, camel-case, and accent-variant figure names', () => {
    expect(getDemoAvatarByName('Buckminster Fuller')).toEqual(
      expect.objectContaining({
        name: 'Buckminster Fuller',
        fallbackInitials: 'BF',
      }),
    );

    expect(getDemoAvatarByName('BuckminsterFuller')).toEqual(
      expect.objectContaining({
        name: 'Buckminster Fuller',
      }),
    );

    expect(getDemoAvatarByName('Niccolo Machiavelli')).toEqual(
      expect.objectContaining({
        name: 'Niccolo Machiavelli',
        fallbackInitials: 'NM',
      }),
    );
  });

  it('returns null for unknown names', () => {
    expect(getDemoAvatarByName('Unknown Figure')).toBeNull();
  });
});
