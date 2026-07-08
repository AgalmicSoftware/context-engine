import React, { useCallback, useEffect, useRef, useState } from 'react';
import { faArrowLeft, faArrowRight, faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { PostMarkdownBlock, parsePostMarkdown } from './postMarkdownParser.js';
import { buildPostAssetUrl } from './postsContent.js';
import PostViz, { getPostVizTitle } from './PostViz.js';
import styles from './PostsPage.module.scss';

type PostMarkdownRendererProps = {
  markdown: string;
  assetBasePath?: string;
  title?: string;
};

type ImageBlock = Extract<PostMarkdownBlock, { type: 'image' }>;
type VizGroupBlock = Extract<PostMarkdownBlock, { type: 'vizGroupStart' }> & {
  blocks: PostMarkdownBlock[];
};
type RenderablePostBlock = PostMarkdownBlock | VizGroupBlock;

type RenderBlockArgs = {
  block: RenderablePostBlock;
  index: number;
  assetBasePath?: string;
  vizDefaultOpen?: boolean;
  nestedViz?: boolean;
};

const getCarouselScrollBehavior = (): ScrollBehavior => {
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return 'auto';
  }

  return 'smooth';
};

const getCarouselSlideTitle = (block: PostMarkdownBlock, index: number): string => {
  if (block.type === 'viz') return getPostVizTitle(block.spec);

  if (block.type === 'heading' || block.type === 'paragraph' || block.type === 'blockquote') {
    return block.text;
  }

  return `Visualization ${index + 1}`;
};

const clampSlideIndex = (index: number, slideCount: number): number => Math.min(Math.max(index, 0), slideCount - 1);

const sanitizeHref = (href: string): string => {
  const value = String(href || '').trim();
  if (!value) return '';
  if (value.startsWith('/') || value.startsWith('#')) return value;

  try {
    const parsed = new URL(value);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? value : '';
  } catch {
    return '';
  }
};

const sanitizeImageSrc = (src: string, assetBasePath = ''): string => {
  const value = buildPostAssetUrl(src, assetBasePath);
  if (!value) return '';
  if (value.startsWith('/')) return value;

  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? value : '';
  } catch {
    return '';
  }
};

const renderInline = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  const inlinePattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = inlinePattern.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push(text.slice(cursor, match.index));
    }

    if (match[2]) {
      parts.push(<strong key={`strong-${match.index}`}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<code key={`code-${match.index}`}>{match[3]}</code>);
    } else if (match[4] && match[5]) {
      const href = sanitizeHref(match[5]);
      parts.push(
        href ? (
          <a
            key={`link-${match.index}`}
            href={href}
            target={href.startsWith('http') ? '_blank' : undefined}
            rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
          >
            {match[4]}
          </a>
        ) : (
          <span key={`unsafe-link-${match.index}`}>{match[4]}</span>
        ),
      );
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts;
};

const PostImageFigure = ({ block, assetBasePath }: { block: ImageBlock; assetBasePath?: string }) => {
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const src = sanitizeImageSrc(block.src, assetBasePath);

  useEffect(() => {
    if (!isPreviewOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPreviewOpen]);

  if (!src) return null;

  const openLabel = block.alt ? `Open image preview: ${block.alt}` : 'Open image preview';

  return (
    <figure className={styles.postImageFigure}>
      <button
        type="button"
        className={styles.postImageButton}
        onClick={() => setPreviewOpen(true)}
        aria-label={openLabel}
      >
        <img className={styles.postImage} src={src} alt={block.alt} loading="lazy" decoding="async" />
      </button>
      {isPreviewOpen && (
        <button
          type="button"
          className={`${styles.postImageFullscreen} ${styles.postImageFullscreenOpen}`}
          onClick={() => setPreviewOpen(false)}
          aria-label="Close image preview"
        >
          <img className={styles.postImageFullscreenImage} src={src} alt="" decoding="async" />
        </button>
      )}
      {block.caption && <figcaption className={styles.postImageCaption}>{renderInline(block.caption)}</figcaption>}
    </figure>
  );
};

const VizGroupCarousel = ({ block, assetBasePath }: { block: VizGroupBlock; assetBasePath?: string }) => {
  const slideCount = block.blocks.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const slideIntersectionRatiosRef = useRef<Map<Element, number>>(new Map());
  // Regression guard: programmatic smooth scroll can leave the departing slide
  // as the max-ratio slide mid-transit. Suppress observer updates until the
  // requested destination arrives or the user takes over manually.
  const pendingIndexRef = useRef<number | null>(null);
  const pendingTimeoutRef = useRef<number | null>(null);
  const slideTitles = block.blocks.map(getCarouselSlideTitle);

  const clearPendingNavigation = useCallback(() => {
    pendingIndexRef.current = null;

    if (pendingTimeoutRef.current !== null) {
      window.clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
  }, []);

  const restartPendingNavigationTimeout = useCallback(() => {
    if (pendingTimeoutRef.current !== null) {
      window.clearTimeout(pendingTimeoutRef.current);
    }

    pendingTimeoutRef.current = window.setTimeout(() => {
      pendingIndexRef.current = null;
      pendingTimeoutRef.current = null;
    }, 1200);
  }, []);

  const setSlideIndex = (index: number) => {
    if (slideCount === 0) return;

    const nextIndex = clampSlideIndex(index, slideCount);
    if (nextIndex !== activeIndex) {
      pendingIndexRef.current = nextIndex;
      restartPendingNavigationTimeout();
    }

    setActiveIndex(nextIndex);
  };

  useEffect(() => {
    if (slideCount === 0) return;
    setActiveIndex((index) => clampSlideIndex(index, slideCount));
  }, [slideCount]);

  useEffect(() => {
    const track = trackRef.current;
    const slide = slideRefs.current[activeIndex];

    if (!track || !slide || typeof track.scrollTo !== 'function') return;

    track.scrollTo({
      left: slide.offsetLeft,
      behavior: getCarouselScrollBehavior(),
    });
  }, [activeIndex]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const track = trackRef.current;
    if (!track) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          slideIntersectionRatiosRef.current.set(entry.target, entry.intersectionRatio);
        });

        let maxRatio = 0;
        let visibleIndex = -1;

        slideRefs.current.forEach((slide, index) => {
          if (!slide) return;

          const ratio = slideIntersectionRatiosRef.current.get(slide) ?? 0;
          if (ratio > maxRatio) {
            maxRatio = ratio;
            visibleIndex = index;
          }
        });

        if (visibleIndex >= 0 && maxRatio >= 0.5) {
          const pendingIndex = pendingIndexRef.current;
          if (pendingIndex !== null) {
            if (visibleIndex === pendingIndex) {
              clearPendingNavigation();
            }

            return;
          }

          setActiveIndex(visibleIndex);
        }
      },
      {
        root: track,
        threshold: [0.55, 0.75],
      },
    );

    slideRefs.current.forEach((slide) => {
      if (slide) observer.observe(slide);
    });

    return () => {
      observer.disconnect();
      slideIntersectionRatiosRef.current.clear();
    };
  }, [clearPendingNavigation, slideCount]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    track.addEventListener('wheel', clearPendingNavigation, { passive: true });
    track.addEventListener('touchstart', clearPendingNavigation, { passive: true });
    track.addEventListener('pointerdown', clearPendingNavigation, { passive: true });

    return () => {
      track.removeEventListener('wheel', clearPendingNavigation);
      track.removeEventListener('touchstart', clearPendingNavigation);
      track.removeEventListener('pointerdown', clearPendingNavigation);
    };
  }, [clearPendingNavigation]);

  useEffect(() => clearPendingNavigation, [clearPendingNavigation]);

  const onCarouselKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    const target = event.target as HTMLElement;
    const control = target.closest('[data-carousel-control="true"]');
    const isCarouselTarget = target === event.currentTarget;
    const isCarouselControl = !!control && event.currentTarget.contains(control);

    if (!isCarouselTarget && !isCarouselControl) return;

    event.preventDefault();
    setSlideIndex(activeIndex + (event.key === 'ArrowRight' ? 1 : -1));
  };

  if (slideCount === 0) {
    return <p className={styles.vizFallback}>Visualization group has no items.</p>;
  }

  return (
    <section
      className={styles.vizCarousel}
      role="group"
      aria-roledescription="carousel"
      aria-label={`${block.title} visualizations`}
      data-testid="ce-posts-viz-carousel"
      tabIndex={0}
      onKeyDown={onCarouselKeyDown}
    >
      <div className={styles.vizCarouselControls}>
        <button
          type="button"
          className={styles.vizCarouselButton}
          aria-label="Previous visualization"
          data-testid="ce-posts-viz-carousel-prev"
          data-carousel-control="true"
          disabled={activeIndex === 0}
          onClick={() => setSlideIndex(activeIndex - 1)}
        >
          <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
        </button>
        <span className={styles.vizCarouselCounter} aria-live="polite">
          {activeIndex + 1} / {slideCount}
        </span>
        <button
          type="button"
          className={styles.vizCarouselButton}
          aria-label="Next visualization"
          data-testid="ce-posts-viz-carousel-next"
          data-carousel-control="true"
          disabled={activeIndex === slideCount - 1}
          onClick={() => setSlideIndex(activeIndex + 1)}
        >
          <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.vizCarouselTrack} ref={trackRef}>
        {block.blocks.map((childBlock, childIndex) => (
          <div
            key={`viz-carousel-slide-${childIndex}`}
            className={styles.vizCarouselSlide}
            role="group"
            aria-roledescription="slide"
            aria-label={`${childIndex + 1} of ${slideCount}: ${slideTitles[childIndex]}`}
            data-active={childIndex === activeIndex ? 'true' : 'false'}
            ref={(element) => {
              slideRefs.current[childIndex] = element;
            }}
          >
            {childBlock.type === 'viz' ? (
              <PostViz spec={childBlock.spec} error={childBlock.error} presentation="slide" />
            ) : (
              renderBlock({
                block: childBlock,
                index: childIndex,
                assetBasePath,
              })
            )}
          </div>
        ))}
      </div>
      <div className={styles.vizCarouselDots} role="group" aria-label="Choose visualization slide">
        {slideTitles.map((slideTitle, slideIndex) => (
          <button
            // eslint-disable-next-line react/no-array-index-key
            key={`${slideTitle}-${slideIndex}`}
            type="button"
            className={styles.vizCarouselDot}
            aria-label={`Go to slide ${slideIndex + 1}: ${slideTitle}`}
            aria-current={activeIndex === slideIndex ? 'true' : undefined}
            data-testid={`ce-posts-viz-carousel-dot-${slideIndex}`}
            data-carousel-control="true"
            onClick={() => setSlideIndex(slideIndex)}
          />
        ))}
      </div>
    </section>
  );
};

const renderBlock = ({ block, index, assetBasePath, vizDefaultOpen, nestedViz = false }: RenderBlockArgs) => {
  if (block.type === 'heading') {
    const HeadingTag = `h${block.level}` as 'h1' | 'h2' | 'h3';
    return (
      <HeadingTag key={`heading-${index}`} className={styles.postHeading}>
        {renderInline(block.text)}
      </HeadingTag>
    );
  }

  if (block.type === 'paragraph') {
    return (
      <p key={`paragraph-${index}`} className={styles.postParagraph}>
        {renderInline(block.text)}
      </p>
    );
  }

  if (block.type === 'image') {
    return <PostImageFigure key={`image-${index}`} block={block} assetBasePath={assetBasePath} />;
  }

  if (block.type === 'blockquote') {
    return (
      <blockquote key={`blockquote-${index}`} className={styles.postBlockquote}>
        {renderInline(block.text)}
      </blockquote>
    );
  }

  if (block.type === 'list') {
    const ListTag = block.ordered ? 'ol' : 'ul';
    return (
      <ListTag key={`list-${index}`} className={styles.postList}>
        {block.items.map((item, itemIndex) => (
          <li key={`${item}-${itemIndex}`}>{renderInline(item)}</li>
        ))}
      </ListTag>
    );
  }

  if (block.type === 'code') {
    return (
      <pre key={`code-${index}`} className={styles.postCode}>
        <code>{block.code}</code>
      </pre>
    );
  }

  if (block.type === 'viz') {
    return (
      <PostViz
        key={`viz-${index}`}
        spec={block.spec}
        error={block.error}
        defaultOpen={vizDefaultOpen}
        nested={nestedViz}
      />
    );
  }

  if (block.type === 'vizGroupStart' && 'blocks' in block) {
    return (
      <details
        key={`viz-group-${index}`}
        className={`${styles.vizDisclosure} ${styles.vizGroupDisclosure}`}
        open={block.defaultOpen}
      >
        <summary className={styles.vizDisclosureSummary}>
          <span>{block.title}</span>
          <span className={styles.vizDisclosureIcon} aria-hidden="true">
            <FontAwesomeIcon className={styles.vizDisclosureIconClosed} icon={faCaretDown} />
            <FontAwesomeIcon className={styles.vizDisclosureIconOpen} icon={faCaretUp} />
          </span>
        </summary>
        <section className={`${styles.vizCard} ${styles.vizGroupCard}`} aria-label={block.title}>
          <VizGroupCarousel block={block} assetBasePath={assetBasePath} />
        </section>
      </details>
    );
  }

  if (block.type === 'vizGroupStart' || block.type === 'vizGroupEnd') return null;

  return <hr key={`rule-${index}`} className={styles.postRule} />;
};

const groupVizBlocks = (blocks: PostMarkdownBlock[]): RenderablePostBlock[] => {
  const groupedBlocks: RenderablePostBlock[] = [];
  let activeGroup: VizGroupBlock | null = null;

  blocks.forEach((block) => {
    if (block.type === 'vizGroupStart') {
      if (activeGroup) groupedBlocks.push(activeGroup);
      activeGroup = { ...block, blocks: [] };
      return;
    }

    if (block.type === 'vizGroupEnd') {
      if (activeGroup) {
        groupedBlocks.push(activeGroup);
        activeGroup = null;
      }
      return;
    }

    if (activeGroup) {
      activeGroup.blocks.push(block);
      return;
    }

    groupedBlocks.push(block);
  });

  if (activeGroup) groupedBlocks.push(activeGroup);

  return groupedBlocks;
};

const normalizeHeadingText = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();

const suppressDuplicateTitleHeading = (blocks: PostMarkdownBlock[], title?: string): PostMarkdownBlock[] => {
  if (!title || blocks[0]?.type !== 'heading' || blocks[0].level !== 1) {
    return blocks;
  }

  return normalizeHeadingText(blocks[0].text) === normalizeHeadingText(title) ? blocks.slice(1) : blocks;
};

const PostMarkdownRenderer = ({ markdown, assetBasePath = '', title }: PostMarkdownRendererProps) => {
  const blocks = groupVizBlocks(suppressDuplicateTitleHeading(parsePostMarkdown(markdown), title));

  return (
    <div className={styles.markdownBody}>
      {blocks.map((block, index) => renderBlock({ block, index, assetBasePath }))}
    </div>
  );
};

export default PostMarkdownRenderer;
