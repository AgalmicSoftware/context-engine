import { getDemoAvatar, getDemoAvatarByName } from './demoAvatars.js';

describe('demoAvatars', () => {
  const expectHistoricalPhotoUrl = (url) => {
    expect(url).toMatch(
      /^(\/historical-avatars\/|https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/|https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/)/
    );
  };

  it('resolves merged demo wallet addresses to avatar metadata', () => {
    const avatarInfo = getDemoAvatar('0x000000000000000000000000000000000000000b');

    expect(avatarInfo).toEqual(expect.objectContaining({
      name: 'Abraham Lincoln',
      fallbackInitials: 'AL',
    }));
    expectHistoricalPhotoUrl(avatarInfo.url);
    expect(avatarInfo.fallbackColor).toMatch(/^#/);
  });

  it('resolves policy atlas pseudo addresses to avatar metadata', () => {
    const avatarInfo = getDemoAvatar('0x_pseudo_address_turing');

    expect(avatarInfo).toEqual(expect.objectContaining({
      name: 'Alan Turing',
      fallbackInitials: 'AT',
    }));
    expectHistoricalPhotoUrl(avatarInfo.url);
  });

  it('resolves policy atlas-only figures through the local historical avatar manifest by name', () => {
    const avatarInfo = getDemoAvatar('0x_pseudo_address_aurelius');

    expect(avatarInfo).toEqual(expect.objectContaining({
      name: 'Marcus Aurelius',
      fallbackInitials: 'MA',
    }));
    expectHistoricalPhotoUrl(avatarInfo.url);
  });

  it('supports name-based lookup for spaced, camel-case, and accent-variant figure names', () => {
    expect(getDemoAvatarByName('Buckminster Fuller')).toEqual(expect.objectContaining({
      name: 'Buckminster Fuller',
      fallbackInitials: 'BF',
    }));

    expect(getDemoAvatarByName('BuckminsterFuller')).toEqual(expect.objectContaining({
      name: 'Buckminster Fuller',
    }));

    expect(getDemoAvatarByName('Niccolo Machiavelli')).toEqual(expect.objectContaining({
      name: 'Niccolo Machiavelli',
      fallbackInitials: 'NM',
    }));
  });

  it('returns null for unknown demo addresses and names', () => {
    expect(getDemoAvatar('0x_not_a_demo_address')).toBeNull();
    expect(getDemoAvatarByName('Unknown Figure')).toBeNull();
  });
});
