import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AdminStorageVisibilityPanel from './AdminStorageVisibilityPanel';

const renderPanel = (postSignedRequest = jest.fn(), canAdminWorker = true) =>
  render(
    <AdminStorageVisibilityPanel
      canAdminWorker={canAdminWorker}
      sessionSlug="rxc-ra-test"
      postSignedRequest={postSignedRequest}
    />,
  );

it('hides a question id through the signed admin route and shows the hidden list', async () => {
  const postSignedRequest = jest.fn().mockResolvedValue({
    data: { ok: true, resource: 'questions', id: '0xabc', hidden: true, matchedRows: 2, hiddenIds: ['0xabc'] },
  });
  renderPanel(postSignedRequest);

  fireEvent.change(screen.getByLabelText('Id or link'), { target: { value: ' 0xABC ' } });
  fireEvent.click(screen.getByTestId('ce-admin-storage-visibility-hide'));

  expect(screen.getByTestId('ce-admin-storage-visibility-hide')).toBeDisabled();
  expect(await screen.findByRole('status')).toHaveTextContent('Question 0xabc is hidden. Updated 2 stored version(s).');
  expect(screen.getByText('Hidden questions: 0xabc')).toBeInTheDocument();
  expect(postSignedRequest).toHaveBeenCalledWith({
    action: 'storage/set-hidden',
    path: '/admin/storage/set-hidden',
    body: { sessionSlug: 'rxc-ra-test', resource: 'questions', id: '0xabc', hidden: true },
  });
});

it('reads the resource and id from a pasted survey link when unhiding', async () => {
  const postSignedRequest = jest.fn().mockResolvedValue({ data: { ok: true, matchedRows: 1, hiddenIds: [] } });
  renderPanel(postSignedRequest);

  fireEvent.change(screen.getByLabelText('Id or link'), {
    target: { value: 'https://contextengine.sh/survey/0xS1?session=rxc-ra-test' },
  });
  fireEvent.click(screen.getByTestId('ce-admin-storage-visibility-unhide'));

  expect(await screen.findByRole('status')).toHaveTextContent('Survey 0xs1 is visible again.');
  expect(postSignedRequest).toHaveBeenCalledWith(
    expect.objectContaining({
      body: { sessionSlug: 'rxc-ra-test', resource: 'surveys', id: '0xs1', hidden: false },
    }),
  );
  expect(screen.getByLabelText('Type')).toHaveValue('surveys');
});

it('explains when the session Worker predates the hide route', async () => {
  renderPanel(jest.fn().mockRejectedValue(new Error('Unknown admin action.')));
  fireEvent.change(screen.getByLabelText('Id or link'), { target: { value: '0xabc' } });
  fireEvent.click(screen.getByTestId('ce-admin-storage-visibility-hide'));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This session Worker cannot hide questions or surveys yet. Update the session Worker first.',
  );
  expect(screen.getByTestId('ce-admin-storage-visibility-hide')).toBeEnabled();
});

it('asks for the admin wallet instead of offering controls to other accounts', () => {
  const postSignedRequest = jest.fn();
  renderPanel(postSignedRequest, false);
  expect(screen.getByText(/Connect the configured worker admin wallet/)).toBeInTheDocument();
  expect(screen.queryByTestId('ce-admin-storage-visibility-hide')).not.toBeInTheDocument();
  expect(postSignedRequest).not.toHaveBeenCalled();
});
