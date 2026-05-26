import storageManager from './storageManager.js';

describe('storageManager public key helper', () => {
  it('preserves dg key formatting without trimming or normalizing names and slugs', () => {
    expect(storageManager.key('questionsCache', 'edge session')).toBe('dg:questionsCache:edge session');
    expect(storageManager.key('sbtCache', ' Alpha ')).toBe('dg:sbtCache: Alpha ');
    expect(storageManager.key(null, undefined)).toBe('dg::');
    expect(storageManager.key(0, false)).toBe('dg::');
  });
});
