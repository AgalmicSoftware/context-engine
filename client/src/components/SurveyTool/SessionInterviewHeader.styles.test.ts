import path from 'node:path';
import * as sass from 'sass';

describe("the Interview window's header", () => {
  const scssDir = path.resolve(__dirname, '..', '..');
  const css = sass.compile(path.resolve(__dirname, 'SurveyTool.module.scss'), {
    loadPaths: [scssDir],
    style: 'expanded',
    logger: sass.Logger.silent,
  }).css;
  const rule = (source: string, selector: string) =>
    source.match(new RegExp(`(?:^|\\n)\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ||
    '';

  it('holds the language button and its flags in one pill, on a row of its own while the flags show', () => {
    const row = rule(css, '.sessionInterviewLanguageRow');
    expect(row).toMatch(/flex-basis:\s*100%/);
    expect(row).toMatch(/order:\s*1/);
    // With the flags gone the pill is the button alone, back in the title row.
    const closed = rule(css, '.sessionInterviewLanguageRow[data-open=false]');
    expect(closed).toMatch(/flex-basis:\s*auto/);
    expect(closed).toMatch(/order:\s*0/);
    // Outlined, where the status pill beside it is filled.
    const pill = rule(css, '.sessionInterviewLanguageGroup');
    expect(pill).toMatch(/border:\s*1px solid/);
    expect(pill).toMatch(/border-radius:\s*999px/);
    expect(pill).not.toMatch(/background/);
  });

  it('puts the pill in the title row where the row itself has the room', () => {
    // The row is measured, not the screen: the dialog is narrow on a tablet too.
    expect(css).toMatch(
      /\.modal-title\)?:has\(\.sessionInterviewHeader\)\s*\{\s*container:\s*ce-interview-title\s*\/\s*inline-size/,
    );
    const wide = css.match(/@container ce-interview-title \(min-width: (\d+)px\)\s*\{([\s\S]*?\})\s*\}/);
    expect(wide).not.toBeNull();
    // Back, the title, "?", the language button and seven flags take about 475px; the rest is the status's.
    expect(Number(wide?.[1])).toBeGreaterThanOrEqual(600);
    const joined = rule(wide?.[2] || '', '.sessionInterviewLanguageRow');
    expect(joined).toMatch(/flex-basis:\s*auto/);
    expect(joined).toMatch(/order:\s*0/);
  });
});
