import { copyText, writeClipboard } from './copyText';

const setClipboard = (clipboard: unknown) =>
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
const setCommand = (command: unknown) =>
  Object.defineProperty(document, 'execCommand', { value: command, configurable: true, writable: true });

afterEach(() => {
  setClipboard(undefined);
  Reflect.deleteProperty(document, 'execCommand');
  jest.useRealTimers();
});

it('copies with the copy command inside the tap, leaving nothing behind', async () => {
  const writeText = jest.fn(async (_text: string) => undefined);
  setClipboard({ writeText });
  const copied: string[] = [];
  setCommand(
    jest.fn(() => {
      const field = document.activeElement as HTMLTextAreaElement;
      copied.push(field.value.slice(field.selectionStart, field.selectionEnd));
      return true;
    }),
  );
  const button = document.body.appendChild(document.createElement('button'));
  button.focus();
  // Synchronously, before any await: the copy happens within the tap.
  const result = copyText('the whole prompt');
  expect(copied).toEqual(['the whole prompt']);
  await expect(result).resolves.toBe(true);
  expect(writeText).not.toHaveBeenCalled();
  expect(document.querySelector('textarea')).toBeNull();
  expect(document.activeElement).toBe(button);
  button.remove();
});

it.each([
  ['refused', () => false],
  ['missing', undefined],
])('copies with the clipboard where the copy command is %s', async (_, command) => {
  if (command) setCommand(command);
  const writeText = jest.fn(async (_text: string) => undefined);
  setClipboard({ writeText });
  await expect(copyText('prompt')).resolves.toBe(true);
  expect(writeText).toHaveBeenCalledWith('prompt');
});

it('says it could not copy when neither way is allowed', async () => {
  setCommand(() => false);
  setClipboard({ writeText: async () => Promise.reject(new Error('denied')) });
  await expect(copyText('prompt')).resolves.toBe(false);
  setClipboard(undefined);
  setCommand(() => {
    throw new Error('unsupported');
  });
  await expect(copyText('prompt')).resolves.toBe(false);
  await expect(writeClipboard('prompt')).rejects.toThrow('Copying isn’t allowed here.');
});

it('counts a clipboard write that never settles as refused', async () => {
  jest.useFakeTimers();
  setCommand(() => false);
  setClipboard({ writeText: () => new Promise(() => undefined) });
  const result = copyText('prompt');
  jest.advanceTimersByTime(2000);
  await expect(result).resolves.toBe(false);
});
