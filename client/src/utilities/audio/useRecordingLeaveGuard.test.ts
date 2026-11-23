import { renderHook } from '@testing-library/react';

import { pageHeld } from '../ui/leaveGuards';
import { useRecordingLeaveGuard } from './useRecordingLeaveGuard';

describe('recording leave guard', () => {
  it('says a recording holds the page while it captures or has unsent audio, and no longer', () => {
    expect(pageHeld()).toBe(false);
    const { rerender, unmount } = renderHook(
      ({ capturing, unsent }: { capturing: boolean; unsent: boolean }) => useRecordingLeaveGuard(capturing, unsent),
      { initialProps: { capturing: false, unsent: false } },
    );
    expect(pageHeld()).toBe(false);

    rerender({ capturing: true, unsent: false });
    expect(pageHeld()).toBe(true);
    rerender({ capturing: false, unsent: true });
    expect(pageHeld()).toBe(true);
    rerender({ capturing: false, unsent: false });
    expect(pageHeld()).toBe(false);

    // Two recorders: the page is held until both let go.
    const other = renderHook(() => useRecordingLeaveGuard(false, true));
    rerender({ capturing: false, unsent: true });
    other.unmount();
    expect(pageHeld()).toBe(true);
    unmount();
    expect(pageHeld()).toBe(false);
  });
});
