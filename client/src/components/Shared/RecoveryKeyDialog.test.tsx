import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import RecoveryKeyDialog from './RecoveryKeyDialog';
import { useRecoveryKeyCustody } from '../Sessions/useRecoveryKeyCustody';
const value = {
  recoveryKey: 'a'.repeat(64),
  fingerprint: 'b'.repeat(64),
  slug: 'fixture',
  workerUrl: 'https://worker.test',
  createdAt: '2026-10-26T00:00:00Z',
};

test.each(["I've saved it", 'Skip, I understand the risk'])(
  'masks the key and continues with %s without browser storage',
  (choice) => {
    const storage = jest.spyOn(Storage.prototype, 'setItem');
    const onContinue = jest.fn();
    render(<RecoveryKeyDialog value={value} onContinue={onContinue} />);
    expect(screen.getByLabelText('Recovery key')).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Reveal key' }));
    expect(screen.getByLabelText('Recovery key')).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: choice }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(storage).not.toHaveBeenCalled();
    storage.mockRestore();
  },
);

test('downloads the key, identity, fingerprint and restore instructions', async () => {
  let downloaded: Blob | undefined;
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: jest.fn((blob: Blob) => {
      downloaded = blob;
      return 'blob:key';
    }),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  render(<RecoveryKeyDialog value={value} onContinue={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Download recovery key' }));
  expect(click.mock.instances[0]).toHaveAttribute('download', 'fixture-recovery-key.txt');
  const text = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(downloaded!);
  });
  for (const field of Object.values(value)) expect(text).toContain(field);
  expect(text).toContain('3. Use the same session slug');
  click.mockRestore();
});

test('a lost display explains the admin recovery path', () => {
  render(<RecoveryKeyDialog value={{ ...value, recoveryKey: undefined }} onContinue={() => {}} />);
  expect(screen.getByRole('status')).toHaveTextContent('Show recovery key in Backup & restore');
});

test('context changes discard key material and reject an in-flight display', async () => {
  const { result, rerender } = renderHook(({ identity }) => useRecoveryKeyCustody(identity), {
    initialProps: { identity: 'first' },
  });
  let pending: Promise<void> | undefined;
  act(() => {
    pending = result.current.presentRecoveryKey(value);
  });
  const rejected = expect(pending).rejects.toThrow(/context changed/);
  rerender({ identity: 'second' });
  await rejected;
  await waitFor(() => expect(result.current.recoveryDisplay).toBeNull());
});
