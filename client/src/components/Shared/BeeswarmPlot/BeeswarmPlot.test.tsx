import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import BeeswarmPlot, {
  buildBeeswarmTooltipSegmentClassName,
  buildBeeswarmTooltipStatClassName,
  normalizeTooltipVoteBreakdown,
  resolveTooltipLayout,
  resolveTooltipPositionStyle,
  resolveTooltipResponseSegmentStyle,
} from './BeeswarmPlot';
import styles from './BeeswarmPlot.module.scss';

describe('BeeswarmPlot', () => {
  const samplePoint = [
    {
      questionId: 'q1',
      label: 'Prompt one',
      agrees: 7,
      disagrees: 2,
      unsure: 3,
      total: 12,
      value: 0.15,
    },
  ];

  it('keeps a single point idle until hover when the idle summary is disabled, then shows the floating tooltip', () => {
    render(<BeeswarmPlot points={samplePoint} showIdleSummary={false} />);

    expect(screen.queryByTestId('ce-beeswarm-tooltip')).not.toBeInTheDocument();
    expect(screen.queryByText('Hover a question to inspect the split.')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('ce-beeswarm-point-0'), {
      clientX: 120,
      clientY: 90,
    });

    expect(screen.getByTestId('ce-beeswarm-tooltip')).toBeInTheDocument();
    expect(screen.getByText('Prompt one')).toBeInTheDocument();
    const agreeStat = screen.getByTestId('ce-beeswarm-tooltip-agree');
    const unsureStat = screen.getByTestId('ce-beeswarm-tooltip-unsure');
    const disagreeStat = screen.getByTestId('ce-beeswarm-tooltip-disagree');
    expect(agreeStat).toHaveTextContent('Agree 7');
    expect(unsureStat).toHaveTextContent('Unsure 3');
    expect(disagreeStat).toHaveTextContent('Disagree 2');
    expect(agreeStat.compareDocumentPosition(unsureStat) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(unsureStat.compareDocumentPosition(disagreeStat) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('ce-beeswarm-tooltip-bar')).toBeInTheDocument();
    const agreeSegment = screen.getByTestId('ce-beeswarm-tooltip-segment-agree');
    const unsureSegment = screen.getByTestId('ce-beeswarm-tooltip-segment-unsure');
    const disagreeSegment = screen.getByTestId('ce-beeswarm-tooltip-segment-disagree');
    expect(agreeSegment).toBeInTheDocument();
    expect(unsureSegment).toBeInTheDocument();
    expect(disagreeSegment).toBeInTheDocument();
    expect(agreeSegment.compareDocumentPosition(unsureSegment) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(unsureSegment.compareDocumentPosition(disagreeSegment) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('ce-beeswarm-tooltip-total')).toHaveTextContent('Counted 12');

    fireEvent.mouseLeave(screen.getByTestId('ce-beeswarm-plot'));

    expect(screen.queryByTestId('ce-beeswarm-tooltip')).not.toBeInTheDocument();
  });

  it('normalizes tooltip vote breakdowns so the response bar can render unsure votes', () => {
    expect(
      normalizeTooltipVoteBreakdown({
        agrees: 4,
        disagrees: 1,
        unsure: 2,
        total: 8,
      }),
    ).toEqual({
      agrees: 4,
      disagrees: 1,
      unsure: 3,
      total: 8,
    });

    expect(
      normalizeTooltipVoteBreakdown({
        agrees: 3,
        disagrees: 2,
        total: 0,
      }),
    ).toEqual({
      agrees: 3,
      disagrees: 2,
      unsure: 0,
      total: 5,
    });
  });

  it('builds tooltip display classes and inline styles', () => {
    expect(resolveTooltipPositionStyle({ left: 24, top: 36 })).toEqual({
      left: 24,
      top: 36,
    });
    expect(buildBeeswarmTooltipStatClassName(styles, 'tooltipStatAgree')).toBe(
      `${styles.tooltipStat} ${styles.tooltipStatAgree}`,
    );
    expect(buildBeeswarmTooltipSegmentClassName(styles, 'tooltipResponseSegmentAgree')).toBe(
      `${styles.tooltipResponseSegment} ${styles.tooltipResponseSegmentAgree}`,
    );
    expect(resolveTooltipResponseSegmentStyle(3, 12)).toEqual({ width: '25.00%' });
    expect(resolveTooltipResponseSegmentStyle(3, 0)).toEqual({ width: '100.00%' });
  });

  it('repositions right-edge tooltips to the left so the card keeps its full width', () => {
    expect(
      resolveTooltipLayout({
        anchorX: 320,
        anchorY: 60,
        wrapperWidth: 360,
        wrapperHeight: 220,
        tooltipWidth: 220,
        tooltipHeight: 120,
      }),
    ).toEqual(
      expect.objectContaining({
        horizontal: 'left',
        vertical: 'bottom',
      }),
    );

    expect(
      resolveTooltipLayout({
        anchorX: 44,
        anchorY: 196,
        wrapperWidth: 360,
        wrapperHeight: 220,
        tooltipWidth: 220,
        tooltipHeight: 120,
      }),
    ).toEqual(
      expect.objectContaining({
        horizontal: 'right',
        vertical: 'top',
      }),
    );
  });

  it('pins point details on click until the close action is used', () => {
    render(<BeeswarmPlot points={samplePoint} showIdleSummary={false} />);
    const point = screen.getByTestId('ce-beeswarm-point-0');

    fireEvent.click(point, { clientX: 120, clientY: 90 });
    fireEvent.mouseLeave(screen.getByTestId('ce-beeswarm-plot'));

    expect(point).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('ce-beeswarm-tooltip')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
    expect(screen.queryByTestId('ce-beeswarm-tooltip')).not.toBeInTheDocument();
  });

  it('keeps a pinned detail attached to its stable key when points reorder', () => {
    const points = [
      { key: 'first', label: 'First prompt', value: 0.1, total: 1, agrees: 1 },
      { key: 'second', label: 'Second prompt', value: 0.9, total: 1, disagrees: 1 },
    ];
    const { rerender } = render(<BeeswarmPlot points={points} showIdleSummary={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Second prompt' }));

    rerender(<BeeswarmPlot points={[points[1], points[0]]} showIdleSummary={false} />);

    expect(screen.getByTestId('ce-beeswarm-tooltip')).toHaveTextContent('Second prompt');
  });
});
