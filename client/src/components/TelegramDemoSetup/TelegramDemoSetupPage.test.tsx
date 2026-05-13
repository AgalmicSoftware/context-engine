import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

jest.mock('../../utilities/web3/contractScripts.js', () => ({
  __esModule: true,
  getAllSessionSlugs: jest.fn(() => ['alpha']),
  getSessionConfigBySlug: jest.fn((slug: string) => (
    slug === 'alpha'
      ? {
          slug: 'alpha',
          sessionName: 'Alpha Session',
          corsWorkerUrl: 'https://session-worker.example.test/',
          networkChainId: 11155420,
        }
      : null
  )),
  getSessionConfigBySlugOrDefault: jest.fn(() => ({
    slug: '',
    sessionName: 'General',
    corsWorkerUrl: 'https://general-worker.example.test',
    networkChainId: 11155420,
  })),
  normalizeSessionSlug: jest.fn((value = '') => String(value || '').trim().toLowerCase()),
}));

const TelegramDemoSetupPage = require('./TelegramDemoSetupPage').default;

const sessionOptionsOverride = [
  {
    slug: 'alpha',
    label: 'Alpha Session',
    config: {
      slug: 'alpha',
      sessionName: 'Alpha Session',
      corsWorkerUrl: 'https://session-worker.example.test/',
      networkChainId: 11155420,
    },
  },
];

describe('TelegramDemoSetupPage', () => {
  beforeEach(() => {
    if (!globalThis.crypto?.getRandomValues) {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: {
          getRandomValues: (bytes: Uint8Array) => {
            bytes.forEach((_, index) => {
              bytes[index] = (index + 3) % 256;
            });
            return bytes;
          },
        },
      });
    }
  });

  it('renders setup sections with selected session defaults and no manual account id field', () => {
    render(
      <TelegramDemoSetupPage
        activeSessionSlug="alpha"
        sessionOptionsOverride={sessionOptionsOverride}
      />
    );

    expect(screen.getByTestId(E2E_TESTIDS.PAGE_TELEGRAM_DEMO_SETUP_ROOT)).toBeInTheDocument();
    expect(screen.getByText('Select CE Session')).toBeInTheDocument();
    expect(screen.getByText('Telegram Bot Credentials')).toBeInTheDocument();
    expect(screen.getByText('Cloudflare Deployment Token')).toBeInTheDocument();
    expect(screen.getByText('Worker URL / Deploy Plan')).toBeInTheDocument();
    expect(screen.getByText('RPC Settings')).toBeInTheDocument();
    expect(screen.getByText('Generated Secrets')).toBeInTheDocument();
    expect(screen.getByText('Deploy / Test Checklist')).toBeInTheDocument();
    expect(screen.getByText('Smoke /start, /join, /questions, /docs, /me')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('/ce_join');
    expect(document.body.textContent).not.toContain('/ce_questions');
    expect(document.body.textContent).not.toContain('/ce_docs');

    expect(screen.getByText('https://session-worker.example.test')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.TELEGRAM_DEMO_DEFAULT_RPC_URL)).toHaveTextContent(
      'https://op-sepolia-testnet.api.pocket.network'
    );
    expect(screen.queryByLabelText(/CLOUDFLARE_ACCOUNT_ID/i)).not.toBeInTheDocument();
  });

  it('validates required fields and builds a redacted mocked deploy plan', () => {
    render(
      <TelegramDemoSetupPage
        activeSessionSlug="alpha"
        sessionOptionsOverride={sessionOptionsOverride}
      />
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.TELEGRAM_DEMO_BUILD_PLAN));
    expect(screen.getByTestId(E2E_TESTIDS.TELEGRAM_DEMO_STATUS)).toHaveTextContent('Missing:');
    expect(screen.getByTestId(E2E_TESTIDS.TELEGRAM_DEMO_STATUS)).toHaveTextContent('CLOUDFLARE_API_TOKEN');

    fireEvent.change(screen.getByTestId(E2E_TESTIDS.TELEGRAM_DEMO_BOT_TOKEN), {
      target: { value: '123456:bot-secret' },
    });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.TELEGRAM_DEMO_BOT_USERNAME), {
      target: { value: 'ce_demo_bot' },
    });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.TELEGRAM_DEMO_CLOUDFLARE_API_TOKEN), {
      target: { value: 'cf-secret-token' },
    });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.TELEGRAM_DEMO_WORKERS_SUBDOMAIN), {
      target: { value: 'tenant-subdomain' },
    });
    fireEvent.change(screen.getByTestId(E2E_TESTIDS.TELEGRAM_DEMO_ADDITIONAL_RPC_URL), {
      target: { value: 'https://infura.example.test/op-sepolia' },
    });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.TELEGRAM_DEMO_BUILD_PLAN));

    expect(screen.getByTestId(E2E_TESTIDS.TELEGRAM_DEMO_STATUS)).toHaveTextContent('Plan is ready');
    expect(screen.getByText(/"accountId": "<derived-from-cloudflare-token>"/)).toBeInTheDocument();
    expect(screen.getByText(/"ADDITIONAL_RPC_URL": "https:\/\/infura\.example\.test\/op-sepolia"/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('123456:bot-secret');
    expect(document.body.textContent).not.toContain('cf-secret-token');
  });
});
