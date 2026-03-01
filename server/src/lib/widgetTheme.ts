import dns from "node:dns/promises";
import net from "node:net";
import { chromium } from "playwright";
import { z } from "zod";

const scrapeCache = new Map<string, { expiresAt: number; value: { tokens: WidgetThemeTokens; warnings: string[] } }>();
const SCRAPE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SCRAPE_TIMEOUT_MS = 12_000;
const MAX_WARNINGS = 20;
const MAX_RESPONSE_BYTES = 16_000;

const colorSchema = z.string().trim().min(1).max(64);

const widgetThemeColorsSchema = z.object({
  primary: colorSchema,
  primaryHover: colorSchema,
  background: colorSchema,
  surface: colorSchema,
  text: colorSchema,
  mutedText: colorSchema,
  border: colorSchema
});

const widgetThemeRadiiSchema = z.object({
  sm: z.number().min(0).max(64),
  md: z.number().min(0).max(64),
  lg: z.number().min(0).max(64)
});

const widgetThemeShadowsSchema = z
  .object({
    card: z.string().trim().min(1).max(256).optional()
  })
  .optional();

export const widgetThemeTokensSchema = z.object({
  fontFamily: z.string().trim().min(1).max(200),
  headingFontFamily: z.string().trim().min(1).max(200).optional(),
  colors: widgetThemeColorsSchema,
  radii: widgetThemeRadiiSchema,
  shadows: widgetThemeShadowsSchema,
  logoUrl: z.string().url().max(2048).optional()
});

export type WidgetThemeTokens = z.infer<typeof widgetThemeTokensSchema>;

export const defaultWidgetThemeTokens: WidgetThemeTokens = {
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
  headingFontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
  colors: {
    primary: "#0f172a",
    primaryHover: "#1e293b",
    background: "#f8fafc",
    surface: "#ffffff",
    text: "#0f172a",
    mutedText: "#475569",
    border: "rgba(15, 23, 42, 0.14)"
  },
  radii: {
    sm: 6,
    md: 10,
    lg: 14
  },
  shadows: {
    card: "0 8px 26px rgba(15, 23, 42, 0.08)"
  }
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const normalizeWidgetThemeTokens = (raw: unknown): WidgetThemeTokens => {
  const parsed = widgetThemeTokensSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }

  const asObject = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawColors = asObject.colors && typeof asObject.colors === "object" ? (asObject.colors as Record<string, unknown>) : {};
  const rawRadii = asObject.radii && typeof asObject.radii === "object" ? (asObject.radii as Record<string, unknown>) : {};
  const rawShadows = asObject.shadows && typeof asObject.shadows === "object" ? (asObject.shadows as Record<string, unknown>) : {};

  return {
    fontFamily:
      typeof asObject.fontFamily === "string" && asObject.fontFamily.trim().length > 0
        ? asObject.fontFamily.trim()
        : defaultWidgetThemeTokens.fontFamily,
    headingFontFamily:
      typeof asObject.headingFontFamily === "string" && asObject.headingFontFamily.trim().length > 0
        ? asObject.headingFontFamily.trim()
        : defaultWidgetThemeTokens.headingFontFamily,
    colors: {
      primary: typeof rawColors.primary === "string" ? rawColors.primary : defaultWidgetThemeTokens.colors.primary,
      primaryHover:
        typeof rawColors.primaryHover === "string" ? rawColors.primaryHover : defaultWidgetThemeTokens.colors.primaryHover,
      background:
        typeof rawColors.background === "string" ? rawColors.background : defaultWidgetThemeTokens.colors.background,
      surface: typeof rawColors.surface === "string" ? rawColors.surface : defaultWidgetThemeTokens.colors.surface,
      text: typeof rawColors.text === "string" ? rawColors.text : defaultWidgetThemeTokens.colors.text,
      mutedText: typeof rawColors.mutedText === "string" ? rawColors.mutedText : defaultWidgetThemeTokens.colors.mutedText,
      border: typeof rawColors.border === "string" ? rawColors.border : defaultWidgetThemeTokens.colors.border
    },
    radii: {
      sm: clamp(toFiniteNumber(rawRadii.sm) ?? defaultWidgetThemeTokens.radii.sm, 0, 64),
      md: clamp(toFiniteNumber(rawRadii.md) ?? defaultWidgetThemeTokens.radii.md, 0, 64),
      lg: clamp(toFiniteNumber(rawRadii.lg) ?? defaultWidgetThemeTokens.radii.lg, 0, 64)
    },
    shadows:
      typeof rawShadows.card === "string" && rawShadows.card.trim().length > 0
        ? { card: rawShadows.card.trim() }
        : defaultWidgetThemeTokens.shadows,
    logoUrl:
      typeof asObject.logoUrl === "string" && asObject.logoUrl.startsWith("https://")
        ? asObject.logoUrl
        : undefined
  };
};

const parseCssColor = (value: string): [number, number, number] | null => {
  const raw = value.trim().toLowerCase();
  if (raw.startsWith("#")) {
    const hex = raw.slice(1);
    if (hex.length === 3) {
      const r = Number.parseInt(hex[0] + hex[0], 16);
      const g = Number.parseInt(hex[1] + hex[1], 16);
      const b = Number.parseInt(hex[2] + hex[2], 16);
      if ([r, g, b].every((item) => Number.isFinite(item))) return [r, g, b];
      return null;
    }
    if (hex.length === 6) {
      const r = Number.parseInt(hex.slice(0, 2), 16);
      const g = Number.parseInt(hex.slice(2, 4), 16);
      const b = Number.parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].every((item) => Number.isFinite(item))) return [r, g, b];
      return null;
    }
  }

  const rgb = raw.match(/^rgba?\(([^)]+)\)$/);
  if (!rgb) return null;
  const parts = rgb[1].split(",").map((item) => Number.parseFloat(item.trim()));
  if (parts.length < 3 || parts.slice(0, 3).some((item) => !Number.isFinite(item))) return null;
  return [clamp(parts[0], 0, 255), clamp(parts[1], 0, 255), clamp(parts[2], 0, 255)];
};

const rgbToHex = (rgb: [number, number, number]) =>
  `#${rgb
    .map((value) => Math.round(value).toString(16).padStart(2, "0"))
    .join("")}`;

const relativeLuminance = (rgb: [number, number, number]) => {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const lighten = (color: string, amount = 0.14) => {
  const parsed = parseCssColor(color);
  if (!parsed) return color;
  return rgbToHex([
    parsed[0] + (255 - parsed[0]) * amount,
    parsed[1] + (255 - parsed[1]) * amount,
    parsed[2] + (255 - parsed[2]) * amount
  ] as [number, number, number]);
};

const darken = (color: string, amount = 0.12) => {
  const parsed = parseCssColor(color);
  if (!parsed) return color;
  return rgbToHex([
    parsed[0] * (1 - amount),
    parsed[1] * (1 - amount),
    parsed[2] * (1 - amount)
  ] as [number, number, number]);
};

const deriveSurface = (backgroundColor: string) => {
  const parsed = parseCssColor(backgroundColor);
  if (!parsed) return defaultWidgetThemeTokens.colors.surface;
  const lum = relativeLuminance(parsed);
  if (lum > 0.55) return "#ffffff";
  return lighten(backgroundColor, 0.18);
};

const deriveMutedText = (textColor: string, backgroundColor: string) => {
  const text = parseCssColor(textColor);
  const background = parseCssColor(backgroundColor);
  if (!text || !background) return defaultWidgetThemeTokens.colors.mutedText;
  return rgbToHex([
    text[0] * 0.72 + background[0] * 0.28,
    text[1] * 0.72 + background[1] * 0.28,
    text[2] * 0.72 + background[2] * 0.28
  ] as [number, number, number]);
};

const isPrivateIpv4 = (ip: string) => {
  const parts = ip.split(".").map((item) => Number.parseInt(item, 10));
  if (parts.length !== 4 || parts.some((item) => Number.isNaN(item) || item < 0 || item > 255)) return true;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
};

const isPrivateIpv6 = (ip: string) => {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("::ffff:")) {
    const maybeIpv4 = normalized.slice(7);
    if (net.isIP(maybeIpv4) === 4) return isPrivateIpv4(maybeIpv4);
  }
  return false;
};

const isPrivateIp = (ip: string) => {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return true;
};

const ensureSafeHttpsUrl = async (rawUrl: string) => {
  const parsed = new URL(rawUrl);

  if (parsed.protocol !== "https:") {
    throw new Error("Only https URLs are allowed");
  }

  const hostname = parsed.hostname.trim().toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".local")) {
    throw new Error("Local/private hosts are not allowed");
  }

  if (hostname.length > 255) {
    throw new Error("Hostname is too long");
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error("Private IP ranges are not allowed");
    }
    return parsed;
  }

  const resolved = await dns.lookup(hostname, { all: true, verbatim: true });
  if (resolved.length === 0) {
    throw new Error("Unable to resolve host");
  }

  for (const result of resolved) {
    if (isPrivateIp(result.address)) {
      throw new Error("Private IP ranges are not allowed");
    }
  }

  return parsed;
};

const coercePxRadius = (rawValue: string | null | undefined) => {
  if (!rawValue || rawValue === "0" || rawValue === "0px") return null;
  const parsed = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsed)) return null;
  return clamp(parsed, 0, 64);
};

const sanitizeWarnings = (warnings: string[]) => {
  const unique = [...new Set(warnings.map((item) => item.trim()).filter((item) => item.length > 0))];
  return unique.slice(0, MAX_WARNINGS);
};

export const scrapeWidgetThemeFromUrl = async (sourceUrl: string): Promise<{ tokens: WidgetThemeTokens; warnings: string[] }> => {
  const safeUrl = await ensureSafeHttpsUrl(sourceUrl);
  const cacheKey = safeUrl.toString();
  const now = Date.now();

  const cached = scrapeCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to launch Playwright Chromium";
    if (message.includes("Executable doesn't exist")) {
      throw new Error(
        "Playwright browser is not installed. Run: corepack pnpm --filter @pmm/server exec playwright install chromium"
      );
    }
    throw error;
  }

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(cacheKey, { timeout: SCRAPE_TIMEOUT_MS, waitUntil: "domcontentloaded" });

    // Pass script as string so the bundler does not inject __name etc. into page.evaluate serialization
    const extracted = await page.evaluate(`
      (function() {
        var warnings = [];
        function isVisible(element) {
          if (!element) return false;
          var style = window.getComputedStyle(element);
          if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
          var rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }
        function firstVisible(selectors) {
          for (var i = 0; i < selectors.length; i++) {
            var found = document.querySelectorAll(selectors[i]);
            for (var j = 0; j < found.length; j++) {
              if (isVisible(found[j])) return found[j];
            }
          }
          return null;
        }
        var bodyStyle = window.getComputedStyle(document.body);
        var link = firstVisible(["a[href]"]);
        var button = firstVisible(["button", "input[type='button']", "input[type='submit']", "[role='button']", ".btn", "[class*='button']"]);
        var separator = firstVisible(["hr", "[class*='divider']", "[class*='separator']", "[class*='border']"]);
        var headerLogo = firstVisible(["header img", "nav img", "img[alt*='logo' i]", "[class*='logo'] img"]);
        var heading = firstVisible(["h1", "h2", "[role='heading']"]);
        var mutedTextElement = firstVisible(["small", "p", "[class*='muted']", "[class*='secondary']"]);
        var cardLike = firstVisible(["main section", "article", "[class*='card']", "[class*='panel']"]);
        if (!link) warnings.push("No visible link found; used fallback primary color.");
        if (!button) warnings.push("No visible button found; used fallback radius and hover color.");
        if (!separator) warnings.push("No separator found; used fallback border color.");
        if (!headerLogo || typeof headerLogo.src !== "string") warnings.push("No header logo found.");
        var separatorColor = null;
        if (separator) {
          var s = window.getComputedStyle(separator);
          separatorColor = s.borderColor || s.borderTopColor || s.borderBottomColor;
        }
        return {
          bodyFontFamily: bodyStyle.fontFamily,
          bodyColor: bodyStyle.color,
          bodyBackgroundColor: bodyStyle.backgroundColor,
          headingFontFamily: heading ? window.getComputedStyle(heading).fontFamily : null,
          linkColor: link ? window.getComputedStyle(link).color : null,
          buttonBackgroundColor: button ? window.getComputedStyle(button).backgroundColor : null,
          buttonRadius: button ? window.getComputedStyle(button).borderRadius : null,
          separatorColor: separatorColor,
          mutedTextColor: mutedTextElement ? window.getComputedStyle(mutedTextElement).color : null,
          cardShadow: cardLike ? window.getComputedStyle(cardLike).boxShadow : null,
          logoSrc: headerLogo && typeof headerLogo.src === "string" && headerLogo.src ? headerLogo.src : null,
          warnings: warnings
        };
      })()
    `);

    const primary = extracted.linkColor || extracted.buttonBackgroundColor || defaultWidgetThemeTokens.colors.primary;
    const background = extracted.bodyBackgroundColor || defaultWidgetThemeTokens.colors.background;
    const text = extracted.bodyColor || defaultWidgetThemeTokens.colors.text;
    const surface = deriveSurface(background);

    const tokens = normalizeWidgetThemeTokens({
      fontFamily: extracted.bodyFontFamily || defaultWidgetThemeTokens.fontFamily,
      headingFontFamily: extracted.headingFontFamily || extracted.bodyFontFamily || defaultWidgetThemeTokens.headingFontFamily,
      colors: {
        primary,
        primaryHover: darken(primary, 0.14),
        background,
        surface,
        text,
        mutedText: extracted.mutedTextColor || deriveMutedText(text, background),
        border: extracted.separatorColor || "rgba(0, 0, 0, 0.12)"
      },
      radii: {
        sm: clamp((coercePxRadius(extracted.buttonRadius) ?? defaultWidgetThemeTokens.radii.sm) * 0.75, 0, 64),
        md: clamp(coercePxRadius(extracted.buttonRadius) ?? defaultWidgetThemeTokens.radii.md, 0, 64),
        lg: clamp((coercePxRadius(extracted.buttonRadius) ?? defaultWidgetThemeTokens.radii.lg) * 1.25, 0, 64)
      },
      shadows:
        extracted.cardShadow && extracted.cardShadow !== "none"
          ? { card: extracted.cardShadow }
          : defaultWidgetThemeTokens.shadows,
      logoUrl: extracted.logoSrc?.startsWith("https://") ? extracted.logoSrc : undefined
    });

    const warnings = sanitizeWarnings([
      ...extracted.warnings,
      extracted.logoSrc && !extracted.logoSrc.startsWith("https://") ? "Logo URL was not https and was omitted." : ""
    ]);

    const payload = { tokens, warnings };
    const payloadSize = Buffer.byteLength(JSON.stringify(payload), "utf8");
    if (payloadSize > MAX_RESPONSE_BYTES) {
      throw new Error("Scrape payload exceeded response size limit");
    }

    scrapeCache.set(cacheKey, {
      expiresAt: now + SCRAPE_CACHE_TTL_MS,
      value: payload
    });

    await context.close();
    return payload;
  } finally {
    await browser.close();
  }
};
