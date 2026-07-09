import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CollapsibleFieldGroup from './CollapsibleFieldGroup';
import type { CollapsibleFieldGroupProps } from './CollapsibleFieldGroup';

const renderCollapsibleFieldGroup = (props: Partial<CollapsibleFieldGroupProps> = {}) =>
  render(
    <CollapsibleFieldGroup
      title="AI settings"
      isCollapsed={false}
      onToggleCollapsed={() => {}}
      className="objectGroup"
      toggleAriaLabel="AI settings expand"
      {...props}
    >
      <div>Child field</div>
    </CollapsibleFieldGroup>,
  );

describe('CollapsibleFieldGroup', () => {
  it('renders title and children when not collapsed', () => {
    renderCollapsibleFieldGroup();

    expect(screen.getByText('AI settings')).toBeInTheDocument();
    expect(screen.getByText('Child field')).toBeInTheDocument();
  });

  it('hides children when collapsed', () => {
    renderCollapsibleFieldGroup({ isCollapsed: true });

    expect(screen.getByText('AI settings')).toBeInTheDocument();
    expect(screen.queryByText('Child field')).not.toBeInTheDocument();
  });

  it('calls onToggleCollapsed when toggle button is clicked', () => {
    const onToggleCollapsed = jest.fn();
    renderCollapsibleFieldGroup({ onToggleCollapsed });

    fireEvent.click(screen.getByRole('button', { name: /AI settings/ }));

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('renders the collapsed state caret icon', () => {
    const { rerender } = renderCollapsibleFieldGroup({ isCollapsed: true });
    let button = screen.getByRole('button', { name: 'AI settings expand' });

    expect(button).toHaveAttribute('aria-expanded', 'false');

    rerender(
      <CollapsibleFieldGroup
        title="AI settings"
        isCollapsed={false}
        onToggleCollapsed={() => {}}
        className="objectGroup"
        toggleAriaLabel="AI settings collapse"
      >
        <div>Child field</div>
      </CollapsibleFieldGroup>,
    );

    button = screen.getByRole('button', { name: 'AI settings collapse' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});
