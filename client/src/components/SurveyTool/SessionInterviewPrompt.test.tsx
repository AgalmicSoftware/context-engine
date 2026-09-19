import React from 'react';
import { render, screen } from '@testing-library/react';
import SessionInterviewPrompt from './SessionInterviewPrompt';

describe('SessionInterviewPrompt', () => {
  it('renders long URLs as safe descriptive links without changing surrounding prompt text', () => {
    const prompt =
      'Help me prepare a review-only Context Engine interview prefill. Open https://worker.example/agent/interview-catalog?slug=demo-interview-4&sessionUrl=https%3A%2F%2Fapp.example%2Fsession%2Fdemo-interview-4 then return JSON. Do not POST or upload it.';

    const { container } = render(<SessionInterviewPrompt prompt={prompt} />);

    const link = screen.getByRole('link', { name: 'worker.example/agent/interview-catalog…' });
    expect(link).toHaveAttribute(
      'href',
      'https://worker.example/agent/interview-catalog?slug=demo-interview-4&sessionUrl=https%3A%2F%2Fapp.example%2Fsession%2Fdemo-interview-4',
    );
    expect(link).toHaveAttribute('rel', 'noreferrer');
    expect(container).toHaveTextContent('Help me prepare a review-only Context Engine interview prefill.');
    expect(container).toHaveTextContent('Do not POST or upload it.');
    expect(container.textContent?.replace(/\s+/g, ' ')).toContain(
      'Open worker.example/agent/interview-catalog… then return JSON.',
    );
  });
});
