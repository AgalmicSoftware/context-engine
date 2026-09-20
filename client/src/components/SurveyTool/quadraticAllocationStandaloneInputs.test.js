import vm from 'node:vm';
import { fireEvent, within } from '@testing-library/react';
import { renderTelegramMiniAppBrowserAsset } from '../../../../workers/agentBridgeWorker/telegramMiniAppBrowserAsset.mjs';

const asset = renderTelegramMiniAppBrowserAsset();
const start = asset.indexOf('    function renderAnswerControls(');
const end = asset.indexOf('    let activeDictation', start);
const question = { type: 'quadratic', questionType: 'quadratic', voiceCredits: 99, options: ['Parks', 'Transit', 'Housing'], canAnswer: true };

afterEach(() => { document.body.innerHTML = ''; });

it('telegram sliders show costs, clamp to the shared budget, and preserve signs', () => {
  const draft = { value: [0, 0, 0] };
  const mount = document.createElement('div'); document.body.appendChild(mount);
  const ports = { document, draftFor: () => draft, activate: jest.fn(), markAnswerChanged: jest.fn(), refreshQuestionSubmitButton: jest.fn(), scheduleDraftAutosave: jest.fn(), updateFooterControls: jest.fn(), MIC_ICON: '', shouldShowAnswerActions: () => false, seriesModeEnabled: () => false, applySubmitButtonState: jest.fn(), renderQuestionStack: jest.fn() };
  const render = vm.runInNewContext(asset.slice(start, end) + '\nrenderAnswerControls', ports);
  render(question, mount, { showComments: false });
  const ui = within(mount);
  expect(ui.getByRole('button', { name: 'Reset', exact: true })).toBeVisible();
  const parks = ui.getByRole('slider', { name: 'Parks' });
  const transit = ui.getByRole('slider', { name: 'Transit' });
  expect(ui.queryAllByText('0 credits', { exact: true })).toHaveLength(0);
  fireEvent.input(parks, { target: { value: '7' } });
  fireEvent.input(transit, { target: { value: '-7' } });
  expect(parks).toHaveAttribute('aria-valuetext', '+7 votes, 49 credits, support');
  expect(transit).toHaveAttribute('aria-valuetext', '-7 votes, 49 credits, oppose');
  expect(ui.getAllByText('49 credits', { exact: true })).toHaveLength(2);
  expect(mount).toHaveTextContent('1 credits left');
  fireEvent.input(parks, { target: { value: '9' } });
  expect(parks).toHaveValue('7');
  expect(mount).not.toHaveTextContent('Credit limit reached');
  fireEvent.input(transit, { target: { value: '0' } });
  expect(ui.getAllByText('49 credits', { exact: true })).toHaveLength(1);
  expect(ui.queryAllByText('0 credits', { exact: true })).toHaveLength(0);
  expect(transit).toHaveAttribute('aria-valuetext', '0 votes, 0 credits, neutral');
  fireEvent.input(parks, { target: { value: '-9' } });
  expect(parks).toHaveValue('-9');
  expect(mount).toHaveTextContent('18 credits left');
  expect(mount).toHaveTextContent('+7 or −7 uses 49 credits');
  expect(draft.value).toEqual([-9, 0, 0]);
});
