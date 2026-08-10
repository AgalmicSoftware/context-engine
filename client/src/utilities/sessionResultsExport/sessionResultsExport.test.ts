import {
  buildRedactedSessionResultsSnapshot,
  buildSessionResultsHtmlReportFilename,
  buildSessionResultsPdfReportFilename,
  downloadBrowserFile,
  downloadSessionResultsPdfReport,
  escapeHtml,
  renderSessionResultsHtmlReport,
  serializeJsonForHtmlScript,
} from './sessionResultsExport';
import {
  buildSessionResultsAnalysisAiPayload,
  buildSessionResultsAnalysisInputSignature,
  buildSessionResultsAnalysisPrompt,
  mergeGeneratedSessionResultsAnalysisArtifacts,
  normalizeGeneratedSessionResultsAnalysisArtifact,
} from './sessionResultsAnalysisArtifacts';

describe('sessionResultsExport utilities', () => {
  it('builds safe report filenames from session identifiers and timestamps', () => {
    expect(
      buildSessionResultsHtmlReportFilename({
        exportedAt: '2026-05-25T18:30:00.000Z',
        slug: '../Demo Session?<x>',
      }),
    ).toBe('contextEngine_sessionReport_Demo_Session_x_2026-05-25T18_30_00_000Z.html');
    expect(
      buildSessionResultsPdfReportFilename({
        exportedAt: '2026-05-25T18:30:00.000Z',
        slug: '../Demo Session?<x>',
      }),
    ).toBe('contextEngine_sessionReport_Demo_Session_x_2026-05-25T18_30_00_000Z.pdf');
  });

  it('escapes dynamic HTML text', () => {
    expect(escapeHtml(`Tom & "Jerry" <script>'`)).toBe('Tom &amp; &quot;Jerry&quot; &lt;script&gt;&#39;');
  });

  it('serializes JSON for inert script embedding without allowing script breakouts', () => {
    const serialized = serializeJsonForHtmlScript({
      prompt: '</script><img src=x onerror=alert(1)>',
      amp: '&',
    });

    expect(serialized).toContain('\\u003C/script\\u003E');
    expect(serialized).toContain('\\u003Cimg src=x onerror=alert(1)\\u003E');
    expect(serialized).toContain('\\u0026');
    expect(serialized).not.toContain('</script><img');
  });

  it('normalizes a redacted v1 snapshot and strips sensitive fields from sections and filters', () => {
    const snapshot = buildRedactedSessionResultsSnapshot({
      exportedAt: '2026-05-25T18:30:00.000Z',
      session: {
        slug: 'demo',
        name: 'Demo Session',
        chainId: 11155420,
        latestKnownBlock: 123,
        networkLabel: 'OP Sepolia',
      },
      exportedBy: {
        address: '0x9999999999999999999999999999999999999999',
        chainId: 11155420,
      },
      counts: {
        questions: 1,
        responses: 2,
        participants: 1,
      },
      filters: {
        note: 'owner 0x1111111111111111111111111111111111111111',
        walletAddress: '0xabc',
        tag: 'governance',
      },
      sections: {
        report: {
          dimensions: [
            {
              id: 'sbt_groups',
              label: 'SBT / Groups',
              values: [{ id: 'builders', label: 'Builders Guild', count: 1 }],
            },
          ],
          questions: [
            {
              id: 'q1',
              prompt: 'Should CE export HTML for 0x2222222222222222222222222222222222222222?',
              type: 'binary',
              tags: ['export'],
              options: ['Yes', 'No'],
              responseCount: 2,
              responder: '0xabc',
              answer: { value: 'Yes' },
            },
          ],
        },
        argumentMap: {
          debates: [
            {
              claim: 'Export helps audits for 0x3333333333333333333333333333333333333333',
              responderAddress: '0xdef',
              encryptedData: 'ciphertext',
            },
          ],
        },
      },
    });

    expect(snapshot.type).toBe('ce_session_results_html_snapshot');
    expect(snapshot.version).toBe(1);
    expect(snapshot.privacyMode).toBe('redacted');
    expect(snapshot.exportedBy).toEqual({
      address: '0x9999999999999999999999999999999999999999',
      chainId: 11155420,
      displayAddress: '0x9999...9999',
    });
    expect(snapshot.filters).toEqual({ note: 'owner [redacted-address]', tag: 'governance' });
    expect(snapshot.sections.report.available).toBe(true);
    expect(snapshot.sections.report.questions).toEqual([
      {
        id: 'q1',
        prompt: 'Should CE export HTML for [redacted-address]?',
        type: 'binary',
        tags: ['export'],
        options: ['Yes', 'No'],
        responseCount: 2,
      },
    ]);
    expect(snapshot.sections.argumentMap.debates).toEqual([{ claim: 'Export helps audits for [redacted-address]' }]);
    expect(snapshot.sections.riskMatrix.available).toBe(false);
    expect(snapshot.redactions).toEqual(
      expect.arrayContaining(['encrypted_payloads', 'raw_responses', 'wallet_addresses']),
    );
  });

  it('renders a self-contained HTML report with anchors, unavailable states, and safe embedded JSON', () => {
    const snapshot = buildRedactedSessionResultsSnapshot({
      exportedAt: '2026-05-25T18:30:00.000Z',
      session: {
        slug: 'demo',
        name: 'Unsafe </script><img src=x>',
        chainId: 11155420,
        networkLabel: 'OP Sepolia',
      },
      exportedBy: {
        address: '0x9999999999999999999999999999999999999999',
        chainId: 11155420,
      },
      counts: {
        questions: 1,
        responses: 1,
        participants: 1,
      },
      sections: {
        report: {
          dimensions: [
            {
              id: 'sbt_groups',
              label: 'SBT / Groups',
              values: [{ id: 'builders', label: 'Builders Guild', count: 1 }],
            },
          ],
          questions: [
            {
              id: 'q1',
              prompt: 'Prompt <b>unsafe</b>',
              type: 'freeform',
              responseCount: 1,
            },
          ],
        },
      },
    });

    const html = renderSessionResultsHtmlReport(snapshot);

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('href="#report"');
    expect(html).toContain('id="ce-session-results-snapshot"');
    expect(html).toContain('Download Snapshot JSON');
    expect(html).toContain('Downloaded by 0x9999...9999');
    expect(html).toContain('ce-report-integrity-warning');
    expect(html).toContain('Comparison Dimensions');
    expect(html).toContain('Builders Guild');
    expect(html).toContain('Argument Map');
    expect(html).toContain('No hydrated data was available');
    expect(html).toContain('Prompt &lt;b&gt;unsafe&lt;/b&gt;');
    expect(html).toContain('\\u003C/script\\u003E');
    expect(html).not.toContain('</script><img');
  });

  it('renders static selected-section HTML without viewer controls', () => {
    const snapshot = buildRedactedSessionResultsSnapshot({
      exportedAt: '2026-05-25T18:30:00.000Z',
      exportedBy: { address: '0x9999999999999999999999999999999999999999' },
      sections: {
        report: {
          questions: [{ id: 'q1', prompt: 'Only report?', responseCount: 1, type: 'binary' }],
        },
      },
    });

    const html = renderSessionResultsHtmlReport(snapshot, {
      format: 'single-html',
      sections: {
        argumentMap: false,
        atlas: false,
        report: true,
        riskMatrix: false,
        snapshotJson: false,
      },
    });

    expect(html).toContain('ce-report-static');
    expect(html).toContain('Only report?');
    expect(html).not.toContain('Download Snapshot JSON');
    expect(html).not.toContain('<h2>Argument Map</h2>');
    expect(html).not.toContain('<h2>Embedded Snapshot JSON</h2>');
  });

  it('keeps standalone HTML deterministic and fixed-light across session color scheme ids', () => {
    const build = (colorSchemeId: string) => {
      const snapshot = buildRedactedSessionResultsSnapshot({
        exportedAt: '2026-05-25T18:30:00.000Z',
        session: {
          slug: 'demo',
          name: 'Demo Session',
          appearance: { colorSchemeId },
        } as never,
        sections: {
          report: {
            questions: [{ id: 'q1', prompt: 'Same report?', responseCount: 1, type: 'binary' }],
          },
        },
      });
      return renderSessionResultsHtmlReport(snapshot, { format: 'single-html' });
    };

    const ocean = build('ocean');
    const amber = build('amber');
    expect(ocean).toBe(amber);
    expect(ocean).not.toContain('data-ce-session-color-scheme');
    expect(ocean).not.toContain('--ce-session-accent');
    expect(ocean).toContain('background: #f7f8fb');
  });

  it('builds AI payloads with synthetic participant IDs and normalizes generated artifacts', () => {
    const built = buildSessionResultsAnalysisAiPayload({
      questions: [
        {
          id: 'q1',
          prompt: 'How should reports work for 0x3333333333333333333333333333333333333333?',
          type: 'freeform',
        },
      ],
      responses: [
        {
          answer: 'Use a viewer for 0x1111111111111111111111111111111111111111',
          participantAddress: '0x1111111111111111111111111111111111111111',
          questionId: 'q1',
        },
        {
          answer: 'Make PDFs readable',
          participantAddress: '0x2222222222222222222222222222222222222222',
          questionId: 'q1',
        },
      ],
      segmentDimensions: [
        {
          id: 'sbt-groups',
          label: 'SBT / Groups',
          source: 'sbt',
          values: [
            { id: '0x9999999999999999999999999999999999999999', label: 'Builders Guild', count: 2 },
            {
              id: '0x8888888888888888888888888888888888888888',
              label: '0x8888888888888888888888888888888888888888',
              count: 1,
            },
          ],
        },
      ],
      session: { name: 'Demo', slug: 'demo' },
    });
    const prompt = buildSessionResultsAnalysisPrompt(built.aiPayload);
    const riskPrompt = buildSessionResultsAnalysisPrompt(built.aiPayload, 'riskMatrix');
    const inputSignature = buildSessionResultsAnalysisInputSignature(built.aiPayload);

    expect(built.aiPayload.responses).toEqual([
      expect.objectContaining({ answer: 'Use a viewer for [redacted-address]', participantId: 'participant_001' }),
      expect.objectContaining({ answer: 'Make PDFs readable', participantId: 'participant_002' }),
    ]);
    expect(built.aiPayload.questions[0].prompt).toContain('[redacted-address]');
    expect(built.aiPayload.segmentDimensions).toEqual([
      {
        id: 'sbt_groups',
        label: 'SBT / Groups',
        source: 'sbt',
        values: [{ id: 'sbt_groups_builders_guild', label: 'Builders Guild', count: 2 }],
      },
    ]);
    expect(built.participants).toEqual([
      expect.objectContaining({
        address: '0x1111111111111111111111111111111111111111',
        syntheticId: 'participant_001',
      }),
      expect.objectContaining({
        address: '0x2222222222222222222222222222222222222222',
        syntheticId: 'participant_002',
      }),
    ]);
    expect(prompt).toContain('participant_001');
    expect(prompt).toContain('segmentDimensions');
    expect(prompt).toContain('Builders Guild');
    expect(prompt).toContain('inputLimits');
    expect(riskPrompt).toContain('Generate only this result view: Risk Matrix');
    expect(riskPrompt).toContain('"riskMatrix"');
    expect(riskPrompt).not.toContain('"argumentMap"');
    expect(riskPrompt).not.toContain('"atlas"');
    expect(prompt).not.toContain('0x9999999999999999999999999999999999999999');
    expect(prompt).not.toContain('0x8888888888888888888888888888888888888888');
    expect(prompt).not.toContain('0x1111111111111111111111111111111111111111');
    expect(prompt).not.toContain('0x3333333333333333333333333333333333333333');
    expect(inputSignature).toMatch(/^session-results-analysis-v1-[0-9a-f]{8}-[0-9a-f]{8}$/);
    expect(inputSignature).not.toContain('Use a viewer');

    const artifact = normalizeGeneratedSessionResultsAnalysisArtifact({
      generatedAt: '2026-05-25T18:30:00.000Z',
      inputSignature: 'sig',
      participants: built.participants,
      rawOutput: JSON.stringify({
        breakdown: {
          summary: {
            overview: 'Address should not survive 0x4444444444444444444444444444444444444444',
            walletAddress: '0x5555555555555555555555555555555555555555',
          },
          dimensions: [
            {
              id: 'sbt_groups',
              label: 'SBT / Groups',
              values: [
                { id: 'builders_guild', label: 'Builders Guild 0x6666666666666666666666666666666666666666', count: 2 },
              ],
            },
          ],
        },
        argumentMap: { debates: [{ id: 'debate_1' }] },
        riskMatrix: { categories: [{ id: 'risk_1' }], comments: [{ id: 'c1' }] },
        atlas: { nodes: [{ id: 'atlas_1' }] },
      }),
    });

    expect(artifact.kind).toBe('ce_session_results_analysis_artifact');
    expect(artifact.sections.argumentMap.available).toBe(true);
    expect(artifact.sections.breakdown.dimensions).toEqual([
      expect.objectContaining({ id: 'sbt_groups', label: 'SBT / Groups' }),
    ]);
    expect(JSON.stringify(artifact.sections.breakdown)).toContain('[redacted-address]');
    expect(JSON.stringify(artifact.sections.breakdown)).not.toContain('0x4444444444444444444444444444444444444444');
    expect(JSON.stringify(artifact.sections.breakdown)).not.toContain('walletAddress');
    expect(artifact.sections.riskMatrix.available).toBe(true);
    expect(artifact.sections.atlas.available).toBe(true);
    expect(artifact.participants[0].address).toBe('0x1111111111111111111111111111111111111111');

    const partialRiskArtifact = normalizeGeneratedSessionResultsAnalysisArtifact({
      inputSignature: 'sig',
      participants: built.participants,
      rawOutput: JSON.stringify({
        riskMatrix: {
          categories: [{ id: 'risk_2', label: 'Export confusion' }],
          comments: [{ id: 'risk_comment_2' }],
        },
      }),
    });
    const merged = mergeGeneratedSessionResultsAnalysisArtifacts({
      base: artifact,
      next: partialRiskArtifact,
      sections: ['riskMatrix'],
    });
    expect(merged?.sections.breakdown.available).toBe(true);
    expect(merged?.sections.argumentMap.available).toBe(true);
    expect(merged?.sections.riskMatrix.categories).toEqual([{ id: 'risk_2', label: 'Export confusion' }]);
  });

  it('downloads browser files with object URLs and revokes them', () => {
    const originalCreateElement = document.createElement.bind(document);
    const anchor = originalCreateElement('a');
    const clickSpy = jest.spyOn(anchor, 'click').mockImplementation(() => {});
    const createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string) =>
        tagName.toLowerCase() === 'a' ? anchor : originalCreateElement(tagName)) as typeof document.createElement);
    const appendChildSpy = jest.spyOn(document.body, 'appendChild');
    const removeChildSpy = jest.spyOn(document.body, 'removeChild');
    const urlApi = {
      createObjectURL: jest.fn(() => 'blob:session-report'),
      revokeObjectURL: jest.fn(),
    };

    downloadBrowserFile({
      content: '<html></html>',
      filename: 'report.html',
      mimeType: 'text/html;charset=utf-8;',
      urlApi: urlApi as any,
    });

    expect(urlApi.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchor.getAttribute('href')).toBe('blob:session-report');
    expect(anchor.getAttribute('download')).toBe('report.html');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalledWith(anchor);
    expect(removeChildSpy).toHaveBeenCalledWith(anchor);
    expect(urlApi.revokeObjectURL).toHaveBeenCalledWith('blob:session-report');

    removeChildSpy.mockRestore();
    appendChildSpy.mockRestore();
    createElementSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it('paginates PDF exports instead of shrinking long reports onto one page', async () => {
    const canvas = {
      height: 2000,
      toDataURL: jest.fn(() => 'data:image/jpeg;base64,report'),
      width: 500,
    } as unknown as HTMLCanvasElement;
    const html2canvas = jest.fn(async () => canvas);
    const addImage = jest.fn();
    const addPage = jest.fn();
    const save = jest.fn();
    const JsPdf = jest.fn().mockImplementation(() => ({
      addImage,
      addPage,
      internal: {
        pageSize: {
          getHeight: () => 842,
          getWidth: () => 595,
        },
      },
      save,
    }));

    await downloadSessionResultsPdfReport({
      filename: 'report.pdf',
      html: '<!doctype html><html><body><main>Long report</main></body></html>',
      html2canvasLoader: async () => ({ default: html2canvas }),
      jsPdfLoader: async () => ({ jsPDF: JsPdf }),
    });

    expect(html2canvas).toHaveBeenCalledTimes(1);
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.82);
    expect(addImage).toHaveBeenCalledTimes(3);
    expect(addPage).toHaveBeenCalledTimes(2);
    expect(addImage.mock.calls.map((call) => call[3])).toEqual([0, -842, -1684]);
    expect(addImage.mock.calls[0]).toEqual(
      expect.arrayContaining(['data:image/jpeg;base64,report', 'JPEG', 0, 0, 595, 2380]),
    );
    expect(save).toHaveBeenCalledWith('report.pdf');
    expect(document.querySelector('iframe[title="Context Engine PDF export"]')).toBeNull();
  });
});
