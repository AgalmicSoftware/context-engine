// Read-only session discovery and local filter toggling; no account or data writes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
try {
  for (const theme of ['civic', 'classic-95', 'context-engine']) {
    for (const width of [320, 705, 937, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 853 }, reducedMotion: 'reduce' });
      await page.addInitScript(theme => {
        localStorage.setItem('ce:theme', theme);
        localStorage.setItem('ce:theme-default-version', '2026-10-13-civic-v1');
        localStorage.setItem('ce_onboarding_complete', 'true');
        localStorage.setItem('ce:firstVisitRootAboutRedirectConsumed:v20260618b', 'true');
        localStorage.setItem('ce:primarySessionSlug', 'eddy26');
        localStorage.setItem('ce:selectedSessionScope', 'active');
      }, theme);
      await page.goto(base);
      await page.getByRole('tab', { name: 'Stats', exact: true }).click();
      await page.getByTestId('ce-community-stat-users').click();
      const dialog = page.getByRole('dialog');
      const select = page.getByTestId('ce-community-users-session-select');
      const filter = dialog.getByRole('button', { name: 'Filter', exact: true });
      await filter.waitFor({ timeout: 60000 });
      await page.waitForFunction(() => [...document.querySelectorAll('[role=dialog]')].some(element => getComputedStyle(element).opacity === '1'));
      const inspect = async () => {
        const bounds = await select.evaluate(select => {
          const group = select.closest('[class*="globalSessionSelector_"]');
          const row = group.parentElement;
          const button = row.querySelector('[class*="usersFilter_"] > button');
          const link = group.querySelector('a,button');
          const rect = element => { const r = element.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, cy:r.top+r.height/2 }; };
          return { select:rect(select), link:rect(link), button:rect(button), group:rect(group), row:rect(row), overflow:row.scrollWidth>row.clientWidth+1 };
        });
        assert(bounds.select.right <= bounds.link.left, `Select avoids icon: ${JSON.stringify({theme,width,bounds})}`);
        assert(bounds.link.right <= bounds.group.right && bounds.group.right <= bounds.button.left, JSON.stringify(bounds));
        assert(Math.abs(bounds.select.cy-bounds.button.cy)<2, `Controls align: ${JSON.stringify({theme,width,bounds})}`);
        assert(bounds.select.width >= 24 && !bounds.overflow, `Usable narrow selector: ${JSON.stringify({theme,width,bounds})}`);
      };
      await inspect();
      await filter.click();
      const panel = dialog.locator('[class*="usersFilter_"] > div');
      await panel.waitFor();
      const panelBounds = await panel.boundingBox();
      const selectorBounds = await select.boundingBox();
      assert(panelBounds.y >= selectorBounds.y + selectorBounds.height, 'Expanded options sit below the toolbar');
      await inspect();
      await filter.click();
      for (const value of ['__ce_all_sessions__', '', 'eddy26']) {
        await select.selectOption(value);
        await filter.waitFor({ timeout: 60000 });
        await inspect();
      }
      if (theme === 'civic') await dialog.screenshot({ path: `/tmp/users-toolbar-${width}.png` });
      console.log(`PASS Users toolbar: ${theme} ${width}, long title, filter expansion and session switching`);
      await page.close();
    }
  }
} finally { await browser.close(); }
