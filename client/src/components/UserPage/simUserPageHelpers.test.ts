import {
  buildSimFullProfileModalStatePatch,
  buildSimUserPageRootClassName,
  buildSimUserInfoStatePatch,
  buildSimUserRelatedScoreClassName,
  buildSimUserVoteIndicatorClassName,
  resolveSimUserInfoByUsername,
  resolveSimUserStanceMarkerStyle,
} from './simUserPageHelpers';

const figures = [
  { username: 'Franklin', name: 'Benjamin Franklin' },
  { username: 'Lovelace', name: 'Ada Lovelace' },
];

describe('simUserPageHelpers', () => {
  it('resolves simulated user info with the existing strict username match', () => {
    expect(resolveSimUserInfoByUsername(figures, 'Franklin')).toEqual(figures[0]);
    expect(resolveSimUserInfoByUsername(figures, 'franklin')).toBeNull();
    expect(resolveSimUserInfoByUsername(figures, undefined)).toBeNull();
  });

  it('builds the mounted user-info state patch', () => {
    expect(
      buildSimUserInfoStatePatch({
        figures,
        simUsername: 'Lovelace',
      }),
    ).toEqual({
      userInfo: figures[1],
    });
    expect(buildSimUserInfoStatePatch({ figures, simUsername: 'Missing' })).toEqual({
      userInfo: null,
    });
  });

  it('builds full-profile modal state patches with boolean-only open semantics', () => {
    expect(buildSimFullProfileModalStatePatch({ open: true })).toEqual({
      showFullProfileModal: true,
    });
    expect(buildSimFullProfileModalStatePatch({ open: 'true' })).toEqual({
      showFullProfileModal: false,
    });
    expect(buildSimFullProfileModalStatePatch()).toEqual({
      showFullProfileModal: false,
    });
  });

  it('builds simulated user page display classes and styles', () => {
    expect(
      buildSimUserPageRootClassName({
        baseClassName: 'sim',
        minimized: true,
        minimizedClassName: 'min',
      }),
    ).toBe('sim min');
    expect(
      buildSimUserPageRootClassName({
        baseClassName: 'sim',
        minimized: false,
        minimizedClassName: 'min',
      }),
    ).toBe('sim');
    expect(resolveSimUserStanceMarkerStyle({ value: 0 })).toEqual({ left: '50%' });
    expect(resolveSimUserStanceMarkerStyle({ value: -1 })).toEqual({ left: '0%' });
    expect(
      buildSimUserVoteIndicatorClassName({
        baseClassName: 'vote',
        negativeClassName: 'negative',
        positiveClassName: 'positive',
        vote: 2,
      }),
    ).toBe('vote positive');
    expect(
      buildSimUserVoteIndicatorClassName({
        baseClassName: 'vote',
        negativeClassName: 'negative',
        positiveClassName: 'positive',
        vote: -1,
      }),
    ).toBe('vote negative');
    expect(
      buildSimUserRelatedScoreClassName({
        baseClassName: 'score',
        disagreeClassName: 'disagree',
      }),
    ).toBe('score disagree');
  });
});
