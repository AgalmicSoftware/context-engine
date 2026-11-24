import React from 'react';
import { parsePostMarkdown, type PostMarkdownBlock } from '../Posts/postMarkdownParser';
import styles from './SessionAgentAnswer.module.scss';

// Bold and inline code. Anything else, a link included, stays as it was written.
const INLINE = /\*\*([^*]+)\*\*|`([^`]+)`/g;

const inline = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE)) {
    const at = match.index ?? 0;
    if (at > cursor) parts.push(text.slice(cursor, at));
    parts.push(match[1] ? <strong key={at}>{match[1]}</strong> : <code key={at}>{match[2]}</code>);
    cursor = at + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
};

const block = (item: PostMarkdownBlock, index: number): React.ReactNode => {
  switch (item.type) {
    case 'heading':
      return (
        <p key={index} className={styles.heading}>
          {inline(item.text)}
        </p>
      );
    case 'paragraph':
      return <p key={index}>{inline(item.text)}</p>;
    case 'list': {
      const List = item.ordered ? 'ol' : 'ul';
      return (
        <List key={index}>
          {item.items.map((entry, entryIndex) => (
            <li key={entryIndex}>{inline(entry)}</li>
          ))}
        </List>
      );
    }
    case 'blockquote':
      return <blockquote key={index}>{inline(item.text)}</blockquote>;
    case 'rule':
      return <hr key={index} />;
    case 'code':
      return (
        <pre key={index}>
          <code>{item.code}</code>
        </pre>
      );
    // Nothing is fetched or drawn from an answer: an image is its words, a chart its text.
    case 'image':
      return item.alt ? <p key={index}>{item.alt}</p> : null;
    case 'viz':
    case 'vizGroupStart':
    case 'disclosureStart':
      return (
        <pre key={index}>
          <code>{item.raw}</code>
        </pre>
      );
    default:
      return null;
  }
};

/**
 * A Session Agent answer drawn from the simple Markdown it is written in: paragraphs, lists, short headings, bold
 * and quotes. React escapes every piece, so HTML in an answer shows as text. Only the view changes: the answer is
 * kept as it came.
 */
export default function SessionAgentAnswer({ text, className = '' }: { text: string; className?: string }) {
  return <div className={`${styles.answer} ${className}`.trim()}>{parsePostMarkdown(text).map(block)}</div>;
}
