import { render } from '@testing-library/react';
import DocsPrompt from './DocsPrompt';

it('lists a template’s placeholders and keeps the template’s own text to select', () => {
  const template = 'Rank {{questionListJson}} for <Users>.';
  const { container } = render(<DocsPrompt id="prompt-rank" text={template} />);
  expect(container).toHaveTextContent('Variables: {{questionListJson}}, <Users>');
  // What is selected to copy by hand is the template, and nothing else.
  expect(container.querySelector('#prompt-rank')?.textContent).toBe(template);
});

it('has no variables line for a prompt without placeholders', () => {
  const { container } = render(<DocsPrompt id="prompt-plain" text="Summarise the audio." />);
  expect(container).not.toHaveTextContent('Variables:');
});
