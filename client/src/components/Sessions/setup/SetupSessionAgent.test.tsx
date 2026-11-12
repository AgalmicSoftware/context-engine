import React, { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { SESSION_AGENT_DEFAULT_INSTRUCTIONS } from '@ce-shared/sessionAgent.mjs';
import SetupSessionAgent from './SetupSessionAgent';

const GROUPS = [
  { groupId: 'salon', label: 'Salon' },
  { groupId: 'hosts', label: 'Hosts' },
];
const CONTRACT = `0x${'5b'.repeat(20)}`;
const everyone = {
  who: { match: 'any', conditions: [{ kind: 'agent_grant_scope', scope: 'ai' }] },
  answers: 'general',
};

// Keeps the setting as a page's draft does, so each change builds on the last.
const renderAgent = ({ value = null, sbtChainId = 0 }: { value?: unknown; sbtChainId?: number } = {}) => {
  const changes: unknown[] = [];
  const Page = () => {
    const [setting, setSetting] = useState<unknown>(value);
    return (
      <SetupSessionAgent
        value={setting}
        groups={GROUPS}
        sbtChainId={sbtChainId}
        onChange={(next) => {
          changes.push(next);
          setSetting(next);
        }}
      />
    );
  };
  render(<Page />);
  return () => changes.at(-1);
};

describe('SetupSessionAgent', () => {
  it('is off until turned on, then lets everyone signed in ask for General answers', () => {
    const last = renderAgent();
    expect(screen.getByTestId('ce-setup-session-agent')).not.toBeChecked();
    expect(screen.queryByTestId('ce-setup-session-agent-audience-0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ce-setup-session-agent'));
    expect(last()).toEqual({ audiences: [everyone] });
    expect(screen.getByTestId('ce-setup-session-agent-0-answers')).toHaveValue('general');
    // Each style's instructions start as its default.
    const detailed = screen.getByTestId('ce-setup-session-agent-detailed');
    expect(detailed).toHaveValue(SESSION_AGENT_DEFAULT_INSTRUCTIONS.detailed);
    // The session's settings are public, and the "?" says so for what an admin writes here.
    expect(detailed).toHaveAccessibleDescription(expect.stringContaining('these instructions can be read by anyone'));
    fireEvent.click(screen.getByTestId('ce-setup-session-agent'));
    expect(last()).toBeNull();
  });

  it('puts a new audience first, for the groups an admin ticks, with Detailed answers', () => {
    const last = renderAgent({ value: { audiences: [everyone] } });
    fireEvent.click(screen.getByTestId('ce-setup-session-agent-add'));
    // A rule naming no group can't be saved yet, and says so.
    expect(screen.getByTestId('ce-setup-session-agent-error')).toHaveTextContent(
      'Audience 1, rule 1, needs at least one group.',
    );
    const first = within(screen.getByTestId('ce-setup-session-agent-audience-0'));
    fireEvent.click(within(first.getByRole('group', { name: 'Audience 1, rule 1: groups' })).getByLabelText('Salon'));
    expect(last()).toEqual({
      audiences: [
        { who: { match: 'any', conditions: [{ kind: 'worker_group', groupIds: ['salon'] }] }, answers: 'detailed' },
        everyone,
      ],
    });
    expect(screen.queryByTestId('ce-setup-session-agent-error')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Move audience 2 up' }));
    expect((last() as { audiences: unknown[] }).audiences[0]).toEqual(everyone);
  });

  it('asks whether people must meet any or every rule once an audience has two', () => {
    const last = renderAgent({ value: { audiences: [everyone] }, sbtChainId: 84532 });
    expect(screen.queryByLabelText('Who')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add a rule to audience 1' }));
    fireEvent.change(screen.getByTestId('ce-setup-session-agent-rule-0-1'), { target: { value: 'sbt_onchain' } });
    fireEvent.change(screen.getByLabelText('Audience 1, rule 2: SBT contract'), { target: { value: CONTRACT } });
    fireEvent.change(screen.getByLabelText('Who'), { target: { value: 'all' } });
    expect(last()).toEqual({
      audiences: [
        {
          who: {
            match: 'all',
            conditions: [
              { kind: 'agent_grant_scope', scope: 'ai' },
              { kind: 'sbt_onchain', chainId: 84532, contract: CONTRACT, anyOrAll: 'any' },
            ],
          },
          answers: 'general',
        },
      ],
    });
  });

  it('offers SBT holders only on a session that checks SBTs', () => {
    renderAgent({ value: { audiences: [everyone] } });
    const kinds = within(screen.getByTestId('ce-setup-session-agent-rule-0-0')).getAllByRole('option');
    expect(kinds.map((option) => option.textContent)).toEqual(['Everyone signed in', 'Members of groups']);
  });

  it('leaves only admins able to ask when every audience is removed', () => {
    const last = renderAgent({ value: { audiences: [everyone] } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove audience 1' }));
    expect(last()).toEqual({ audiences: [] });
    expect(screen.getByText('Only admins may ask.')).toBeInTheDocument();
  });

  it('keeps an edited instruction with the setting', () => {
    const last = renderAgent({ value: { audiences: [everyone] } });
    fireEvent.change(screen.getByTestId('ce-setup-session-agent-general'), { target: { value: 'Be brief.' } });
    expect(last()).toEqual({ audiences: [everyone], instructions: { general: 'Be brief.' } });
  });
});
