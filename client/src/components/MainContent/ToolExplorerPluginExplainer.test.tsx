import React from 'react';
import { render, screen } from '@testing-library/react';
import ToolExplorerPluginExplainer from './ToolExplorerPluginExplainer';

jest.mock('../Shared/CETooltip', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span data-testid="mock-ce-tooltip">{children}</span>,
}));

describe('ToolExplorerPluginExplainer', () => {
  it('does not render without explainer text', () => {
    const { container } = render(<ToolExplorerPluginExplainer />);

    expect(container.firstChild).toBeNull();
  });

  it('renders explainer text inside the tooltip', () => {
    render(<ToolExplorerPluginExplainer explainText="Explain this tool" />);

    expect(screen.getByTestId('mock-ce-tooltip')).toHaveTextContent('Explain this tool');
  });
});
