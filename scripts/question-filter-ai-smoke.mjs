import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

// Opt-in live smoke: consumes one session-sponsored AI request with public
// question prompts. It removes its temporary filter and never submits answers.
export async function inspectWorkerAiFilter(page, { capture } = {}) {
  const query = "AI governance and oversight";
  const dialog = page.getByRole("dialog");
  if (!(await dialog.isVisible()))
    await page
      .getByRole("button", { name: "Filter Questions", exact: true })
      .click();
  const input = page.getByTestId("ce-question-filter-ai-query");
  if (!(await input.isVisible()))
    await page.getByRole("heading", { name: "AI Filter", exact: true }).click();
  assert(
    await input.isEnabled(),
    "Worker session AI query is enabled without registry gates",
  );
  await input.fill(query);
  await page.getByTestId("ce-question-filter-ai-top-n").fill("3");
  await page.getByTestId("ce-question-filter-ai-apply").click();
  await dialog
    .getByText(`Active: "${query}" • Top 3 • Override`, { exact: true })
    .waitFor({
      state: "visible",
      timeout: 60_000,
    });
  assert(
    await page.getByTestId("ce-question-filter-ai-apply").isEnabled(),
    "AI request completed",
  );
  if (capture) await capture();
  await dialog
    .getByRole("button", {
      name: `Remove filter: AI "${query}" (Top 3)`,
      exact: true,
    })
    .click();
  await dialog
    .getByRole("button", { name: "See Questions", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
}

if (
  typeof process !== "undefined" &&
  process.argv[1] === fileURLToPath(import.meta.url)
) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(
      process.env.CE_AI_FILTER_SMOKE_URL ||
        "http://127.0.0.1:3000/session/demo-sh",
    );
    await inspectWorkerAiFilter(page);
    console.log("Worker AI question-filter smoke passed");
  } finally {
    await browser.close();
  }
}
