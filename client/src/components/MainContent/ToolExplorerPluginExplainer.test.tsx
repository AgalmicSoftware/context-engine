import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import CETooltip from '../Shared/CETooltip';
import ToolExplorerPluginExplainer from './ToolExplorerPluginExplainer';

const store = createStore(() => ({ sessionState: { tooltipsEnabled: false } }));

describe('ToolExplorerPluginExplainer', () => {
  it('does not render without explainer text', () => {
    const { container } = render(<ToolExplorerPluginExplainer />);
    expect(container.firstChild).toBeNull();
  });

  it('opens on explicit click with automatic explainers off and survives their cleanup', async () => {
    const user = userEvent.setup();
    const parentClick = jest.fn();
    const view = (mountDisabledTooltip: boolean) => (
      <Provider store={store}>
        <div onClick={parentClick}>
          <ToolExplorerPluginExplainer explainText="Explain this tool" />
        </div>
        <button id="automatic-help">Automatic help</button>
        {mountDisabledTooltip && <CETooltip target="automatic-help">Automatic explainer</CETooltip>}
      </Provider>
    );
    const { rerender } = render(view(false));
    const button = screen.getByRole('button', { name: 'About this tool' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.hover(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.click(button);
    expect(parentClick).not.toHaveBeenCalled();
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const help = screen.getByRole('tooltip');
    expect(help).toHaveTextContent('Explain this tool');
    expect(button).toHaveAttribute('aria-describedby', help.id);
    rerender(view(true));
    expect(screen.getByRole('tooltip')).toBe(help);
    expect(screen.queryByText('Automatic explainer')).not.toBeInTheDocument();
    fireEvent.pointerDown(help);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await user.click(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.click(button);
    fireEvent.pointerDown(document.body);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(button).not.toHaveAttribute('aria-describedby');
  });

  it('supports Enter and Space, dismisses with Escape, and removes open help on unmount', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ToolExplorerPluginExplainer explainText="Keyboard help" />);
    const button = screen.getByRole('button', { name: 'About this tool' });
    button.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Keyboard help');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    await user.keyboard(' ');
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await user.keyboard(' ');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    unmount();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(document, { key: 'Escape' });
  });
});
