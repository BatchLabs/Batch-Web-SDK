import { MessageColorScheme } from "com.batch.dom/render/model/model";
import { RENDER_LOG_MODULE } from "com.batch.dom/render/render-constants";
import { Log } from "com.batch.shared/logger";

export type MessageThemeMode = "auto" | "light" | "dark";

/** Resolves the current color scheme from the host environment. */
export function resolveScheme(): MessageColorScheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Validates theme input and falls back to `auto` for unsupported values. */
export function normalizeThemeMode(mode: string): MessageThemeMode {
  if (mode === "auto" || mode === "light" || mode === "dark") {
    return mode;
  }

  Log.warn(RENDER_LOG_MODULE, `Invalid message theme mode "${mode}", falling back to "auto".`);
  return "auto";
}

/** Resolves the theme attribute applied to message hosts; keeps `auto` only when the media query can be evaluated. */
export function resolveThemeAttribute(mode: MessageThemeMode): MessageThemeMode {
  if (mode !== "auto") {
    return mode;
  }

  if (supportsPreferredColorSchemeMediaQuery()) {
    return "auto";
  }

  return resolveScheme();
}

export function applyThemeToHost(host: HTMLElement, mode: MessageThemeMode): void {
  host.setAttribute("data-batch-messaging-theme", resolveThemeAttribute(mode));
}

function supportsPreferredColorSchemeMediaQuery(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").media !== "not all";
}
