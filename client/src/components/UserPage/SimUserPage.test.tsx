import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import SimUserPage from './SimUserPage';
import historicalFigures from '../../variables/demo/historical_figure_users.json';

type TestSimQuestion = {
  question: string;
  questionType: string;
  answer: {
    value?: unknown;
  };
};

type TestHistoricalFigure = {
  name: string;
  username: string;
  questions: TestSimQuestion[];
  biggestHope: string;
};

type MockSingleQuestionResponseProps = {
  mode?: string;
  question?: {
    prompt?: string;
    type?: string;
  };
  response?: {
    answer?: {
      value?: unknown;
    };
  };
};

const historicalFiguresData = historicalFigures as TestHistoricalFigure[];

jest.mock('../SurveyTool/SingleQuestionResponse', () => (props: MockSingleQuestionResponseProps) => {
  const rawValue = props?.response?.answer?.value;
  const answerText = Array.isArray(rawValue) ? rawValue.join(' | ') : String(rawValue ?? '');

  return (
    <div data-testid="sim-question-card" data-mode={props.mode} data-type={props.question?.type || ''}>
      <span>{props.question?.prompt}</span>
      <span>{answerText}</span>
    </div>
  );
});

describe('SimUserPage', () => {
  const mockCanvasAvatar = (value = 'data:image/png;base64,mock-blockie') => {
    const nativeCreateElement = document.createElement.bind(document) as (
      tagName: string,
      options?: ElementCreationOptions,
    ) => HTMLElement;
    const getContext = jest.fn(() => ({ fillStyle: '', fillRect: jest.fn() }));
    const toDataURL = jest.fn(() => value);
    const createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string, options?: ElementCreationOptions) => {
        if (tagName === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext,
            toDataURL,
          } as unknown as HTMLCanvasElement;
        }
        return nativeCreateElement(tagName, options);
      });

    return { createElementSpy, getContext, toDataURL };
  };

  it('renders simulated question responses through the shared response-card presentation', async () => {
    const figure = historicalFiguresData.find((entry) => entry.username === 'Franklin');
    if (!figure) throw new Error('Franklin test fixture is missing');
    const firstBinary = figure.questions.find((entry) => entry.questionType === 'binary');
    const firstFreeform = figure.questions.find((entry) => entry.questionType === 'freeform');

    render(<SimUserPage simUsername="Franklin" />);

    expect(await screen.findByRole('heading', { name: 'Question Responses' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Summarized Advice' })).toBeInTheDocument();

    const responseCards = screen.getAllByTestId('sim-question-card');
    expect(responseCards).toHaveLength(figure.questions.length);
    expect(responseCards[0]).toHaveAttribute('data-mode', 'mini');
    expect(responseCards[0]).toHaveAttribute('data-type', figure.questions[0].questionType);

    expect(screen.getByText(figure.questions[0].question)).toBeInTheDocument();
    expect(screen.getAllByText(String(firstBinary?.answer.value)).length).toBeGreaterThan(0);
    expect(
      screen.getByText((content: string) => content.includes(String(firstFreeform?.answer.value).substring(0, 40))),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Question 1$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Binary$/i)).not.toBeInTheDocument();
    expect(screen.getByText(figure.biggestHope)).toBeInTheDocument();
    expect(screen.getByAltText(figure.name).getAttribute('src')).toMatch(
      /^(\/historical-avatars\/|https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/)/,
    );
  });

  it('prepends PUBLIC_URL when building atlas links', async () => {
    const previousPublicUrl = process.env.PUBLIC_URL;
    const mutableEnv = process.env as Record<string, string | undefined>;
    mutableEnv.PUBLIC_URL = '/ce/';
    const priorUrl = window.location.href;
    try {
      window.history.replaceState({}, '', '/ce/su/Franklin?tab=atlas#positions');
      render(<SimUserPage simUsername="Franklin" />);

      const atlasLinks = await screen.findAllByRole('link', { name: /Open .* in the atlas/i });
      const atlasLink = atlasLinks[0];
      expect(atlasLink.getAttribute('href')).toMatch(
        /^\/ce\/atlas\/.+\?demo=1&returnTo=%2Fce%2Fsu%2FFranklin%3Ftab%3Datlas%23positions$/,
      );

      const profileLinks = (await screen.findAllByRole('link')).filter((link) =>
        /^\/ce\/su\//.test(link.getAttribute('href') || ''),
      );
      expect(profileLinks.length).toBeGreaterThan(0);
    } finally {
      window.history.replaceState({}, '', priorUrl);
      if (previousPublicUrl === undefined) delete mutableEnv.PUBLIC_URL;
      else mutableEnv.PUBLIC_URL = previousPublicUrl;
    }
  });

  it('falls back to a blockie when a historical photo fails to load', async () => {
    const { createElementSpy, getContext, toDataURL } = mockCanvasAvatar('data:image/png;base64,fallback-blockie');

    try {
      render(<SimUserPage simUsername="Franklin" />);

      const avatar = await screen.findByAltText('Benjamin Franklin');
      fireEvent.error(avatar);

      expect(avatar).toHaveAttribute('src', 'data:image/png;base64,fallback-blockie');
      expect(getContext).toHaveBeenCalledWith('2d');
      expect(toDataURL).toHaveBeenCalledWith('image/png');
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it('keeps the simulated-user page on the UserPage contrast palette', () => {
    const scssPath = path.join(__dirname, 'SimUserPage.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(/@extend \.userPage;/);
    expect(scss).toMatch(/\$accent:\s*(#4dffa4|tokens\.\$ce-clickable);/);
    expect(scss).toMatch(/\$panel-bg:\s*(rgba\(255,\s*255,\s*255,\s*0\.06\)|tokens\.\$ce-card-bg);/);
    expect(scss).not.toMatch(/\.questionTypeBadge\s*{/);
    expect(scss).toMatch(/\.highlightedText\s*{[^}]*color:\s*\$body-text;/);
    expect(scss).not.toMatch(/\.highlightedText\s*{[^}]*color:\s*var\(--ce-color-accent\);/);
  });
});
