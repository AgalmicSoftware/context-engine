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

  it('renders the catalog JSON sample as readable code without changing the prose intro', () => {
    const prompt =
      'Use catalog values in this compact shape:\n{"version":1,"responses":[{"questionId":"q1","confidence":0.35}]}';

    const { container } = render(<SessionInterviewPrompt prompt={prompt} />);

    expect(screen.getByText('Use catalog values in this compact shape:')).toBeInTheDocument();
    const code = container.querySelector('pre code');
    expect(code).toBeInTheDocument();
    expect(code?.textContent).toContain('\n  "version": 1,');
    expect(code?.textContent).toContain('"responses": [');
    expect(container.querySelector('pre')).toHaveTextContent('"questionId": "q1"');
  });

  it('keeps an unparsable catalog sample as plain code text', () => {
    const prompt = 'Use catalog values in this compact shape:\n{"version":1,';

    const { container } = render(<SessionInterviewPrompt prompt={prompt} />);

    expect(container.querySelector('pre code')).toHaveTextContent('{"version":1,');
  });
});
