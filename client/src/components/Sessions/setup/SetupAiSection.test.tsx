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

  it('offers the Analysis card on a Session Worker, ticked unless turned off, with what it does behind its "?"', () => {
    const renderCard = (extra: SetupDraft, workerHosted: boolean) => {
      cleanup();
      const onChange = jest.fn();
      render(
        <SetupAiSection
          draft={{ ...draft, ...extra }}
          onChange={onChange}
          mode="create"
          open
          onToggle={() => {}}
          conflicts={[]}
          workerHosted={workerHosted}
        />,
      );
      return onChange;
    };
    // A new session's draft has it on; turning it off says so on the closed section too.
    const onChange = renderCard({ analysisCardEnabled: true }, true);
    const box = screen.getByLabelText('Analysis card');
    expect(box).toBeChecked();
    expect(box).toHaveAccessibleDescription(/two-page picture card .* turned back on\.$/);
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(['analysisCardEnabled'], false);
    renderCard({ analysisCardEnabled: false }, true);
    expect(screen.getByLabelText('Analysis card')).not.toBeChecked();
    expect(screen.getByTestId('ce-setup-summary-ai')).toHaveTextContent('Analysis card off');
    // An on-chain session keeps no such setting.
    renderCard({ analysisCardEnabled: true }, false);
    expect(screen.queryByLabelText('Analysis card')).not.toBeInTheDocument();
  });

  describe('Session Agent on Cloudflare', () => {
    const agent = { audiences: [] };
    const cloudflare = { provider: 'workers-ai', model: '@cf/zai-org/glm-5.3' };
    const ai = draft.ai as { models: Record<string, unknown> };
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
      expect(onChange).toHaveBeenCalledWith(['ai', 'models'], { ...ai.models, 'session-agent': cloudflare });
    });

    it('unticking hands the Session Agent back to the session’s provider', () => {
      const onChange = renderAgent({
        sessionAgent: agent,
        ai: { ...ai, models: { ...ai.models, 'session-agent': cloudflare } },
      });
      const box = screen.getByTestId('ce-ai-session-agent-cloudflare');
      expect(box).toBeChecked();
      fireEvent.click(box);
      expect(onChange).toHaveBeenCalledWith(['ai', 'models'], ai.models);
    });
  });
});
