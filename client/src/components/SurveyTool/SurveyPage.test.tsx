import React from 'react';
import { render } from '@testing-library/react';
import SurveyPage from './SurveyPage';

const mockSurveyTool = jest.fn();

jest.mock('components/SurveyTool/SurveyTool', () => (props: any) => {
  mockSurveyTool(props);
  return null;
});

describe('SurveyPage session propagation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('falls back activeSessionSlug to sessionSlug for embedded pile mode', () => {
    render(
      <SurveyPage
        minifiedMode="pile"
        sessionSlug="edge"
        sessionConfig={{ slug: 'edge', sessionName: 'Edge Session' }}
      />,
    );

    expect(mockSurveyTool).toHaveBeenCalledTimes(1);
    expect(mockSurveyTool.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        activeSessionSlug: 'edge',
        sessionSlug: 'edge',
        sessionSlugPinned: false,
        sessionConfig: expect.objectContaining({
          slug: 'edge',
          sessionName: 'Edge Session',
        }),
      }),
    );
  });

  it('keeps the same active/session slug propagation for full SurveyTool renders', () => {
    const ensureLightSbtUniverse = jest.fn();

    render(
      <SurveyPage
        sessionSlug="alpha"
        sessionConfig={{ slug: 'alpha', sessionName: 'Alpha Session' }}
        ensureLightSbtUniverse={ensureLightSbtUniverse}
      />,
    );

    expect(mockSurveyTool).toHaveBeenCalledTimes(1);
    expect(mockSurveyTool.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        activeSessionSlug: 'alpha',
        sessionSlug: 'alpha',
        sessionSlugPinned: false,
        sessionConfig: expect.objectContaining({
          slug: 'alpha',
          sessionName: 'Alpha Session',
        }),
        ensureLightSbtUniverse,
      }),
    );
  });

  it('forwards fallback question pools to full SurveyTool renders', () => {
    const questionPool = [{ id: 'q1', prompt: 'Canonical demo question' }];

    render(
      <SurveyPage
        sessionSlug=""
        sessionConfig={{ slug: '', sessionName: 'Context Engine' }}
        questionPool={questionPool}
      />,
    );

    expect(mockSurveyTool).toHaveBeenCalledTimes(1);
    expect(mockSurveyTool.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        questionPool,
      }),
    );
  });

  it('forwards session network metadata into SurveyTool when provided by the route shell', () => {
    render(
      <SurveyPage
        activeSessionSlug="demo"
        sessionConfig={{ slug: 'demo', sessionName: 'Demo Session', networkChainId: 84532 }}
        contracts={{
          surveys: {
            address: '0x1111111111111111111111111111111111111111',
            chainId: 84532,
          },
        }}
        blockLimits={{ start: 12, end: 34 }}
        networkChainId={84532}
      />,
    );

    expect(mockSurveyTool).toHaveBeenCalledTimes(1);
    expect(mockSurveyTool.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        activeSessionSlug: 'demo',
        sessionSlug: 'demo',
        sessionConfig: expect.objectContaining({
          slug: 'demo',
          networkChainId: 84532,
        }),
        contracts: expect.objectContaining({
          surveys: expect.objectContaining({
            address: '0x1111111111111111111111111111111111111111',
            chainId: 84532,
          }),
        }),
        blockLimits: { start: 12, end: 34 },
        networkChainId: 84532,
      }),
    );
  });
});
