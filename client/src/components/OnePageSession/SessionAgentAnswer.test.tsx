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
  expect(screen.getByText('A chart of votes').tagName).toBe('P');
  expect(container).toHaveTextContent('See [the results](https://elsewhere.example) and [this](javascript:alert(3)).');
  expect(container.querySelector('pre code')).toHaveTextContent('{"type":"bar"}');
});

it('keeps a plain answer a paragraph', () => {
  const { container } = render(<SessionAgentAnswer text="Most members favour a pilot." />);
  expect(container.innerHTML).toContain('<p>Most members favour a pilot.</p>');
});
