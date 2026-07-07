import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SessionWizardSessionIdBadge, { formatSessionIdBadgeText } from './SessionWizardSessionIdBadge';

const renderInfoTooltip = ({ testId, ariaLabel }: Record<string, unknown>) => (
  <button type="button" data-testid={String(testId)} aria-label={String(ariaLabel)} />
);

describe('SessionWizardSessionIdBadge', () => {
  it('renders nothing without a session ID', () => {
    const { container } = render(
      <SessionWizardSessionIdBadge onCopy={jest.fn()} onRegenerate={jest.fn()} renderInfoTooltip={renderInfoTooltip} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the truncated badge, tooltip, and forwards actions', () => {
    const onCopy = jest.fn();
    const onRegenerate = jest.fn();

    render(
      <SessionWizardSessionIdBadge
        isRegenerating
        onCopy={onCopy}
        onRegenerate={onRegenerate}
        renderInfoTooltip={renderInfoTooltip}
        sessionIdDisplay="1234567890abcdef"
      />,
    );

    expect(screen.getByTitle('1234567890abcdef')).toHaveTextContent('1234567890abcd…');
    expect(screen.getByTestId('ce-wizard-tooltip-gw-session-id')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Generate a new session ID' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy session ID' }));

    expect(onRegenerate).toHaveBeenCalledTimes(1);
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('formats badge text with the existing 14-character truncation boundary', () => {
    expect(formatSessionIdBadgeText('1234567890abcd')).toBe('1234567890abcd');
    expect(formatSessionIdBadgeText('1234567890abcde')).toBe('1234567890abcd…');
  });
});
