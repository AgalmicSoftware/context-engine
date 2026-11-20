import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AgentMark, { AGENT_MARK_LABEL } from './AgentMark';
import { polisAgentLabel } from '../PolisReport/polisReportRuntime';

jest.mock('reactstrap', () => ({
  UncontrolledTooltip: ({
    children,
    target,
    trigger,
  }: {
    children: React.ReactNode;
    target: string;
    trigger: string;
  }) => (
    <div data-testid="mock-tooltip" data-target={target} data-trigger={trigger}>
      {children}
    </div>
  ),
}));

describe('AgentMark', () => {
  it('says what Results say of an agent with no model or source', () => {
    expect(AGENT_MARK_LABEL).toBe(polisAgentLabel());
  });

  it('is a robot named by its label, with the label as a tip on hover or focus only', () => {
    render(<AgentMark />);
    const mark = screen.getByRole('button', { name: AGENT_MARK_LABEL });
    expect(mark).toHaveTextContent('');
    expect(mark.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    const tip = screen.getByTestId('mock-tooltip');
    expect(tip).toHaveAttribute('data-target', mark.id);
    expect(tip).toHaveAttribute('data-trigger', 'hover focus');
    expect(tip).toHaveTextContent(AGENT_MARK_LABEL);
    expect(document.querySelector(`#${mark.id}`)).toBe(mark);
  });

  it('gives each mark its own target and lets Escape put the tip away', () => {
    render(
      <>
        <AgentMark />
        <AgentMark />
      </>,
    );
    const [first, second] = screen.getAllByRole('button', { name: AGENT_MARK_LABEL });
    expect(first.id).not.toBe(second.id);
    first.focus();
    fireEvent.keyDown(first, { key: 'Escape' });
    expect(first).not.toHaveFocus();
  });
});
