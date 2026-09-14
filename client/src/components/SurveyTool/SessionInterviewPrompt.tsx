import React from 'react';

const emphasis =
  /(Help me prepare a review-only Context Engine interview prefill\.|Search only conversation history, memory, and connected sources already available to you|Return only:|Every response needs confidence from 0 to 1 and evidence:|Evidence must omit quotes, source names, URLs, timestamps, account IDs, and hidden reasoning\.|Review keeps name sharing off by default\.|Do not POST or upload it\.|Nothing is submitted; the link opens editable drafts for my review\.)/g;

/** Presentation only: clipboard content continues to use the original kickoff text. */
export default function SessionInterviewPrompt({ prompt }: { prompt: string }) {
  return (
    <>
      {prompt
        .split(/\n\n+| (?=Coverage counts are|Platform\/model are|If you already know|Present it as)/)
        .map((paragraph, index) => (
          <p key={index}>
            {paragraph
              .split(emphasis)
              .map((part, partIndex) => (partIndex % 2 ? <strong key={partIndex}>{part}</strong> : part))}
          </p>
        ))}
    </>
  );
}
