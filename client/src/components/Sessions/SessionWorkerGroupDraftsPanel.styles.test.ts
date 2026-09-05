import fs from 'node:fs';
import path from 'node:path';

describe('SessionWorkerGroupDraftsPanel contrast styles', () => {
  const source = fs.readFileSync(path.join(__dirname, 'SessionWizard.module.scss'), 'utf8');

  it('keeps the new Group name legible against the global form-control theme', () => {
    expect(source).toMatch(
      /\.groupWizard \.pendingWorkerGroupAddRow\s*\{[\s\S]*?input\s*\{[\s\S]*?background:\s*\$input-bg;[\s\S]*?color:\s*var\(--ce-control-text\);/,
    );
  });
});
