import fs from 'fs';
import path from 'path';

describe('Account.module.scss modal account layout guards', () => {
  it('keeps the narrow account modal fix scoped to the modal shell', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'Account.module.scss'), 'utf8');

    expect(scss).toMatch(/@media \(max-width: 600px\)\s*{[\s\S]*?\.accountModalBody\s*{[\s\S]*?align-items:\s*stretch;[\s\S]*?gap:\s*1rem;[\s\S]*?padding:\s*1rem 0\.75rem;/);
    expect(scss).toMatch(/@media \(max-width: 600px\)\s*{[\s\S]*?\.accountModalProfileShell\s*{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?overflow-x:\s*hidden;/);
    expect(scss).toMatch(/@media \(max-width: 600px\)\s*{[\s\S]*?\.accountModalProfileShell > \*\s*{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?min-width:\s*0;/);
    expect(scss).not.toMatch(/:global\([^)]*userPage/i);
    expect(scss).not.toMatch(/:global\([^)]*userInfo/i);
  });
});
