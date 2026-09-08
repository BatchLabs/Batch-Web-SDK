import { MessageBox, MessageFontDecoration, MessageHeightType, MessageWidthType } from "com.batch.dom/render/model/model";
import { MessageColor, MessageHideOn } from "com.batch.dom/render/model/types";

export function colorToCSS(color: string | undefined): string | undefined {
  if (typeof color !== "string" || color.length === 0) return undefined;
  return hexRgbaToCSS(color);
}

export function resolveColorPair(
  color: MessageColor | undefined,
  fallbackLight?: string,
  fallbackDark?: string
): [string | undefined, string | undefined] {
  const light = colorToCSS(color?.[0]) ?? fallbackLight;
  const dark = colorToCSS(color?.[1] ?? color?.[0]) ?? fallbackDark ?? light;
  return [light, dark];
}

export function setThemePair(el: HTMLElement, name: string, light: string | undefined, dark?: string): void {
  if (light !== undefined) {
    el.style.setProperty(`--${name}`, light);
  }
  const darkValue = dark ?? light;
  if (darkValue !== undefined) {
    el.style.setProperty(`--${name}-dark`, darkValue);
  }
}

export function applyThemePair(
  el: HTMLElement,
  name: string,
  color: MessageColor | undefined,
  fallbackLight?: string,
  fallbackDark?: string
): void {
  const [light, dark] = resolveColorPair(color, fallbackLight, fallbackDark);
  setThemePair(el, name, light, dark);
}

/** Sets the responsive pair `--{name}` and `--{name}-desktop`. Always set both: custom properties inherit. */
export function setResponsivePair(el: HTMLElement, name: string, base: string | undefined, desktop?: string): void {
  if (base === undefined) return;
  el.style.setProperty(`--${name}`, base);
  el.style.setProperty(`--${name}-desktop`, desktop ?? base);
}

export function applyResponsiveBox(el: HTMLElement, name: string, base: MessageBox | undefined, desktop?: MessageBox): void {
  setResponsivePair(el, name, boxToCSS(base), boxToCSS(desktop));
}

export function applyResponsiveLength(el: HTMLElement, name: string, basePx: number, desktopPx?: number): void {
  setResponsivePair(el, name, `${basePx}px`, desktopPx !== undefined ? `${desktopPx}px` : undefined);
}

/** Tags the element so the stylesheet's breakpoint rules can hide it on one side. */
export function applyHideOn(el: HTMLElement, hideOn: MessageHideOn | undefined): void {
  if (hideOn !== undefined) {
    el.classList.add(`iam-hide-${hideOn}`);
  }
}

export function boxToCSS(values: MessageBox): string;
export function boxToCSS(values: MessageBox | undefined): string | undefined;
export function boxToCSS(values: MessageBox | undefined): string | undefined {
  if (!values) return undefined;
  return values.map(v => `${v}px`).join(" ");
}

export function radiusToCSS(values: MessageBox): string;
export function radiusToCSS(values: MessageBox | undefined): string | undefined;
export function radiusToCSS(values: MessageBox | undefined): string | undefined {
  return boxToCSS(values);
}

function hexRgbaToCSS(hex: string): string {
  const h = hex.replace("#", "").trim();
  if (/^[0-9a-fA-F]{8}$/.test(h)) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = parseInt(h.slice(6, 8), 16) / 255;
    return `rgba(${r},${g},${b},${a.toFixed(3)})`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(h)) {
    return `#${h}`;
  }
  return hex;
}

/** Tells whether a color paints nothing: `transparent`, a zero-alpha hex, or an explicit zero alpha. */
export function isTransparentColor(color: string): boolean {
  const value = color.trim().toLowerCase();
  if (value === "transparent") {
    return true;
  }

  const hex = value.replace("#", "");
  if (/^[0-9a-f]{8}$/.test(hex)) {
    return parseInt(hex.slice(6, 8), 16) === 0;
  }

  const fn = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(([^)]*)\)$/.exec(value);
  if (!fn) {
    return false;
  }
  // Both the slash form, `rgb(r g b / 0)`, and the legacy 4-argument comma
  // form, `rgba(r, g, b, 0)`, carry the alpha in the last position.
  const slashed = fn[1].split("/");
  const args = slashed.length > 1 ? slashed[1] : fn[1].split(",").length === 4 ? fn[1].split(",")[3] : undefined;
  return args !== undefined && parseFloat(args) === 0;
}

export function resolveHeight(height: MessageHeightType): Partial<CSSStyleDeclaration> {
  if (height === "fill") return { flex: "1 1 0", minHeight: "0" };
  if (height === "auto") return { height: "auto" };
  return { height: `${height.px}px` };
}

export function resolveWidth(width: MessageWidthType): string {
  if (width === "fill") return "100%";
  if ("px" in width) return `${width.px}px`;
  return `${width.percent}%`;
}

export function applyRadius(el: HTMLElement, radius: MessageBox): void {
  el.style.borderRadius = radiusToCSS(radius);
}

export function applyLineClamp(el: HTMLElement, maxLines: number): void {
  if (maxLines <= 0) {
    el.style.overflow = "visible";
    el.style.textOverflow = "clip";
    el.style.whiteSpace = "normal";
    el.style.webkitLineClamp = "";
    el.style.removeProperty("-webkit-box-orient");
    return;
  }

  el.style.overflow = "hidden";
  el.style.textOverflow = "ellipsis";

  if (maxLines === 1) {
    el.style.whiteSpace = "nowrap";
    el.style.display = "block";
    el.style.webkitLineClamp = "";
    el.style.removeProperty("-webkit-box-orient");
    return;
  }

  el.style.whiteSpace = "normal";
  el.style.display = "-webkit-box";
  el.style.webkitLineClamp = String(maxLines);
  el.style.setProperty("-webkit-box-orient", "vertical");
}

export function applyFontDecoration(el: HTMLElement, decorations: MessageFontDecoration[]): void {
  // Reset first. Browser default button styles apply an unwanted bold weight.
  el.style.fontWeight = decorations.includes("bold") ? "700" : "400";
  el.style.fontStyle = decorations.includes("italic") ? "italic" : "normal";

  const textDecorations: string[] = [];
  if (decorations.includes("underline")) textDecorations.push("underline");
  if (decorations.includes("stroke")) textDecorations.push("line-through");
  const value = textDecorations.length > 0 ? textDecorations.join(" ") : "none";
  // Controls support `textDecoration` more widely than `textDecorationLine`.
  el.style.textDecoration = value;
  el.style.textDecorationLine = value;
}
