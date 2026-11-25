import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";

export function loopbackAuditOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username || url.password || !url.port) {
    throw new Error("UI audits require an explicit loopback HTTP origin and port.");
  }
  return url.origin;
}

// Install before navigation. Narrow page routes can still fulfill named synthetic assets and API calls.
export async function containAuditNetwork(context: BrowserContext, allowedOrigins: readonly string[]) {
  const allowed = new Set(allowedOrigins.map(loopbackAuditOrigin));
  // Contexts block workers. Suppress the PWA bootstrap so a deliberate fixture restriction is not a console error.
  await context.addInitScript(() => { Reflect.deleteProperty(Navigator.prototype, "serviceWorker"); });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if ((allowed.has(url.origin) && url.pathname.startsWith("/_vercel/")) ||
      url.origin === "https://va.vercel-scripts.com") {
      await route.fulfill({ status: 204, contentType: "application/javascript", body: "" });
    } else if (allowed.has(url.origin) || url.protocol === "data:" || url.protocol === "blob:") {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
    }
  });
  await context.routeWebSocket("**/*", (socket) => {
    const origin = new URL(socket.url().replace(/^ws:/, "http:")).origin;
    if (allowed.has(origin)) socket.connectToServer();
    else void socket.close({ code: 1008, reason: "Non-fixture destination blocked" });
  });
}

export async function auditPageLayout(page: Page) {
  await page.evaluate(async () => {
    const settling = document.getAnimations().filter((animation) =>
      (animation.pending || animation.playState === "running") &&
      Number.isFinite(animation.effect?.getComputedTiming().endTime),
    );
    await Promise.allSettled(settling.map((animation) => animation.finished));
  });
  await expect.poll(async () => page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    return Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - viewport;
  }), { message: "Document and body must fit without horizontal scrolling" }).toBeLessThanOrEqual(1);
}

export async function auditHorizontalScroller(scroller: Locator) {
  await expect(scroller).toBeVisible();
  const result = await scroller.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const contained = rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1;
    if (!contained || element.scrollWidth <= element.clientWidth + 1) return { contained, operable: true };
    const style = getComputedStyle(element);
    if (style.overflowX !== "auto" && style.overflowX !== "scroll") return { contained, operable: false };
    const start = element.scrollLeft;
    const end = style.direction === "rtl" ? -element.scrollWidth : element.scrollWidth;
    try {
      element.scrollTo({ left: start === 0 ? end : 0, behavior: "instant" });
      return { contained, operable: element.scrollLeft !== start };
    } finally {
      element.scrollTo({ left: start, behavior: "instant" });
    }
  });
  expect(result, "Intentional horizontal scroll must stay within its container and actually scroll").toEqual({
    contained: true,
    operable: true,
  });
}

export async function auditAction(action: Locator, options: { contrast?: "text" | "icon" } = {}) {
  await expect(action).toBeVisible();
  await expect(action).toBeEnabled();
  if (options.contrast) await auditSolidContrast(action, options.contrast === "icon" ? 3 : 4.5);

  // The trial performs Playwright's real actionability checks without dispatching a click.
  await action.click({ trial: true });
  await expect.poll(async () => action.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    const viewport = document.documentElement;
    return rect.x >= -1 && rect.y >= -1 && rect.right <= viewport.clientWidth + 1 &&
      rect.bottom <= viewport.clientHeight + 1 && hit !== null && element.contains(hit);
  }), { message: "Primary control must fit in the viewport and not be covered" }).toBe(true);
}

async function auditSolidContrast(action: Locator, minimum: number) {
  const contrast = await action.evaluate((element) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Cannot resolve CSS colors for the contrast check.");
    const rgba = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    };
    const luminance = (channels: number[]) => {
      const [r, g, b] = channels.slice(0, 3).map((value) => {
        const srgb = value / 255;
        return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (let surface: Element | null = element; surface; surface = surface.parentElement) {
      const style = getComputedStyle(surface);
      if (style.backgroundImage !== "none" || Number(style.opacity) !== 1) break;
      const background = rgba(style.backgroundColor);
      if (background[3] === 0) continue;
      if (background[3] !== 255) break;
      const foreground = rgba(getComputedStyle(element).color);
      const alpha = foreground[3] / 255;
      const text = luminance(foreground.slice(0, 3).map((value, i) => alpha * value + (1 - alpha) * background[i]));
      const fill = luminance(background);
      return (Math.max(text, fill) + 0.05) / (Math.min(text, fill) + 0.05);
    }
    throw new Error("Numeric contrast needs a known solid surface. Review translucent or image-backed controls visually.");
  });
  expect(contrast, "Named control text or icon must contrast with its solid background").toBeGreaterThanOrEqual(minimum);
}

export async function auditKeyboardFocus(action: Locator) {
  await expect(action).toBeFocused();
  await expect.poll(async () => action.evaluate((element) => {
    const style = getComputedStyle(element);
    return element.matches(":focus-visible") &&
      ((style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0 &&
        !["transparent", "rgba(0, 0, 0, 0)"].includes(style.outlineColor)) || style.boxShadow !== "none");
  }), { message: "Keyboard focus must have a visible indicator" }).toBe(true);
}

export async function auditReducedMotionStatus(critical: Locator) {
  await expect(critical).toBeVisible();
  await expect.poll(async () => critical.evaluate((element) => {
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) return "media not emulated";
    if (!element.closest('[aria-busy="true"]')) {
      const animations = new Set(element.getAnimations({ subtree: true }));
      let opacity = 1;
      for (let node: Element | null = element; node; node = node.parentElement) {
        opacity *= Number(getComputedStyle(node).opacity);
        for (const animation of node.getAnimations()) animations.add(animation);
      }
      if (opacity < 0.99) return "content is still faded or hidden";
      if ([...animations].some((animation) =>
        animation.playState === "running" && animation.effect?.getTiming().iterations === Infinity,
      )) return "critical content is still animating";
      return "usable";
    }
    return "critical content is still loading";
  }), { message: "Critical content must settle and remain visible with reduced motion" }).toBe("usable");
}
