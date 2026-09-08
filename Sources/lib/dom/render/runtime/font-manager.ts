import { RENDER_FONT_CSS_PROP } from "com.batch.dom/render/render-constants";

export interface MessageFontConfig {
  family: string;
  url?: string;
}

const FONT_FAMILY_UNSAFE = /[^a-zA-Z0-9 _-]/g;

/** Returns the family stripped of every character unsafe in a quoted CSS value, or null when nothing usable remains. */
export function sanitizeFontFamily(family: string): string | null {
  const safe = family.replace(FONT_FAMILY_UNSAFE, "");
  return safe.length === 0 ? null : safe;
}

/** Holds the renderer-level font override and writes it on the surface host. Loading the font is the host's job. */
export class MessageFontManager {
  private family: string | null = null;

  public get currentFamily(): string | undefined {
    return this.family ?? undefined;
  }

  public setFamily(host: HTMLElement | null, family: string | null): void {
    this.family = family;
    if (host) {
      this.applyToHost(host);
    }
  }

  public applyToHost(host: HTMLElement): void {
    if (this.family === null) {
      host.style.removeProperty(RENDER_FONT_CSS_PROP);
      return;
    }
    host.style.setProperty(RENDER_FONT_CSS_PROP, `"${this.family}", sans-serif`);
  }
}
