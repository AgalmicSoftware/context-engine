import { fireEvent, render, screen } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { CE_THEME_STORAGE_KEY } from '../../utilities/ui/themeRuntime';
import AppThemeSelector from './AppThemeSelector';

describe('AppThemeSelector', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.ceDeploymentTheme = 'context-engine';
    document.documentElement.dataset.ceTheme = 'context-engine';
    document.documentElement.dataset.ceThemeSource = 'deployment';
  });

  test('shows only the selector, names the deployment theme, and can return to that default', () => {
    render(<AppThemeSelector />);
    const select = screen.getByTestId(E2E_TESTIDS.SETTINGS_THEME);

    expect(select).toHaveAccessibleName('App theme');
    expect(screen.queryByText('App theme')).not.toBeInTheDocument();
    expect(screen.queryByText(/Changes the complete app appearance/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Deployment theme: Context Engine',
      'Context Engine',
      'Classic 95',
    ]);

    fireEvent.change(select, { target: { value: 'classic-95' } });
    expect(window.localStorage.getItem(CE_THEME_STORAGE_KEY)).toBe('classic-95');
    expect(document.documentElement.dataset.ceTheme).toBe('classic-95');
    expect(document.documentElement.dataset.ceThemeSource).toBe('user');

    fireEvent.change(select, { target: { value: '' } });
    expect(window.localStorage.getItem(CE_THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset.ceThemeSource).toBe('deployment');
  });

  test('describes an unavailable deployment choice as the default', () => {
    delete document.documentElement.dataset.ceDeploymentTheme;

    render(<AppThemeSelector />);

    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Deployment theme: default');
  });
});
