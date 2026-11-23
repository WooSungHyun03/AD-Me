import { createRequire } from "node:module";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const origin = new URL(process.env.VISUAL_BASE_URL || "https://be-celeb.org")
  .origin;
const output = resolve(
  process.env.VISUAL_OUTPUT || "output/playwright/premium/audit",
);
const viewports = [
  [360, 800],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
];
const require = createRequire(import.meta.url);
const axePath =
  process.env.VISUAL_AXE === "1" ? require.resolve("axe-core") : undefined;
const sizes = [viewports[1], viewports[6]];
const focusedRoutes = new Set([
  "/",
  "/creators",
  "/jobs",
  "/pricing",
  "/login",
  "/signup",
  "/dashboard",
  "/admin/intelligence",
  "/campaigns/new",
]);
const privateRoute =
  /^\/(admin|billing|account|settings|dashboard|lists|saved-searches|notifications|reports|brand|privacy\/requests)(\/|$)|\/(new|edit)$/;
const imageRoute = /^\/creators\/youtube\/UC/;
function slug(path) {
  return path.replace(/^\//, "").replaceAll("/", "--") || "home";
}
async function routes(dir, url = "") {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("_") || entry.name.startsWith("@")) continue;
    if (entry.isDirectory()) {
      const segment = entry.name.startsWith("(") ? "" : "/" + entry.name;
      found.push(...(await routes(dir + "/" + entry.name, url + segment)));
    } else if (entry.name === "page.tsx") found.push(url || "/");
  }
  return found;
}

await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const result = { origin, routeTemplates: await routes("src/app"), routes: [] };
const credentials = process.env.VISUAL_ACCOUNTS
  ? JSON.parse(await readFile(process.env.VISUAL_ACCOUNTS, "utf8"))
  : {};
const contexts = new Map();
async function context(role) {
  if (contexts.has(role)) return contexts.get(role);
  const session = await browser.newContext();
  contexts.set(role, session);
  if (role === "anonymous") return session;
  const page = await session.newPage();
  try {
    await page.goto(origin + "/login");
    await page
      .getByLabel("이메일", { exact: true })
      .fill(credentials[role].email);
    await page
      .getByLabel("비밀번호", { exact: true })
      .fill(credentials[role].password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await page.waitForURL((url) => /^\/(dashboard|admin)/.test(url.pathname), {
      timeout: 15000,
    });
    return session;
  } catch {
    await session.close();
    contexts.delete(role);
    result.routes.push({
      path: "/login",
      role,
      error: "QA login did not reach the workspace",
    });
    return null;
  } finally {
    await page.close();
  }
}

try {
  const anonymous = await context("anonymous");
  const probe = await anonymous.newPage();
  const discovered = new Set();
  for (const route of ["/", "/creators", "/jobs", "/pricing"]) {
    await probe.goto(origin + route, { waitUntil: "load" });
    if (route === "/creators")
      await probe
        .getByTestId("youtube-channel")
        .first()
        .waitFor({ timeout: 4500 })
        .catch(() => {});
    for (const link of await probe
      .locator("a[href]")
      .evaluateAll((nodes) => nodes.map((node) => node.href))) {
      const url = new URL(link);
      if (
        url.origin === origin &&
        (imageRoute.test(url.pathname) ||
          /^\/jobs\/[0-9a-f-]{36}$/.test(url.pathname))
      )
        discovered.add(url.pathname);
    }
  }
  await probe.close();
  const paths = [
    ...new Set([
      ...result.routeTemplates.filter((route) => !route.includes("[")),
      ...discovered,
      "/tools",
      "/tools/local",
    ]),
  ];
  const tasks = paths.map((path) => {
    const preferredRole = path.startsWith("/admin")
      ? "admin"
      : path === "/settings/youtube"
        ? "creator"
        : "brand";
    const role =
      !privateRoute.test(path) || !credentials[preferredRole]
        ? "anonymous"
        : preferredRole;
    return { path, role };
  });
  if (credentials.creator)
    tasks.push(
      { path: "/dashboard", role: "creator" },
      { path: "/settings", role: "creator" },
    );
  for (const role of new Set(tasks.map((task) => task.role)))
    await context(role);
  const brandSession = contexts.get("brand");
  if (brandSession) {
    const workspace = await brandSession.newPage();
    try {
      const dynamic = new Set();
      for (const entry of ["/dashboard", "/jobs"]) {
        await workspace.goto(origin + entry, { waitUntil: "load" });
        await workspace
          .locator("main .loading")
          .waitFor({ state: "hidden", timeout: 6500 })
          .catch(() => {});
        const links = await workspace
          .locator("main a[href]")
          .evaluateAll((nodes) => nodes.map((item) => item.href));
        for (const link of links) {
          const { origin: linkOrigin, pathname } = new URL(link);
          if (
            linkOrigin === origin &&
            /^\/(campaigns|jobs|collaborations)\/[0-9a-f-]{36}(\/(edit|copy|deliverables|recommendations))?$/.test(
              pathname,
            )
          )
            dynamic.add(pathname);
        }
      }
      for (const path of [...dynamic].slice(0, 8)) {
        if (!tasks.some((task) => task.path === path && task.role === "brand"))
          tasks.push({ path, role: "brand" });
      }
    } finally {
      await workspace.close();
    }
  }
  async function inspect({ path, role }) {
    const session = contexts.get(role);
    if (!session) return;
    const page = await session.newPage();
    const snapshots = [];
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message.slice(0, 180)));
    try {
      const wideCoverage =
        focusedRoutes.has(path) ||
        (imageRoute.test(path) && path === [...discovered][0]);
      for (const [width, height] of wideCoverage ? viewports : sizes) {
        await page.setViewportSize({ width, height });
        try {
          const response = await page.goto(origin + path, {
            timeout: 16000,
            waitUntil: "load",
          });
          await page
            .locator("main .loading")
            .waitFor({ state: "hidden", timeout: 6500 })
            .catch(() => {});
          if (path === "/") {
            await page
              .locator(".premium-hero,.product-hero")
              .waitFor({ timeout: 3500 })
              .catch(() => {});
          }
          if (path === "/")
            await page
              .locator(".channel-preview-loading")
              .waitFor({ state: "hidden", timeout: 4500 })
              .catch(() => {});
          if (path === "/creators") {
            await page
              .getByRole("heading", { name: "공개 YouTube 채널" })
              .waitFor({ timeout: 3500 })
              .catch(() => {});
          }
          const layout = await page.evaluate(() => {
            const view = document.documentElement.clientWidth;
            const text =
              [...document.querySelectorAll("main h1")]
                .find((node) => node.getBoundingClientRect().height)
                ?.textContent?.trim() || null;
            const outliers = [
              ...document.querySelectorAll(
                "main a, main button, main input, main select, header a",
              ),
            ]
              .filter((node) => {
                const rect = node.getBoundingClientRect();
                return (
                  rect.width &&
                  rect.height &&
                  (rect.right > view + 1 || rect.left < -1) &&
                  !node.closest(".table-scroll")
                );
              })
              .slice(0, 5)
              .map(
                (node) =>
                  node.tagName +
                  " " +
                  (node.textContent?.trim().slice(0, 40) ||
                    node.getAttribute("name") ||
                    ""),
              );
            return {
              view,
              documentWidth: document.documentElement.scrollWidth,
              heading: text,
              outliers,
            };
          });
          const final = new URL(page.url()).pathname;
          const snap = {
            width,
            height,
            status: response?.status(),
            final,
            ...layout,
          };
          if (width === 390 || width === 1440) {
            const filename = role + "--" + slug(path) + "--" + width + ".png";
            if (
              role === "anonymous" ||
              process.env.VISUAL_PRIVATE_SCREENSHOTS === "1"
            ) {
              await page
                .screenshot({
                  path: output + "/" + filename,
                  fullPage: true,
                  animations: "disabled",
                  timeout: 5500,
                })
                .then(() => {
                  snap.screenshot = filename;
                })
                .catch(() => {});
            }
          }
          if (
            axePath &&
            (width === 390 || width === 1440) &&
            wideCoverage &&
            response?.status() === 200
          ) {
            try {
              await page.addScriptTag({ path: axePath });
              snap.a11y = await page.evaluate(async () => {
                const check = await window.axe.run({
                  runOnly: {
                    type: "tag",
                    values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
                  },
                });
                return check.violations.map(({ id, impact, nodes }) => ({
                  id,
                  impact,
                  count: nodes.length,
                }));
              });
            } catch (error) {
              snap.a11yError = String(error).split("\n")[0];
            }
          }
          snapshots.push(snap);
        } catch (error) {
          snapshots.push({
            width,
            height,
            error: String(error).split("\n")[0],
          });
        }
      }
    } finally {
      await page.close();
    }
    result.routes.push({ path, role, snapshots, errors: [...new Set(errors)] });
  }
  for (let i = 0; i < tasks.length; i += 4)
    await Promise.all(tasks.slice(i, i + 4).map(inspect));
} finally {
  await writeFile(output + "/routes.json", JSON.stringify(result, null, 2));
  await browser.close();
}
