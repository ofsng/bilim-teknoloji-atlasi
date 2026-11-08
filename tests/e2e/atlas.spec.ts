import { test, expect, type Page } from "@playwright/test";

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1000) < 1024;

async function openPane(page: Page, name: "Gezgin" | "Harita" | "Ayrıntı" | "Genel bakış") {
  if (isMobile(page)) await page.getByRole("navigation", { name: "Bölümler" }).getByRole("button", { name }).click();
}

test("açılış: 30 ana disiplin, toplam düğüm sayısı ve harita", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("tree", { name: "Teknoloji ağacı" })).toBeVisible();
  await expect(page.getByRole("treeitem")).toHaveCount(30);
  await expect(page.getByText("3.492 düğüm").first()).toBeVisible();
  await openPane(page, "Harita");
  await expect(page.getByTestId("map").locator("canvas").first()).toBeAttached();
  await expect(page.getByText("30 / 3.492 düğüm")).toBeVisible();
});

test("arama ve paylaşılabilir URL", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Teknoloji ara" }).fill("kuantum hata duzeltme");
  const results = page.getByRole("list", { name: "Arama sonuçları" });
  await expect(results.getByRole("button").first()).toContainText("Kuantum Hata Düzeltme");
  await results.getByRole("button").first().click();
  await expect(page).toHaveURL(/\?t=quantum-error-correction$/);
  await openPane(page, "Ayrıntı");
  await expect(page.getByRole("heading", { level: 2, name: "Kuantum Hata Düzeltme" })).toBeVisible();
  await expect(page.getByText("Doğrulanmamış yapay zekâ taslağı.")).toBeVisible();
  // Doğrudan bağlantı aynı görünümü açar
  await page.goto("/?t=quantum-error-correction");
  await expect(page.getByRole("heading", { level: 2, name: "Kuantum Hata Düzeltme" })).toBeVisible();
  await expect(page).toHaveTitle(/Kuantum Hata Düzeltme/);
});

test("ağaç klavyeyle gezilebilir ve genişletilebilir", async ({ page }) => {
  test.skip(isMobile(page), "klavye testi masaüstünde");
  await page.goto("/");
  const tree = page.getByRole("tree", { name: "Teknoloji ağacı" });
  await tree.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  const items = page.getByRole("treeitem");
  await expect(items.nth(1)).toHaveAttribute("aria-expanded", "true");
  await expect(items.nth(2)).toHaveAttribute("aria-level", "2");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\?t=biology-and-biotechnology$/);
  await expect(items.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(items.nth(1)).toHaveAttribute("aria-expanded", "false");
  await expect(items).toHaveCount(30);
});

test("araştırma kaydı doğru teknolojiyle ve kaynak bağlantılarıyla gösterilir", async ({ page }) => {
  await page.goto("/?t=quantum-error-correction");
  await openPane(page, "Ayrıntı");
  await page.getByRole("link", { name: "Mixed-state entanglement and quantum error correction" }).click();
  await expect(page).toHaveURL(/r=[0-9a-f]{10}/);
  await expect(page.getByRole("heading", { level: 2, name: "Mixed-state entanglement and quantum error correction" })).toBeVisible();
  await expect(page.getByRole("link", { name: "10.1103/physreva.54.3824" }).first()).toHaveAttribute("href", "https://doi.org/10.1103/physreva.54.3824");
  await expect(page.locator("#ayrinti").getByText("Kanonik konum:")).toBeVisible();
  await page.getByRole("button", { name: "← Kuantum Hata Düzeltme" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Kuantum Hata Düzeltme" })).toBeVisible();
});

test("filtre: disiplin ve derinlik", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Filtre" }).click();
  const filters = page.getByRole("group", { name: "Filtreler" });
  await filters.getByLabel("Nanoteknoloji").check();
  await filters.getByLabel("En az").selectOption("2");
  await filters.getByLabel("En çok").selectOption("2");
  await expect(page.getByText(/Filtreye uyan \d+ düğüm/)).toBeVisible();
  await page.getByRole("button", { name: "Tümünü aç" }).click();
  const items = page.getByRole("treeitem");
  await expect(items.first()).toContainText("Nanoteknoloji");
  const n = await items.count();
  expect(n).toBeGreaterThan(1);
  for (let i = 1; i < n; i++) await expect(items.nth(i)).toHaveAttribute("aria-level", "2");
});

test("istatistikler ve tema", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "İstatistikler" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "İstatistikler" })).toBeVisible();
  await expect(page.getByText(/yalnızca bu arşive alınmış \d+ kaydı/)).toBeVisible();
  const html = page.locator("html");
  const before = await html.getAttribute("data-theme");
  await page.getByRole("button", { name: /temaya geç/ }).click();
  await expect(html).not.toHaveAttribute("data-theme", before ?? "");
});

test("harita: odaklanma ilgili dalı açar", async ({ page }) => {
  await page.goto("/?t=quantum-error-correction");
  await openPane(page, "Ayrıntı");
  await page.getByRole("button", { name: "Haritada odaklan" }).click();
  const counter = page.getByText(/^\d+ \/ 3\.492 düğüm/);
  await expect(counter).toBeVisible();
  await expect(counter).not.toHaveText(/^30 \//);
});
