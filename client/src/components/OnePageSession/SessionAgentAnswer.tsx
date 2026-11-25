import React from 'react';
import styles from './SessionAgentAnswer.module.scss';

type Item = { number?: number; text: string };
type Block =
  | { type: 'paragraph' | 'heading' | 'quote' | 'code'; text: string }
  | { type: 'list'; ordered: boolean; items: Item[] }
  | { type: 'rule' };

const HEADING = /^#{1,3}\s+(.+)$/;
const isRule = (line: string) => /^(-{3,}|\*{3,}|_{3,})$/.test(line);

// "- ", "* " and "• " bullets; "1." and "1)" numbers, each item keeping its own number.
const listItem = (line: string): (Item & { ordered: boolean }) | null => {
  const bullet = line.match(/^[-*•]\s+(.*)$/);
  if (bullet) return { ordered: false, text: bullet[1] };
  const numbered = line.match(/^(\d{1,9})[.)]\s+(.*)$/);
  return numbered ? { ordered: true, number: Number(numbered[1]), text: numbered[2] } : null;
};

const startsBlock = (line: string) =>
  !line || line.startsWith('```') || line.startsWith('>') || isRule(line) || HEADING.test(line) || !!listItem(line);

// Answers are asked for in plain text, so a line break is kept and a "---" line is only a rule.
const blocksOf = (answer: string): Block[] => {
  const raw = answer.replace(/\r\n?/g, '\n').split('\n');
  const lines = raw.map((line) => line.trim());
  const blocks: Block[] = [];
  let at = 0;
  while (at < lines.length) {
    const line = lines[at];
    const heading = line.match(HEADING);
    const first = listItem(line);
    if (!line) {
      at += 1;
    } else if (line.startsWith('```')) {
      const code: string[] = [];
      for (at += 1; at < lines.length && !lines[at].startsWith('```'); at += 1) code.push(raw[at]);
      at += 1;
      blocks.push({ type: 'code', text: code.join('\n') });
    } else if (isRule(line)) {
      blocks.push({ type: 'rule' });
      at += 1;
    } else if (heading) {
      blocks.push({ type: 'heading', text: heading[1] });
      at += 1;
    } else if (first) {
      const items: Item[] = [];
      let item: ReturnType<typeof listItem> = first;
      while (item?.ordered === first.ordered) {
        items.push(item);
        at += 1;
        // A blank line between two items of one list does not end it.
        let next = at;
        while (next < lines.length && !lines[next]) next += 1;
        if (listItem(lines[next] ?? '')?.ordered === first.ordered) at = next;
        item = listItem(lines[at] ?? '');
      }
      blocks.push({ type: 'list', ordered: first.ordered, items });
    } else if (line.startsWith('>')) {
      const quote: string[] = [];
      for (; at < lines.length && lines[at].startsWith('>'); at += 1) quote.push(lines[at].replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', text: quote.join('\n') });
    } else {
      const paragraph = [line];
      for (at += 1; at < lines.length && !startsBlock(lines[at]); at += 1) paragraph.push(lines[at]);
      blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
    }
  }
  return blocks;
};

// Bold and inline code. Anything else, a link or an image included, stays as it was written.
const INLINE = /\*\*([^*\n]+)\*\*|`([^`\n]+)`/g;

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

const draw = (block: Block, key: number): React.ReactNode => {
  switch (block.type) {
    case 'heading':
      return (
        <p key={key} className={styles.heading}>
          {inline(block.text)}
        </p>
      );
    case 'paragraph':
      return <p key={key}>{inline(block.text)}</p>;
    case 'quote':
      return <blockquote key={key}>{inline(block.text)}</blockquote>;
    case 'code':
      return (
        <pre key={key}>
          <code>{block.text}</code>
        </pre>
      );
    case 'rule':
      return <hr key={key} />;
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <List key={key}>
          {block.items.map((item, index) => (
            <li key={index} value={item.number}>
              {inline(item.text)}
            </li>
          ))}
        </List>
      );
    }
  }
};

/**
 * A Session Agent answer, drawn with the light formatting models write even when asked for plain text: line breaks,
 * bullets, numbered steps, short headings, quotes, bold and code. Every piece is a text child, so HTML, a link or an
 * image in an answer shows as text and nothing is fetched. Only the view changes: the answer is kept as it came.
 */
export default function SessionAgentAnswer({ text, className = '' }: { text: string; className?: string }) {
  return <div className={`${styles.answer} ${className}`.trim()}>{blocksOf(text).map(draw)}</div>;
}
