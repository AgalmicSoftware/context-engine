import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import FeaturedSbtField from './FeaturedSbtField';
import type { FeaturedSbtFieldProps } from './FeaturedSbtField';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

type MockSbtEntry = {
  address: string;
  name: string;
};

type MockSbtSelectorProps = {
  id?: string;
  label?: string;
  selectedSBTs?: MockSbtEntry[] | null;
  defaultFeaturedSBTs?: string[];
  onAddSBT?: (sbt: MockSbtEntry) => void;
  onRemoveSBT?: (address: string) => void;
};

jest.mock('../SBTs/SBTSelector', () => (props: MockSbtSelectorProps) => {
  const selectedSBTs = Array.isArray(props.selectedSBTs) ? props.selectedSBTs : [];
  return (
    <div
      data-testid="mock-featured-sbt-selector"
      data-selector-id={props.id || ''}
      data-selector-label={props.label || ''}
      data-default-featured={(props.defaultFeaturedSBTs || []).join(',')}
      data-selected={selectedSBTs.map((entry) => entry.address).join(',')}
    >
      <button type="button" onClick={() => props.onAddSBT?.({ address: '0x222', name: 'Second SBT' })}>
        Add featured SBT
      </button>
      {selectedSBTs.map((entry) => (
        <button key={entry.address} type="button" onClick={() => props.onRemoveSBT?.(entry.address)}>
          {`Remove ${entry.address}`}
        </button>
      ))}
    </div>
  );
});

const renderFeaturedSbtField = (props: Partial<FeaturedSbtFieldProps> = {}) =>
  render(
    <FeaturedSbtField
      label="Default Groups"
      tooltipControl={<span data-testid="featured-tooltip">?</span>}
      createButtonLabel="Create Group"
      onCreateSbt={() => {}}
      selectedSBTs={[{ address: '0x111', name: 'First SBT' }]}
      onSelectionsChange={() => {}}
      onRemove={() => {}}
      selectorLabel="Choose groups"
      network={{ id: 11155420 }}
      additionalSBTOptions={[]}
      chainId={11155420}
      sessionSlug="session-alpha"
      sessionConfig={{ slug: 'session-alpha' }}
      sbtCacheRevision={1}
      ensureLightSbtUniverse={() => {}}
      {...props}
    />,
  );

describe('FeaturedSbtField', () => {
  it('renders the field header, create action, and selector surface', () => {
    renderFeaturedSbtField();

    expect(screen.getByText('Default Groups')).toBeInTheDocument();
    expect(screen.getByTestId('featured-tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('mock-featured-sbt-selector')).toHaveAttribute(
      'data-selector-id',
      'default-featured-sbts',
    );
  });

  it('calls onSelectionsChange with the current entries plus the added SBT', () => {
    const onSelectionsChange = jest.fn();
    renderFeaturedSbtField({ onSelectionsChange });

    fireEvent.click(screen.getByRole('button', { name: 'Add featured SBT' }));

    expect(onSelectionsChange).toHaveBeenCalledWith([
      { address: '0x111', name: 'First SBT' },
      { address: '0x222', name: 'Second SBT' },
    ]);
  });

  it('preserves the create button test ID and target attribute', () => {
    const onCreateSbt = jest.fn();
    renderFeaturedSbtField({ onCreateSbt });

    const createButton = screen.getByTestId(E2E_TESTIDS.WIZARD_CREATE_SBT);
    fireEvent.click(createButton);

    expect(createButton).toHaveAttribute('data-ce-sbt-target', 'defaultFeaturedSBTs');
    expect(onCreateSbt).toHaveBeenCalledTimes(1);
  });

  it('renders empty selector state when no SBTs are selected', () => {
    renderFeaturedSbtField({ selectedSBTs: null });

    expect(screen.getByTestId('mock-featured-sbt-selector')).toHaveAttribute('data-selected', '');
    expect(screen.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument();
  });

  it('calls onRemove with the selected chip address', () => {
    const onRemove = jest.fn();
    renderFeaturedSbtField({ onRemove });

    fireEvent.click(screen.getByRole('button', { name: 'Remove 0x111' }));

    expect(onRemove).toHaveBeenCalledWith('0x111');
  });
});
