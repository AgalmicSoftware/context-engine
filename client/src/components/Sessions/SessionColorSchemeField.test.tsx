import { fireEvent, render, screen } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import SessionColorSchemeField from './SessionColorSchemeField';

describe('SessionColorSchemeField', () => {
  test('renders the closed picker and updates its shared-token preview immediately', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <SessionColorSchemeField value={{ colorSchemeId: 'context-engine' }} onChange={onChange} />,
    );

    const picker = screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_COLOR_SCHEME);
    expect(picker).toHaveAccessibleName('Color scheme');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Context Engine',
      'Ocean',
      'Amber',
    ]);
    expect(screen.getByText('Choose the accent colors used for this session. This does not change your app theme.')).toBeInTheDocument();

    fireEvent.change(picker, { target: { value: 'ocean' } });
    expect(onChange).toHaveBeenCalledWith({ colorSchemeId: 'ocean' });

    rerender(<SessionColorSchemeField value={{ colorSchemeId: 'ocean' }} onChange={onChange} />);
    const preview = screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_COLOR_PREVIEW);
    expect(preview).toHaveAttribute('data-ce-color-scheme-id', 'ocean');
    expect(preview).toHaveAttribute('data-ce-session-color-scheme', 'ocean');
    expect(preview).toHaveAccessibleName('Color scheme preview: Ocean');
  });

  test('falls back to Context Engine without exposing arbitrary inputs', () => {
    render(<SessionColorSchemeField value={{ colorSchemeId: '../custom.scss' }} onChange={jest.fn()} />);

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_COLOR_SCHEME)).toHaveValue('context-engine');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
