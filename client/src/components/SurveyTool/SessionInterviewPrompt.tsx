import React from 'react';

const emphasis =
  /(Help me prepare a review-only Context Engine interview prefill\.|Search only conversation history, memory, and connected sources already available to you|Return only:|Every response needs confidence from 0 to 1 and evidence:|Evidence must omit quotes, source names, URLs, timestamps, account IDs, and hidden reasoning\.|Do not POST or upload it\.|Nothing is submitted; the link opens editable drafts for my review\.)/g;

const urlPattern = /(https?:\/\/[^\s)]+[^\s).,;:!?])/g;

const formatUrlLabel = (url: string): string => {
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search ? '…' : ''}`;
    return `${parsed.hostname}${path === '/' ? '' : path}`;
  } catch {
    return url;
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

/** Presentation only: clipboard content continues to use the original kickoff text. */
export default function SessionInterviewPrompt({ prompt }: { prompt: string }) {
  return (
    <>
      {prompt.split(/\n\n+| (?=Coverage counts are|Platform\/model are|Present it as)/).map((paragraph, index) => (
        <p key={index}>
          {paragraph
            .split(emphasis)
            .map((part, partIndex) =>
              partIndex % 2 ? (
                <strong key={partIndex}>{renderPlainTextWithLinks(part, `${index}-${partIndex}`)}</strong>
              ) : (
                renderPlainTextWithLinks(part, `${index}-${partIndex}`)
              ),
            )}
        </p>
      ))}
    </>
  );
}
