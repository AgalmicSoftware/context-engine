import { render, screen } from '@testing-library/react';
import SessionDataNote from './SessionDataNote';

it('shows the note as text, with only https addresses as links that open in a new tab', () => {
  render(
    <SessionDataNote note="Funded by Example (https://example.test/study). Also http://plain.test and javascript:alert(1) <b>bold</b>" />,
  );
  const links = screen.getAllByRole('link');
  expect(links).toHaveLength(1);
  // The closing bracket and full stop stay text.
  expect(links[0]).toHaveAttribute('href', 'https://example.test/study');
  expect(links[0]).toHaveAttribute('target', '_blank');
  expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer');
  const note = screen.getByTestId('session-data-note');
  expect(note).toHaveTextContent(
    'Funded by Example (https://example.test/study). Also http://plain.test and javascript:alert(1) <b>bold</b>',
  );
  expect(note.querySelector('b')).toBeNull();
});

it('keeps a bracket that belongs to the address in the link', () => {
  render(<SessionDataNote note="See https://example.test/wiki/Foo_(bar), or (https://example.test/a)." />);
  expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
    'https://example.test/wiki/Foo_(bar)',
    'https://example.test/a',
  ]);
});

it('shows nothing for an empty note', () => {
  const { container } = render(<SessionDataNote note="  " />);
  expect(container).toBeEmptyDOMElement();
});
