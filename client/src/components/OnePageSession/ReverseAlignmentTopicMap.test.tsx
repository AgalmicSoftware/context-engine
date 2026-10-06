import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ReverseAlignmentTopicMap, { hasReverseAlignmentTopicPreview } from './ReverseAlignmentTopicMap';
import type { AtlasViewProps } from '../DebateMap/debateMapTypes';

const mockCircles = jest.fn((props: AtlasViewProps) => props);
jest.mock('../DebateMap/DebateMap', () => ({
  AtlasView: (props: AtlasViewProps) => {
    mockCircles(props);
    return (
      <div>
        {props.data
          .flatMap((group) => group.children || [])
          .map((topic) => (
            <button key={topic.id} onClick={() => props.onNodeClick(topic)}>
              {topic.name}
            </button>
          ))}
      </div>
    );
  },
}));

it('limits the preview to Reverse Alignment sessions', () => {
  expect(hasReverseAlignmentTopicPreview('rxc-test')).toBe(true);
  expect(hasReverseAlignmentTopicPreview('rxc-ra-test')).toBe(true);
  expect(hasReverseAlignmentTopicPreview('eddy26')).toBe(false);
  expect(hasReverseAlignmentTopicPreview('demo')).toBe(false);
});

it('uses shared read-only Circles with twelve empty topics and lets participants inspect them', async () => {
  render(<ReverseAlignmentTopicMap />);
  expect(await screen.findAllByRole('button')).toHaveLength(12);
  const props = mockCircles.mock.calls.at(-1)?.[0];
  if (!props) throw new Error('Atlas preview did not render');
  expect(props).toEqual(expect.objectContaining({ atlasLayoutMode: 'packed', readOnly: true }));
  expect(props.data).toHaveLength(3);
  props.data.forEach((group) => {
    expect(group.children).toHaveLength(4);
    [group, ...(group.children || [])].forEach((node) => {
      expect(node.questions).toEqual([]);
      expect(node.comments).toEqual([]);
      expect(node.votes).toBeUndefined();
    });
  });
  expect(screen.getByText('Circles · Preview')).toBeVisible();
  expect(screen.getByText('Waiting for more data')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Law and liberties' }));
  expect(within(screen.getByRole('status')).getByText('Law and liberties')).toBeVisible();
  expect(within(screen.getByRole('status')).getByText('No questions or responses assigned yet.')).toBeVisible();
  expect(screen.queryByRole('button', { name: /generate|process/i })).not.toBeInTheDocument();
});
