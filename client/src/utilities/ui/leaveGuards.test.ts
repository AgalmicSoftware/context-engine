import { guardLeaving, pageHeld } from './leaveGuards';

describe('leave guards', () => {
  it('holds the page while any holder says so, and asks each holder afresh', () => {
    expect(pageHeld()).toBe(false);
    let unsaved = false;
    const releaseDraft = guardLeaving(() => unsaved);
    expect(pageHeld()).toBe(false);
    unsaved = true;
    expect(pageHeld()).toBe(true);
    unsaved = false;
    const releaseRecording = guardLeaving(() => true);
    expect(pageHeld()).toBe(true);
    releaseRecording();
    expect(pageHeld()).toBe(false);
    unsaved = true;
    releaseDraft();
    expect(pageHeld()).toBe(false);
  });
});
