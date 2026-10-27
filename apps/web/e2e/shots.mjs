// Screenshots of the built site for visual review: node e2e/shots.mjs <baseURL> <outDir>
import { chromium } from "@playwright/test";

const [base = "http://localhost:4173", out = "shots"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: process.env.CI ? undefined : "chrome" });
const errors = [];
for (const [name, vp] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${name}-landing.png` });
  await page.goto(`${base}/privacy/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${name}-privacy.png` });
  await page.goto(`${base}/app/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${name}-dashboard-empty.png` });
  await page.getByRole("button", { name: "Start from the sample" }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${name}-storyboard.png` });
  for (const step of ["script", "brand", "export"]) {
    await page.evaluate((s) => { location.hash = location.hash.replace(/\/\w+$/, `/${s}`); }, step);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/${name}-${step}.png` });
  }
  await page.goto(`${base}/app/#/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${name}-dashboard.png` });
  await page.close();
}
await browser.close();
console.log(errors.length ? `console errors:\n${errors.join("\n")}` : "no console errors");
