/**
 * Returns true when demo tooling is enabled.
 * Handles both legacy boolean payloads and the current structured shape.
 */
export function isDemoModeEnabled(demoMode) {
  if (demoMode && typeof demoMode === 'object') {
    return !!demoMode.tools;
  }
  return !!demoMode;
}
