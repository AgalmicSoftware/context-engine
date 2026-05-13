import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { StandalonePoliticalCompass } from './PoliticalCompassView';

const createCompass = () => ({
  xAxis: {
    label: 'Tooltip Compass',
    left: 'Left',
    right: 'Right',
  },
  yAxis: {
    top: 'Top',
    bottom: 'Bottom',
  },
  points: [
    {
      name: 'Comment Point',
      x: 0.35,
      y: 0.75,
      color: '#ff7a18',
      type: 'historical',
      comment: 'Quoted comment text for hover tooltip coverage.',
    },
    {
      name: 'No Comment Point',
      x: 0.62,
      y: 0.28,
      color: '#2f7df6',
      type: 'analyst',
      comment: '',
    },
    {
      name: 'Hypatia',
      x: 0.48,
      y: 0.58,
      color: '#6f55ff',
      type: 'historical',
      comment: 'Avatar-backed historical figure.',
    },
  ],
});

const mockWrapperRect = () => {
  const wrapper = screen.getByTestId('ce-political-compass-chart-wrapper');

  jest.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
    x: 100,
    y: 80,
    left: 100,
    top: 80,
    right: 700,
    bottom: 600,
    width: 600,
    height: 520,
    toJSON: () => ({}),
  });
};

describe('PoliticalCompass tooltip hover behavior', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows a floating tooltip for comment-bearing points, tracks pointer movement, and hides on leave', () => {
    render(<StandalonePoliticalCompass compass={createCompass()} compact={false} />);
    mockWrapperRect();

    const point = screen.getByTestId('ce-political-compass-point-comment-point');

    fireEvent.mouseEnter(point, { clientX: 260, clientY: 240 });

    const tooltip = screen.getByTestId('ce-political-compass-tooltip');
    Object.defineProperty(tooltip, 'offsetWidth', {
      configurable: true,
      value: 180,
    });
    Object.defineProperty(tooltip, 'offsetHeight', {
      configurable: true,
      value: 72,
    });

    fireEvent.mouseMove(point, { clientX: 260, clientY: 240 });

    const anchoredTooltip = screen.getByTestId('ce-political-compass-tooltip');
    const firstLeft = parseFloat(anchoredTooltip.style.left);
    const firstTop = parseFloat(anchoredTooltip.style.top);

    expect(anchoredTooltip).toHaveTextContent('Comment Point');
    expect(anchoredTooltip).toHaveTextContent('Quoted comment text for hover tooltip coverage.');
    expect(anchoredTooltip).toHaveStyle('position: absolute');
    expect(anchoredTooltip).toHaveStyle('max-width: 250px');

    fireEvent.mouseMove(point, { clientX: 320, clientY: 300 });

    const movedTooltip = screen.getByTestId('ce-political-compass-tooltip');
    expect(parseFloat(movedTooltip.style.left)).toBeGreaterThan(firstLeft);
    expect(parseFloat(movedTooltip.style.top)).not.toBe(firstTop);

    fireEvent.mouseLeave(point);

    expect(screen.queryByTestId('ce-political-compass-tooltip')).toBeNull();
  });

  it('keeps the inline name label fallback when a point has no comment', () => {
    render(<StandalonePoliticalCompass compass={createCompass()} compact={false} />);
    mockWrapperRect();

    const point = screen.getByTestId('ce-political-compass-point-no-comment-point');
    fireEvent.mouseEnter(point, { clientX: 280, clientY: 250 });

    expect(screen.queryByTestId('ce-political-compass-tooltip')).toBeNull();
    expect(screen.getByText('No Comment Point')).toBeInTheDocument();
  });

  it('preserves the click-to-select detail panel behavior', () => {
    render(<StandalonePoliticalCompass compass={createCompass()} compact={false} />);

    fireEvent.click(screen.getByTestId('ce-political-compass-point-comment-point'));

    expect(screen.getByRole('link', { name: 'Comment Point' })).toBeInTheDocument();
    expect(screen.getByText(/Quoted comment text for hover tooltip coverage\./)).toBeInTheDocument();
  });

  it('renders demo figure markers as clipped avatar images and keeps fallback markers for unknown points', () => {
    const { container } = render(<StandalonePoliticalCompass compass={createCompass()} compact={false} />);

    const hypatiaAvatar = screen.getByTestId('ce-political-compass-point-hypatia-avatar');
    expect(hypatiaAvatar.getAttribute('src')).toMatch(/^(\/historical-avatars\/|https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/)/);
    expect(hypatiaAvatar.style.width).toBe('4%');

    expect(screen.queryByTestId('ce-political-compass-point-no-comment-point-avatar')).toBeNull();
    expect(container.querySelector('[data-testid="ce-political-compass-point-no-comment-point"] circle')).not.toBeNull();
  });
});
