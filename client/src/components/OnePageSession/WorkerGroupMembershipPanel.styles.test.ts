import fs from 'fs';
import path from 'path';

describe('WorkerGroupMembershipPanel loading styles', () => {
  it('renders group loading copy at a larger size with space before the card grid', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'OnePageSession.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.workerGroupsLoadingState\s*\{[\s\S]*?margin:\s*0 0 24px;[\s\S]*?font-size:\s*1\.25rem;[\s\S]*?font-weight:\s*700;[\s\S]*?line-height:\s*1\.4;/,
    );
  });
});
