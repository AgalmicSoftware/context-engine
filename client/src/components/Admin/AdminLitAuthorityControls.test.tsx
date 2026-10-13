import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminLitAuthorityControls from './AdminLitAuthorityControls';

const AUTHORITY = {
  ok: true,
  litAuthorizationVersion: 'worker-signed-v1',
  litAuthorizationSigner: '0x00000000000000000000000000000000000000aa',
  litGroupId: '7',
  litPkpId: 'pkp-fixture',
  litActionCid: 'cid-fixture',
};
const setup = (overrides: Record<string, unknown> = {}) => {
  const props = {
    canAdminWorker: true,
    hasUnsavedChanges: false,
    workerSupportsFreshAuthority: true,
    sessionSlug: 'edge',
    workerUrl: 'https://worker.example.test',
    postSignedRequest: jest.fn(async () => ({ data: AUTHORITY })),
    onProvisioned: jest.fn(async () => {}),
    ...overrides,
  };
  return { props, ...render(<AdminLitAuthorityControls {...props} />) };
};
const confirm = () => fireEvent.click(screen.getByRole('checkbox', { name: /I preserved.*old ciphertext/i }));

test('requires an updated Worker status before permitting a destructive request', () => {
  const { props } = setup({ workerSupportsFreshAuthority: false });
  expect(screen.getByRole('checkbox')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Create fresh Lit authority' }));
  expect(props.postSignedRequest).not.toHaveBeenCalled();
  expect(screen.getByText(/Update the session Worker/i)).toBeInTheDocument();
});

test.each([
  { ok: true },
  { ...AUTHORITY, litAuthorizationVersion: 'legacy' },
  { ...AUTHORITY, litAuthorizationSigner: 'invalid' },
  { ...AUTHORITY, litActionCid: '' },
  { ...AUTHORITY, litGroupId: '' },
  { ...AUTHORITY, litPkpId: '' },
])('does not report a fresh authority for an incomplete or old-Worker success reply: %j', async (data) => {
  const { props } = setup({ postSignedRequest: jest.fn(async () => ({ data })) });
  confirm();
  fireEvent.click(screen.getByRole('button', { name: 'Create fresh Lit authority' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Worker-signed Lit authority/);
  expect(props.onProvisioned).not.toHaveBeenCalled();
  expect(props.postSignedRequest).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('checkbox')).not.toBeChecked();
});

test('a double click sends one signed request and locks the acknowledgement while pending', async () => {
  let finish: (value: { data: typeof AUTHORITY }) => void = () => {};
  const { props } = setup({
    postSignedRequest: jest.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    ),
  });
  confirm();
  const button = screen.getByRole('button', { name: 'Create fresh Lit authority' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(props.postSignedRequest).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('checkbox')).toBeDisabled();
  await act(async () => {
    finish({ data: AUTHORITY });
  });
  expect(screen.getByRole('status')).toHaveTextContent(/Fresh Lit authority created/);
  expect(screen.getByRole('checkbox')).not.toBeChecked();
});

test('a follow-up status failure does not repeat a successful cutover or report provisioning failure', async () => {
  const { props } = setup({
    onProvisioned: jest.fn(async () => {
      throw new Error('status unavailable');
    }),
  });
  confirm();
  fireEvent.click(screen.getByRole('button', { name: 'Create fresh Lit authority' }));
  await waitFor(() => expect(props.onProvisioned).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('status')).toHaveTextContent(/Fresh Lit authority created/);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(props.postSignedRequest).toHaveBeenCalledTimes(1);
});

test('unmounting during provisioning cannot refresh a different session after completion', async () => {
  let finish: (value: { data: typeof AUTHORITY }) => void = () => {};
  const { props, unmount } = setup({
    postSignedRequest: jest.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    ),
  });
  confirm();
  fireEvent.click(screen.getByRole('button', { name: 'Create fresh Lit authority' }));
  unmount();
  await act(async () => {
    finish({ data: AUTHORITY });
  });
  expect(props.onProvisioned).not.toHaveBeenCalled();
});
