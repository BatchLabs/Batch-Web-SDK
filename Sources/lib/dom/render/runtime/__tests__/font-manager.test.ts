/* eslint-env jest */

import { RENDER_FONT_CSS_PROP } from "com.batch.dom/render/render-constants";
import { MessageFontManager, sanitizeFontFamily } from "com.batch.dom/render/runtime/font-manager";

const FONT_PROP = RENDER_FONT_CSS_PROP;

describe("sanitizeFontFamily", () => {
  test("strips every character unsafe in a quoted CSS value", () => {
    expect(sanitizeFontFamily("My <Bad> Font!")).toBe("My Bad Font");
    expect(sanitizeFontFamily("PT_Sans.Web")).toBe("PT_SansWeb");
    expect(sanitizeFontFamily("Inter")).toBe("Inter");
  });

  test("returns null when the name holds no usable character", () => {
    expect(sanitizeFontFamily("日本語")).toBeNull();
    expect(sanitizeFontFamily("")).toBeNull();
  });
});

describe("MessageFontManager", () => {
  test("removes the font property when no family is configured", () => {
    const manager = new MessageFontManager();
    const host = document.createElement("div");
    host.style.setProperty(FONT_PROP, `"Stale", sans-serif`);

    manager.applyToHost(host);

    expect(host.style.getPropertyValue(FONT_PROP)).toBe("");
  });

  test("writes the configured family and reports that same family", () => {
    const manager = new MessageFontManager();
    manager.setFamily(null, "My Bad Font");
    const host = document.createElement("div");

    manager.applyToHost(host);

    expect(host.style.getPropertyValue(FONT_PROP)).toBe(`"My Bad Font", sans-serif`);
    expect(manager.currentFamily).toBe("My Bad Font");
  });

  test("applies the family to the provided host right away", () => {
    const manager = new MessageFontManager();
    const host = document.createElement("div");

    manager.setFamily(host, "Inter");

    expect(host.style.getPropertyValue(FONT_PROP)).toBe(`"Inter", sans-serif`);
  });

  test("clears the family from the host when set to null", () => {
    const manager = new MessageFontManager();
    const host = document.createElement("div");
    manager.setFamily(host, "Inter");

    manager.setFamily(host, null);

    expect(host.style.getPropertyValue(FONT_PROP)).toBe("");
    expect(manager.currentFamily).toBeUndefined();
  });

  test("keeps the family without a host and applies it on the next host", () => {
    const manager = new MessageFontManager();

    manager.setFamily(null, "Inter");
    const host = document.createElement("div");
    manager.applyToHost(host);

    expect(host.style.getPropertyValue(FONT_PROP)).toBe(`"Inter", sans-serif`);
  });
});
