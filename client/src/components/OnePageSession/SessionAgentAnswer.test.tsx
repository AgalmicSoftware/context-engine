import React from 'react';
import { render, screen, within } from '@testing-library/react';
import SessionAgentAnswer from './SessionAgentAnswer';

// A good answer came back as one block of "- " lines and was hard to read.
it('draws an answer’s bullets, numbered steps, short headings and bold as such', () => {
  const { container } = render(
    <SessionAgentAnswer
      text={[
        '## Main themes',
        'Members raised **three** concerns:',
        '- Cost of the night bus',
        '- Safety on `Route 4`',
        '- Late buses',
        '',
        '1. Pilot first',
        '2. Review after a year',
      ].join('\n')}
    />,
  );
  expect(container.querySelector('p')).toHaveTextContent('Main themes');
  expect(screen.getByText('three').tagName).toBe('STRONG');
  expect(screen.getByText('Route 4').tagName).toBe('CODE');
  const [bullets, steps] = screen.getAllByRole('list');
  expect(bullets.tagName).toBe('UL');
  expect(
    within(bullets)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(['Cost of the night bus', 'Safety on Route 4', 'Late buses']);
  expect(steps.tagName).toBe('OL');
  expect(within(steps).getAllByRole('listitem')).toHaveLength(2);
});

it('draws no HTML, image, link or chart from an answer, and fetches nothing', () => {
  const { container } = render(
    <SessionAgentAnswer
      text={[
        '<img src="https://tracker.example/a.png" onerror="alert(1)"> <script>alert(2)</script>',
        '',
        '![A chart of votes](https://tracker.example/b.png)',
        '',
        'See [the results](https://elsewhere.example) and [this](javascript:alert(3)).',
        '',
        '```ce-viz',
        '{"type":"bar"}',
        '```',
      ].join('\n')}
    />,
  );
  expect(container.querySelector('img, script, a, svg, iframe')).toBeNull();
  expect(container).toHaveTextContent('<img src="https://tracker.example/a.png" onerror="alert(1)">');
  expect(container).toHaveTextContent('<script>alert(2)</script>');
  expect(container).toHaveTextContent('![A chart of votes](https://tracker.example/b.png)');
  expect(container).toHaveTextContent('See [the results](https://elsewhere.example) and [this](javascript:alert(3)).');
  expect(container.querySelector('pre code')).toHaveTextContent('{"type":"bar"}');
});

it('keeps a plain answer a paragraph', () => {
  const { container } = render(<SessionAgentAnswer text="Most members favour a pilot." />);
  expect(container.innerHTML).toContain('<p>Most members favour a pilot.</p>');
});

// The Worker asks for plain text, so these shapes are the likely ones; each was drawn wrongly by the Posts parser.
it('keeps the line breaks inside a paragraph', () => {
  const { container } = render(<SessionAgentAnswer text={'Option A: a pilot\nOption B: a survey\nOption C: wait'} />);
  const paragraphs = container.querySelectorAll('p');
  expect(paragraphs).toHaveLength(1);
  expect(paragraphs[0].textContent).toBe('Option A: a pilot\nOption B: a survey\nOption C: wait');
});

it('takes • bullets and 1) numbers for lists', () => {
  const { container } = render(
    <SessionAgentAnswer text={['• Cost', '• Safety', '', '1) Pilot first', '2) Review'].join('\n')} />,
  );
  const [bullets, steps] = screen.getAllByRole('list');
  expect(bullets.tagName).toBe('UL');
  expect(
    within(bullets)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(['Cost', 'Safety']);
  expect(steps.tagName).toBe('OL');
  expect(
    within(steps)
      .getAllByRole('listitem')
      .map((item) => item.textContent),
  ).toEqual(['Pilot first', 'Review']);
  expect(container.querySelector('p')).toBeNull();
});

it('keeps each numbered item’s own number, with blank lines between them', () => {
  render(<SessionAgentAnswer text={['1. Pilot', '', '2. Survey', '', '3. Wait', '', '7. Then decide'].join('\n')} />);
  const [steps] = screen.getAllByRole('list');
  expect(screen.getAllByRole('list')).toHaveLength(1);
  expect(
    within(steps)
      .getAllByRole('listitem')
      .map((item) => item.getAttribute('value')),
  ).toEqual(['1', '2', '3', '7']);
});

it('draws --- lines as rules and drops no words around them', () => {
  const { container } = render(
    <SessionAgentAnswer text={['---', 'First point.', '---', 'Second point.'].join('\n')} />,
  );
  expect(container.querySelectorAll('hr')).toHaveLength(2);
  expect([...container.querySelectorAll('p')].map((paragraph) => paragraph.textContent)).toEqual([
    'First point.',
    'Second point.',
  ]);
});
