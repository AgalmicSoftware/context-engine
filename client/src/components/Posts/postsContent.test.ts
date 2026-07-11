import { buildPostAssetUrl, getPostAssetBasePath, normalizePostsManifest } from './postsContent';

const mutableEnv = process.env as Record<string, string | undefined>;
const ORIGINAL_PUBLIC_URL = mutableEnv.PUBLIC_URL;

afterEach(() => {
  if (typeof ORIGINAL_PUBLIC_URL === 'undefined') {
    delete mutableEnv.PUBLIC_URL;
  } else {
    mutableEnv.PUBLIC_URL = ORIGINAL_PUBLIC_URL;
  }
});

describe('postsContent', () => {
  it('normalizes valid manifest entries and drops incomplete or unsafe posts', () => {
    expect(
      normalizePostsManifest({
        posts: [
          {
            slug: 'newer',
            title: 'Newer',
            date: '2026-07-03',
            file: 'newer.md',
            headerImage: {
              src: 'assets/hero.png',
              alt: 'Hero image',
            },
            attachments: 'newer/attachments',
            tags: ['analysis', '', 'viz'],
          },
          {
            slug: 'older',
            title: 'Older',
            date: '2026-07-01',
            file: '/posts/older.md',
            headerImage: {
              src: '../private.png',
              alt: 'Unsafe image',
            },
            attachments: '../private',
          },
          {
            slug: 'unsafe',
            title: 'Unsafe',
            file: '../private.md',
          },
          {
            slug: '',
            title: 'Missing slug',
            file: 'missing.md',
          },
        ],
      }),
    ).toEqual([
      {
        slug: 'newer',
        title: 'Newer',
        date: '2026-07-03',
        file: 'newer.md',
        headerImage: {
          src: '/posts/assets/hero.png',
          alt: 'Hero image',
        },
        attachments: '/posts/newer/attachments',
        tags: ['analysis', 'viz'],
      },
      {
        slug: 'older',
        title: 'Older',
        date: '2026-07-01',
        file: '/posts/older.md',
        tags: [],
      },
    ]);
  });

  it('builds post asset URLs under PUBLIC_URL', () => {
    mutableEnv.PUBLIC_URL = '/ce/';

    expect(buildPostAssetUrl('entry.md')).toBe('/ce/posts/entry.md');
    expect(buildPostAssetUrl('attachments/image.png', 'agent-village-wrapped')).toBe(
      '/ce/posts/agent-village-wrapped/attachments/image.png',
    );
    expect(buildPostAssetUrl('/posts/manifest.json')).toBe('/ce/posts/manifest.json');
    expect(buildPostAssetUrl('https://raw.example.test/post.md')).toBe('https://raw.example.test/post.md');
  });

  it('derives post-local attachment bases from nested post files', () => {
    expect(getPostAssetBasePath('agent-village-wrapped/agent-village-wrapped.md')).toBe('agent-village-wrapped');
    expect(getPostAssetBasePath('/posts/mapping-collective-intelligence.md')).toBe('');
    expect(getPostAssetBasePath('../private.md')).toBe('');
  });
});
