import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { MemoryRouter } from 'react-router-dom';

import AboutPage, {
  getAboutDemoSessionPath,
  getConfiguredRecognitionIndividuals,
} from './AboutPage.jsx';

beforeEach(() => {
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

    expect(hero).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore Demo/i })).toHaveAttribute(
      'href',
      getAboutDemoSessionPath()
    );
    expect(within(hero).getByTestId('ce-about-link-whitepaper')).toBeVisible();
    expect(within(hero).getByTestId('ce-about-link-whitepaper')).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/blob/main/Whitepaper/whitepaper.md'
    );
    expect(within(hero).getByTestId('ce-about-link-github')).toBeVisible();
    expect(within(hero).getByTestId('ce-about-link-github')).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine'
    );
    expect(within(hero).queryByTestId('ce-about-link-contributing')).not.toBeInTheDocument();
    expect(within(hero).queryByTestId('ce-about-link-license')).not.toBeInTheDocument();
    expect(within(hero).getByTestId('ce-about-link-slides')).toBeVisible();
    expect(within(hero).getByTestId('ce-about-link-slides')).toHaveAttribute(
      'href',
      'https://docs.google.com/presentation/d/1fFExDsGNpy13SE3TOw9ogasi5BcxXOQwKaXf96mBL-8/edit?usp=sharing'
    );
    expect(within(hero).getByRole('link', { name: /Email/i })).toHaveAttribute(
      'href',
      'mailto:contextengine@protonmail.com'
    );
  });

  it('uses the first concrete list-scoped session for the demo CTA when list scope is active', () => {
    window.localStorage.setItem('ce:selectedSessionScope', 'list');
    window.localStorage.setItem('ce:selectedSessionSlugs', JSON.stringify(['general', 'edge', 'rxc']));

    renderAboutPage();

    expect(screen.getByRole('link', { name: /Explore Demo/i })).toHaveAttribute('href', '/session/edge');
  });

  it('shows one use-case detail panel at a time', () => {
    renderAboutPage();

    expect(screen.queryByText(/structured public map of AI questions/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-about-usecase-ai-discourse'));

    expect(screen.getByText(/structured public map of AI questions/i)).toBeInTheDocument();
    expect(screen.getByTestId('ce-about-usecase-ai-discourse')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('ce-about-usecase-corporate'));

    expect(screen.queryByText(/structured public map of AI questions/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/make private predictions, retroactively recognize the strongest predictors/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('ce-about-usecase-corporate')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('ce-about-usecase-ai-discourse')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByTestId('ce-about-usecase-cities'));

    expect(
      screen.getByText(/more nuanced than a poll and more durable than a hearing/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-about-usecase-conferences'));

    expect(
      screen.getByText(/events, including conferences and pop-up cities/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-about-usecase-digital-groups'));

    expect(
      screen.getByText(/monetize tacit and local data in a privacy-preserving, attributable, and revocable way/i)
    ).toBeInTheDocument();
  });

  it('renames current functionalities and merges milestones plus future items into one roadmap toggle', () => {
    renderAboutPage();

    const currentToggle = screen.getByRole('button', { name: /current functionalities/i });
    const roadmapToggle = screen.getByRole('button', { name: /roadmap/i });

    expect(currentToggle).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /present functionalities/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^future$/i })).not.toBeInTheDocument();
    expect(
      screen.queryByText(/zero-knowledge proofs for encrypted predictions and retroactive evaluation/i)
    ).not.toBeInTheDocument();

    fireEvent.click(currentToggle);

    expect(
      screen.getByText(/create and publish sessions through the session wizard/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/sponsored-session links/i)).toBeInTheDocument();

    fireEvent.click(roadmapToggle);

    expect(screen.getByText(/stage 1: upgraded decentralized pol\.is/i)).toBeInTheDocument();
    expect(
      screen.getByText(/zero-knowledge proofs for encrypted predictions and retroactive evaluation/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/fhe for private computation on encrypted group data/i)).toBeInTheDocument();
    expect(screen.getByText(/privacy-preserving proof-of-unique-human filtering/i)).toBeInTheDocument();
    expect(
      screen.getByText(/ai agents that learn group preferences and represent communities in governance/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/data labor tools for groups to monetize preference data revokably/i)
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

  it('shows the updated RadicalxChange governance description in the recognition modal', async () => {
    renderAboutPage();

    fireEvent.click(screen.getByTestId('ce-about-recognition-radicalxchange'));

    const dialog = screen.getByRole('dialog');

    expect(
      screen.getByText(/quadratic voting, plural governance, and large-group coordination/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/auditable inputs for pluralist decision-making/i)
    ).toBeInTheDocument();
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
  });

  it('keeps mobile recognition rows aligned and stacks the use-case grid on small screens', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'AboutPage.module.scss'), 'utf8');

    expect(scss).toMatch(/@media \(max-width:\s*640px\)\s*{[\s\S]*?\.useCaseGrid\s*{[\s\S]*?grid-template-columns:\s*1fr;/);
    expect(scss).toMatch(/@media \(max-width:\s*640px\)\s*{[\s\S]*?\.recognitionItem\s*{[\s\S]*?grid-template-columns:\s*46px minmax\(0,\s*1fr\);/);
    expect(scss).toMatch(/\.recognitionModalLogo\.recognitionLogoRxc\s*{[\s\S]*?background:\s*linear-gradient/);
  });
});
