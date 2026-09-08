/* eslint-env jest */

import type { MessageImageModel } from "com.batch.dom/render/model/model";
import {
  DEFAULT_BOX_FALLBACK,
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_IMAGE_HEIGHT,
  DEFAULT_IMAGE_RADIUS,
} from "com.batch.dom/render/model/normalizer-defaults";
import type { MessageImagePayload } from "com.batch.dom/render/model/types";
import type { ComponentMatrixSpec, PropMatrix } from "com.batch.dom/render/test-utils/prop-matrix";
import {
  componentMessage,
  expectResponsivePair,
  normalizeCase,
  renderCase,
  runComponentMatrix,
  selectFirstChild,
} from "com.batch.dom/render/test-utils/prop-matrix";

const IMAGE_URL = "https://cdn.example.test/hero.png";

const img = (el: HTMLElement): HTMLImageElement | null => el.querySelector("img");

const FALLBACK_BOX_CSS = "0px 0px 0px 0px";
const FALLBACK_RADIUS_CSS = `${DEFAULT_IMAGE_RADIUS}px ${DEFAULT_IMAGE_RADIUS}px ${DEFAULT_IMAGE_RADIUS}px ${DEFAULT_IMAGE_RADIUS}px`;
const FALLBACK_BOX_MODEL = [DEFAULT_BOX_FALLBACK, DEFAULT_BOX_FALLBACK, DEFAULT_BOX_FALLBACK, DEFAULT_BOX_FALLBACK];

const props: PropMatrix<MessageImagePayload, MessageImageModel> = {
  aspect: {
    cases: [
      {
        name: "fit → contain",
        patch: { aspect: "fit" },
        expectModel: m => expect(m.configuration.style.aspect).toBe("fit"),
        expectCss: el => expect(img(el)?.style.objectFit).toBe("contain"),
      },
      {
        name: "fill → cover",
        patch: { aspect: "fill" },
        expectModel: m => expect(m.configuration.style.aspect).toBe("fill"),
        expectCss: el => expect(img(el)?.style.objectFit).toBe("cover"),
      },
      {
        name: "omitted → DEFAULT_IMAGE_ASPECT_RATIO (cover)",
        patch: {},
        expectModel: m => expect(m.configuration.style.aspect).toBe(DEFAULT_IMAGE_ASPECT_RATIO),
        expectCss: el => expect(img(el)?.style.objectFit).toBe("cover"),
      },
      {
        name: "invalid → DEFAULT_IMAGE_ASPECT_RATIO (cover)",
        patch: { aspect: "square" },
        expectModel: m => expect(m.configuration.style.aspect).toBe(DEFAULT_IMAGE_ASPECT_RATIO),
        expectCss: el => expect(img(el)?.style.objectFit).toBe("cover"),
      },
    ],
  },

  height: {
    cases: [
      {
        name: "auto → wrapper height auto",
        patch: { height: "auto" },
        expectModel: m => expect(m.configuration.placement.height).toBe("auto"),
        expectCss: el => expect(el.style.height).toBe("auto"),
      },
      {
        name: "fill → flex 1 1 0 / minHeight 0",
        patch: { height: "fill" },
        expectModel: m => expect(m.configuration.placement.height).toBe("fill"),
        expectCss: el => {
          expect(el.style.flex).toBe("1 1 0px");
          expect(el.style.minHeight).toBe("0");
        },
      },
      {
        name: "px → wrapper height in px",
        patch: { height: "240px" },
        expectModel: m => expect(m.configuration.placement.height).toEqual({ px: 240 }),
        expectCss: el => expect(el.style.height).toBe("240px"),
      },
      {
        name: "percent unsupported → DEFAULT_IMAGE_HEIGHT (auto)",
        patch: { height: "50%" },
        expectModel: m => expect(m.configuration.placement.height).toBe(DEFAULT_IMAGE_HEIGHT),
        expectCss: el => expect(el.style.height).toBe("auto"),
      },
      {
        name: "omitted → DEFAULT_IMAGE_HEIGHT (auto)",
        patch: { height: undefined },
        expectModel: m => expect(m.configuration.placement.height).toBe(DEFAULT_IMAGE_HEIGHT),
        expectCss: el => expect(el.style.height).toBe("auto"),
      },
      {
        name: "invalid → DEFAULT_IMAGE_HEIGHT (auto)",
        patch: { height: "tall" },
        expectModel: m => expect(m.configuration.placement.height).toBe(DEFAULT_IMAGE_HEIGHT),
        expectCss: el => expect(el.style.height).toBe("auto"),
      },
    ],
  },

  radius: {
    cases: [
      {
        name: "four-value box",
        patch: { radius: [8, 4, 8, 4] },
        expectModel: m => expect(m.configuration.style.radius).toEqual([8, 4, 8, 4]),
        expectCss: el => expect(el.style.borderRadius).toBe("8px 4px 8px 4px"),
      },
      {
        name: "shorthand [8,4] → [8,4,8,4]",
        patch: { radius: [8, 4] },
        expectModel: m => expect(m.configuration.style.radius).toEqual([8, 4, 8, 4]),
        expectCss: el => expect(el.style.borderRadius).toBe("8px 4px 8px 4px"),
      },
      {
        name: "omitted → DEFAULT_IMAGE_RADIUS box",
        patch: {},
        expectModel: m =>
          expect(m.configuration.style.radius).toEqual([
            DEFAULT_IMAGE_RADIUS,
            DEFAULT_IMAGE_RADIUS,
            DEFAULT_IMAGE_RADIUS,
            DEFAULT_IMAGE_RADIUS,
          ]),
        expectCss: el => expect(el.style.borderRadius).toBe(FALLBACK_RADIUS_CSS),
      },
      {
        name: "negative → DEFAULT_IMAGE_RADIUS box",
        patch: { radius: [-8] },
        expectModel: m =>
          expect(m.configuration.style.radius).toEqual([
            DEFAULT_IMAGE_RADIUS,
            DEFAULT_IMAGE_RADIUS,
            DEFAULT_IMAGE_RADIUS,
            DEFAULT_IMAGE_RADIUS,
          ]),
        expectCss: el => expect(el.style.borderRadius).toBe(FALLBACK_RADIUS_CSS),
      },
    ],
  },

  margin: {
    cases: [
      {
        name: "explicit → --iam-margin pair",
        patch: { margin: [8, 16, 4, 12] },
        expectModel: m => expect(m.configuration.placement.margin).toEqual([8, 16, 4, 12]),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: "8px 16px 4px 12px" }),
      },
      {
        name: "shorthand [10,20] → [10,20,10,20]",
        patch: { margin: [10, 20] },
        expectModel: m => expect(m.configuration.placement.margin).toEqual([10, 20, 10, 20]),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: "10px 20px 10px 20px" }),
      },
      {
        name: "omitted → DEFAULT_BOX_FALLBACK box",
        patch: {},
        expectModel: m => expect(m.configuration.placement.margin).toEqual(FALLBACK_BOX_MODEL),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: FALLBACK_BOX_CSS }),
      },
      {
        name: "invalid → DEFAULT_BOX_FALLBACK box",
        patch: { margin: ["8", "16"] },
        expectModel: m => expect(m.configuration.placement.margin).toEqual(FALLBACK_BOX_MODEL),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: FALLBACK_BOX_CSS }),
      },
    ],
  },

  marginDesktop: {
    cases: [
      {
        name: "explicit stamps -desktop",
        patch: { margin: [8, 16, 4, 12], marginDesktop: [16, 32, 8, 24] },
        expectModel: m => expect(m.configuration.placement.marginDesktop).toEqual([16, 32, 8, 24]),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: "8px 16px 4px 12px", desktop: "16px 32px 8px 24px" }),
      },
      {
        name: "omitted → model undefined, -desktop mirrors base",
        patch: { margin: [8, 16, 4, 12] },
        expectModel: m => expect(m.configuration.placement.marginDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: "8px 16px 4px 12px" }),
      },
      {
        name: "invalid → model undefined, -desktop mirrors base",
        patch: { margin: [8, 16, 4, 12], marginDesktop: [] },
        expectModel: m => expect(m.configuration.placement.marginDesktop).toBeUndefined(),
        expectCss: el => expectResponsivePair(el, "iam-margin", { base: "8px 16px 4px 12px" }),
      },
    ],
  },

  accessibilityLabel: {
    cases: [
      {
        name: "explicit → img.alt",
        patch: { accessibilityLabel: "Hero banner" },
        expectModel: m => expect(m.configuration.accessibility.label).toBe("Hero banner"),
        expectCss: el => expect(img(el)?.alt).toBe("Hero banner"),
      },
      {
        name: "blank → trimmed to undefined, alt empty",
        patch: { accessibilityLabel: "   " },
        expectModel: m => expect(m.configuration.accessibility.label).toBeUndefined(),
        expectCss: el => expect(img(el)?.alt).toBe(""),
      },
      {
        name: "omitted → undefined, alt empty",
        patch: {},
        expectModel: m => expect(m.configuration.accessibility.label).toBeUndefined(),
        expectCss: el => expect(img(el)?.alt).toBe(""),
      },
      {
        name: "non-string → undefined, alt empty",
        patch: { accessibilityLabel: 42 },
        expectModel: m => expect(m.configuration.accessibility.label).toBeUndefined(),
        expectCss: el => expect(img(el)?.alt).toBe(""),
      },
    ],
  },

  hideOn: {
    cases: [
      {
        name: "mobile → class iam-hide-mobile",
        patch: { hideOn: "mobile" },
        expectModel: m => expect(m.hideOn).toBe("mobile"),
        expectCss: el => expect(el.className).toContain("iam-hide-mobile"),
      },
      {
        name: "desktop → class iam-hide-desktop",
        patch: { hideOn: "desktop" },
        expectModel: m => expect(m.hideOn).toBe("desktop"),
        expectCss: el => expect(el.className).toContain("iam-hide-desktop"),
      },
      {
        name: "omitted → undefined, no hide class",
        patch: {},
        expectModel: m => expect(m.hideOn).toBeUndefined(),
        expectCss: el => expect(el.className).not.toContain("iam-hide"),
      },
      {
        name: "invalid → undefined, no hide class",
        patch: { hideOn: "sideways" },
        expectModel: m => expect(m.hideOn).toBeUndefined(),
        expectCss: el => expect(el.className).not.toContain("iam-hide"),
      },
    ],
  },
};

const spec: ComponentMatrixSpec<MessageImagePayload, MessageImageModel> = {
  label: "Image",
  buildPayload: (patch, message) =>
    componentMessage({ type: "image", id: "hero", height: "auto", ...patch }, { urls: { hero: IMAGE_URL }, ...message }),
  select: message => selectFirstChild<MessageImageModel>(message, "image"),
  props,
};

runComponentMatrix(spec);

describe("Image · source resolution", () => {
  test("id drives contentRef and image source", () => {
    const testCase = { name: "id", patch: { id: "hero" }, message: { urls: { hero: IMAGE_URL } } };
    const model = normalizeCase(spec, testCase);
    expect(model.id).toBe("hero");
    expect(model.configuration.contentRef).toBe("hero");
    expect(img(renderCase(spec, testCase))?.src).toBe(IMAGE_URL);
  });

  test("unsafe javascript: URL stripped → component dropped", () => {
    const el = renderCase(spec, { name: "unsafe url", message: { urls: { hero: "javascript:alert(1)" } } });
    expect(el.dataset.dropped).toBe("true");
  });
});
