import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import LoginSettingsSectionCard from './LoginSettingsSectionCard';

describe('LoginSettingsSectionCard', () => {
  it('renders static settings section content', () => {
    render(
      <LoginSettingsSectionCard title="Session" summary="General">
        <div>Session settings body</div>
      </LoginSettingsSectionCard>,
    );

    expect(screen.getByText('Session')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Session settings body')).toBeInTheDocument();
  });

  it('renders collapsible sections and forwards toggle clicks', () => {
    const onToggle = jest.fn();
    const { rerender } = render(
      <LoginSettingsSectionCard title="AI" summary="Using local override" isOpen={false} onToggle={onToggle}>
        <div>AI settings body</div>
      </LoginSettingsSectionCard>,
    );

    const toggle = screen.getByRole('button', { name: /AI/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('AI settings body')).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <LoginSettingsSectionCard title="AI" summary="Using local override" isOpen onToggle={onToggle}>
        <div>AI settings body</div>
      </LoginSettingsSectionCard>,
    );

    expect(screen.getByRole('button', { name: /AI/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('AI settings body')).toBeInTheDocument();
  });
});
