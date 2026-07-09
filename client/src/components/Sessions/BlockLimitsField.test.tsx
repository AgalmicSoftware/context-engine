import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import BlockLimitsField from './BlockLimitsField';
import type { BlockLimitsFieldProps } from './BlockLimitsField';

const renderBlockLimitsField = (props: Partial<BlockLimitsFieldProps> = {}) =>
  render(
    <BlockLimitsField
      blockLimits={{ start: 123, end: null }}
      onStartChange={() => {}}
      blockLimitDuration="30"
      blockLimitUnit="minutes"
      onDurationChange={() => {}}
      onUnitChange={() => {}}
      latestChainBlock={null}
      latestBlockStatus=""
      label="Time Limits"
      tooltipControl={null}
      {...props}
    />,
  );

describe('BlockLimitsField', () => {
  it('renders the start input and end-after duration composer', () => {
    renderBlockLimitsField();

    const numberInputs = screen.getAllByRole('spinbutton');
    expect(numberInputs).toHaveLength(2);
    expect(numberInputs[0]).toHaveValue(123);
    expect(numberInputs[1]).toHaveValue(30);
    expect(screen.getByRole('combobox')).toHaveValue('minutes');
  });

  it('renders the latest block helper line when latestChainBlock is non-null', () => {
    renderBlockLimitsField({ latestChainBlock: 30297069 });

    expect(screen.getByText('Latest block: 30,297,069')).toBeInTheDocument();
  });

  it('renders the latest block status helper line when truthy', () => {
    renderBlockLimitsField({ latestBlockStatus: 'Block height loaded.' });

    expect(screen.getByText('Block height loaded.')).toBeInTheDocument();
  });

  it('renders the end block helper text for set and unset end blocks', () => {
    const { rerender } = renderBlockLimitsField({
      blockLimits: { start: 123, end: 30297123 },
    });

    expect(screen.getByText('Ends at block 30,297,123.')).toBeInTheDocument();

    rerender(
      <BlockLimitsField
        blockLimits={{ start: 123, end: null }}
        onStartChange={() => {}}
        blockLimitDuration="30"
        blockLimitUnit="minutes"
        onDurationChange={() => {}}
        onUnitChange={() => {}}
        latestChainBlock={null}
        latestBlockStatus=""
        label="Time Limits"
        tooltipControl={null}
      />,
    );

    expect(screen.getByText('No end block set.')).toBeInTheDocument();
  });

  it('calls onStartChange with the raw string value when the start input changes', () => {
    const onStartChange = jest.fn();
    renderBlockLimitsField({ onStartChange });

    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '456' } });

    expect(onStartChange).toHaveBeenCalledWith('456');
  });

  it('calls onDurationChange and onUnitChange from their controls', () => {
    const onDurationChange = jest.fn();
    const onUnitChange = jest.fn();
    renderBlockLimitsField({ onDurationChange, onUnitChange });

    const [, durationInput] = screen.getAllByRole('spinbutton');
    fireEvent.change(durationInput, { target: { value: '45' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'hours' } });

    expect(onDurationChange).toHaveBeenCalledWith('45');
    expect(onUnitChange).toHaveBeenCalledWith('hours');
  });
});
