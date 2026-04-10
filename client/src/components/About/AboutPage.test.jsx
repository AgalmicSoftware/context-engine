import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { MemoryRouter } from 'react-router-dom';

import AboutPage, {
  getAboutDemoSessionPath,
  getConfiguredRecognitionIndividuals,
} from './AboutPage.jsx';

const ORIGINAL_PUBLIC_URL = process.env.PUBLIC_URL;

beforeEach(() => {
  if (typeof ORIGINAL_PUBLIC_URL === 'undefined') {
    delete process.env.PUBLIC_URL;
  } else {
    process.env.PUBLIC_URL = ORIGINAL_PUBLIC_URL;
  }
  window.localStorage.clear();
});

const renderAboutPage = () => render(
  <MemoryRouter>
    <AboutPage />
  </MemoryRouter>
);

describe('AboutPage', () => {
  it('renders the hero with the expected primary and external links', () => {
    renderAboutPage();

    const hero = screen.getByTestId('ce-about-hero');
    const demoLink = within(hero).getByRole('link', { name: /^Demo$/i });
    const newSessionLink = within(hero).getByRole('link', { name: /New Session/i });

    expect(hero).toBeInTheDocument();
    expect(demoLink).toHaveAttribute(
      'href',
      getAboutDemoSessionPath()
    );
    expect(newSessionLink).toHaveAttribute('href', '/new');
    expect(within(hero).getByTestId('ce-about-link-whitepaper')).toBeVisible();
    expect(within(hero).getByTestId('ce-about-link-whitepaper')).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/blob/main/Whitepaper/whitepaper.md'
    );
    expect(within(hero).getByLabelText(/view context engine on github/i)).toBeVisible();
    expect(within(hero).getByTestId('ce-about-link-github')).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine'
    );
    expect(within(hero).queryByTestId('ce-about-link-contributing')).not.toBeInTheDocument();
    expect(within(hero).queryByTestId('ce-about-link-license')).not.toBeInTheDocument();
    expect(within(hero).queryByTestId('ce-about-link-slides')).not.toBeInTheDocument();
    expect(within(hero).getByRole('link', { name: /Email/i })).toHaveAttribute(
      'href',
      'mailto:contextengine@protonmail.com'
    );
  });

  it('uses the first concrete list-scoped session for the demo CTA when list scope is active', () => {
    window.localStorage.setItem('ce:selectedSessionScope', 'list');
    window.localStorage.setItem('ce:selectedSessionSlugs', JSON.stringify(['general', 'edge', 'rxc']));

    renderAboutPage();

    expect(screen.getByRole('link', { name: /^Demo$/i })).toHaveAttribute('href', '/session/edge');
  });

  it('prepends PUBLIC_URL to the new-session CTA for subpath deployments', () => {
    process.env.PUBLIC_URL = '/ce/';

    renderAboutPage();

    expect(screen.getByRole('link', { name: /New Session/i })).toHaveAttribute('href', '/ce/new');
  });

  it('shows one use-case detail panel at a time', () => {
    renderAboutPage();

    expect(screen.queryByText(/durable public map/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-about-usecase-ai-discourse'));

    expect(within(screen.getByRole('article')).getByText(/^for ai discourse$/i)).toBeInTheDocument();
    expect(screen.getByText(/low-dimensional debate/i)).toBeInTheDocument();
    expect(screen.getByText(/durable public map/i)).toBeInTheDocument();
    expect(
      screen.getByText(/public ai discourse gets flattened into slogans like "accelerate" vs\. "pause,"/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/create a structured public map of ai questions, preferences, and predictions in durable form/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/how ce helps/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-about-usecase-ai-discourse')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('ce-about-usecase-corporate'));

    expect(screen.queryByText(/durable public map/i)).not.toBeInTheDocument();
    expect(within(screen.getByRole('article')).getByText(/^for companies$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/record predictions, assumptions, and confidence before outcomes are known/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('ce-about-usecase-corporate')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('ce-about-usecase-ai-discourse')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByTestId('ce-about-usecase-cities'));

    expect(
      screen.getByText(/gather input that is more nuanced than a poll and more durable than a hearing/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-about-usecase-conferences'));

    expect(
      screen.getByText(/leave with a durable map of consensus, subgroup differences, and unresolved questions/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-about-usecase-digital-groups'));

    expect(
      screen.getByText(/train representative ai models, and keep community data attributable, licensable, and revocable/i)
    ).toBeInTheDocument();
  });

  it('renames functionality and merges milestones plus future items into one roadmap toggle', () => {
    renderAboutPage();

    const currentToggle = screen.getByRole('button', { name: /functionality/i });
    const roadmapToggle = screen.getByRole('button', { name: /roadmap/i });

    expect(currentToggle).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /present functionalities/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^future$/i })).not.toBeInTheDocument();
    expect(
      screen.queryByText(/zero-knowledge proofs for encrypted predictions and retroactive evaluation/i)
    ).not.toBeInTheDocument();

    fireEvent.click(currentToggle);

    expect(screen.getByText(/^Sessions:$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/include questions, responses, documents, access gates, and configuration/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/^Questions:$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/supports binary, rating, multiple-choice, and freeform questions/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/^Storage:$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/responses and documents on arweave plus built-in report views, exports, and address-based comparison tools/i)
    ).toBeInTheDocument();

    fireEvent.click(roadmapToggle);

    expect(screen.getByText(/^Stage 1:$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Complete$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/current platform: an upgraded decentralized pol\.is with more question types, optional privacy, ai-native inputs/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/^Stage 2:$/i)).toBeInTheDocument();
    expect(screen.getByText(/deployment and interface upgrades/i)).toBeInTheDocument();
    expect(
      screen.getByText(/agent-first ux so an agent can interface with a session in natural language/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/^Stage 3:$/i)).toBeInTheDocument();
    expect(screen.getByText(/stronger privacy and resilience/i)).toBeInTheDocument();
    expect(
      screen.getByText(/unlinkable per-response and per-sbt accounts, zero-knowledge and fhe aggregation/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/zktls group formation and post-quantum cryptography/i)).toBeInTheDocument();
    expect(screen.getByText(/^Stage 4\+:$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/group prompting, multimedia worldbuilding, and backcasting from clusters to scenarios/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/agent-to-agent negotiation tooling for multi-step private processes/i)
    ).toBeInTheDocument();
  });

  it('keeps the recognition section visible without rendering empty individuals content', () => {
    renderAboutPage();

    const recognitionSection = screen.getByTestId('ce-about-recognition-toggle');
    const recognitionToggle = within(recognitionSection).getByRole('button', { name: /recognition/i });

    expect(recognitionSection).toBeInTheDocument();
    expect(recognitionToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('ce-about-recognition-radicalxchange')).toBeInTheDocument();
    expect(screen.queryByTestId('ce-about-recognition-individuals')).not.toBeInTheDocument();
    expect(screen.queryByText(/No recognized individuals yet/i)).not.toBeInTheDocument();

    fireEvent.click(recognitionToggle);

    expect(recognitionToggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(recognitionSection).getByTestId('ce-about-recognition-summary')).toBeInTheDocument();
    expect(screen.queryByTestId('ce-about-recognition-radicalxchange')).not.toBeInTheDocument();
  });

  it('only treats named recognition individuals as renderable configuration', () => {
    expect(getConfiguredRecognitionIndividuals()).toEqual([]);
    expect(getConfiguredRecognitionIndividuals([
      null,
      {},
      { name: '   ' },
      { name: 'Audrey Tang', url: 'https://example.com/audrey' },
    ])).toEqual([
      { name: 'Audrey Tang', url: 'https://example.com/audrey' },
    ]);
  });

  it('falls back to the legacy demo route when list scope has no concrete session slug', () => {
    expect(getAboutDemoSessionPath({
      selectedSessionScope: 'list',
      selectedSessionSlugs: ['general'],
    })).toBe('/session/demo');
  });

  it.each([
    [
      'ce-about-recognition-ethereum',
      /passkey ethereum wallet model rather than email/i,
      /users do not need to know anything about cryptocurrency to use it/i,
    ],
    [
      'ce-about-recognition-radicalxchange',
      /social identity, plural governance, and group-owned value/i,
      /retaining ownership over the preference data and value they create/i,
    ],
    [
      'ce-about-recognition-pol-is',
      /current sota for large-group discourse software/i,
      /vtaiwan demonstration/i,
    ],
  ])('shows updated whitepaper-derived copy in the %s recognition modal', async (testId, firstCopy, secondCopy) => {
    renderAboutPage();

    fireEvent.click(screen.getByTestId(testId));

    const dialog = screen.getByRole('dialog');

    expect(screen.getByText(firstCopy)).toBeInTheDocument();
    expect(screen.getByText(secondCopy)).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: /close recognition details/i })
    ).toBeVisible();

    fireEvent.click(within(dialog).getByRole('button', { name: /close recognition details/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('uses large muted OnePageSession-style section headings on the about page', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'AboutPage.module.scss'), 'utf8');

    expect(scss).toMatch(/\.sectionTitle\s*{[\s\S]*?font-family:\s*var\(--ce-font-body\);[\s\S]*?font-size:\s*clamp\(1\.6rem,\s*4vw,\s*2\.1rem\);[\s\S]*?color:\s*rgba\(255,\s*255,\s*255,\s*0\.5\);/);
    expect(scss).not.toMatch(/&:hover\s+\.sectionTitle\s*{[\s\S]*?#4dffa4;/);
    expect(scss).toMatch(/\.useCaseLabel\s*{[\s\S]*?font-family:\s*var\(--ce-font-body\);[\s\S]*?color:\s*rgba\(14,\s*20,\s*39,\s*0\.5\);/);
    expect(scss).toMatch(/\.featureLabel\s*{[\s\S]*?font-size:\s*clamp\(1\.08rem,\s*1\.6vw,\s*1\.22rem\);[\s\S]*?font-weight:\s*700;/);
    expect(scss).toMatch(/\.featureItem\s*{[\s\S]*?border-radius:\s*16px;[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.05\);/);
    expect(scss).toMatch(/\.featureStatusComplete\s*{[\s\S]*?text-transform:\s*uppercase;/);
    expect(scss).toMatch(/\.heroPrimaryButton\s*{[\s\S]*?font-size:\s*1\.14rem;[\s\S]*?font-weight:\s*700;/);
  });

  it('keeps mobile recognition rows aligned and stacks the use-case grid on small screens', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'AboutPage.module.scss'), 'utf8');

    expect(scss).toMatch(/@media \(max-width:\s*640px\)\s*{[\s\S]*?\.useCaseGrid\s*{[\s\S]*?grid-template-columns:\s*1fr;/);
    expect(scss).toMatch(/@media \(max-width:\s*640px\)\s*{[\s\S]*?\.useCaseDetailRow\s*{[\s\S]*?flex-direction:\s*column;/);
    expect(scss).toMatch(/@media \(max-width:\s*640px\)\s*{[\s\S]*?\.recognitionItem\s*{[\s\S]*?grid-template-columns:\s*46px minmax\(0,\s*1fr\);/);
    expect(scss).toMatch(/\.recognitionModalLogo\.recognitionLogoRxc\s*{[\s\S]*?background:\s*linear-gradient/);
  });
});
