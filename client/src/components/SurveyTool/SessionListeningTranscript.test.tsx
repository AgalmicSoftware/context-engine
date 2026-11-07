import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SessionListeningTranscript } from './SessionListeningTranscript';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

describe('SessionListeningTranscript', () => {
  const scrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
  const clientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
  beforeAll(() => {
    // jsdom lays nothing out; each line is 20px tall in a 100px box.
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.childElementCount * 20;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 100 });
  });
  afterAll(() => {
    if (scrollHeight) Object.defineProperty(HTMLElement.prototype, 'scrollHeight', scrollHeight);
    if (clientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', clientHeight);
  });

  const lines = (count: number) =>
    Array.from({ length: count }, (_, index) => `Person ${(index % 2) + 1}: point ${index + 1}.`).join('\n');
  const transcriptBox = (count: number) => (
    <SessionListeningTranscript transcript={lines(count)} clearDisabled={false} onClear={jest.fn()} />
  );

  it('keeps the newest line in view as chunks arrive until the host scrolls up', () => {
    const { rerender } = render(transcriptBox(10));
    const box = screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT);
    expect(box.scrollTop).toBe(200);

    rerender(transcriptBox(15));
    expect(box.scrollTop).toBe(300);

    // Rereading earlier lines: a new chunk leaves the text where the host put it.
    box.scrollTop = 40;
    fireEvent.scroll(box);
    rerender(transcriptBox(20));
    expect(box.scrollTop).toBe(40);

    // Back at the end, it follows the newest line again.
    box.scrollTop = 400 - 100;
    fireEvent.scroll(box);
    rerender(transcriptBox(25));
    expect(box.scrollTop).toBe(500);
  });

  it('gives each speaker a bold label in their own colour', () => {
    render(
      <SessionListeningTranscript
        transcript={
          'Person 1: First.\nPerson 2: Second.\nPerson 9: Ninth.\n[Recording gap: audio could not be transcribed.]'
        }
        clearDisabled={false}
        onClear={jest.fn()}
      />,
    );
    const label = (name: string) => screen.getByText(name, { selector: 'strong' });
    expect(label('Person 1:')).toHaveStyle({ color: 'var(--ce-speaker-1)' });
    expect(label('Person 2:')).toHaveStyle({ color: 'var(--ce-speaker-2)' });
    // Colours repeat rather than run out.
    expect(label('Person 9:')).toHaveStyle({ color: 'var(--ce-speaker-1)' });
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT)).toHaveTextContent('Person 2: Second.');
    expect(screen.getByText('[Recording gap: audio could not be transcribed.]').querySelector('strong')).toBeNull();
  });

  it('lets a speaker’s label open their code only when there are codes to give', () => {
    const transcript = 'Person 1: First.\nPerson 2: Second.\n[Recording gap: audio could not be transcribed.]';
    const onSelectSpeaker = jest.fn();
    const { rerender } = render(
      <SessionListeningTranscript transcript={transcript} clearDisabled={false} onClear={jest.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'Person 2:' })).toBeNull();
    rerender(
      <SessionListeningTranscript
        transcript={transcript}
        clearDisabled={false}
        onClear={jest.fn()}
        onSelectSpeaker={onSelectSpeaker}
      />,
    );
    const label = screen.getByRole('button', { name: 'Person 2:' });
    // Still the bold, coloured label; the person buttons under it are the keyboard's way in.
    expect(label.querySelector('strong')).toHaveStyle({ color: 'var(--ce-speaker-2)' });
    expect(label).toHaveAttribute('tabindex', '-1');
    fireEvent.click(label);
    expect(onSelectSpeaker).toHaveBeenCalledWith('Person 2');
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT)).toHaveTextContent('Person 2: Second.');
  });

  it('keeps the box reachable by keyboard, since it scrolls', () => {
    render(transcriptBox(2));
    expect(screen.getByRole('region', { name: 'Transcript' })).toHaveAttribute('tabindex', '0');
  });

  it('clears through its corner control unless clearing is disabled', () => {
    const onClear = jest.fn();
    const { rerender } = render(<SessionListeningTranscript transcript="Notes" clearDisabled onClear={onClear} />);
    expect(screen.getByTestId(E2E_TESTIDS.SESSION_LISTENING_TRANSCRIPT)).toHaveTextContent('Notes');
    expect(screen.getByRole('button', { name: 'Clear transcript' })).toBeDisabled();

    rerender(<SessionListeningTranscript transcript="Notes" clearDisabled={false} onClear={onClear} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear transcript' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
