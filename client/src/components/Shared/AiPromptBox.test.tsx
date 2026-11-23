import { fireEvent, render, screen } from '@testing-library/react';
import AiPromptBox from './AiPromptBox';
import { findPromptPlaceholders, splitPromptByVariables } from './aiPromptPieces';
import { PromptStandInList } from './AiPromptStandIns';
import { seedGenPrompt } from '../../prompts/seedGenPrompt.js';

it('cuts a prompt at each value, longest first, and names each stand-in', () => {
  const variables = [
    { name: 'Site', value: 'https://app.example' },
    { name: 'Link', value: 'https://app.example/new' },
  ];
  expect(splitPromptByVariables('Open https://app.example/new on https://app.example.', variables)).toEqual([
    { text: 'Open ' },
    { text: '<Link>', variable: 'Link' },
    { text: ' on ' },
    { text: '<Site>', variable: 'Site' },
    { text: '.' },
  ]);
  // A value that is empty stands in for nothing.
  expect(splitPromptByVariables('As it is.', [{ name: 'Empty', value: '' }])).toEqual([{ text: 'As it is.' }]);
});

it("finds a template's placeholders once each, and they stand in as written", () => {
  const template = 'Rank {{questionListJson}} for <Users>, top {{topX}}; again <Users>. Not a tag: 1 < 2 > 0.';
  expect(findPromptPlaceholders(template).map(({ value }) => value)).toEqual([
    '{{questionListJson}}',
    '<Users>',
    '{{topX}}',
  ]);
  const shown = splitPromptByVariables(template, findPromptPlaceholders(template));
  expect(shown.map(({ text }) => text).join('')).toBe(template);
  expect(shown.filter(({ variable }) => variable).map(({ text }) => text)).toEqual([
    '{{questionListJson}}',
    '<Users>',
    '{{topX}}',
    '<Users>',
  ]);
});

it('shows a stand-in for each value, lists them once, and copies through its button', () => {
  const onCopy = jest.fn();
  render(
    <AiPromptBox
      testId="box"
      prompt="Use sk-secret at https://app.example, then sk-secret again."
      variables={[
        { name: 'Key', value: 'sk-secret' },
        { name: 'Site', value: 'https://app.example' },
      ]}
      onCopy={onCopy}
      copied={false}
    />,
  );
  const box = screen.getByTestId('box');
  expect(box).toHaveTextContent('AI Prompt');
  expect(box).toHaveTextContent('Variables: <Key>, <Site>');
  expect(box).toHaveTextContent('Use <Key> at <Site>, then <Key> again.');
  expect(box).not.toHaveTextContent('sk-secret');
  fireEvent.click(screen.getByRole('button', { name: 'Copy AI prompt' }));
  expect(onCopy).toHaveBeenCalledTimes(1);
});

it('has no header, variables line or copy button where it is given none', () => {
  render(<AiPromptBox testId="box" prompt="Nothing changes here." variables={[]} title={null} />);
  expect(screen.getByTestId('box')).toHaveTextContent(/^Nothing changes here\.$/);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it("lists every placeholder of the question generator's template, in the template's order", () => {
  const { container } = render(<PromptStandInList prompt={seedGenPrompt} className="chip" />);
  expect(container).toHaveTextContent(
    '<SourceType>, <MultiSpeakerHint>, <GroupCustomInstructions>, <SourceDocContent>, <NumSeedStatements>, <Types>, <DefaultTags>',
  );
});

it('takes a placeholder described in words only where asked to', () => {
  const template = 'Topic: <Topic, left out for a whole branch> and <Branch>; not <negative end: 2-4 words>.';
  expect(findPromptPlaceholders(template).map(({ value }) => value)).toEqual(['<Branch>']);
  expect(findPromptPlaceholders(template, { described: true }).map(({ value }) => value)).toEqual([
    '<Topic, left out for a whole branch>',
    '<Branch>',
  ]);
});
