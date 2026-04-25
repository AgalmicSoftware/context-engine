/**
 * Returns true when demo tooling is enabled.
 * Handles both legacy boolean payloads and the current structured shape.
 */
export function isDemoModeEnabled(demoMode: unknown): boolean {
  if (demoMode && typeof demoMode === 'object') {
    return !!(demoMode as { tools?: unknown }).tools;
  }
  return !!demoMode;
}
