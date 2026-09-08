/* eslint-env jest */

import type { MessageCloseOptionsModel } from "com.batch.dom/render/model/model";
import {
  DEFAULT_CLOSE_BUTTON_BACKGROUND,
  DEFAULT_CLOSE_BUTTON_COLOR,
  DEFAULT_MODAL_CLOSE_BUTTON,
} from "com.batch.dom/render/model/normalizer-defaults";
import type { MessageCloseOptionPayload, MessageColor, MessagePayload } from "com.batch.dom/render/model/types";
import { renderCloseButton } from "com.batch.dom/render/render/components/close-button";
import { renderSurfaceProgressBar } from "com.batch.dom/render/render/components/progress-bar";
import { colorToCSS } from "com.batch.dom/render/render/dom-utils";
import type { ComponentMatrixSpec, PropMatrix } from "com.batch.dom/render/test-utils/prop-matrix";
import { expectThemePair, runComponentMatrix } from "com.batch.dom/render/test-utils/prop-matrix";

const closeBtn = (el: HTMLElement): HTMLElement => el.querySelector(".iam-close") as HTMLElement;
const progress = (el: HTMLElement): HTMLElement | null => el.querySelector<HTMLElement>(".iam-progress");

const progressBar = (el: HTMLElement): HTMLElement => {
  const bar = progress(el);
  if (!bar) {
    throw new Error("expected an auto-close progress bar");
  }
  return bar;
};

const css = (hex: string): string => colorToCSS(hex) ?? hex;
const pair = (color: MessageColor): { light: string; dark: string } => ({ light: css(color[0]), dark: css(color[1] ?? color[0]) });

const MODAL_COLOR = pair(DEFAULT_MODAL_CLOSE_BUTTON.color);
const MODAL_BG = pair(DEFAULT_MODAL_CLOSE_BUTTON.backgroundColor);
const CLOSE_COLOR = pair(DEFAULT_CLOSE_BUTTON_COLOR);
const CLOSE_BG = pair(DEFAULT_CLOSE_BUTTON_BACKGROUND);

const props: PropMatrix<MessageCloseOptionPayload, MessageCloseOptionsModel> = {
  auto: {
    cases: [
      {
        name: "delay fractional preserved (0.25)",
        patch: { auto: { delay: 0.25 } },
        expectModel: m => {
          expect(m.auto).toBeDefined();
          expect(m.auto?.delay).toBeCloseTo(0.25);
        },
        expectCss: el => expect(progressBar(el).style.animationDuration).toBe("0.25s"),
      },
      {
        name: "delay positive integer preserved (5)",
        patch: { auto: { delay: 5 } },
        expectModel: m => expect(m.auto?.delay).toBe(5),
        expectCss: el => expect(progressBar(el).style.animationDuration).toBe("5s"),
      },
      {
        name: "delay 0 → auto disabled",
        patch: { auto: { delay: 0 } },
        expectModel: m => expect(m.auto).toBeUndefined(),
        expectCss: el => expect(progress(el)).toBeNull(),
      },
      {
        name: "delay negative → auto disabled",
        patch: { auto: { delay: -5 } },
        expectModel: m => expect(m.auto).toBeUndefined(),
        expectCss: el => expect(progress(el)).toBeNull(),
      },
      {
        name: "omitted → auto disabled",
        patch: {},
        expectModel: m => expect(m.auto).toBeUndefined(),
        expectCss: el => expect(progress(el)).toBeNull(),
      },

      {
        name: "color explicit pair",
        patch: { auto: { delay: 5, color: ["#FF0000FF", "#00FF00FF"] } },
        expectModel: m => expect(m.auto?.color).toEqual(["#FF0000FF", "#00FF00FF"]),
        expectCss: el =>
          expectThemePair(progressBar(el), "iam-progress-color", { light: "rgba(255,0,0,1.000)", dark: "rgba(0,255,0,1.000)" }),
      },
      {
        name: "color single → dark mirrors light",
        patch: { auto: { delay: 5, color: ["#0000FFFF"] } },
        expectModel: m => expect(m.auto?.color).toEqual(["#0000FFFF", "#0000FFFF"]),
        expectCss: el => expectThemePair(progressBar(el), "iam-progress-color", { light: "rgba(0,0,255,1.000)" }),
      },
      {
        name: "color #RRGGBBAA alpha → rgba",
        patch: { auto: { delay: 5, color: ["#12345678"] } },
        expectModel: m => expect(m.auto?.color?.[0]).toBe("#12345678"),
        expectCss: el => expect(progressBar(el).style.getPropertyValue("--iam-progress-color")).toBe("rgba(18,52,86,0.471)"),
      },
      {
        name: "color omitted → no --iam-progress-color stamped",
        patch: { auto: { delay: 5 } },
        expectModel: m => expect(m.auto?.color).toBeUndefined(),
        expectCss: el => {
          const bar = progressBar(el);
          expect(bar.style.getPropertyValue("--iam-progress-color")).toBe("");
          expect(bar.style.getPropertyValue("--iam-progress-color-dark")).toBe("");
        },
      },
    ],
  },

  button: {
    cases: [
      {
        name: "color explicit pair",
        patch: { button: { color: ["#FF0000FF", "#00FF00FF"] } },
        expectModel: m => expect(m.button?.color).toEqual(["#FF0000FF", "#00FF00FF"]),
        expectCss: el => expectThemePair(closeBtn(el), "iam-close-color", { light: "rgba(255,0,0,1.000)", dark: "rgba(0,255,0,1.000)" }),
      },
      {
        name: "color single → dark mirrors light",
        patch: { button: { color: ["#ABCDEFFF"] } },
        expectModel: m => expect(m.button?.color).toEqual(["#ABCDEFFF", "#ABCDEFFF"]),
        expectCss: el => expectThemePair(closeBtn(el), "iam-close-color", { light: "rgba(171,205,239,1.000)" }),
      },
      {
        name: "color invalid → DEFAULT_CLOSE_BUTTON_COLOR (provided-button branch)",
        patch: { button: { color: ["not-a-color"] } },
        expectModel: m => expect(m.button?.color).toEqual(DEFAULT_CLOSE_BUTTON_COLOR),
        expectCss: el => expectThemePair(closeBtn(el), "iam-close-color", CLOSE_COLOR),
      },
      {
        name: "omitted → DEFAULT_MODAL_CLOSE_BUTTON color",
        patch: {},
        expectModel: m => expect(m.button?.color).toEqual(DEFAULT_MODAL_CLOSE_BUTTON.color),
        expectCss: el => expectThemePair(closeBtn(el), "iam-close-color", MODAL_COLOR),
      },

      {
        name: "backgroundColor explicit pair",
        patch: { button: { color: ["#FFFFFFFF"], backgroundColor: ["#0044FFFF", "#112233FF"] } },
        expectModel: m => expect(m.button?.backgroundColor).toEqual(["#0044FFFF", "#112233FF"]),
        expectCss: el => expectThemePair(closeBtn(el), "iam-close-bg", { light: "rgba(0,68,255,1.000)", dark: "rgba(17,34,51,1.000)" }),
      },
      {
        name: "backgroundColor omitted (button provided) → DEFAULT_CLOSE_BUTTON_BACKGROUND",
        patch: { button: { color: ["#FFFFFFFF"] } },
        expectModel: m => expect(m.button?.backgroundColor).toEqual(DEFAULT_CLOSE_BUTTON_BACKGROUND),
        expectCss: el => expectThemePair(closeBtn(el), "iam-close-bg", CLOSE_BG),
      },
      {
        name: "omitted → DEFAULT_MODAL_CLOSE_BUTTON backgroundColor",
        patch: {},
        expectModel: m => expect(m.button?.backgroundColor).toEqual(DEFAULT_MODAL_CLOSE_BUTTON.backgroundColor),
        expectCss: el => expectThemePair(closeBtn(el), "iam-close-bg", MODAL_BG),
      },
    ],
  },
};

const spec: ComponentMatrixSpec<MessageCloseOptionPayload, MessageCloseOptionsModel> = {
  label: "CloseOptions",
  buildPayload: (patch, message) => {
    const payload: MessagePayload = {
      format: "modal",
      root: { children: [] },
      closeOptions: patch,
      texts: {},
      urls: {},
      actions: {},
      ...message,
    };
    return payload;
  },
  select: message => message.closeOptions,
  render: model => {
    const container = document.createElement("div");
    container.appendChild(renderCloseButton({ opts: model.button, onClose: () => undefined }));
    if (model.auto) {
      container.appendChild(renderSurfaceProgressBar({ totalDelay: model.auto.delay, elapsed: 0, color: model.auto.color }));
    }
    return container;
  },
  props,
};

runComponentMatrix(spec);
