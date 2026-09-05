import fs from 'fs';
import path from 'path';

describe('WorkerGroupMembershipPanel loading styles', () => {
  it('renders group loading copy with the high-contrast body type used by the About page', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'OnePageSession.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.workerGroupsLoadingState\s*\{[\s\S]*?margin:\s*0 0 24px;[\s\S]*?color:\s*var\(--ce-control-text\);[\s\S]*?font-family:\s*var\(--ce-font-body\);[\s\S]*?font-size:\s*1\.25rem;[\s\S]*?font-weight:\s*700;[\s\S]*?line-height:\s*1\.4;/,
    );
  });

  it('keeps loaded worker group descriptions readable in the same body type', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'OnePageSession.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.workerGroupDetailDescription\s*\{[\s\S]*?font-family:\s*var\(--ce-font-body\);[\s\S]*?p\s*\{[\s\S]*?color:\s*var\(--ce-control-text\);[\s\S]*?font-family:\s*var\(--ce-font-body\);/,
    );
  });
});
