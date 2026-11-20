import fs from 'node:fs';
import path from 'node:path';

describe('SessionWorkerGroupDraftsPanel contrast styles', () => {
  const source = fs.readFileSync(path.join(__dirname, 'SessionWizard.module.scss'), 'utf8');

  it('keeps Create group readable when it is disabled', () => {
    expect(source).toMatch(
      /\.groupWizard \.pendingWorkerGroupAddRow\s*\{[\s\S]*?button:disabled\s*\{[\s\S]*?background:\s*transparent;[\s\S]*?color:\s*var\(--ce-control-text\);/,
    );
  });
});
