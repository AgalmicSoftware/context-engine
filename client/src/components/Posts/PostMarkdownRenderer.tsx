import React from 'react';
import {
  PostMarkdownBlock,
  parsePostMarkdown,
} from './postMarkdownParser.js';
import { buildPostAssetUrl } from './postsContent.js';
import PostViz from './PostViz.js';
import styles from './PostsPage.module.scss';

type PostMarkdownRendererProps = {
  markdown: string;
  assetBasePath?: string;
  title?: string;
};

type RenderBlockArgs = {
  block: PostMarkdownBlock;
  index: number;
  assetBasePath?: string;
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
      parts.push(href ? (
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
      ));
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts;
};

const renderBlock = ({ block, index, assetBasePath }: RenderBlockArgs) => {
  if (block.type === 'heading') {
    const HeadingTag = (`h${block.level}` as 'h1' | 'h2' | 'h3');
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
    const src = sanitizeImageSrc(block.src, assetBasePath);
    if (!src) return null;
    return (
      <figure
        key={`image-${index}`}
        className={styles.postImageFigure}
        tabIndex={0}
        aria-label={block.alt ? `Preview image: ${block.alt}` : 'Preview image'}
      >
        <img
          className={styles.postImage}
          src={src}
          alt={block.alt}
          loading="lazy"
          decoding="async"
        />
        <span className={styles.postImageFullscreen} aria-hidden="true">
          <img
            className={styles.postImageFullscreenImage}
            src={src}
            alt=""
            decoding="async"
          />
        </span>
        {block.caption && (
          <figcaption className={styles.postImageCaption}>{renderInline(block.caption)}</figcaption>
        )}
      </figure>
    );
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
    return <PostViz key={`viz-${index}`} spec={block.spec} error={block.error} />;
  }

  return <hr key={`rule-${index}`} className={styles.postRule} />;
};

const normalizeHeadingText = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();

const suppressDuplicateTitleHeading = (
  blocks: PostMarkdownBlock[],
  title?: string
): PostMarkdownBlock[] => {
  if (!title || blocks[0]?.type !== 'heading' || blocks[0].level !== 1) {
    return blocks;
  }

  return normalizeHeadingText(blocks[0].text) === normalizeHeadingText(title)
    ? blocks.slice(1)
    : blocks;
};

const PostMarkdownRenderer = ({ markdown, assetBasePath = '', title }: PostMarkdownRendererProps) => {
  const blocks = suppressDuplicateTitleHeading(parsePostMarkdown(markdown), title);

  return (
    <div className={styles.markdownBody}>
      {blocks.map((block, index) => renderBlock({ block, index, assetBasePath }))}
    </div>
  );
};

export default PostMarkdownRenderer;
