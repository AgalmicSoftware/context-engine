// The older copy command, on a hidden field placed where the tap was, so a dialog's focus trap leaves it be.
const copyWithCommand = (text: string): boolean => {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  // 16px stops iOS zooming in on the field; it is invisible and takes no room.
  field.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;';
  (active?.closest<HTMLElement>('[role="dialog"]') || document.body).appendChild(field);
  let copied = false;
  try {
    field.focus({ preventScroll: true });
    field.select();
    field.setSelectionRange(0, text.length);
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  field.remove();
  active?.focus({ preventScroll: true });
  return copied;
};

// A clipboard write that has not settled by then counts as refused: some in-app browsers never settle it.
const CLIPBOARD_WAIT_MS = 2000;

/**
 * Copies text for a tap or key press. Call it from the handler itself, before any await. The older copy command
 * goes first because it copies inside the tap itself, which Safari and in-app browsers allow; the clipboard API,
 * which some of them refuse or leave hanging, is the second try. Resolves false when neither copied, so the
 * caller can show the text to copy by hand.
 */
export const copyText = async (text: string): Promise<boolean> => {
  if (copyWithCommand(text)) return true;
  if (!navigator.clipboard?.writeText) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      navigator.clipboard.writeText(text).then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), CLIPBOARD_WAIT_MS);
      }),
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

/** Like `navigator.clipboard.writeText`, with copyText's fallbacks: rejects when nothing could be copied. */
export const writeClipboard = async (text: string) => {
  if (!(await copyText(text))) throw new Error('Copying isn’t allowed here.');
};

/** Selects an element's text, for the person to copy where copying for them was refused. */
export const selectText = (element: Element | null) => {
  const selection = window.getSelection();
  if (!element || !selection) return;
  selection.selectAllChildren(element);
};
