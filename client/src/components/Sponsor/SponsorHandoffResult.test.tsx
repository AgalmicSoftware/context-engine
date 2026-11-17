import { act, fireEvent, render, screen } from '@testing-library/react';
import { SponsorHandoffResult } from './SponsorHandoffResult';

type OnCopy = (value: unknown, label: string) => Promise<boolean>;
const result = (onCopy: OnCopy, shareKey = 'key-secret') => (
  <SponsorHandoffResult shareKey={shareKey} shareTxId="" shareUrl="https://site.example/s" onCopy={onCopy} />
);
const copyKey = () =>
  act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy sponsored decryption key' })));

it('keeps the key masked when it was copied', async () => {
  render(result(async () => true));
  await copyKey();
  expect(screen.getByLabelText('Sponsored decryption key')).toHaveAttribute('type', 'password');
});

it('shows the key selected when copying it is refused, and masks the next one', async () => {
  const onCopy = jest.fn(async (_value: unknown, _label: string) => false);
  const view = render(result(onCopy));
  await copyKey();
  expect(onCopy).toHaveBeenCalledWith('key-secret', 'Copied sponsored decryption key');
  const key = screen.getByLabelText<HTMLInputElement>('Sponsored decryption key');
  expect(key).toHaveAttribute('type', 'text');
  expect(document.activeElement).toBe(key);
  expect([key.selectionStart, key.selectionEnd]).toEqual([0, 'key-secret'.length]);
  view.rerender(result(onCopy, 'key-next'));
  expect(screen.getByLabelText('Sponsored decryption key')).toHaveAttribute('type', 'password');
});
