import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  buildPublicRoute,
  stripPublicUrlBasePath,
} from '../../utilities/ui/publicUrl.js';
import { CE_ABOUT_POSTS_ENABLED } from '../../variables/appConfig.js';
import {
  LoadedPost,
  PostManifestEntry,
  PostsFetch,
  getPostAssetBasePath,
  loadPostMarkdown,
  loadPostsManifest,
} from './postsContent.js';
import PostMarkdownRenderer from './PostMarkdownRenderer.js';
import styles from './PostsPage.module.scss';

type PostsPageStatus = 'idle' | 'loading' | 'ready' | 'unavailable';
type PostLoadStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

type PostsPageProps = {
  enabled?: boolean;
  fetcher?: PostsFetch;
};

const defaultFetch: PostsFetch = (input, init) => {
  if (typeof fetch !== 'function') {
    throw new Error('fetch unavailable');
  }
  return fetch(input, init);
};

const formatPostDate = (date: string | undefined): string => {
  if (!date) return '';
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const decodePathSegment = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const readPostSlugFromPathname = (pathname: string): string => {
  const routePath = stripPublicUrlBasePath(pathname).split('?')[0].split('#')[0];
  const segments = routePath.split('/').filter(Boolean);
  if (segments[0] !== 'posts') return '';
  return decodePathSegment(segments[1] || '').trim();
};

const buildPostRoute = (slug: string): string => (
  buildPublicRoute(`/posts/${encodeURIComponent(slug)}`)
);

const PostsPage = ({
  enabled = CE_ABOUT_POSTS_ENABLED,
  fetcher = defaultFetch,
}: PostsPageProps) => {
  const location = useLocation();
  const [status, setStatus] = useState<PostsPageStatus>('idle');
  const [postStatus, setPostStatus] = useState<PostLoadStatus>('idle');
  const [posts, setPosts] = useState<PostManifestEntry[]>([]);
  const [loadedPost, setLoadedPost] = useState<LoadedPost | null>(null);

  const selectedSlug = useMemo(
    () => readPostSlugFromPathname(location.pathname),
    [location.pathname]
  );

  useEffect(() => {
    if (!enabled) {
      setStatus('ready');
      setPosts([]);
      setLoadedPost(null);
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');

    loadPostsManifest(fetcher)
      .then((entries) => {
        if (cancelled) return;
        setPosts(entries);
        setStatus(entries.length > 0 ? 'ready' : 'unavailable');
      })
      .catch(() => {
        if (cancelled) return;
        setPosts([]);
        setLoadedPost(null);
        setStatus('unavailable');
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, fetcher]);

  const selectedPostMeta = useMemo(
    () => (selectedSlug ? posts.find((post) => post.slug === selectedSlug) || null : null),
    [posts, selectedSlug]
  );

  useEffect(() => {
    if (!enabled || !selectedSlug || !selectedPostMeta) {
      setLoadedPost(null);
      setPostStatus('idle');
      return undefined;
    }

    let cancelled = false;
    setPostStatus('loading');

    loadPostMarkdown(selectedPostMeta, fetcher)
      .then((post) => {
        if (cancelled) return;
        setLoadedPost(post);
        setPostStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setLoadedPost(null);
        setPostStatus('unavailable');
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, fetcher, selectedPostMeta, selectedSlug]);

  const showUnavailable = enabled && status === 'unavailable';
  const showLoading = enabled && status === 'loading';
  const showPosts = enabled && status === 'ready' && posts.length > 0;
  const showPostIndex = showPosts && !selectedSlug;
  const showPostDetail = showPosts && !!selectedSlug;
  const showPageTitle = !selectedSlug;

  return (
    <main
      className={styles.postsPage}
      data-testid="ce-posts-surface"
    >
      <div className={styles.pageShell}>
        {showPageTitle && (
          <header className={styles.hero}>
            <h1 className={styles.mainTitle}>Posts</h1>
          </header>
        )}

        {!enabled && (
          <section className={styles.statusPanel} aria-live="polite">
            <h2>Posts are disabled for this deployment.</h2>
            <p>Enable `REACT_APP_CE_ABOUT_POSTS_ENABLED` to show this page and its About page entry point.</p>
          </section>
        )}

        {showLoading && (
          <section className={styles.statusPanel} aria-live="polite">
            <h2>Loading posts</h2>
          </section>
        )}

        {showUnavailable && (
          <section className={styles.statusPanel} aria-live="polite">
            <h2>Posts unavailable</h2>
            <p>The posts manifest could not be loaded. The rest of Context Engine is unaffected.</p>
          </section>
        )}

        {showPostIndex && (
          <section className={styles.postIndex}>
            <nav className={styles.postNav} aria-label="Posts">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  to={buildPostRoute(post.slug)}
                  className={styles.postNavItem}
                >
                  {post.headerImage && (
                    <span className={styles.postNavMedia} aria-hidden="true">
                      <img
                        className={styles.postNavImage}
                        src={post.headerImage.src}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                  )}
                  <span className={styles.postNavTitle}>{post.title}</span>
                  {post.date && (
                    <time className={styles.postNavDate} dateTime={post.date}>
                      {formatPostDate(post.date)}
                    </time>
                  )}
                  {post.summary && <span className={styles.postNavSummary}>{post.summary}</span>}
                </Link>
              ))}
            </nav>
          </section>
        )}

        {showPostDetail && (
          <article className={styles.postArticle} aria-live="polite">
            <Link to={buildPublicRoute('/posts')} className={styles.backLink}>
              <span aria-hidden="true">&larr;</span>
              <span>Posts</span>
            </Link>

            {selectedPostMeta && (
              <header className={styles.postHeader}>
                {selectedPostMeta.headerImage && (
                  <figure className={styles.postHeroFigure}>
                    <img
                      className={styles.postHeroImage}
                      src={selectedPostMeta.headerImage.src}
                      alt={selectedPostMeta.headerImage.alt}
                    />
                    {selectedPostMeta.headerImage.caption && (
                      <figcaption className={styles.postImageCaption}>
                        {selectedPostMeta.headerImage.caption}
                      </figcaption>
                    )}
                  </figure>
                )}
                <h2 className={styles.postTitle}>{selectedPostMeta.title}</h2>
                {(selectedPostMeta.date || selectedPostMeta.tags.length > 0) && (
                  <div className={styles.postMeta}>
                    {selectedPostMeta.tags.length > 0 && (
                      <div className={styles.tagList} aria-label="Post tags">
                        {selectedPostMeta.tags.map((tag) => (
                          <span key={tag} className={styles.tag}>{tag}</span>
                        ))}
                      </div>
                    )}
                    {selectedPostMeta.date && (
                      <time className={styles.postDate} dateTime={selectedPostMeta.date}>
                        {formatPostDate(selectedPostMeta.date)}
                      </time>
                    )}
                  </div>
                )}
              </header>
            )}

            {!selectedPostMeta && (
              <p className={styles.postStatus}>This post could not be found.</p>
            )}
            {postStatus === 'loading' && <p className={styles.postStatus}>Loading post...</p>}
            {postStatus === 'unavailable' && (
              <p className={styles.postStatus}>This post could not be loaded.</p>
            )}
            {postStatus === 'ready' && loadedPost && (
              <PostMarkdownRenderer
                markdown={loadedPost.markdown}
                assetBasePath={getPostAssetBasePath(loadedPost.file)}
                title={selectedPostMeta?.title}
              />
            )}
          </article>
        )}
      </div>
    </main>
  );
};

export default PostsPage;
