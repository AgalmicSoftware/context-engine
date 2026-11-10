import {
  SESSION_RESULTS_EXPORT_FORMAT_PDF,
  type SessionResultsReportQuestion,
  buildSessionResultsSnapshot,
  buildSessionResultsHtmlReportFilename,
  buildSessionResultsPdfReportFilename,
  downloadBrowserFile,
  escapeHtml,
  renderSessionResultsHtmlReport,
  serializeJsonForHtmlScript,
} from './sessionResultsExport';
import { downloadSessionResultsPdfReport } from './sessionResultsPdfDownload';
import {
  buildSessionResultsAnalysisAiPayload,
  buildSessionResultsAnalysisInputSignature,
  buildSessionResultsAnalysisPrompt,
  mergeGeneratedSessionResultsAnalysisArtifacts,
  normalizeGeneratedSessionResultsAnalysisArtifact,
} from './sessionResultsAnalysisArtifacts';
import { buildResultsAnalysisPrompt } from '../../../../shared/resultsAnalysisPrompt.mjs';

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

  it('normalizes a v1 snapshot that keeps what the exporter can see and drops secrets and ciphertext', () => {
    const snapshot = buildSessionResultsSnapshot({
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
        apiKey: 'fixture-value',
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
              promptEncrypted: 'ciphertext',
            } as SessionResultsReportQuestion,
          ],
          answers: [
            {
              questionId: 'q1',
              responder: '0x1111111111111111111111111111111111111111',
              answer: 'Yes',
              comment: 'A note',
              conviction: 4,
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
    expect(snapshot.privacyMode).toBe('as-viewed');
    expect(snapshot.exportedBy).toEqual({
      address: '0x9999999999999999999999999999999999999999',
      chainId: 11155420,
      displayAddress: '0x9999999999999999999999999999999999999999',
    });
    expect(snapshot.filters).toEqual({
      note: 'owner 0x1111111111111111111111111111111111111111',
      walletAddress: '0xabc',
      tag: 'governance',
    });
    expect(snapshot.sections.report.available).toBe(true);
    expect(snapshot.sections.report.questions).toEqual([
      {
        id: 'q1',
        prompt: 'Should CE export HTML for 0x2222222222222222222222222222222222222222?',
        type: 'binary',
        tags: ['export'],
        options: ['Yes', 'No'],
        responseCount: 2,
      },
    ]);
    expect(snapshot.sections.report.answers).toEqual([
      {
        questionId: 'q1',
        responder: '0x1111111111111111111111111111111111111111',
        answer: 'Yes',
        comment: 'A note',
        conviction: 4,
      },
    ]);
    expect(snapshot.sections.argumentMap.debates).toEqual([
      { claim: 'Export helps audits for 0x3333333333333333333333333333333333333333', responderAddress: '0xdef' },
    ]);
    expect(snapshot.sections.riskMatrix.available).toBe(false);
    expect(snapshot.redactions).toEqual(['contact_handles', 'encrypted_payloads', 'secrets']);
  });

  describe('answers in the report', () => {
    const answers = Array.from({ length: 45 }, (_, index) => ({
      questionId: 'q1',
      responder: `0x${String(index).padStart(40, '0')}`,
      answer: `Answer <${index}>`,
      comment: index === 44 ? 'Note <b>' : '',
    }));
    const snapshot = buildSessionResultsSnapshot({
      exportedBy: { address: '0x9999999999999999999999999999999999999999' },
      sections: {
        report: {
          questions: [
            { id: 'Q1', prompt: 'First question', type: 'freeform', options: [], tags: [], responseCount: 45 },
          ],
          answers: [...answers, { questionId: 'gone', responder: '0xabc', answer: 'Kept', comment: '' }],
        },
      },
    });
    const sections = { argumentMap: false, atlas: false, riskMatrix: false, snapshotJson: false };

    it('lists them under each question, escaped, in the interactive and static reports', () => {
      const html = renderSessionResultsHtmlReport(snapshot, { sections });
      expect(html).toContain('<h3>Answers</h3>');
      expect(html).toContain('First question <span class="ce-report-muted">(45)</span>');
      expect(html).toContain('Answer &lt;44&gt;');
      expect(html).toContain('Note &lt;b&gt;');
      expect(html).toContain(answers[0].responder);
      expect(html).toContain('gone <span class="ce-report-muted">(1)</span>');
      expect(html.match(/<details/g)).toHaveLength(2);
      expect(html).not.toContain('<details open');
    });

    it('leaves them out when the Report section is not selected', () => {
      const html = renderSessionResultsHtmlReport(snapshot, { sections: { ...sections, report: false } });
      expect(html).not.toContain('Answer &lt;44&gt;');
      expect(html).not.toContain(answers[0].responder);
    });

    it('splits a PDF into blocks small enough to capture, with everything open', () => {
      const html = renderSessionResultsHtmlReport(snapshot, {
        format: SESSION_RESULTS_EXPORT_FORMAT_PDF,
        sections,
      });
      const page = new DOMParser().parseFromString(html, 'text/html');
      const blocks = Array.from(page.querySelectorAll('main > section'));
      // The overview, the question table, 45 answers in blocks of 16, and the question it no longer lists.
      expect(blocks).toHaveLength(6);
      expect(blocks[2].querySelector('h3')?.textContent).toBe('First question');
      expect(blocks[3].querySelector('h3')?.textContent).toBe('First question (continued)');
      blocks.slice(2, 5).forEach((block, index) => {
        expect(block.querySelectorAll('tbody tr')).toHaveLength(index === 2 ? 13 : 16);
      });
      expect(page.querySelectorAll('details:not([open])')).toHaveLength(0);
      // A capture stops at its block's edge, so nothing may be wider than the block: long text wraps in fixed columns.
      expect(page.querySelector('style')?.textContent).toContain('body.ce-report-pdf table { table-layout: fixed; }');
      expect(page.querySelector('style')?.textContent).toMatch(/body\.ce-report-pdf \{[^}]*overflow-wrap: anywhere/);
      expect(page.querySelector('main table.ce-report-questions')).not.toBeNull();
      // Scripts and the JSON copy add nothing to a capture of the page.
      expect(page.querySelectorAll('script')).toHaveLength(0);
    });

    it('still names the exporter in the header of a PDF', () => {
      const html = renderSessionResultsHtmlReport(snapshot, { format: SESSION_RESULTS_EXPORT_FORMAT_PDF, sections });
      const page = new DOMParser().parseFromString(html, 'text/html');
      expect(page.querySelector('header')?.textContent).toContain('0x9999999999999999999999999999999999999999');
    });
  });

  it('renders a self-contained HTML report with anchors, unavailable states, and safe embedded JSON', () => {
    const snapshot = buildSessionResultsSnapshot({
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
              options: [],
              prompt: 'Prompt <b>unsafe</b>',
              tags: [],
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
    expect(html).toContain('Downloaded by 0x9999999999999999999999999999999999999999');
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
    const snapshot = buildSessionResultsSnapshot({
      exportedAt: '2026-05-25T18:30:00.000Z',
      exportedBy: { address: '0x9999999999999999999999999999999999999999' },
      sections: {
        report: {
          questions: [{ id: 'q1', options: [], prompt: 'Only report?', responseCount: 1, tags: [], type: 'binary' }],
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

  it.each(['viewer', 'single-html'] as const)(
    'keeps excluded analysis out of all %s bytes and snapshot downloads',
    (format) => {
      const snapshot = buildSessionResultsSnapshot({
        exportedBy: { address: '0x9999999999999999999999999999999999999999' },
        sections: {
          report: {
            questions: [{ id: 'q1', prompt: 'REPORT_MARKER', options: [], responseCount: 2, tags: [], type: 'binary' }],
          },
          argumentMap: { debates: [{ claim: 'ARGUMENT_MARKER' }] },
          riskMatrix: { categories: [{ label: 'RISK_MARKER' }] },
          atlas: { nodes: [{ label: 'ATLAS_MARKER' }] },
        },
      });
      for (const snapshotJson of [false, true]) {
        const html = renderSessionResultsHtmlReport(snapshot, {
          format,
          sections: { report: true, argumentMap: false, riskMatrix: false, atlas: false, snapshotJson },
        });
        expect(html).toContain('REPORT_MARKER');
        for (const marker of ['ARGUMENT_MARKER', 'RISK_MARKER', 'ATLAS_MARKER']) expect(html).not.toContain(marker);
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const embedded = JSON.parse(parsed.getElementById('ce-session-results-snapshot')?.textContent || '{}');
        expect(Object.keys(embedded.sections)).toEqual(['report']);
        expect(parsed.querySelector('[data-ce-download-snapshot]') !== null).toBe(format === 'viewer' && snapshotJson);
      }
      const all = renderSessionResultsHtmlReport(snapshot, { format });
      for (const marker of ['REPORT_MARKER', 'ARGUMENT_MARKER', 'RISK_MARKER', 'ATLAS_MARKER'])
        expect(all).toContain(marker);
    },
  );

  it('downloads precisely the selected snapshot when Snapshot JSON is checked', async () => {
    const snapshot = buildSessionResultsSnapshot({
      exportedBy: { address: '0x9999999999999999999999999999999999999999' },
      sections: {
        report: { summary: { marker: 'REPORT_MARKER' } },
        argumentMap: { debates: [{ claim: 'EXCLUDED_MARKER' }] },
      },
    });
    const html = renderSessionResultsHtmlReport(snapshot, {
      sections: { report: true, argumentMap: false, riskMatrix: false, atlas: false, snapshotJson: true },
    });
    const page = new DOMParser().parseFromString(html, 'text/html');
    const script = page.querySelector('script:not([type])')?.textContent || '';
    const blobs: Blob[] = [];
    const url = {
      createObjectURL: (blob: Blob) => {
        blobs.push(blob);
        return 'blob:fixture';
      },
      revokeObjectURL: jest.fn(),
    };
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      new Function('document', 'URL', 'Blob', script)(page, url, Blob);
      (page.querySelector('[data-ce-download-snapshot]') as HTMLButtonElement).click();
      expect(blobs).toHaveLength(1);
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsText(blobs[0]);
      });
      expect(JSON.parse(text)).toEqual(
        JSON.parse(page.getElementById('ce-session-results-snapshot')?.textContent || '{}'),
      );
      expect(text).toContain('REPORT_MARKER');
      expect(text).not.toContain('EXCLUDED_MARKER');
      expect(url.revokeObjectURL).toHaveBeenCalledWith('blob:fixture');
    } finally {
      click.mockRestore();
    }
  });

  it('keeps standalone HTML deterministic and fixed-light across session color scheme ids', () => {
    const build = (colorSchemeId: string) => {
      const snapshot = buildSessionResultsSnapshot({
        exportedAt: '2026-05-25T18:30:00.000Z',
        session: {
          slug: 'demo',
          name: 'Demo Session',
          appearance: { colorSchemeId },
        } as never,
        sections: {
          report: {
            questions: [{ id: 'q1', options: [], prompt: 'Same report?', responseCount: 1, tags: [], type: 'binary' }],
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

  it('sends the Worker’s results prompt and reads its generated risk axes into the report', () => {
    const payload = buildSessionResultsAnalysisAiPayload({
      questions: [{ id: 'q1', prompt: 'Pilot?', type: 'binary' }],
    }).aiPayload;
    expect(buildSessionResultsAnalysisPrompt(payload, 'riskMatrix')).toBe(
      buildResultsAnalysisPrompt({ sections: ['riskMatrix'], input: payload }),
    );
    const artifact = normalizeGeneratedSessionResultsAnalysisArtifact({
      rawOutput: JSON.stringify({
        riskMatrix: {
          axes: {
            x: {
              id: 'reach',
              label: 'Reach',
              levels: [
                { id: 'few', label: 'Few people' },
                { id: 'many', label: 'Many' },
              ],
            },
            y: {
              id: 'cost',
              label: 'Cost',
              levels: [
                { id: 'cheap', label: 'Cheap' },
                { id: 'dear', label: 'Dear' },
              ],
            },
          },
          assessments: [
            {
              id: 'risk_1',
              label: 'Slow rollout',
              summary: 'Few would see it.',
              xLevelId: 'few',
              yLevelId: 'dear',
              participantIds: ['participant_001'],
              questionIds: ['q1'],
            },
          ],
        },
      }),
    });
    expect(artifact.sections.riskMatrix).toMatchObject({
      available: true,
      categories: [{ id: 'risk_1', label: 'Slow rollout', description: 'Few would see it.' }],
      comments: [{ categoryId: 'risk_1', participantIds: ['participant_001'], questionIds: ['q1'] }],
      heatmap: { risk_1: { Reach: 'Few people', Cost: 'Dear' } },
    });
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

  describe('PDF download', () => {
    const exporterAddress = '0x9999999999999999999999999999999999999999';
    const stubPdf = () => {
      const doc = {
        addImage: jest.fn(),
        addPage: jest.fn(),
        internal: { pageSize: { getHeight: () => 1040, getWidth: () => 540 } },
        save: jest.fn(),
        setFontSize: jest.fn(),
        setProperties: jest.fn(),
        setTextColor: jest.fn(),
        text: jest.fn(),
      };
      return { doc, loader: async () => ({ jsPDF: jest.fn().mockImplementation(() => doc) }) };
    };
    let mocks: Array<{ mockRestore: () => void }>;
    beforeEach(() => {
      mocks = [
        jest
          .spyOn(HTMLCanvasElement.prototype, 'getContext')
          .mockReturnValue({ fillRect: jest.fn(), drawImage: jest.fn() } as unknown as CanvasRenderingContext2D),
        jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,page'),
      ];
    });
    afterEach(() => mocks.forEach((mock) => mock.mockRestore()));
    const capturing = (heights: Record<string, number>) => {
      const seen: Array<{ tag: string; id: string; documentHolds: number }> = [];
      const html2canvas = jest.fn(async (element: HTMLElement, _options?: Record<string, unknown>) => {
        seen.push({
          tag: element.tagName,
          id: element.id,
          documentHolds: element.ownerDocument.querySelectorAll('main > *').length,
        });
        const canvas = element.ownerDocument.createElement('canvas');
        canvas.width = 500;
        canvas.height = heights[element.id] ?? 100;
        return canvas;
      });
      return { html2canvas, seen };
    };
    const html = `<!doctype html><html><head><title>Session report</title></head><body class="ce-report-pdf">
      <header id="top">Header</header><main><section id="one">One</section><section id="two">Two</section></main></body></html>`;

    it('captures the header and each block alone, then names the exporter on every page', async () => {
      const { doc, loader } = stubPdf();
      const { html2canvas, seen } = capturing({ top: 100, one: 700, two: 700 });
      await downloadSessionResultsPdfReport({
        exporterAddress,
        filename: 'report.pdf',
        html,
        html2canvasLoader: async () => ({ default: html2canvas }),
        jsPdfLoader: loader,
      });
      // html2canvas copies whatever the document holds on every capture, so a block is alone when captured.
      expect(seen).toEqual([
        { tag: 'HEADER', id: 'top', documentHolds: 0 },
        { tag: 'SECTION', id: 'one', documentHolds: 1 },
        { tag: 'SECTION', id: 'two', documentHolds: 1 },
      ]);
      expect(doc.addPage).toHaveBeenCalledTimes(1);
      expect(doc.text).toHaveBeenCalledTimes(2);
      expect(doc.text.mock.calls[0][0]).toBe(`Downloaded by ${exporterAddress}`);
      expect(doc.setProperties).toHaveBeenCalledWith(
        expect.objectContaining({ author: exporterAddress, title: 'Session report' }),
      );
      expect(doc.save).toHaveBeenCalledWith('report.pdf');
      expect(document.querySelector('iframe[title="Context Engine PDF export"]')).toBeNull();
    });

    // The report lays out in its own iframe, so its sizes are set there before the capture starts.
    const withLayout = (rects: Record<string, { top?: number; height: number }>, html2canvas: unknown) => async () => {
      const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Context Engine PDF export"]');
      const frameWindow = frame?.contentWindow as unknown as { Element: typeof Element };
      frameWindow.Element.prototype.getBoundingClientRect = function rectOf(this: Element) {
        const { top = 0, height = 100 } = rects[this.id] || {};
        return { top, height, bottom: top + height } as DOMRect;
      };
      return { default: html2canvas };
    };
    const rowsHtml = `<!doctype html><html><body><main><section id="one"><table>
      <tr id="r1"></tr><tr id="r2"></tr><tr id="r3"></tr></table></section></main></body></html>`;

    it('captures a block too tall for one image in windows that end on a row, losing none of it', async () => {
      const { doc, loader } = stubPdf();
      const { html2canvas } = capturing({});
      await downloadSessionResultsPdfReport({
        exporterAddress,
        filename: 'report.pdf',
        html: rowsHtml,
        html2canvasLoader: withLayout(
          {
            one: { height: 8000 },
            r1: { top: 0, height: 3400 },
            r2: { top: 3400, height: 200 },
            r3: { top: 3600, height: 4400 },
          },
          html2canvas,
        ),
        jsPdfLoader: loader,
      });
      const windows = html2canvas.mock.calls.map(([, options]) => [options?.y, options?.height]);
      // The second row would straddle 3,500, so the first window stops before it. No window is big enough
      // to exceed the 16.7 million pixels a phone's canvas holds, even at the capture's double scale.
      expect(windows[0]).toEqual([0, 3400]);
      expect(windows.at(-1)?.[0]).toBeLessThan(8000);
      expect(windows.reduce((sum, [, height]) => sum + Number(height), 0)).toBe(8000);
      windows.forEach(([, height]) => expect(Number(height) * 2 * 2148).toBeLessThanOrEqual(16777216));
      expect(doc.save).toHaveBeenCalledWith('report.pdf');
    });

    it('keeps windows full when rows sit at fractional positions', async () => {
      const { loader } = stubPdf();
      const { html2canvas } = capturing({});
      const count = 40;
      const rowHeight = 277.6;
      const rects: Record<string, { top?: number; height: number }> = { one: { height: count * rowHeight } };
      const rows = Array.from({ length: count }, (_, index) => {
        rects[`row-${index}`] = { top: index * rowHeight, height: rowHeight };
        return `<tr id="row-${index}"></tr>`;
      });
      await downloadSessionResultsPdfReport({
        filename: 'report.pdf',
        html: `<!doctype html><html><body><main><section id="one"><table>${rows.join('')}</table></section></main></body></html>`,
        html2canvasLoader: withLayout(rects, html2canvas),
        jsPdfLoader: loader,
      });
      // Rows that seem to overlap by a rounding pixel would back each window up to a sliver.
      const heights = html2canvas.mock.calls.map(([, options]) => Number(options?.height));
      expect(heights).toHaveLength(4);
      heights.slice(0, -1).forEach((height) => expect(height).toBeGreaterThan(3000));
    });

    it('breaks pages between rows when a block is taller than a page', async () => {
      const { doc, loader } = stubPdf();
      const html2canvas = jest.fn(async (element: HTMLElement) => {
        const canvas = element.ownerDocument.createElement('canvas');
        canvas.width = 500;
        canvas.height = 2400;
        return canvas;
      });
      await downloadSessionResultsPdfReport({
        filename: 'report.pdf',
        html: rowsHtml,
        html2canvasLoader: withLayout(
          {
            one: { height: 1200 },
            r1: { top: 0, height: 475 },
            r2: { top: 475, height: 475 },
            r3: { top: 950, height: 250 },
          },
          html2canvas,
        ),
        jsPdfLoader: loader,
      });
      // 1,000 pixels fit a page: each page ends where a row does, not at 1,000 and 2,000.
      expect(doc.addImage.mock.calls.map((call) => call[5])).toEqual([950, 950, 500]);
    });
  });
});

describe('rating scales in reports and AI input', () => {
  const scale = { min: 0, max: 10, step: 2, minLabel: 'Never', maxLabel: 'Always' };
  const reversed = { ...scale, minLabel: 'Always', maxLabel: 'Never' };
  const question = (questionScale: typeof scale) => ({
    id: 'q1',
    prompt: 'How often?',
    type: 'rating',
    scale: questionScale,
    options: [],
    tags: [],
    responseCount: 1,
  });
  const payload = (questionScale: typeof scale) =>
    buildSessionResultsAnalysisAiPayload({
      questions: [question(questionScale)],
      responses: [{ questionId: 'q1', answer: '8', participantAddress: 'participant-1' }],
    }).aiPayload;

  it('tells the AI what a rating question’s ends mean', () => {
    expect(payload(scale).questions[0].scale).toEqual(scale);
    expect(buildSessionResultsAnalysisPrompt(payload(scale))).toContain('Always');
    expect(buildSessionResultsAnalysisInputSignature(payload(reversed))).not.toBe(
      buildSessionResultsAnalysisInputSignature(payload(scale)),
    );
    expect(payload(scale).questions[0]).toEqual(expect.objectContaining({ type: 'rating' }));
    const binary = buildSessionResultsAnalysisAiPayload({
      questions: [{ id: 'q2', prompt: 'Agree?', type: 'binary' }],
    }).aiPayload.questions[0];
    expect(binary).not.toHaveProperty('scale');
  });

  it('shows a rating question’s scale in the report and its data', () => {
    const snapshot = buildSessionResultsSnapshot({ sections: { report: { questions: [question(scale)] } } });
    expect(snapshot.sections.report.questions[0].scale).toEqual(scale);
    const html = renderSessionResultsHtmlReport(snapshot);
    expect(html).toContain('0 (Never) to 10 (Always), step 2');
    const plain = buildSessionResultsSnapshot({
      sections: {
        report: {
          questions: [{ ...question({ ...scale, step: 1, minLabel: '0', maxLabel: '10' }), id: 'q2', prompt: 'Plain' }],
        },
      },
    });
    expect(renderSessionResultsHtmlReport(plain)).toContain('0 to 10');
  });
});

describe('analysis request question limits', () => {
  const serializedInput = (
    questions: NonNullable<Parameters<typeof buildSessionResultsAnalysisAiPayload>[0]>['questions'],
    responses: NonNullable<Parameters<typeof buildSessionResultsAnalysisAiPayload>[0]>['responses'],
  ) => {
    const { aiPayload } = buildSessionResultsAnalysisAiPayload({ questions, responses });
    const prompt = buildSessionResultsAnalysisPrompt(aiPayload);
    return { prompt, input: JSON.parse(prompt.split('Session input:\n')[1]) };
  };

  it('one bounded question represents three answers in the complete model request', () => {
    const text = 'a'.repeat(12680) + 'UNIQUE_SUFFIX_BEYOND_CAP_';
    const responses = [1, 2, 3].map((index) => ({
      questionId: 'q1',
      questionPrompt: text,
      answer: 'Agree',
      participantAddress: `participant-${index}`,
    }));
    const { prompt, input } = serializedInput([{ id: 'q1', prompt: text, type: 'binary' }], responses);
    expect(prompt).not.toContain('UNIQUE_SUFFIX_BEYOND_CAP_');
    expect(input.questions).toHaveLength(1);
    expect(input.questions[0].prompt.length).toBeLessThanOrEqual(900);
    expect(input.responses).toHaveLength(3);
    for (const response of input.responses) {
      expect(response).not.toHaveProperty('questionPrompt');
      expect(input.questions.some((question: { id: string }) => question.id === response.questionId)).toBe(true);
    }
  });

  it('keeps short text and caps fallback text while dropping responses outside the included questions', () => {
    const questions = Array.from({ length: 81 }, (_, index) => ({
      id: `q${index}`,
      prompt: index === 0 ? '' : `Short ${index}`,
    }));
    const { prompt, input } = serializedInput(questions, [
      { questionId: 'q0', questionPrompt: 'b'.repeat(12704) + 'HIDDEN_FALLBACK_SUFFIX', answer: 'one' },
      { questionId: 'q1', questionPrompt: 'Short 1', answer: 'two' },
      { questionId: 'q80', answer: 'outside cap' },
      { questionId: 'missing', answer: 'orphan' },
    ]);
    expect(input.questions[0].prompt.length).toBeGreaterThan(0);
    expect(input.questions[0].prompt.length).toBeLessThanOrEqual(900);
    expect(input.questions[1].prompt).toBe('Short 1');
    expect(prompt).not.toContain('HIDDEN_FALLBACK_SUFFIX');
    expect(input.responses.map((row: { questionId: string }) => row.questionId)).toEqual(['q0', 'q1']);
    expect(input.counts.responses).toBe(2);
  });
});
