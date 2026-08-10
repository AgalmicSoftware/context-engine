/**
 * Color values that are deliberately independent of the active app theme.
 *
 * QR codes and copied bitmap canvases require deterministic light/dark pixels
 * for reliable scanning and portable output. Do not add ordinary UI colors to
 * this file; themeable presentation belongs in the `--ce-*` runtime contract.
 */
export const FIXED_MEDIA_LIGHT = '#ffffff';
export const FIXED_MEDIA_DARK = '#000000';
