import { expect, type Page, test } from "@playwright/test";
import path from "node:path";

type OverflowReport = {
  viewportWidth: number;
  scrollWidth: number;
  offenders: Array<{ tag: string; text: string; left: number; right: number; width: number }>;
};

async function expectNoHorizontalOverflow(page: Page) {
  const report = await page.evaluate<OverflowReport>(() => {
    const viewportWidth = window.innerWidth;
    const offenders = Array.from(document.querySelectorAll("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          text: (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      })
      .filter((box) => box.width > 0 && (box.left < -2 || box.right > viewportWidth + 2))
      .slice(0, 8);

    return {
      viewportWidth,
      scrollWidth: document.documentElement.scrollWidth,
      offenders
    };
  });

  expect(report.offenders, JSON.stringify(report, null, 2)).toEqual([]);
  expect(report.scrollWidth, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(
    report.viewportWidth + 2
  );
}

async function attachVisualEvidence(page: Page, name: string) {
  const screenshot = await page.screenshot({ fullPage: true });
  expect(screenshot.byteLength).toBeGreaterThan(12_000);
  await test.info().attach(name, { body: screenshot, contentType: "image/png" });
}

test.describe("CueRoom visual contracts", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("home page renders the beta entry points without layout overflow", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: /Private watch rooms with calls, chat, and local sync/i
      })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Create room/i }).first()).toBeVisible();
    await expect(page.getByText(/never sees Netflix video/i)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await attachVisualEvidence(page, "home-page");
  });

  test("room page keeps call controls, chat, and sync health visible", async ({ page }) => {
    await page.goto("/room/visual-regression-room");

    await expect(page.getByRole("heading", { name: /Friday watch room/i })).toBeVisible();
    await expect(page.getByText(/Netflix tab not paired/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Chat/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Toggle chat/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Leave room/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await attachVisualEvidence(page, "room-page");
  });

  test("extension popup renders paired state without Chrome runtime access", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 520 });
    await page.goto(`file://${path.resolve("apps/extension/dist/popup.html")}`);
    await page.evaluate(() => {
      document.querySelector("#pairing")!.textContent = "Paired to room_visual_review";
      document.querySelector("#playback")!.textContent = "Netflix detected: Demo title at 742s";
      document.querySelector("#warning")!.textContent = "No sync warnings";
    });

    await expect(page.getByRole("heading", { name: "CueRoom" })).toBeVisible();
    await expect(page.getByText(/Paired to room_visual_review/i)).toBeVisible();
    await expect(page.getByText(/Netflix detected: Demo title at 742s/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Disconnect room/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await attachVisualEvidence(page, "extension-popup");
  });
});
