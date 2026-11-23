// What a page would lose if it were left: a recording under way, a draft that could not be saved. Each holder
// also asks through the browser's own prompt on a reload or a close; this is for a link that would swap the page
// inside the app, where the browser asks nothing. Such a link opens a new tab or navigates for real instead.
const guards = new Set<() => boolean>();

/** Says the page is held while `holds` answers yes; returns the release. */
export const guardLeaving = (holds: () => boolean): (() => void) => {
  guards.add(holds);
  return () => void guards.delete(holds);
};

/** Whether leaving this page now would lose something. */
export const pageHeld = (): boolean => [...guards].some((holds) => holds());
