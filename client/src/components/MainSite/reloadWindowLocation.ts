type ReloadableWindow =
  | {
      location?: {
        reload?: () => void;
      } | null;
    }
  | null
  | undefined;

export const reloadWindowLocation = (targetWindow: ReloadableWindow): boolean => {
  if (!targetWindow?.location || typeof targetWindow.location.reload !== 'function') {
    return false;
  }
  targetWindow.location.reload();
  return true;
};
