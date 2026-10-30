import { getCorsProxyUrlOrThrow } from '../../utilities/worker/corsProxy';
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

it.each([
  ['registry', 'registry', 'https://site.example/session/workshop'],
  ['Worker canonical', 'worker_canonical', cleanUrl],
])('keeps %s routing authority in voice and AI join links', async (_, mode, expected) => {
  render(
    <SessionJoinPanel
      sessionUrl="https://site.example/session/workshop?token=private"
      workerUrl="https://worker.example/"
      sessionConfig={{ sessionModeProfile: { authority: { mode } } }}
    />,
  );
  fireEvent.click(screen.getByText('Join'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Copy AI prompt' })).toBeEnabled());
  const voice = `${expected}${expected.includes('?') ? '&' : '?'}mode=voice`;
  expect(screen.getByRole('link', { name: 'Open voice interview' })).toHaveAttribute('href', voice);
  expect(screen.getByTestId('qr')).toHaveAttribute('data-value', voice);
  expect(verify).toHaveBeenCalledWith({
    workerUrl: 'https://worker.example',
    sessionSlug: 'workshop',
    sessionUrl: expected,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Copy AI prompt' }));
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      buildExternalInterviewKickoff({
        workerUrl: 'https://worker.example',
        sessionSlug: 'workshop',
        sessionUrl: expected,
      }),
    ),
  );
});

it.each(['not a URL', 'https://wrong.example/path', 'https://fixture:[redacted-email]'])(
  'uses the resolved Worker when the admin field is invalid: %s',
  async (workerUrl) => {
    jest.mocked(getCorsProxyUrlOrThrow).mockResolvedValue('https://worker.example');
    render(<SessionJoinPanel sessionUrl="https://site.example/session/workshop" workerUrl={workerUrl} />);
    fireEvent.click(screen.getByText('Join'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy AI prompt' })).toBeEnabled());
    expect(getCorsProxyUrlOrThrow).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith({
      workerUrl: 'https://worker.example',
      sessionSlug: 'workshop',
      sessionUrl: 'https://site.example/session/workshop',
    });
    expect(screen.queryByText('Checking session compatibility…')).not.toBeInTheDocument();
  },
);
