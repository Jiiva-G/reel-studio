import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";

async function startSample(page: Page) {
  await page.goto("/app/");
  await page.getByRole("button", { name: "Start from the sample" }).click();
  await expect(page.getByRole("heading", { name: "Scene 1 of 7" })).toBeVisible();
}

test("create from the sample, edit, and the edit survives a reload", async ({ page }) => {
  await startSample(page);
  const heading = page.getByLabel("On-screen heading");
  await heading.fill("Your API is *on fire*");
  await expect(page.locator(".save-state")).toHaveText("Saved locally");
  await page.waitForTimeout(200);
  await page.reload();
  await expect(page.getByLabel("On-screen heading")).toHaveValue("Your API is *on fire*");
});

test("validation shows the engine's message and blocks export", async ({ page }) => {
  await startSample(page);
  await page.getByLabel("On-screen heading").fill("x".repeat(61));
  await expect(page.getByText("heading too long (61 > 60).").first()).toBeVisible();
  await page.getByRole("link", { name: /^Export/ }).first().click();
  await expect(page.getByText("Scene 1 (hook): heading too long (61 > 60).")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download bundle" })).toBeDisabled();
  await page.keyboard.press("Control+z");
  await expect(page.getByRole("button", { name: "Download bundle" })).toBeEnabled();
});

test("reorder with the keyboard, undo it, and the order persists", async ({ page }) => {
  await startSample(page);
  const first = page.getByRole("option").first();
  await first.focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect(page.getByRole("option").nth(1)).toHaveAccessibleName(/Hook/);
  await expect(page.getByRole("heading", { name: "Scene 2 of 7" })).toBeVisible();
  await expect(page.locator(".save-state")).toHaveText("Saved locally");
  await page.waitForTimeout(200);
  await page.reload();
  await expect(page.getByRole("option").nth(1)).toHaveAccessibleName(/Hook/);
  await page.getByRole("option").nth(1).focus();
  await page.keyboard.press("Control+z"); // nothing to undo after a reload: history is per session
  await page.getByRole("option").nth(1).click();
  await page.keyboard.press("Alt+ArrowUp");
  await expect(page.getByRole("option").first()).toHaveAccessibleName(/Hook/);
});

test("brand settings apply and the exported bundle is what the engine imports", async ({ page }) => {
  await startSample(page);
  await page.getByRole("link", { name: "Brand" }).click();
  await page.getByLabel("Name").fill("Acme Labs");
  await page.getByLabel("Handle", { exact: true }).fill("@acmelabs");
  await page.getByRole("link", { name: /^Export/ }).first().click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download bundle" }).click()]);
  expect(dl.suggestedFilename()).toBe("rate-limiting-in-fastapi.reelstudio.zip");
  const files = unzipSync(new Uint8Array(readFileSync(await dl.path())));
  expect(Object.keys(files).sort()).toEqual(["README.md", "bundle.json", "content.md"]);
  const b = JSON.parse(strFromU8(files["bundle.json"]));
  expect(b.format).toBe("reel-studio.bundle");
  expect(b.version).toBe(1);
  expect(b.brand.name).toBe("Acme Labs");
  expect(b.brand.handle).toBe("@acmelabs");
  expect(b.storyboard.scenes).toHaveLength(7);
});

test("delete a project, restore it from recently deleted", async ({ page }) => {
  await startSample(page);
  await page.getByRole("link", { name: "Back to projects" }).click();
  await page.getByRole("button", { name: "Delete Rate limiting in FastAPI" }).click();
  await expect(page.getByText("Make your first reel")).toBeVisible();
  await page.getByText(/Recently deleted \(1\)/).click();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("link", { name: "Rate limiting in FastAPI" })).toBeVisible();
});

test("the preview plays the real scenes", async ({ page }) => {
  await startSample(page);
  const player = page.locator(".player");
  await expect(player).toBeVisible();
  await expect(player).toContainText("flood");
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  const clock = page.locator(".ptime .ctl .num");
  const t0 = await clock.textContent();
  await page.waitForTimeout(1500);
  expect(await clock.textContent()).not.toBe(t0);
  await page.getByRole("button", { name: "Scene 2, 6.7 seconds" }).click();
  await expect(player).toContainText("gatekeeper");
});

test("the website's New project form opens the editor with that project", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Project name").fill("My first reel");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/app\/#\/p\/.+\/storyboard/);
  await expect(page.getByRole("heading", { name: "My first reel" })).toBeVisible();
});
