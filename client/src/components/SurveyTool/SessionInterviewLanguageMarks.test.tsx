import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import SessionInterviewLanguageMarks, { LANGUAGE_FLAGS_SHOWN_MS } from './SessionInterviewLanguageMarks';

const globe = () => screen.getByRole('button', { name: 'Languages you can answer in' });
// Found through the globe: a hidden list has no accessible name to find it by.
const flags = () => document.getElementById(globe().getAttribute('aria-controls') || '') as HTMLElement;
const wait = (ms: number) => act(() => jest.advanceTimersByTime(ms));

describe('SessionInterviewLanguageMarks', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the flags for ten seconds on each opening, then gives their row back', () => {
    const view = render(<SessionInterviewLanguageMarks />);
    expect(screen.getByRole('list', { name: 'Some languages you can answer in' })).toBe(flags());
    expect(flags()).toBeVisible();
    expect(globe()).toHaveAttribute('aria-expanded', 'true');
    wait(LANGUAGE_FLAGS_SHOWN_MS - 1);
    expect(flags()).toBeVisible();
    wait(1);
    expect(flags()).not.toBeVisible();
    expect(globe()).toHaveAttribute('aria-expanded', 'false');
    // Closing the interview unmounts it, so the next opening shows them again.
    view.unmount();
    render(<SessionInterviewLanguageMarks />);
    expect(flags()).toBeVisible();
  });

  it('brings the flags back from the globe for another ten seconds, and hides them from it too', () => {
    render(<SessionInterviewLanguageMarks />);
    wait(LANGUAGE_FLAGS_SHOWN_MS);
    fireEvent.click(globe());
    expect(flags()).toBeVisible();
    wait(LANGUAGE_FLAGS_SHOWN_MS - 1);
    expect(flags()).toBeVisible();
    wait(1);
    expect(flags()).not.toBeVisible();
    fireEvent.click(globe());
    fireEvent.click(globe());
    expect(flags()).not.toBeVisible();
  });

  it('holds the flags while a pointer is over them, and hides them ten seconds after it leaves', () => {
    render(<SessionInterviewLanguageMarks />);
    wait(LANGUAGE_FLAGS_SHOWN_MS - 1000);
    fireEvent.pointerEnter(flags());
    wait(LANGUAGE_FLAGS_SHOWN_MS * 3);
    expect(flags()).toBeVisible();
    fireEvent.pointerLeave(flags());
    wait(LANGUAGE_FLAGS_SHOWN_MS - 1);
    expect(flags()).toBeVisible();
    wait(1);
    expect(flags()).not.toBeVisible();
  });

  it('starts a fresh ten seconds from the globe even if the pointer never left the hidden row', () => {
    render(<SessionInterviewLanguageMarks />);
    fireEvent.pointerEnter(flags());
    fireEvent.click(globe());
    fireEvent.click(globe());
    wait(LANGUAGE_FLAGS_SHOWN_MS);
    expect(flags()).not.toBeVisible();
  });
});
