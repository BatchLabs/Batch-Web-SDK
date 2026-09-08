import { RENDER_LOG_MODULE } from "com.batch.dom/render/render-constants";
import { Log } from "com.batch.shared/logger";

import { MessageFontConfig, sanitizeFontFamily } from "./font-manager";

type FontFaceSetWithAdd = FontFaceSet & {
  add(face: FontFace): FontFaceSet;
  delete(face: FontFace): boolean;
};

const STYLESHEET_TIMEOUT_MS = 5000;
const STYLESHEET_ATTRIBUTE = "data-batch-messaging-font";

const loadedFaces = new Map<string, FontFace>();
let activeStylesheetUrl: string | null = null;

/** Detects whether a font URL points directly to a font file rather than a CSS stylesheet. */
export function isDirectFontUrl(url: string): boolean {
  return /\.(woff2?|ttf|otf|eot)$/i.test(url.split("?")[0]);
}

/**
 * Loads the font a config names and resolves with the sanitized family, or null when nothing usable remains. A load failure still resolves
 * with the family.
 */
export async function loadMessageFont(config: MessageFontConfig): Promise<string | null> {
  const family = sanitizeFontFamily(config.family);
  if (family === null) {
    Log.publicError(`[Message] Ignoring custom font "${config.family}": its name holds no usable character.`);
    return null;
  }

  const { url } = config;
  if (!url) {
    return family;
  }

  if (isDirectFontUrl(url)) {
    const key = `${family}::${url}`;
    if (loadedFaces.has(key)) {
      return family;
    }
    try {
      // The url goes inside a quoted CSS `url()`: escape the quote and the backslash.
      const face = new FontFace(family, `url("${url.replace(/["\\]/g, "\\$&")}")`, { display: "swap" });
      (document.fonts as FontFaceSetWithAdd).add(face);
      await face.load();
      loadedFaces.set(key, face);
    } catch (e: unknown) {
      Log.publicError(`[Message] Failed to load custom font "${family}" from ${url}. Text will render in the fallback font.`);
      Log.error(RENDER_LOG_MODULE, "Font load error:", e);
    }
    return family;
  }

  if (activeStylesheetUrl === url) {
    return family;
  }
  const link = ensureFontStylesheet(url);
  const loaded = await waitForStylesheet(link, url);
  if (loaded) {
    await document.fonts.ready;
    activeStylesheetUrl = url;
  } else {
    activeStylesheetUrl = null;
  }
  return family;
}

/** Removes every face and stylesheet this module registered. Called when the override is cleared. */
export function unloadMessageFonts(): void {
  const fonts = document.fonts as FontFaceSetWithAdd;
  loadedFaces.forEach(face => fonts.delete(face));
  loadedFaces.clear();
  document.querySelector(`link[${STYLESHEET_ATTRIBUTE}]`)?.remove();
  activeStylesheetUrl = null;
}

function ensureFontStylesheet(url: string): HTMLLinkElement {
  // Recreate the link: a stale `once: true` listener fires too early when the href changes mid-request.
  document.querySelector(`link[${STYLESHEET_ATTRIBUTE}]`)?.remove();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  link.setAttribute(STYLESHEET_ATTRIBUTE, "");
  document.head.appendChild(link);
  return link;
}

function waitForStylesheet(link: HTMLLinkElement, url: string): Promise<boolean> {
  return new Promise(resolve => {
    if (link.sheet) {
      resolve(true);
      return;
    }

    const timer = setTimeout(() => {
      Log.warn(RENDER_LOG_MODULE, `Message font stylesheet did not load within ${STYLESHEET_TIMEOUT_MS}ms: ${url}`);
      resolve(false);
    }, STYLESHEET_TIMEOUT_MS);

    link.addEventListener(
      "load",
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      { once: true }
    );
    link.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        Log.warn(RENDER_LOG_MODULE, `Failed to load message font stylesheet: ${url}`);
        resolve(false);
      },
      { once: true }
    );
  });
}
