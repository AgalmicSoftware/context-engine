import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

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

  it('names the transcription model new sessions use behind the Provider’s "?"', () => {
    renderAi('create');
    expect(screen.getByRole('button', { name: 'About Provider' })).toBeInTheDocument();
    expect(screen.getByLabelText('Provider')).toHaveAccessibleDescription(
      /Transcription always uses OpenAI gpt-transcribe, so voice interviews and group recordings need an OpenAI key too\./,
    );
    expect(screen.queryByText(/^Transcription uses OpenAI/)).not.toBeInTheDocument();
  });

  describe('Session Agent on Cloudflare', () => {
    const agent = { audiences: [] };
    const cloudflare = { provider: 'workers-ai', model: '@cf/zai-org/glm-5.3' };
    const renderAgent = (extra: SetupDraft) => {
      const onChange = jest.fn();
      render(
        <SetupAiSection
          draft={{ ...draft, ...extra }}
          onChange={onChange}
          mode="create"
          open
          onToggle={() => {}}
          conflicts={[]}
          sessionAgent={<div />}
        />,
      );
      return onChange;
    };

    it('offers it only while the Session Agent is on, off by default', () => {
      renderAgent({ sessionAgent: null });
      expect(screen.queryByTestId('ce-ai-session-agent-cloudflare')).not.toBeInTheDocument();
      cleanup();
      const onChange = renderAgent({ sessionAgent: agent });
      const box = screen.getByTestId('ce-ai-session-agent-cloudflare');
      expect(box).not.toBeChecked();
      expect(box).toHaveAccessibleDescription(/Everything else, including voice, transcription and drafting/);
      fireEvent.click(box);
      expect(onChange).toHaveBeenCalledWith(['ai', 'models'], { ...draft.ai.models, 'session-agent': cloudflare });
    });

    it('unticking hands the Session Agent back to the session’s provider', () => {
      const onChange = renderAgent({
        sessionAgent: agent,
        ai: { ...draft.ai, models: { ...draft.ai.models, 'session-agent': cloudflare } },
      });
      const box = screen.getByTestId('ce-ai-session-agent-cloudflare');
      expect(box).toBeChecked();
      fireEvent.click(box);
      expect(onChange).toHaveBeenCalledWith(['ai', 'models'], draft.ai.models);
    });
  });
});
