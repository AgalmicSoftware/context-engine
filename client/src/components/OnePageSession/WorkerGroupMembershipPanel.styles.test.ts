import fs from 'fs';
import path from 'path';

describe('WorkerGroupMembershipPanel loading styles', () => {
  it("shares the report's loading box and leaves the spinner the size the report gives it", () => {
    const scss = fs.readFileSync(path.join(__dirname, 'OnePageSession.module.scss'), 'utf8');
    const rule = scss.match(/\.workerGroupsLoadingState\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(rule).toMatch(/@include loadingState\.loading-state\(/);
    // The spinner is sized in em, so a font size here would grow it past the report's.
    expect(rule).not.toMatch(/font-size/);
  });

  it('keeps loaded worker group descriptions readable in the same body type', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'OnePageSession.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.workerGroupDetailDescription\s*\{[\s\S]*?font-family:\s*var\(--ce-font-body\);[\s\S]*?p\s*\{[\s\S]*?color:\s*var\(--ce-control-text\);[\s\S]*?font-family:\s*var\(--ce-font-body\);/,
    );
  });
});
