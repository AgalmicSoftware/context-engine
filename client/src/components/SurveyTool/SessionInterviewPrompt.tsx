import React from 'react';
import styles from './SurveyTool.module.scss';

const emphasis =
  /(Help me prepare a review-only Context Engine interview prefill\.|Search only conversation history, memory, and connected sources already available to you|Return only:|Every response needs confidence from 0 to 1 and evidence:|Evidence must omit quotes, source names, URLs, timestamps, account IDs, and hidden reasoning\.|Do not POST or upload it\.|Nothing is submitted; the link opens editable drafts for my review\.)/g;

const urlPattern = /(https?:\/\/[^\s)]+[^\s).,;:!?])/g;
const catalogShapeIntro = 'Use catalog values in this compact shape:';

type PromptSegment = { kind: 'paragraph'; text: string } | { kind: 'catalog-shape'; intro: string; code: string };

const formatUrlLabel = (url: string): string => {
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search ? '…' : ''}`;
    return `${parsed.hostname}${path === '/' ? '' : path}`;
  } catch {
    return url;
  }
};

const prettyPrintJson = (text: string): string => {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

const renderPlainTextWithLinks = (text: string, keyPrefix: string): React.ReactNode[] =>
  text.split(urlPattern).map((part, index) => {
    if (!part) return null;
    if (!/^https?:\/\//i.test(part)) return part;
    return (
      <a key={`${keyPrefix}-url-${index}`} href={part} target="_blank" rel="noreferrer" title={part}>
        {formatUrlLabel(part)}
      </a>
    );
  });

const splitPromptSegments = (prompt: string): PromptSegment[] => {
  const paragraphs = prompt
    .split(/\n\n+| (?=Coverage counts are|Platform\/model are|Present it as)/)
    .filter((paragraph) => paragraph.length > 0);

  const segments: PromptSegment[] = [];

  paragraphs.forEach((paragraph) => {
    if (paragraph.startsWith(`${catalogShapeIntro}\n`)) {
      const code = paragraph.slice(catalogShapeIntro.length).trim();
      segments.push({ kind: 'catalog-shape', intro: catalogShapeIntro, code: prettyPrintJson(code) });
      return;
    }

    segments.push({ kind: 'paragraph', text: paragraph });
  });

  return segments;
};

const renderFormattedParagraph = (paragraph: string, keyPrefix: string) =>
  paragraph
    .split(emphasis)
    .map((part, partIndex) =>
      partIndex % 2 ? (
        <strong key={partIndex}>{renderPlainTextWithLinks(part, `${keyPrefix}-${partIndex}`)}</strong>
      ) : (
        renderPlainTextWithLinks(part, `${keyPrefix}-${partIndex}`)
      ),
    );

/** Presentation only: clipboard content continues to use the original kickoff text. */
export default function SessionInterviewPrompt({ prompt }: { prompt: string }) {
  return (
    <>
      {splitPromptSegments(prompt).map((segment, index) => {
        if (segment.kind === 'catalog-shape') {
          return (
            <React.Fragment key={index}>
              <p>{renderFormattedParagraph(segment.intro, `${index}-intro`)}</p>
              <pre className={styles.sessionInterviewPromptCodeBlock}>
                <code>{segment.code}</code>
              </pre>
            </React.Fragment>
          );
        }

        return <p key={index}>{renderFormattedParagraph(segment.text, `${index}`)}</p>;
      })}
    </>
  );
}
