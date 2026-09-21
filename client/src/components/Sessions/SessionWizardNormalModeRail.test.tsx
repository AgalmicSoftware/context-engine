import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import SessionWizardNormalModeRail, { getNormalModeCardToneClassName } from './SessionWizardNormalModeRail';
import type { NormalModeCard } from './sessionWizardNormalModeCards';

const cards: NormalModeCard[] = [
  {
    key: 'metadata',
    title: 'Session Details',
    summary: 'Demo session',
    tone: 'ready',
    stepNumber: 1,
  },
  {
    key: 'encryption',
    title: 'Privacy',
    summary: 'Open link by default',
    tone: 'neutral',
    stepNumber: 2,
  },
  {
    key: 'publish',
    title: 'Deploy Session',
    summary: 'Set a worker URL before uploading metadata.',
    tone: 'pending',
    stepNumber: 3,
  },
];

describe('SessionWizardNormalModeRail', () => {
  it('renders normal-mode cards with stable labels, classes, and click handlers', () => {
    const onFocusSection = jest.fn();

    render(
      <SessionWizardNormalModeRail
        activeNormalModeIndex={2}
        collapsedSections={{ metadata: true, encryption: false, publish: true }}
        normalModeCards={cards}
        onFocusSection={onFocusSection}
      />,
    );

    expect(screen.getByRole('region', { name: 'Session setup steps' })).toHaveStyle({
      '--session-wizard-card-count': '3',
    });
    const sessionDetailsButton = screen.getByRole('button', { name: 'Step 1: Session Details' });
    const privacyButton = screen.getByRole('button', { name: 'Step 2: Privacy' });
    const deployButton = screen.getByRole('button', { name: 'Step 3: Deploy Session' });
    expect(sessionDetailsButton).toHaveClass('normalModeCardReady');
    expect(sessionDetailsButton).toHaveClass('normalModeCardCompact');
    expect(privacyButton).toHaveClass('normalModeCardActive');
    expect(deployButton).toHaveClass('normalModeCardPending');
    expect(deployButton).toHaveClass('normalModeCardCompact');
    expect(within(sessionDetailsButton).getByText('1')).toBeInTheDocument();
    expect(within(deployButton).getByText('3')).toBeInTheDocument();
    expect(screen.queryByText('Session Details')).not.toBeInTheDocument();
    expect(screen.getByText('Privacy')).toBeInTheDocument();
    expect(screen.queryByText('Deploy Session')).not.toBeInTheDocument();
    expect(screen.queryByText('Demo session')).not.toBeInTheDocument();
    expect(screen.getByText('Open link by default')).toBeInTheDocument();
    expect(screen.queryByText('Set a worker URL before uploading metadata.')).not.toBeInTheDocument();

    fireEvent.click(deployButton);

    expect(onFocusSection).toHaveBeenCalledWith('publish');
  });

  it('maps unknown/neutral card tones to the neutral class', () => {
    expect(getNormalModeCardToneClassName('ready')).toBe('normalModeCardReady');
    expect(getNormalModeCardToneClassName('pending')).toBe('normalModeCardPending');
    expect(getNormalModeCardToneClassName('neutral')).toBe('normalModeCardNeutral');
  });
});
