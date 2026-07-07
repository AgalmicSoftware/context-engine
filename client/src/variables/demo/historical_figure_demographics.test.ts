import fs from 'fs';
import path from 'path';

import demoPolisData from './demo_polis_data.json';
import historicalFigureDemographics, { DEMO_ANALYSIS_DEMOGRAPHIC_FIELDS } from './historical_figure_demographics.js';

describe('historicalFigureDemographics', () => {
  it('covers every demo participant xid with complete metadata', () => {
    const xids = (demoPolisData?.participantsVotes || []).map((participant) => participant?.xid).filter(Boolean);
    expect(xids.length).toBeGreaterThan(0);

    const metadataKeys = Object.keys(historicalFigureDemographics || {});
    expect(metadataKeys.sort()).toEqual([...xids].sort());

    xids.forEach((xid) => {
      const entry = historicalFigureDemographics[xid];
      expect(entry).toBeTruthy();
      DEMO_ANALYSIS_DEMOGRAPHIC_FIELDS.forEach((field) => {
        expect(String(entry?.[field] || '').trim()).not.toBe('');
      });
    });
  });

  it('keeps only merged canonical rows for former duplicate demo personas', () => {
    expect(historicalFigureDemographics.FDR).toBeTruthy();
    expect(historicalFigureDemographics.MLK).toBeTruthy();
    expect(historicalFigureDemographics.Lincoln).toBeTruthy();
    expect(historicalFigureDemographics.MahatmaGandhi).toBeTruthy();
    expect(historicalFigureDemographics.MahatmaGandhi.displayName).toBe('Mahatma Gandhi');
    expect(historicalFigureDemographics.FrederickDouglass).toBeTruthy();
    expect(historicalFigureDemographics.RachelCarson).toBeTruthy();

    expect(historicalFigureDemographics.FranklinDRoosevelt).toBeUndefined();
    expect(historicalFigureDemographics.MartinLutherKingJr).toBeUndefined();
    expect(historicalFigureDemographics.AbrahamLincoln).toBeUndefined();
    expect(historicalFigureDemographics.Gandhi).toBeUndefined();
    expect(historicalFigureDemographics.Douglass).toBeUndefined();
    expect(historicalFigureDemographics.Carson).toBeUndefined();
  });

  it('does not pull the demo polis vote fixture into the demographics module', () => {
    const demographicsSource = fs.readFileSync(path.join(__dirname, 'historical_figure_demographics.ts'), 'utf8');

    expect(demographicsSource).not.toMatch(/demo_polis_data\.json/);
  });
});
