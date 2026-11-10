import { act, renderHook } from '@testing-library/react';

import { useBoundedLoading } from './useBoundedLoading';

afterEach(() => {
  jest.useRealTimers();
});

it('reports loading for at most the given time in a row, and starts again with a new load', () => {
  jest.useFakeTimers();
  const { result, rerender } = renderHook(({ loading }) => useBoundedLoading(loading, 1000), {
    initialProps: { loading: true },
  });
  expect(result.current).toBe(true);
  act(() => {
    jest.advanceTimersByTime(999);
  });
  expect(result.current).toBe(true);
  // A load that never finishes stops showing as one.
  act(() => {
    jest.advanceTimersByTime(1);
  });
  expect(result.current).toBe(false);

  rerender({ loading: false });
  expect(result.current).toBe(false);
  rerender({ loading: true });
  expect(result.current).toBe(true);
  act(() => {
    jest.advanceTimersByTime(500);
  });
  expect(result.current).toBe(true);
});

it('never reports loading when nothing loads', () => {
  const { result } = renderHook(() => useBoundedLoading(false, 1000));
  expect(result.current).toBe(false);
});
