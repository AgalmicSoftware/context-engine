import fs from 'fs';
import path from 'path';

const readPolisReportScss = () => fs.readFileSync(path.join(__dirname, 'PolisReport.module.scss'), 'utf8');
const readPolisReportSource = () => fs.readFileSync(path.join(__dirname, 'PolisReport.tsx'), 'utf8');

describe('PolisReport graph scroll controls', () => {
  it('keeps the controls close to the graph and large enough to find', () => {
    const scss = readPolisReportScss();

    expect(scss).toMatch(/\.swarmScrollControls\s*{[^}]*margin-top:\s*0;/s);
    expect(scss).toMatch(/\.scrollButton\s*{[^}]*width:\s*38px;[^}]*height:\s*38px;/s);
  });

  it('uses high-contrast action colors in each report theme', () => {
    const scss = readPolisReportScss();
    const scrollButtonBlocks = scss.match(/\.scrollButton\s*{[^}]*}/gs) ?? [];

    expect(scrollButtonBlocks).toHaveLength(3);
    scrollButtonBlocks.forEach((block) => {
      expect(block).toContain('background: var(--ce-action-primary);');
      expect(block).toContain('color: var(--ce-action-primary-text);');
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
