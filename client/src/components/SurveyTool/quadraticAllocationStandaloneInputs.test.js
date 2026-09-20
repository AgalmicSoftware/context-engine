import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { fireEvent, within } from '@testing-library/react';
import { renderTelegramMiniAppBrowserAsset } from '../../../../workers/agentBridgeWorker/telegramMiniAppBrowserAsset.mjs';

// Execute the shipped standalone controls against a real DOM, with only transport/lifecycle ports stubbed.
const companionSource = readFileSync(resolve(__dirname, '../../../../contextEngine-cc/public/js/form.mjs'), 'utf8');
const companion = vm.runInNewContext(companionSource.replace(/^import .*;$/gm, '').replace(/export function /g, 'function ').replace(/export async function /g, 'async function ') + '\n({ buildAnswerControlHtml, attachQuadraticSliders })', {
  document, escapeHtml: (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;'),
});
const asset = renderTelegramMiniAppBrowserAsset();
const start = asset.indexOf('    function renderAnswerControls(');
const end = asset.indexOf('    let activeDictation', start);
const question = { type: 'quadratic', questionType: 'quadratic', voiceCredits: 99, options: ['Parks', 'Transit', 'Housing'], canAnswer: true };

afterEach(() => { document.body.innerHTML = ''; });

it.each(['companion', 'telegram'])('%s sliders show costs, clamp to the shared budget, and preserve signs', (surface) => {
  const draft = { value: [0, 0, 0] };
  const mount = document.createElement('div'); document.body.appendChild(mount);
  if (surface === 'companion') {
    mount.innerHTML = companion.buildAnswerControlHtml(question);
    companion.attachQuadraticSliders(question);
  } else {
    const ports = { document, draftFor: () => draft, activate: jest.fn(), markAnswerChanged: jest.fn(), refreshQuestionSubmitButton: jest.fn(), scheduleDraftAutosave: jest.fn(), updateFooterControls: jest.fn(), MIC_ICON: '', shouldShowAnswerActions: () => false, seriesModeEnabled: () => false, applySubmitButtonState: jest.fn(), renderQuestionStack: jest.fn() };
    const render = vm.runInNewContext(asset.slice(start, end) + '\nrenderAnswerControls', ports);
    render(question, mount, { showComments: false });
  }
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
  if (surface === 'telegram') expect(draft.value).toEqual([-9, 0, 0]);
});
