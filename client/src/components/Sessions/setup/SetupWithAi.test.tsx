import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SetupWithAi } from './SetupWithAi';
import { buildSessionSetupKickoff } from './sessionSetupKickoff';

const SETUP_URL = 'https://contextengine.sh/new';
const prompt = buildSessionSetupKickoff({ setupUrl: SETUP_URL });

// The choices show only once "Set up with AI" is pressed.
const renderOpen = () => {
  render(<SetupWithAi setupUrl={SETUP_URL} />);
  fireEvent.click(screen.getByRole('button', { name: 'Set up with AI' }));
};

describe('Set up with AI', () => {
  const writeText = jest.fn();
  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  it('is one button until pressed, then shows the choices; pressing again hides them', () => {
    render(<SetupWithAi setupUrl={SETUP_URL} />);
    const toggle = screen.getByTestId('ce-setup-with-ai-open');
    expect(toggle).toHaveAccessibleName('Set up with AI');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('ce-setup-with-ai-copy')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(toggle.getAttribute('aria-controls') || '')).toContainElement(
      screen.getByTestId('ce-setup-with-ai-copy'),
    );
    expect(screen.getByRole('button', { name: 'Show prompt' })).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByTestId('ce-setup-with-ai-copy')).not.toBeInTheDocument();
  });

  it('copies the setup prompt, whose link comes back to this page', async () => {
    renderOpen();
    fireEvent.click(screen.getByTestId('ce-setup-with-ai-copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(prompt));
    expect(prompt).toContain(`${SETUP_URL}#setup=`);
    expect(await screen.findByRole('status')).toHaveTextContent('Prompt copied.');
  });

  it('opens ChatGPT or Claude with the prompt in a new tab, and copies it in case the site drops it', async () => {
    renderOpen();
    for (const [name, origin] of [
      ['ChatGPT', 'https://chatgpt.com'],
      ['Claude', 'https://claude.ai'],
    ]) {
      const link = screen.getByRole('link', { name: `Open in ${name}` });
      expect(link).toHaveAttribute('data-ce-control-appearance', 'raised');
      const url = new URL(link.getAttribute('href') || '');
      expect(url.origin).toBe(origin);
      expect(url.searchParams.get('q')).toBe(prompt);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      fireEvent.click(link);
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(`If ${name} opens without it, paste it`),
      );
    }
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it('shows the prompt to copy by hand when the clipboard is unavailable', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    renderOpen();
    expect(screen.queryByLabelText('Setup prompt')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ce-setup-with-ai-copy'));
    expect(await screen.findByRole('status')).toHaveTextContent(
      "Copying isn't allowed here, so the prompt is selected. Copy it yourself.",
    );
    const field = screen.getByLabelText('Setup prompt') as HTMLTextAreaElement;
    expect(field).toHaveValue(prompt);
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, prompt.length]);
  });
});
