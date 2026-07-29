import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

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
    expect(screen.getByRole('button', { name: 'Step 1: Session Details' })).toHaveClass('normalModeCardReady');
    expect(screen.getByRole('button', { name: 'Step 2: Privacy' })).toHaveClass('normalModeCardActive');
    expect(screen.getByRole('button', { name: 'Step 3: Deploy Session' })).toHaveClass('normalModeCardPending');
    expect(screen.getByText('Demo session')).toBeInTheDocument();
    expect(screen.getByText('Open link by default')).toBeInTheDocument();
    expect(screen.queryByText('Set a worker URL before uploading metadata.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Step 3: Deploy Session' }));

    expect(onFocusSection).toHaveBeenCalledWith('publish');
  });

  it('maps unknown/neutral card tones to the neutral class', () => {
    expect(getNormalModeCardToneClassName('ready')).toBe('normalModeCardReady');
    expect(getNormalModeCardToneClassName('pending')).toBe('normalModeCardPending');
    expect(getNormalModeCardToneClassName('neutral')).toBe('normalModeCardNeutral');
  });
});
