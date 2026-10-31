import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { evidenceRecord, evidenceMarkdown } from "../../src/exports.js";

const read = async (file) => JSON.parse(await fs.readFile(new URL("../../public/data/" + file, import.meta.url), "utf8"));
const graph = await read("tapestry.json");
const edge = graph.edges.find((e) => e.id === "edge-declaration-1776-benjamin-franklin");
const corpus = await read(edge.dossier + ".json");
const selected = new URLSearchParams({
  tapestry: "1", tapestry_v2: "1", space: "3d", lens: "focus",
  node: edge.source, edge: edge.id, revision: graph.revision,
});
// Software WebGL startup can exceed the generic five-second assertion budget.
const ready = (page) => expect(page.locator(".ts-canvas")).toHaveAttribute("data-render-state", "ready", { timeout: 15000 });
const browserLogs = new WeakMap();

test.beforeEach(async ({ page }) => {
  const messages = [];
  browserLogs.set(page, messages);
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()))
      messages.push({ type: message.type(), text: message.text(), location: message.location() });
  });
  page.on("pageerror", (error) => messages.push({ type: "pageerror", text: error.message }));
});

test.afterEach(async ({ page }, info) => {
  await info.attach("browser-console", {
    body: Buffer.from(JSON.stringify(browserLogs.get(page) || [], null, 2)),
    contentType: "application/json",
  });
  expect((browserLogs.get(page) || []).filter((m) => m.type !== "warning")).toEqual([]);
  await expect(page).toHaveTitle("History Forge | Living Tapestry");
  expect(new URL(page.url()).pathname.startsWith("/HistoryForge/")).toBeTruthy();
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
});

async function bounded(page) {
  const size = await page.locator("canvas").evaluate((c) => ({
    width: c.width, height: c.height,
    cssWidth: c.getBoundingClientRect().width, cssHeight: c.getBoundingClientRect().height,
    viewportWidth: innerWidth, viewportHeight: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(size.cssWidth).toBeGreaterThan(50);
  expect(size.cssHeight).toBeGreaterThan(50);
  expect(size.cssWidth).toBeLessThanOrEqual(size.viewportWidth);
  expect(size.cssHeight).toBeLessThanOrEqual(size.viewportHeight);
  expect(size.width).toBeLessThanOrEqual(8192);
  expect(size.height).toBeLessThanOrEqual(8192);
  expect(size.width * size.height).toBeLessThanOrEqual(16 * 1024 * 1024);
  expect(size.scrollWidth).toBeLessThanOrEqual(size.viewportWidth);
}

async function pixels(page, info, label) {
  // Count blue graph pixels, not light DOM text or empty background.
  const png = await page.locator("canvas").screenshot();
  const count = await page.evaluate(async (data) => {
    const image = new Image();
    image.src = "data:image/png;base64," + data;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < rgba.length; i += 4)
      if (rgba[i + 2] > 70 && rgba[i + 2] > rgba[i] + 20) count++;
    return count;
  }, png.toString("base64"));
  await info.attach(label, { body: png, contentType: "image/png" });
  expect(count).toBeGreaterThan(30);
}

test("built overview survives repeated 3D/2D switches, panel changes and resize", async ({ page }, info) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await ready(page);
  const icon = await page.locator('link[rel="icon"]').getAttribute("href");
  expect(icon).toBe("/HistoryForge/favicon.svg");
  const iconResponse = await page.request.get(icon);
  expect(iconResponse.status()).toBe(200);
  expect(iconResponse.headers()["content-type"]).toContain("image/svg+xml");
  await pixels(page, info, "3d-overview");
  await info.attach("overview-workbench", { body: await page.screenshot(), contentType: "image/png" });
  const camera = await page.locator(".ts-canvas").getAttribute("data-camera");
  await page.getByRole("button", { name: "Rotate right", exact: true }).click();
  await expect(page.locator(".ts-canvas")).not.toHaveAttribute("data-camera", camera);
  const initial = page.viewportSize();
  for (const viewport of [initial, { width: 844, height: 390 }, initial]) {
    await page.setViewportSize(viewport);
    await page.getByRole("button", { name: "2D", exact: true }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "2D", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".tapestry-canvas canvas")).toBeVisible();
    await bounded(page);
    await pixels(page, info, "2d-" + viewport.width);
    await page.getByRole("button", { name: /^(Close details|Browse entities)$/ }).click();
    await bounded(page);
    await page.getByRole("button", { name: "3D", exact: true }).click();
    await ready(page);
    await bounded(page);
  }
  expect(errors).toEqual([]);
});

test("selected evidence keeps endpoint labels, exact exports and return state", async ({ page }, info) => {
  await page.goto("./?" + selected);
  await ready(page);
  await expect(page.locator(".ts-labels button")).toHaveCount(2);
  const rects = await page.locator(".ts-labels button").evaluateAll((nodes) =>
    nodes.map((n) => n.getBoundingClientRect().toJSON()));
  expect(rects.every((r) => r.x >= 0 && r.right <= innerWidthSafe(info))).toBeTruthy();
  expect(rects[0].right <= rects[1].left || rects[1].right <= rects[0].left ||
    rects[0].bottom <= rects[1].top || rects[1].bottom <= rects[0].top).toBeTruthy();
  await expect(page.locator(".ts-assertion")).toHaveText("Listed signature");
  await expect(page.locator(".tf-evidence")).toContainText(edge.date_basis);
  await pixels(page, info, "selected-3d");
  await info.attach("selected-workbench", { body: await page.screenshot(), contentType: "image/png" });
  const saved = new URL(page.url()).search;
  await page.getByRole("link", { name: "Open evidence record", exact: true }).click();
  for (const name of ["JSON", "Markdown"]) {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    const download = await pending;
    const content = await fs.readFile(await download.path(), "utf8");
    const expected = evidenceRecord(edge, corpus);
    if (name === "JSON") expect(JSON.parse(content)).toEqual(expected);
    else expect(content).toBe(evidenceMarkdown(expected));
  }
  await page.getByRole("link", { name: "Return to tapestry", exact: true }).click();
  await ready(page);
  expect(new URL(page.url()).search).toBe(saved);
  await expect(page.locator(".tf-evidence h3")).toHaveText(edge.text);
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.locator(".tf-graph-node")).toHaveCount(2);
});

function innerWidthSafe(info) {
  return info.project.use.viewport.width;
}

test("WebGL unavailable preserves the selected evidence in 2D", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (kind === "webgl2" || kind === "webgl") return null;
      return original.call(this, kind, ...args);
    };
  });
  await page.goto("./?" + selected);
  await expect(page.getByText("3D is unavailable on this browser. Your selection is preserved in 2D.", { exact: true })).toBeVisible();
  await expect(page.locator(".tf-graph-node")).toHaveCount(2);
  await expect(page.locator(".tf-evidence h3")).toHaveText(edge.text);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.locator(".tapestry-canvas canvas")).toBeVisible();
  await bounded(page);
});

test("WebGL context loss retains evidence and permits a fresh 3D context", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./?" + selected);
  await ready(page);
  const supported = await page.locator(".ts-canvas").evaluate((canvas) => {
    const context = canvas.getContext("webgl2");
    const extension = context?.getExtension("WEBGL_lose_context");
    extension?.loseContext();
    return Boolean(extension);
  });
  expect(supported).toBeTruthy();
  await expect(page.getByText("The 3D graphics context was lost. Your selection is preserved in 2D.", { exact: true })).toBeVisible();
  await expect(page.locator(".tf-graph-node")).toHaveCount(2);
  await expect(page.locator(".tf-evidence h3")).toHaveText(edge.text);
  const state = new URL(page.url()).searchParams;
  expect(state.get("edge")).toBe(edge.id);
  expect(state.get("node")).toBe(edge.source);
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await ready(page);
  await expect(page.locator(".tf-evidence h3")).toHaveText(edge.text);
  await bounded(page);
  expect(errors).toEqual([]);
});

test("Roman episode discovery preserves qualified proposals and export notices", async ({ page }, info) => {
  const roman = graph.edges.find((e) => e.claim_id === "rome-49-disbandment-proposal");
  const romanCorpus = await read(roman.dossier + ".json");
  await page.goto("./");
  await ready(page);
  const episodes = page.getByRole("region", { name: "Historical episodes", exact: true });
  if (!(await episodes.isVisible())) await page.getByRole("button", { name: "Browse entities", exact: true }).click();
  await episodes.getByRole("button", { name: /Caesar and Pompey/ }).click();
  await ready(page);
  await expect(page.locator(".tf-entity h3")).toHaveText("Julius Caesar");
  await expect(page.locator(".tf-connections li")).toHaveCount(5);
  await info.attach("roman-neighborhood", { body: await page.screenshot(), contentType: "image/png" });
  await page.locator(".tf-connections button").filter({ hasText: roman.text }).click();
  await ready(page);
  await bounded(page);
  await expect(page.locator(".ts-assertion")).toHaveText("Proposed disbandment");
  await expect(page.locator(".tf-evidence")).toContainText("no calendar day");
  await expect(page.locator(".tf-evidence")).toContainText("not an executed agreement");
  const png = await page.locator("canvas").screenshot();
  const colorCount = await page.evaluate(async (bytes) => {
    const img = new Image(); img.src = "data:image/png;base64," + bytes; await img.decode();
    const canvas = document.createElement("canvas"); canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    let count = 0; for (let i = 0; i < data.length; i += 4) if (data[i] > 80 && data[i+1] > 60 && data[i] > data[i+2]+20) count++;
    return count;
  }, png.toString("base64"));
  expect(colorCount).toBeGreaterThan(30);
  await info.attach("roman-selected-workbench", { body: await page.screenshot(), contentType: "image/png" });
  await page.getByRole("button", { name: /Read cited passages/ }).click();
  await expect(page.getByRole("region", { name: "Project Gutenberg reuse notice", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open evidence record", exact: true }).click();
  await expect(page.getByRole("region", { name: "Project Gutenberg reuse notice", exact: true })).toBeVisible();
  await page.getByText("Full Project Gutenberg License", { exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await expect(page.getByRole("link", { name: /Read the cited Caesar edition/ }).first()).toBeVisible();
  for (const name of ["JSON", "Markdown"]) {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    const download = await pending;
    const content = await fs.readFile(await download.path(), "utf8");
    const expected = evidenceRecord(roman, romanCorpus);
    if (name === "JSON") expect(JSON.parse(content)).toEqual(expected);
    else expect(content).toBe(evidenceMarkdown(expected));
  }
  await page.getByRole("link", { name: "Return to tapestry", exact: true }).click();
  await ready(page);
  await expect(page.locator(".tf-evidence h3")).toHaveText(roman.text);
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.locator(".tf-graph-node")).toHaveCount(2);
});
