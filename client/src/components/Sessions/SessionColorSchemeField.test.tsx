import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SessionColorSchemeField from './SessionColorSchemeField';

describe('SessionColorSchemeField', () => {
  const renderField = (initialColorSchemeId = 'context-engine') => {
    const onChange = jest.fn();
    const Harness = () => {
      const [isCollapsed, setIsCollapsed] = React.useState(true);
      const [colorSchemeId, setColorSchemeId] = React.useState(initialColorSchemeId);
      return (
        <SessionColorSchemeField
          isCollapsed={isCollapsed}
          value={{ colorSchemeId }}
          onChange={(next) => {
            onChange(next);
            setColorSchemeId(next.colorSchemeId);
          }}
          onToggleCollapsed={() => setIsCollapsed((current) => !current)}
        />
      );
    };

    render(<Harness />);
    return { onChange };
  };

  test('starts collapsed and updates its shared-token preview after expansion', () => {
    const { onChange } = renderField();

    const toggle = screen.getByRole('button', { name: 'Session colors expand' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SESSION_COLOR_SCHEME)).not.toBeInTheDocument();

    fireEvent.click(toggle);

    const picker = screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_COLOR_SCHEME);
    expect(picker).toHaveAccessibleName('Color scheme');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Context Engine',
      'Ocean',
      'Amber',
    ]);
    expect(
      screen.getByText('Choose the accent colors used for this session. This does not change your app theme.'),
    ).toBeInTheDocument();

    fireEvent.change(picker, { target: { value: 'ocean' } });
    expect(onChange).toHaveBeenCalledWith({ colorSchemeId: 'ocean' });

    const preview = screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_COLOR_PREVIEW);
    expect(preview).toHaveAttribute('data-ce-color-scheme-id', 'ocean');
    expect(preview).toHaveAttribute('data-ce-session-color-scheme', 'ocean');
    expect(preview).toHaveAccessibleName('Color scheme preview: Ocean');
  });

  test('falls back to Context Engine without exposing arbitrary inputs', () => {
    renderField('../custom.scss');
    fireEvent.click(screen.getByRole('button', { name: 'Session colors expand' }));

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_COLOR_SCHEME)).toHaveValue('context-engine');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
