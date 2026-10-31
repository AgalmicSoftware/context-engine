import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SetupWithAi } from './SetupWithAi';
import { buildSessionSetupKickoff } from './sessionSetupKickoff';

const SETUP_URL = 'https://contextengine.sh/new';
const prompt = buildSessionSetupKickoff({ setupUrl: SETUP_URL });

describe('Set up with your AI', () => {
  const writeText = jest.fn();
  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  it('copies the setup prompt, whose link comes back to this page', async () => {
    render(<SetupWithAi setupUrl={SETUP_URL} />);
    expect(screen.getByRole('heading', { name: 'Set up with your AI' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ce-setup-with-ai-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(prompt));
    expect(prompt).toContain(`${SETUP_URL}#setup=`);
    expect(await screen.findByRole('status')).toHaveTextContent('Prompt copied.');
  });

  it('opens ChatGPT or Claude with the prompt in a new tab, and copies it in case the site drops it', async () => {
    render(<SetupWithAi setupUrl={SETUP_URL} />);
    for (const [name, origin] of [
      ['ChatGPT', 'https://chatgpt.com'],
      ['Claude', 'https://claude.ai'],
    ]) {
      const link = screen.getByRole('link', { name: `Open in ${name}` });
      const url = new URL(link.getAttribute('href') || '');
      expect(url.origin).toBe(origin);
      expect(url.searchParams.get('q')).toBe(prompt);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      fireEvent.click(link);
      expect(await screen.findByRole('status')).toHaveTextContent(`If ${name} opens without it, paste it`);
    }
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it('shows the prompt to copy by hand when the clipboard is unavailable', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    render(<SetupWithAi setupUrl={SETUP_URL} />);
    expect(screen.queryByLabelText('Setup prompt')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ce-setup-with-ai-copy'));
    expect(await screen.findByRole('status')).toHaveTextContent('Copy failed.');
    expect(screen.getByLabelText('Setup prompt')).toHaveValue(prompt);
  });
});
