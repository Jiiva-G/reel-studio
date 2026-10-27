import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const pages = [
  { name: "website", path: "/" },
  { name: "privacy", path: "/privacy/" },
  { name: "dashboard", path: "/app/" },
];

for (const p of pages) {
  test(`${p.name}: no horizontal scroll, no serious accessibility violations`, async ({ page }) => {
    await page.goto(p.path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
  });
}

test("workspace: no horizontal scroll, no serious accessibility violations", async ({ page }) => {
  await page.goto("/app/");
  await page.getByRole("button", { name: "Start from the sample" }).click();
  await expect(page.getByText(/Scene 1 of 7/)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  for (const step of ["storyboard", "script", "brand", "export"]) {
    await page.evaluate((s) => { location.hash = location.hash.replace(/\/\w+$/, `/${s}`); }, step);
    await page.waitForTimeout(300);
    const results = await new AxeBuilder({ page }).exclude(".player").withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${step} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`)).toEqual([]);
  }
});

test("no build or deploy configuration is served", async ({ request }) => {
  // a wrangler auto-migration once wrote dist/wrangler.json (with local paths) into the deployed files
  // (the local preview server answers unknown paths with the HTML page, so check the content, not only the status)
  for (const path of ["/wrangler.json", "/wrangler.jsonc", "/wrangler.toml", "/.wrangler/", "/package.json", "/vite.config.ts"]) {
    const res = await request.get(path);
    if (res.status() !== 200) continue;
    const body = await res.text();
    expect(res.headers()["content-type"] ?? "", path).toContain("text/html");
    expect(body, path).not.toMatch(/configPath|compatibility_date|devDependencies|defineConfig|Jeeva_Personal/);
  }
});

test("keyboard: the website's main action is reachable by tabbing", async ({ page }) => {
  await page.goto("/");
  let found = false;
  for (let i = 0; i < 8 && !found; i++) {
    await page.keyboard.press("Tab");
    found = await page.evaluate(() => document.activeElement?.textContent?.trim() === "Open the editor");
  }
  expect(found).toBe(true);
});
