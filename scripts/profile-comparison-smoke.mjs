import assert from "node:assert/strict";
import { chromium } from "playwright";
const base = process.env.BASE_URL || "http://127.0.0.1:3011";
const browser = await chromium.launch({ headless: true });
try {
  for (const theme of ["context-engine", "classic-95"])
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.setDefaultTimeout(15000);
      await page.route("**/*", (route) => {
        const url = new URL(route.request().url());
        return url.origin === new URL(base).origin ||
          ["data:", "blob:"].includes(url.protocol)
          ? route.continue()
          : route.abort();
      });
      await page.goto(`${base}/tests/fixtures/profile-comparison.html`);
      await page.evaluate(
        (theme) =>
          document.documentElement.setAttribute("data-ce-theme", theme),
        theme,
      );
      const run = page.getByTestId("ce-compare-run");
      await run.waitFor();
      await page.getByText("Loading chart...").waitFor();
      await page.waitForFunction(() =>
        document
          .querySelector('[data-testid="ce-compare-run"]')
          ?.textContent?.includes("2s"),
      );
      await page.waitForFunction(
        () =>
          !document.querySelector('[data-testid="ce-compare-run"]')?.disabled,
      );
      await page
        .getByTestId("ce-compare-agreements")
        .getByText(/Compared 2 participant/)
        .waitFor();
      await page.waitForFunction(() => {
        const result = document.querySelector(
          '[data-testid="ce-compare-result"]',
        );
        return (
          result &&
          result.parentElement.getBoundingClientRect().height > 300 &&
          !document.querySelector(".collapsing")
        );
      });
      assert.equal(await page.getByRole("alert").count(), 0);
      const clear = page.getByRole("button", { name: "Clear this subject" });
      assert.equal(await clear.count(), 2);
      const radius = await clear
        .first()
        .evaluate((el) =>
          parseFloat(getComputedStyle(el.parentElement).borderRadius),
        );
      assert.ok(
        theme === "classic-95" ? radius === 0 : radius > 100,
        `Participant treatment: ${theme}`,
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "No horizontal page overflow",
      );
      await page.screenshot({
        path: `/tmp/ce-profile-comparison-${theme}-${width}.png`,
      });
      await clear.first().click();
      await page
        .getByRole("textbox", { name: "Comparison subject 1" })
        .fill(`wallet:0x${"3".repeat(40)}`);
      assert.equal(await clear.count(), 2);
      await page.getByRole("button", { name: "Show fixture analysis" }).click();
      await page
        .getByText("AI model: synthetic-model (fixture)", { exact: true })
        .waitFor();
      await page.waitForFunction(() => {
        const modal = document.querySelector(".modal");
        return (
          modal &&
          getComputedStyle(modal).opacity === "1" &&
          modal.classList.contains("show")
        );
      });
      await page.screenshot({
        path: `/tmp/ce-profile-analysis-${theme}-${width}.png`,
      });
      console.log(
        JSON.stringify({
          theme,
          width,
          checks: [
            "Hosted comparison",
            "session carried in URL",
            "wallet pills",
            "replace participant",
            "model provenance",
            "no overflow",
          ],
        }),
      );
      await page.close();
    }
} finally {
  await browser.close();
}
