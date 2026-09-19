import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { TestMemoryRouter as MemoryRouter } from 'testUtils/TestMemoryRouter';
import { normalizeScssContract } from 'testUtils/scssContractAssertions';

import AboutPage, { getAboutDemoSessionPath, getConfiguredRecognitionIndividuals } from './AboutPage';

const mutableEnv = process.env as Record<string, string | undefined>;
const ORIGINAL_PUBLIC_URL = process.env.PUBLIC_URL;
const ABOUT_DEMO_VIDEO_MEDIA_URL = '/about-demo.mp4';

beforeEach(() => {
  if (typeof ORIGINAL_PUBLIC_URL === 'undefined') {
    delete mutableEnv.PUBLIC_URL;
  } else {
    mutableEnv.PUBLIC_URL = ORIGINAL_PUBLIC_URL;
  }
  window.localStorage.clear();
});

const renderAboutPage = () =>
  render(
    <MemoryRouter>
      <AboutPage />
    </MemoryRouter>,
  );

describe('AboutPage', () => {
  it('only offers Uses for medium layouts with categories below the initial viewport', () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    const rect = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ bottom: 900 } as DOMRect);
    const resize = (width: number, height: number) => act(() => {
      window.innerWidth = width;
      window.innerHeight = height;
      window.dispatchEvent(new Event('resize'));
    });
    try {
      window.innerWidth = 754;
      window.innerHeight = 803;
      renderAboutPage();
      const categories = screen.getByTestId('ce-about-use-cases');
      const scrollIntoView = jest.fn();
      categories.scrollIntoView = scrollIntoView;
      fireEvent.click(screen.getByRole('button', { name: 'Uses', exact: true }));
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      resize(754, 1000);
      expect(screen.queryByRole('button', { name: 'Uses', exact: true })).not.toBeInTheDocument();
      resize(474, 803);
      expect(screen.queryByRole('button', { name: 'Uses', exact: true })).not.toBeInTheDocument();
      resize(1280, 803);
      expect(screen.queryByRole('button', { name: 'Uses', exact: true })).not.toBeInTheDocument();
      resize(754, 803);
      expect(screen.getByRole('button', { name: 'Uses', exact: true })).toBeVisible();
    } finally {
      rect.mockRestore();
      window.innerWidth = originalWidth;
      window.innerHeight = originalHeight;
    }
  });
  it('briefly reveals title-link labels on hover, keyboard focus, and press', () => {
    jest.useFakeTimers();
    try {
      const { unmount } = renderAboutPage();
      const github = screen.getByTestId('ce-about-link-github');
      const mail = screen.getByTestId('ce-about-link-email');
      const whitepaper = screen.getByTestId('ce-about-link-whitepaper');
      fireEvent.mouseEnter(github);
      expect(github).toHaveAttribute('data-label-visible', 'true');
      act(() => jest.advanceTimersByTime(600));
      fireEvent.focus(mail);
      expect(github).toHaveAttribute('data-label-visible', 'false');
      expect(mail).toHaveAttribute('data-label-visible', 'true');
      act(() => jest.advanceTimersByTime(600));
      expect(mail).toHaveAttribute('data-label-visible', 'true');
      fireEvent.pointerDown(whitepaper, { pointerType: 'touch' });
      expect(mail).toHaveAttribute('data-label-visible', 'false');
      expect(whitepaper).toHaveAttribute('data-label-visible', 'true');
      act(() => jest.advanceTimersByTime(1000));
      expect(whitepaper).toHaveAttribute('data-label-visible', 'false');
      fireEvent.mouseEnter(github);
      unmount();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('renders the hero with the expected primary and external links', () => {
    renderAboutPage();

    const hero = screen.getByTestId('ce-about-hero');
    const demoLink = within(hero).getByRole('link', { name: /^Demo$/i });
    const newSessionLink = within(hero).getByRole('link', { name: /New Session/i });
    const desktopDemoVideo = within(hero).getByTestId('ce-about-demo-video-desktop');
    const mobileDemoVideo = within(hero).getByTestId('ce-about-demo-video-mobile');
    const mobileVideoPlayer = within(hero).getByTestId('ce-about-demo-video-player');

    expect(hero).toBeInTheDocument();
    expect(
      within(hero).getByText(
        'An open toolkit for deliberation, decision-making, and negotiation (for humans and AI agents)',
      ),
    ).toBeVisible();
    expect(demoLink).toHaveAttribute('href', getAboutDemoSessionPath());
    expect(newSessionLink).toHaveAttribute('href', '/new');
    expect(within(hero).getByTestId('ce-about-link-whitepaper')).toBeVisible();
    expect(within(hero).getByTestId('ce-about-link-whitepaper')).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine/blob/main/whitepaper/whitepaper.md',
    );
    const titleRow = within(screen.getByTestId('ce-about-title-row'));
    expect(titleRow.getByRole('link', { name: 'Whitepaper' })).toBeVisible();
    expect(titleRow.getByRole('link', { name: 'Email Context Engine' })).toBeVisible();
    expect(titleRow.getByRole('link', { name: /GitHub/ })).toBeVisible();
    expect(within(hero).queryByText(/^Email$/)).not.toBeInTheDocument();
    expect(within(hero).queryByRole('link', { name: /^Posts$/i })).not.toBeInTheDocument();
    expect(within(hero).queryByTestId('ce-about-link-posts')).not.toBeInTheDocument();
    expect(within(hero).getByLabelText(/view context engine on github/i)).toBeVisible();
    expect(within(hero).getByTestId('ce-about-link-github')).toHaveAttribute(
      'href',
      'https://github.com/AgalmicSoftware/context-engine',
    );
    expect(within(hero).queryByTestId('ce-about-link-contributing')).not.toBeInTheDocument();
    expect(within(hero).queryByTestId('ce-about-link-license')).not.toBeInTheDocument();
    expect(within(hero).queryByTestId('ce-about-link-slides')).not.toBeInTheDocument();
    expect(within(hero).getByRole('link', { name: /Email/i })).toHaveAttribute(
      'href',
      'mailto:contextengine@protonmail.com',
    );
    expect(desktopDemoVideo.tagName.toLowerCase()).toBe('video');
    expect(desktopDemoVideo).toHaveAttribute('controls');
    expect(desktopDemoVideo).toHaveAttribute('playsinline');
    expect(desktopDemoVideo).toHaveAttribute('preload', 'metadata');
    expect(desktopDemoVideo).toHaveAttribute('src', ABOUT_DEMO_VIDEO_MEDIA_URL);
    expect(desktopDemoVideo).toHaveAccessibleName('Context Engine demo video player');
    expect(mobileDemoVideo).toBeInTheDocument();
    expect(mobileVideoPlayer.tagName.toLowerCase()).toBe('video');
    expect(mobileVideoPlayer).toHaveAttribute('controls');
    expect(mobileVideoPlayer).toHaveAttribute('playsinline');
    expect(mobileVideoPlayer).toHaveAttribute('preload', 'none');
    expect(mobileVideoPlayer).not.toHaveAttribute('poster');
    expect(mobileVideoPlayer).toHaveAttribute('src', ABOUT_DEMO_VIDEO_MEDIA_URL);
    expect(hero.querySelectorAll('iframe')).toHaveLength(0);
    expect(hero.querySelectorAll('[src*="drive.google.com"]')).toHaveLength(0);
    expect(within(hero).getByRole('button', { name: /play context engine demo video/i })).toBeInTheDocument();
    expect(within(hero).queryByTestId('ce-about-demo-video-open')).not.toBeInTheDocument();
  });

  it('starts the mobile demo video inline without opening a modal', async () => {
    const loadMock = jest.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    const playMock = jest.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();

    try {
      renderAboutPage();

      const hero = screen.getByTestId('ce-about-hero');
      const videoPlayer = within(hero).getByTestId('ce-about-demo-video-player');
      const inlinePlayButton = within(hero).getByRole('button', { name: /play context engine demo video/i });

      expect(videoPlayer.tagName.toLowerCase()).toBe('video');
      expect(videoPlayer).toHaveAttribute('controls');
      expect(videoPlayer).toHaveAttribute('playsinline');
      expect(videoPlayer).toHaveAttribute('preload', 'none');
      expect(videoPlayer).not.toHaveAttribute('poster');
      expect(videoPlayer).toHaveAttribute('src', ABOUT_DEMO_VIDEO_MEDIA_URL);
      expect(inlinePlayButton).toBeVisible();
      expect(within(hero).queryByTestId('ce-about-demo-video-drive-link')).not.toBeInTheDocument();
      expect(within(hero).queryByRole('link', { name: /google drive/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      fireEvent.click(inlinePlayButton);

      await waitFor(() => {
        expect(loadMock).toHaveBeenCalledTimes(1);
        expect(playMock).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(within(hero).queryByRole('button', { name: /play context engine demo video/i })).not.toBeInTheDocument();
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    } finally {
      playMock.mockRestore();
      loadMock.mockRestore();
    }
  });

  it('uses the first concrete list-scoped session for the demo CTA when list scope is active', () => {
    window.localStorage.setItem('ce:selectedSessionScope', 'list');
    window.localStorage.setItem('ce:selectedSessionSlugs', JSON.stringify(['general', 'edge', 'rxc']));

    renderAboutPage();

    expect(screen.getByRole('link', { name: /^Demo$/i })).toHaveAttribute('href', '/session/edge');
  });

  it('prepends PUBLIC_URL to the new-session CTA for subpath deployments', () => {
    mutableEnv.PUBLIC_URL = '/ce/';

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
      screen.getByText(/public ai discourse gets flattened into slogans like "accelerate" vs\. "pause,"/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/create a structured public map of ai questions, preferences, and predictions in durable form/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/how ce helps/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-about-usecase-ai-discourse')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('ce-about-usecase-corporate'));

    expect(screen.queryByText(/durable public map/i)).not.toBeInTheDocument();
    expect(within(screen.getByRole('article')).getByText(/^for companies$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/record predictions, assumptions, and confidence before outcomes are known/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId('ce-about-usecase-corporate')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('ce-about-usecase-ai-discourse')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByTestId('ce-about-usecase-cities'));

    expect(
      screen.getByText(/gather input that is more nuanced than a poll and more durable than a hearing/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-about-usecase-conferences'));

    expect(
      screen.getByText(/leave with a durable map of consensus, subgroup differences, and unresolved questions/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-about-usecase-digital-groups'));

    expect(
      screen.getByText(
        /train representative ai models, and keep community data attributable, licensable, and revocable/i,
      ),
    ).toBeInTheDocument();
  });

  it('scrolls the selected use-case detail into view on compact screens', async () => {
    const originalInnerWidth = window.innerWidth;
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    const scrollIntoViewMock = jest.fn();

    try {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: 480,
      });
      window.requestAnimationFrame = (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      };
      window.cancelAnimationFrame = jest.fn();
      Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: scrollIntoViewMock,
      });

      renderAboutPage();

      fireEvent.click(screen.getByTestId('ce-about-usecase-cities'));

      await waitFor(() => {
        expect(scrollIntoViewMock).toHaveBeenCalledWith({
          behavior: 'smooth',
          block: 'start',
        });
      });
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalInnerWidth,
      });
      window.requestAnimationFrame = originalRequestAnimationFrame;
      window.cancelAnimationFrame = originalCancelAnimationFrame;
      if (typeof originalScrollIntoView === 'function') {
        Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
          configurable: true,
          value: originalScrollIntoView,
        });
      } else {
        delete (window.HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
      }
    }
  });

  it('renders the live roadmap foundations and specific planned capabilities', () => {
    renderAboutPage();
    const roadmapToggle = screen.getByRole('button', { name: /roadmap/i });
    expect(roadmapToggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(roadmapToggle);
    expect(roadmapToggle).toHaveAttribute('aria-expanded', 'true');
    const foundations = screen.getByRole('heading', { name: 'Current Foundations' }).closest('li')!;
    expect(within(foundations).getAllByText('Complete:')).toHaveLength(6);
    expect(screen.getAllByText('Planned:')).toHaveLength(14);
    expect(screen.getByText(/unlinkable per-response and per-SBT accounts, ZK\/FHE aggregation/)).toBeVisible();
    expect(screen.getByText(/affiliation proofs, encrypted claims, and conditional timelocks/)).toBeVisible();
    expect(screen.getByText(/Turnkey deployment bundles for Arweave, Lit, EVM gas, and AI API access/)).toBeVisible();
    expect(screen.getByText(/Group prompting and backcasting from result clusters/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Interfaces and Inputs' })).toBeVisible();
    fireEvent.keyDown(roadmapToggle, { key: 'Enter' });
    expect(screen.queryByRole('heading', { name: 'Current Foundations' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /functionality/i }));
    expect(screen.getByRole('link', { name: 'SBT groups' })).toHaveAttribute('href', '/groups');
    expect(screen.getByText(/Stores responses and documents in Cloudflare or on Arweave/)).toBeVisible();
  });

  it('links related research and documented uses and includes the media entry', () => {
    renderAboutPage();
    fireEvent.click(screen.getByRole('button', { name: 'Related Work' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recognition' }));
    const related = within(screen.getByTestId('ce-about-related-work'));
    expect(related.getByRole('link', { name: 'AI Opinions Benchmark' })).toHaveAttribute('href', '/benchmarks');
    expect(related.getByRole('link', { name: 'The Agent Mirror Test' })).toHaveAttribute('href', '/posts/agent-village-wrapped');
    expect(related.getByRole('heading', { name: 'Ladders Made of Numbers' })).toBeVisible();
    expect(related.getByRole('link', { name: 'CommonGround · Prime Intellect' })).toHaveAttribute(
      'href', 'https://app.primeintellect.ai/dashboard/environments',
    );
    const practice = within(screen.getByTestId('ce-about-used-by'));
    expect(practice.getByRole('link', { name: 'Cosmos × FIRE grants' })).toHaveAttribute(
      'href', 'https://blog.cosmos-institute.org/p/announcing-80-new-cosmos-grantees',
    );
    expect(practice.getByText(/Context Engine was selected for a Cosmos × FIRE/)).toBeVisible();
    expect(practice.getByRole('link', { name: 'Foresight Institute grant · 2026' })).toHaveAttribute(
      'href', 'https://foresight.org/grants/ai-science-safety-nodes-rfp/',
    );
    expect(practice.getByText(/Context Engine received a grant through Foresight Institute/)).toBeVisible();
    expect(practice.getByRole('link', { name: 'Agent Village 2026' })).toHaveAttribute('href', '/posts/agent-village-wrapped');
    expect(practice.getByRole('link', { name: 'EDDY 2026 demo' })).toHaveAttribute(
      'href', 'https://www.eddy-network.eu/in-person-events/eddy-2026-vienna/program',
    );
    expect(practice.getByRole('link', { name: /d\/acc residency/ })).toHaveAttribute(
      'href', 'https://www.edgecity.live/blog/the-d-acc-residency-at-edge-city-patagonia-2025',
    );
    const artwork = practice.getAllByRole('presentation', { hidden: true });
    expect(artwork).toHaveLength(6);
    artwork.forEach((img) => fireEvent.error(img));
    expect(practice.queryAllByRole('presentation', { hidden: true })).toHaveLength(0);
    expect(practice.getAllByRole('link')).toHaveLength(5);
    expect(screen.queryByRole('heading', { name: /^Media$/ })).not.toBeInTheDocument();
  });

  it('expands the new sections independently with mouse and keyboard controls', () => {
    renderAboutPage();
    const related = screen.getByRole('button', { name: 'Related Work' });
    const practice = screen.getByRole('button', { name: 'Recognition' });
    expect(related).toHaveAttribute('aria-expanded', 'false');
    expect(practice).toHaveAttribute('aria-expanded', 'false');
    const preview = screen.getByTestId('ce-about-related-summary');
    ['benchmark', 'eval', 'media'].forEach((category) => expect(within(preview).getByText(category)).toBeVisible());
    expect(screen.getByTestId('ce-about-practice-summary')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'AI Opinions Benchmark' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Cosmos × FIRE grants' })).not.toBeInTheDocument();

    fireEvent.click(related);
    expect(related).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByTestId('ce-about-related-summary')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AI Opinions Benchmark' })).toBeVisible();
    expect(practice).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(practice, { key: 'Enter' });
    expect(practice).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByTestId('ce-about-practice-summary')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cosmos × FIRE grants' })).toBeVisible();
    fireEvent.keyDown(related, { key: ' ' });
    expect(related).toHaveAttribute('aria-expanded', 'false');
    expect(practice).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(practice);
    expect(screen.queryByRole('link', { name: 'Cosmos × FIRE grants' })).not.toBeInTheDocument();
  });

  it('keeps the recognition section visible without rendering empty individuals content', () => {
    renderAboutPage();

    const recognitionSection = screen.getByTestId('ce-about-in-practice');
    const recognitionToggle = within(recognitionSection).getByRole('button', { name: /^recognition$/i });

    expect(recognitionSection).toBeInTheDocument();
    expect(recognitionToggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(recognitionSection).getByTestId('ce-about-practice-summary')).toBeInTheDocument();
    fireEvent.click(recognitionToggle);
    expect(recognitionToggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(recognitionSection).getByRole('heading', { name: 'Recognized & Used By' })).toBeVisible();
    expect(within(recognitionSection).getByRole('heading', { name: 'Acknowledgements' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Acknowledgements' })).not.toBeInTheDocument();
    expect(screen.getByTestId('ce-about-recognition-radicalxchange')).toBeInTheDocument();
    expect(screen.queryByTestId('ce-about-recognition-individuals')).not.toBeInTheDocument();
    expect(screen.queryByText(/No recognized individuals yet/i)).not.toBeInTheDocument();

    fireEvent.click(recognitionToggle);

    expect(recognitionToggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(recognitionSection).getByTestId('ce-about-practice-summary')).toBeInTheDocument();
    expect(screen.queryByTestId('ce-about-recognition-radicalxchange')).not.toBeInTheDocument();
  });

  it('keeps every collapsible section header frameless', () => {
    renderAboutPage();

    ['Functionality', 'Roadmap', 'Related Work', 'Recognition'].forEach((name) => {
      expect(screen.getByRole('button', { name })).toHaveAttribute('data-ce-control-appearance', 'frameless');
    });
  });

  it('only treats named recognition individuals as renderable configuration', () => {
    expect(getConfiguredRecognitionIndividuals()).toEqual([]);
    expect(
      getConfiguredRecognitionIndividuals([
        null,
        {},
        { name: '   ' },
        { name: 'Audrey Tang', url: 'https://example.com/audrey' },
      ]),
    ).toEqual([{ name: 'Audrey Tang', url: 'https://example.com/audrey' }]);
  });

  it('uses the configured public demo route when list scope has no concrete session slug', () => {
    expect(
      getAboutDemoSessionPath({
        selectedSessionScope: 'list',
        selectedSessionSlugs: ['general'],
      } as any),
    ).toBe('/session/demo-sh');
  });

  it.each([
    ['ethereum', /^Ethereum is an open, decentralized network/, /^Context Engine uses Ethereum-compatible accounts/],
    ['radicalxchange', /^RadicalxChange is a movement/, /^Context Engine draws on these ideas/],
    ['pol-is', /^Pol.is is an open-source tool/, /^Context Engine builds on this approach/],
    ['collective-intelligence-project', /^The Collective Intelligence Project studies/, /^Context Engine shares this focus/],
    ['edge-city', /^Edge City brings people together/, /^Context Engine was developed and tested/],
  ])(
    'introduces %s before explaining its connection to Context Engine',
    async (slug: string, introduction: RegExp, relationship: RegExp) => {
      renderAboutPage();
      fireEvent.click(screen.getByRole('button', { name: 'Recognition' }));
      fireEvent.click(screen.getByTestId(`ce-about-recognition-${slug}`));
      const dialog = screen.getByRole('dialog');
      const first = within(dialog).getByText(introduction);
      const second = within(dialog).getByText(relationship);
      expect(first.tagName).toBe('P');
      expect(second.tagName).toBe('P');
      expect(first.nextElementSibling).toBe(second);
      if (slug === 'edge-city') {
        expect(first).toHaveTextContent('pop-up communities');
        expect(second).toHaveTextContent('(Sponsored by Protocol Labs).');
        expect(second).not.toHaveTextContent('Feedback');
        expect(within(dialog).getByRole('link', { name: 'Residency blog post' })).toHaveAttribute('href', 'https://www.edgecity.live/blog/the-d-acc-residency-at-edge-city-patagonia-2025');
      }
      fireEvent.click(within(dialog).getByRole('button', { name: /close acknowledgement details/i }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    },
  );

  it('uses large muted OnePageSession-style section headings on the about page', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'AboutPage.module.scss'), 'utf8');
    const normalizedScss = normalizeScssContract(scss);

    expect(scss).toMatch(
      /\.sectionTitle\s*{[\s\S]*?font-family:\s*var\(--ce-font-body\);[\s\S]*?font-size:\s*clamp\(1\.6rem,\s*4vw,\s*2\.1rem\);[\s\S]*?color:\s*var\(--ce-panel-text-muted\);/,
    );
    expect(scss).not.toMatch(/&:hover\s+\.sectionTitle\s*{[\s\S]*?#4dffa4;/);
    expect(scss).toMatch(
      /\.useCaseLabel\s*{[\s\S]*?font-family:\s*var\(--ce-font-body\);[\s\S]*?color:\s*var\(--ce-control-text\);/,
    );
    expect(scss).toMatch(
      /\.featureLabel\s*{[\s\S]*?font-size:\s*clamp\(1\.08rem,\s*1\.6vw,\s*1\.22rem\);[\s\S]*?font-weight:\s*700;/,
    );
    expect(scss).toMatch(
      /\.featureItem\s*{[\s\S]*?border-radius:\s*var\(--ce-radius-16\);[\s\S]*?background:\s*\$card-bg;/,
    );
    expect(scss).toMatch(
      /\.roadmapChecklistItem\s*{[\s\S]*?grid-template-columns:\s*auto minmax\(0,\s*1fr\);[\s\S]*?font-size:\s*0\.98rem;/,
    );
    expect(normalizedScss).toMatch(
      /\.roadmapCheck\s*{[\s\S]*?border-radius:\s*var\(--ce-radius-pill\);[\s\S]*?content:\s*'\\2713';/,
    );
    expect(scss).toMatch(/\.roadmapChecklistItemPlanned\s*{[\s\S]*?color:\s*var\(--ce-panel-text-muted\);/);
    expect(scss).toMatch(/\.roadmapChecklistItemPlanned\s+\.roadmapCheck\s*{[\s\S]*?background:\s*transparent;/);
    expect(scss).toMatch(/\.heroPrimaryButton\s*{[\s\S]*?font-size:\s*1\.14rem;[\s\S]*?font-weight:\s*700;/);
  });

  it('keeps the About hero flush with the top of its page container', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'AboutPage.module.scss'), 'utf8');

    expect(scss).toMatch(/\.aboutPageContainer\s*{[\s\S]*?padding:\s*0 20px 56px;/);
    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)\s*{[\s\S]*?\.aboutPageContainer\s*{[\s\S]*?padding:\s*0 14px 40px;/,
    );
  });

  it('uses bundled Tahoma and distinct Windows 95 controls only for the desktop-window profile', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'AboutPage.module.scss'), 'utf8');

    expect(scss).toContain('@container ce-theme style(--ce-layout-profile: desktop-window)');
    expect(scss).toMatch(
      /@container ce-theme style\(--ce-layout-profile:\s*desktop-window\)\s*{[\s\S]*?\.aboutPageContainer\s*{[\s\S]*?font-family:\s*var\(--ce-font-body\);/,
    );
    expect(scss).toMatch(
      /@container ce-theme style\(--ce-layout-profile:\s*desktop-window\)\s*{[\s\S]*?\.recognitionModalTitle\s*{[\s\S]*?color:\s*var\(--ce-titlebar-text\);/,
    );
    expect(scss).toMatch(
      /@container ce-theme style\(--ce-layout-profile:\s*desktop-window\)\s*{[\s\S]*?\.heroPrimaryButton,\s*\.tertiaryLink,\s*\.titleRepoLink\s*{[\s\S]*?border:\s*2px solid;[\s\S]*?box-shadow:\s*var\(--ce-shadow-raised\);[\s\S]*?font-family:\s*var\(--ce-font-body\);/,
    );
    expect(scss).toMatch(/\.heroPrimaryButton\s*{[\s\S]*?min-width:\s*148px;[\s\S]*?min-height:\s*48px;/);
    expect(scss).toMatch(/\.tertiaryLink\s*{[\s\S]*?min-width:\s*108px;[\s\S]*?min-height:\s*34px;/);
    expect(scss).toMatch(
      /\.titleRepoLink\s*{[\s\S]*?width:\s*64px;[\s\S]*?height:\s*44px;[\s\S]*?background:\s*var\(--ce-control-face\);/,
    );
    expect(scss).toMatch(
      /\.heroPrimaryButton:active,[\s\S]*?\.tertiaryLink:active,[\s\S]*?\.titleRepoLink:active\s*{[\s\S]*?box-shadow:\s*var\(--ce-shadow-pressed\);/,
    );
  });

  it('keeps mobile recognition rows and section headers aligned', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'AboutPage.module.scss'), 'utf8');

    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)\s*{[\s\S]*?\.useCaseDetailRow\s*{[\s\S]*?flex-direction:\s*column;/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)\s*{[\s\S]*?\.toggleHeader\s*{[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?justify-content:\s*flex-start;/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)\s*{[\s\S]*?\.toggleHeaderAside\s*{[\s\S]*?display:\s*flex;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?margin-left:\s*0;/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)\s*{[\s\S]*?\.recognitionSummary\s*{[\s\S]*?display:\s*flex;[\s\S]*?flex:\s*0 1 auto;[\s\S]*?margin-top:\s*0;[\s\S]*?overflow:\s*hidden;/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)\s*{[\s\S]*?\.recognitionSummaryLogo \+ \.recognitionSummaryLogo\s*{[\s\S]*?margin-left:\s*-6px;/,
    );
    expect(scss).toMatch(
      /\.recognitionItem\s*{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)\s*{[\s\S]*?\.recognitionStrip\s*{[\s\S]*?flex-direction:\s*column;[\s\S]*?align-items:\s*stretch;/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)\s*{[\s\S]*?\.recognitionItem\s*{[\s\S]*?grid-template-columns:\s*46px minmax\(0,\s*1fr\);/,
    );
    expect(scss).toMatch(/\.recognitionModalLogo\.recognitionLogoRxc\s*{[\s\S]*?background:\s*linear-gradient/);
    expect(scss).toMatch(/\.mobileDemoVideo\s*{[\s\S]*?display:\s*none;/);
    expect(scss).toMatch(/\.mobileDemoVideoPlayer\s*{[\s\S]*?object-fit:\s*contain;/);
    expect(scss).toMatch(/\.mobileDemoVideoPlayButton\s*{[\s\S]*?touch-action:\s*manipulation;/);
    expect(scss).toMatch(/@media \(max-width:\s*1023px\)\s*{[\s\S]*?\.hero\s*{[\s\S]*?grid-template-columns:\s*1fr;/);
    expect(scss).toMatch(
      /@media \(max-width:\s*1023px\)\s*{[\s\S]*?\.heroVideo\s*{[\s\S]*?width:\s*min\(620px,\s*100%\);[\s\S]*?order:\s*-1;/,
    );
    expect(scss).toMatch(
      /@media \(min-width:\s*641px\) and \(max-width:\s*1023px\)\s*{[\s\S]*?\.mainTitle\s*{[\s\S]*?font-size:\s*clamp\(3rem,\s*7vw,\s*4\.4rem\);/,
    );
    expect(scss).toMatch(
      /@media \(min-width:\s*641px\) and \(max-width:\s*1023px\)\s*{[\s\S]*?\.tagline\s*{[\s\S]*?font-size:\s*1\.05rem;/,
    );
    expect(scss).toMatch(
      /@media \(min-width:\s*641px\) and \(max-width:\s*1023px\)\s*{[\s\S]*?\.heroPrimaryButton\s*{[\s\S]*?font-size:\s*1\.08rem;/,
    );
    expect(scss).toMatch(/@media \(max-width:\s*640px\)\s*{[\s\S]*?\.demoVideo\s*{[\s\S]*?display:\s*none;/);
    expect(scss).toMatch(/@media \(max-width:\s*640px\)\s*{[\s\S]*?\.mobileDemoVideo\s*{[\s\S]*?display:\s*grid;/);
    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)\s*{[\s\S]*?\.mobileDemoVideoPlayer\s*{[\s\S]*?min-height:\s*clamp\(220px,\s*62vw,\s*300px\);/,
    );
  });

  it('uses a theme-owned backing so classic recognition logos can remain transparent', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'AboutPage.module.scss'), 'utf8');
    const themeContract = fs.readFileSync(path.resolve(__dirname, '../../scss/themes/_contract.scss'), 'utf8');
    const contextTheme = fs.readFileSync(path.resolve(__dirname, '../../scss/themes/_context-engine.scss'), 'utf8');
    const classicTheme = fs.readFileSync(path.resolve(__dirname, '../../scss/themes/_classic-95.scss'), 'utf8');

    expect(scss).toMatch(
      /\.recognitionLogoEthereum,[\s\S]*?\.recognitionLogoEdge\s*{[\s\S]*?background:\s*color-mix\(in srgb, var\(--ce-recognition-logo-backing\) 96%, transparent\);[\s\S]*?border-color:\s*color-mix\(in srgb, var\(--ce-recognition-logo-border\) 24%, transparent\);/,
    );
    expect(scss).toMatch(
      /\.recognitionLogoPolis\s*{[\s\S]*?background:\s*color-mix\(in srgb, var\(--ce-recognition-logo-backing\) 98%, transparent\);/,
    );
    expect(themeContract).toContain('recognition-logo-backing,');
    expect(themeContract).toContain('recognition-logo-border,');
    expect(contextTheme).toContain('recognition-logo-backing: var(--ce-status-info-text),');
    expect(contextTheme).toContain('recognition-logo-border: var(--ce-status-info),');
    expect(classicTheme).toContain('recognition-logo-backing: transparent,');
    expect(classicTheme).toContain('recognition-logo-border: transparent,');
  });
});
