import styles from './SessionDataNote.module.scss';

// The admin's note on where research data goes (interviewMode.dataNote), shown as plain text.
// Only https addresses become links, so the note can't run script or send people to another scheme.

const URL_PATTERN = /(https:\/\/[^\s<>"]+)/;
// Punctuation that ends a sentence stays text, not part of the link.
const TRAILING = /[.,;:!?)'\]]+$/;

const parts = (note: string) =>
  note.split(URL_PATTERN).flatMap((piece, index) => {
    if (index % 2 === 0) return piece ? [{ text: piece }] : [];
    const tail = piece.match(TRAILING)?.[0] || '';
    const address = tail ? piece.slice(0, -tail.length) : piece;
    let href = '';
    try {
      href = new URL(address).protocol === 'https:' ? address : '';
    } catch {
      href = '';
    }
    return [...(href ? [{ text: address, href }] : [{ text: address }]), ...(tail ? [{ text: tail }] : [])];
  });

export default function SessionDataNote({ note }: { note: string }) {
  const text = note.trim();
  if (!text) return null;
  return (
    <span data-testid="session-data-note">
      {parts(text).map((part, index) =>
        'href' in part && part.href ? (
          <a key={index} className={styles.link} href={part.href} target="_blank" rel="noopener noreferrer">
            {part.text}
          </a>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </span>
  );
}
