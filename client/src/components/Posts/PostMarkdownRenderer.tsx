import React, { useEffect, useState } from 'react';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { PostMarkdownBlock, parsePostMarkdown } from './postMarkdownParser.js';
import { buildPostAssetUrl } from './postsContent.js';
import PostViz from './PostViz.js';
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
          <div className={styles.vizGroupItems}>
            {block.blocks.map((childBlock, childIndex) =>
              renderBlock({
                block: childBlock,
                index: childIndex,
                assetBasePath,
                vizDefaultOpen: block.childrenOpen,
                nestedViz: childBlock.type === 'viz',
              }),
            )}
          </div>
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
