import fs from 'fs';
import path from 'path';

const readPolisReportScss = () => fs.readFileSync(path.join(__dirname, 'PolisReport.module.scss'), 'utf8');
const readPolisReportSource = () => fs.readFileSync(path.join(__dirname, 'PolisReport.tsx'), 'utf8');

describe('PolisReport graph scroll controls', () => {
  it('lets the plot size naturally so the arrow row stays inside its section', () => {
    expect(readPolisReportScss()).toMatch(/\.reportBeeswarm\s*{[^}]*min-height:\s*0;/s);
  });

  it('keeps the controls close to the graph and large enough to find', () => {
    const scss = readPolisReportScss();

    expect(scss).toMatch(/\.swarmScrollControls\s*{[^}]*margin-top:\s*0;/s);
    expect(scss).toMatch(/\.scrollButton\s*{[^}]*width:\s*38px;[^}]*height:\s*38px;/s);
  });

  it('shares light-blue scroll controls with dark-blue icons across report themes', () => {
    const scss = readPolisReportScss();
    const scrollButtonBlocks = scss.match(/\.scrollButton\s*{[^}]*}/gs) ?? [];

    expect(scrollButtonBlocks).toHaveLength(1);
    scrollButtonBlocks.forEach((block) => {
      expect(block).toContain('background: var(--report-scroll-bg);');
      expect(block).toContain('color: var(--report-control-blue-hover);');
    });
    expect(scss).toMatch(/&:focus-visible\s*{[^}]*outline:\s*3px solid/s);
  });
});

describe('PolisReport settings toggle', () => {
  it('renders as an unboxed icon control in both report themes', () => {
    const scss = readPolisReportScss();
    const source = readPolisReportSource();
    const settingsToggleBlocks = scss.match(/\.reportSettingsToggle[^{]*\{[^}]*}/gs) ?? [];

    expect(source).toContain('className={styles.reportSettingsToggle}');
    expect(settingsToggleBlocks.length).toBeGreaterThanOrEqual(3);
    settingsToggleBlocks.forEach((block) => {
      expect(block).toContain('background: transparent;');
      expect(block).toContain('border: 0;');
      expect(block).toContain('box-shadow: none;');
    });
    expect(scss).toContain('outline: 2px solid currentColor;');
  });
});

describe('PolisReport side padding on a phone', () => {
  // The report's last phone block: nested layers give up their side padding there, a PDF never.
  // Screens only: a printed page is narrower than 767px too.
  const phoneBlock = (scss: string) => scss.slice(scss.lastIndexOf('@media screen and (max-width: 767px)'));

  it('keeps one small gutter and drops the layers inside it, on screens and outside PDF capture', () => {
    const block = phoneBlock(readPolisReportScss());

    expect(block.startsWith('@media screen and (max-width: 767px)')).toBe(true);
    expect(block).toMatch(/\.reportInnerModern:not\(\.pdfMode\) \.sectionCollapse,/);

    expect(block).toMatch(/\.polisReportContainer:not\(\.sessionEmbeddedReport\)\s*{\s*padding:\s*6px;/);
    expect(block).toMatch(/\.reportInner:not\(\.pdfDesktopWidth\)\s*{\s*padding:\s*8px;/);
    expect(block).toMatch(
      /\.reportInner:not\(\.pdfMode\) \.allQuestionsBody\s*{\s*padding-left:\s*0;\s*border-left:\s*0;/,
    );
    expect(block).toMatch(/\.reportInnerDark:not\(\.pdfMode\) \.sectionCollapse\s*{\s*padding-right:\s*8px;/);
  });

  it('trims the answer panel and its option cards, but not in a PDF', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'PolisAnswerSections.module.scss'), 'utf8');
    const block = scss.slice(scss.indexOf('@media screen and (max-width: 767px)'));
    const source = fs.readFileSync(path.join(__dirname, 'PolisAnswerSections.tsx'), 'utf8');

    expect(block).toMatch(/\.sections:not\(\.pdf\)\s*{\s*padding-right:\s*6px;\s*padding-left:\s*6px;/);
    expect(block).toMatch(/\.sections:not\(\.pdf\) \.quadratic li\s*{\s*padding-right:\s*12px;/);
    expect(source).toContain('pdfMode ? `${styles.sections} ${styles.pdf}` : styles.sections');
    // The quadratic legend lines up with the bars: card padding plus its 1px border.
    expect(block).toMatch(/\.quadratic li\s*{\s*padding-right:\s*12px;\s*padding-left:\s*12px;/);
    expect(block).toMatch(/\.legend\s*{\s*padding:\s*0 13px;/);
  });
});
