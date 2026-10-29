import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionJoinPanel from './SessionJoinPanel';
import { buildExternalInterviewKickoff } from '../SurveyTool/sessionInterview';
import { verifyInterviewKickoffCatalog } from '../SurveyTool/sessionInterviewCatalogValidation';

jest.mock('../SurveyTool/sessionInterviewCatalogValidation', () => ({ verifyInterviewKickoffCatalog: jest.fn() }));
jest.mock('../../utilities/worker/corsProxy.js', () => ({ getCorsProxyUrlOrThrow: jest.fn() }));
jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <svg data-testid="qr" data-value={value} />,
}));
const verify = jest.mocked(verifyInterviewKickoffCatalog);
const sessionUrl =
  'https://site.example/session/workshop?worker=https%3A%2F%2Fworker.example&token=do-not-share#private';
const cleanUrl = 'https://site.example/session/workshop?worker=https%3A%2F%2Fworker.example';
const writeText = jest.fn().mockResolvedValue(undefined);
beforeEach(() => {
  jest.clearAllMocks();
  verify.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

it('shares the voice link and the existing AI prompt without private query or fragment material', async () => {
  render(<SessionJoinPanel sessionUrl={sessionUrl} />);
  expect(verify).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Join'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Copy AI prompt' })).toBeEnabled());
  expect(screen.getByTestId('qr')).toHaveAttribute('data-value', `${cleanUrl}&mode=voice`);
  fireEvent.click(screen.getByRole('button', { name: 'Copy voice link' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${cleanUrl}&mode=voice`));
  fireEvent.click(screen.getByRole('button', { name: 'Copy AI prompt' }));
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      buildExternalInterviewKickoff({
        workerUrl: 'https://worker.example',
        sessionSlug: 'workshop',
        sessionUrl: cleanUrl,
      }),
    ),
  );
  expect(verify).toHaveBeenCalledWith({
    workerUrl: 'https://worker.example',
    sessionSlug: 'workshop',
    sessionUrl: cleanUrl,
  });
});

it('keeps the prompt unavailable when the catalog is incompatible and supports retry', async () => {
  verify.mockRejectedValueOnce(new Error('The session needs an updated catalog.'));
  render(<SessionJoinPanel sessionUrl={sessionUrl} />);
  fireEvent.click(screen.getByText('Join'));
  expect(await screen.findByRole('alert')).toHaveTextContent('updated catalog');
  expect(screen.getByRole('button', { name: 'Copy AI prompt' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Copy AI prompt' })).toBeEnabled());
});

it('offers selectable text if clipboard access fails', async () => {
  writeText.mockRejectedValueOnce(new Error('denied'));
  render(<SessionJoinPanel sessionUrl={sessionUrl} />);
  fireEvent.click(screen.getByText('Join'));
  fireEvent.click(screen.getByRole('button', { name: 'Copy voice link' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Copy the text below');
  expect(screen.getByLabelText('Text to copy')).toHaveValue(`${cleanUrl}&mode=voice`);
});
