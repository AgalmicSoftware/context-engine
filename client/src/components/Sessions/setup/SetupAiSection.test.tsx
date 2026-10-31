import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { SetupAiSection } from './SetupAiSection';
import type { SetupDraft, SetupMode } from './setupSectionTypes';

const draft: SetupDraft = {
  ai: {
    models: {
      fast: { provider: 'openai', model: 'gpt-5.6-terra' },
      thinking: { provider: 'openai', model: 'gpt-5.6-terra' },
    },
    reasoningEffort: 'medium',
  },
  questionsGenPrompt: 'Prefer concrete next steps.',
};

const renderAi = (mode: SetupMode) => {
  const onChange = jest.fn();
  render(<SetupAiSection draft={draft} onChange={onChange} mode={mode} open onToggle={() => {}} conflicts={[]} />);
  return onChange;
};

describe('SetupAiSection', () => {
  it('moves both models onto a newly chosen provider’s list', () => {
    const onChange = renderAi('create');
    fireEvent.change(screen.getByTestId('ce-setup-ai-provider'), { target: { value: 'anthropic' } });
    expect(onChange).toHaveBeenCalledWith(['ai', 'models'], {
      fast: { provider: 'anthropic', model: 'claude-sonnet-5-5' },
      thinking: { provider: 'anthropic', model: 'claude-opus-5-5' },
    });
    expect(screen.getByTestId('ce-setup-summary-ai')).toHaveTextContent('OpenAI gpt-5.6-terra · medium effort');
  });

  it('shows the saved models without offering edits the settings page could not save', () => {
    const onChange = renderAi('edit');
    expect(screen.queryByTestId('ce-setup-ai-provider')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Reasoning effort')).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-setup-ai-fixed')).toHaveTextContent('OpenAI gpt-5.6-terra');
    expect(screen.getByTestId('ce-setup-summary-ai')).toHaveTextContent(/^OpenAI gpt-5\.6-terra$/);
    fireEvent.change(screen.getByLabelText('Question prompt'), { target: { value: 'Ask about pilots.' } });
    expect(onChange).toHaveBeenCalledWith(['questionsGenPrompt'], 'Ask about pilots.');
  });
});
