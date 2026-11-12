import { getCorsProxyUrlOrThrow } from '../../utilities/worker/corsProxy';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SessionJoinPanel from './SessionJoinPanel';
import { buildExternalInterviewKickoff } from '../SurveyTool/sessionInterview';
import {
  InterviewCatalogSignInError,
  verifyInterviewKickoffCatalog,
} from '../SurveyTool/sessionInterviewCatalogValidation';

jest.mock('../SurveyTool/sessionInterviewCatalogValidation', () => ({
  ...jest.requireActual<object>('../SurveyTool/sessionInterviewCatalogValidation'),
  verifyInterviewKickoffCatalog: jest.fn(),
}));
jest.mock('../../utilities/worker/corsProxy.js', () => ({ getCorsProxyUrlOrThrow: jest.fn() }));
jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, level }: { value: string; level?: string }) => (
    <svg data-testid="qr" data-value={value} data-level={level} />
  ),
}));
const verify = jest.mocked(verifyInterviewKickoffCatalog);
const sessionUrl =
  'https://site.example/session/workshop?worker=https%3A%2F%2Fworker.example&token=do-not-share#private';
const cleanUrl = 'https://site.example/session/workshop?worker=https%3A%2F%2Fworker.example';
const writeText = jest.fn().mockResolvedValue(undefined);
beforeEach(() => {
  jest.clearAllMocks();
  verify.mockResolvedValue('');
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

it('shares the voice link and the existing AI prompt without private query or fragment material', async () => {
  render(<SessionJoinPanel sessionUrl={sessionUrl} />);
  expect(verify).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Interview & share' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Copy AI prompt' })).toBeEnabled());
  expect(screen.getByTestId('qr')).toHaveAttribute('data-value', `${cleanUrl}&mode=voice`);
  // Level M survives a projected screen's glare better than the default L.
  expect(screen.getByTestId('qr')).toHaveAttribute('data-level', 'M');
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
  fireEvent.click(screen.getByRole('button', { name: 'Interview & share' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('updated catalog');
  expect(screen.getByRole('button', { name: 'Copy AI prompt' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Copy AI prompt' })).toBeEnabled());
});

it('says each person copies their own prompt when the session’s questions need a sign-in', async () => {
  verify.mockRejectedValueOnce(new InterviewCatalogSignInError());
  render(<SessionJoinPanel sessionUrl={sessionUrl} />);
  fireEvent.click(screen.getByRole('button', { name: 'Interview & share' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'each person copies their own prompt from the session page once signed in',
  );
  expect(screen.getByRole('button', { name: 'Copy AI prompt' })).toBeDisabled();
  // A prompt copied to share is checked, and copied, without anyone's ticket.
  expect(verify.mock.calls[0][0]).not.toHaveProperty('ticket');
});

it('offers selectable text if clipboard access fails', async () => {
  writeText.mockRejectedValueOnce(new Error('denied'));
  render(<SessionJoinPanel sessionUrl={sessionUrl} />);
  fireEvent.click(screen.getByRole('button', { name: 'Interview & share' }));
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
  fireEvent.click(screen.getByRole('button', { name: 'Interview & share' }));
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

it.each(['not a URL', 'https://wrong.example/path', `https://fixture:credential${'@'}wrong.example`])(
  'uses the resolved Worker when the admin field is invalid: %s',
  async (workerUrl) => {
    jest.mocked(getCorsProxyUrlOrThrow).mockResolvedValue('https://worker.example');
    render(<SessionJoinPanel sessionUrl="https://site.example/session/workshop" workerUrl={workerUrl} />);
    fireEvent.click(screen.getByRole('button', { name: 'Interview & share' }));
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

it.each([
  ['Worker canonical', 'worker_canonical', `${cleanUrl}&mode=groupRecording`],
  ['registry', 'registry', 'https://site.example/session/workshop?mode=groupRecording'],
])('gives admins the group recorder link, with the Worker pin a %s session needs', async (_, mode, expected) => {
  const props = {
    sessionUrl: 'https://site.example/session/workshop?mode=recordGroup&token=private',
    workerUrl: 'https://worker.example/',
    sessionConfig: { sessionModeProfile: { authority: { mode } } },
  };
  const { rerender } = render(<SessionJoinPanel {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Interview & share' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Copy AI prompt' })).toBeEnabled());
  // Participants only join; the recorder link is for whoever runs a room.
  expect(screen.queryByTestId('ce-join-group-recorder-link')).not.toBeInTheDocument();
  rerender(<SessionJoinPanel {...props} isAdmin />);
  fireEvent.click(screen.getByTestId('ce-join-group-recorder-link'));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(expected));
  expect(await screen.findByRole('status')).toHaveTextContent('Copied.');
});
