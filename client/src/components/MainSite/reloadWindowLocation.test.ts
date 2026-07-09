import { reloadWindowLocation } from './reloadWindowLocation.js';

describe('reloadWindowLocation', () => {
  it('reloads the current location when a browser window is available', () => {
    const reload = jest.fn();

    expect(
      reloadWindowLocation({
        location: { reload },
      }),
    ).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('returns false when location.reload is unavailable', () => {
    expect(
      reloadWindowLocation({
        location: {},
      }),
    ).toBe(false);
  });
});
