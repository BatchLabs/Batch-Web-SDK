/* eslint-env jest */

import type { MessageModel } from "com.batch.dom/render/model/model";
import { DEFAULT_FORMAT, DEFAULT_FULLSCREEN_POSITION, DEFAULT_MODAL_POSITION } from "com.batch.dom/render/model/normalizer-defaults";
import type { MessagePayload } from "com.batch.dom/render/model/types";
import { MessageSurfaceController } from "com.batch.dom/render/runtime/surface-controller";
import type { ComponentMatrixSpec, PropMatrix } from "com.batch.dom/render/test-utils/prop-matrix";
import { runComponentMatrix } from "com.batch.dom/render/test-utils/prop-matrix";

type MessageEnvelopePayload = Omit<MessagePayload, "root" | "closeOptions">;

const nativeAttachShadow = Element.prototype.attachShadow;
const controllers: MessageSurfaceController[] = [];

beforeEach(() => {
  jest.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init: ShadowRootInit): ShadowRoot {
    return nativeAttachShadow.call(this, { ...init, mode: "open" });
  });
});

afterEach(() => {
  for (const controller of controllers.splice(0)) {
    controller.destroy();
  }
  document.body.innerHTML = "";
  jest.restoreAllMocks();
});

function shadowOf(host: HTMLElement): ShadowRoot {
  const shadow = host.shadowRoot;
  if (!shadow) {
    throw new Error("expected an open shadow root on the surface host");
  }
  return shadow;
}

function expectSurfaceLayer(host: HTMLElement, position: string): void {
  expect(shadowOf(host).querySelector(`.iam-surface-layer--${position}`)).toBeInstanceOf(HTMLElement);
  expect(shadowOf(host).querySelector(".iam-modal")).toBeInstanceOf(HTMLElement);
  expect(host.style.pointerEvents).toBe("none");
}

function expectCenteredModal(host: HTMLElement): void {
  expect(shadowOf(host).querySelector(".iam-backdrop")).toBeInstanceOf(HTMLElement);
  expect(shadowOf(host).querySelector(".iam-surface-layer")).toBeNull();
  expect(host.style.pointerEvents).toBe("");
}

function expectFullscreen(host: HTMLElement): void {
  expect(shadowOf(host).querySelector(".iam-fullscreen")).toBeInstanceOf(HTMLElement);
  expect(shadowOf(host).querySelector(".iam-backdrop")).toBeNull();
  expect(shadowOf(host).querySelector(".iam-surface-layer")).toBeNull();
}

const props: PropMatrix<MessageEnvelopePayload, MessageModel> = {
  format: {
    cases: [
      {
        name: "modal → centered surface with a backdrop",
        patch: { format: "modal" },
        expectModel: m => expect(m.format).toBe("modal"),
        expectCss: expectCenteredModal,
      },
      {
        name: "fullscreen → edge-to-edge container, no backdrop",
        patch: { format: "fullscreen" },
        expectModel: m => expect(m.format).toBe("fullscreen"),
        expectCss: expectFullscreen,
      },
      {
        name: "invalid → DEFAULT_FORMAT",
        patch: { format: "banner" },
        expectModel: m => expect(m.format).toBe(DEFAULT_FORMAT),
        expectCss: expectFullscreen,
      },
    ],
  },

  position: {
    cases: [
      {
        name: "top → edge-aligned surface layer",
        patch: { format: "modal", position: "top" },
        expectModel: m => expect(m.position).toBe("top"),
        expectCss: host => expectSurfaceLayer(host, "top"),
      },
      {
        name: "bottom → edge-aligned surface layer",
        patch: { format: "modal", position: "bottom" },
        expectModel: m => expect(m.position).toBe("bottom"),
        expectCss: host => expectSurfaceLayer(host, "bottom"),
      },
      {
        name: "center → backdrop, host stays clickable-through-free",
        patch: { format: "modal", position: "center" },
        expectModel: m => expect(m.position).toBe("center"),
        expectCss: expectCenteredModal,
      },
      {
        name: "invalid → the format's default position",
        patch: { format: "modal", position: "middle" },
        expectModel: m => expect(m.position).toBe(DEFAULT_MODAL_POSITION),
        expectCss: expectCenteredModal,
      },
      {
        name: "omitted on a modal → DEFAULT_MODAL_POSITION",
        patch: { format: "modal" },
        expectModel: m => expect(m.position).toBe(DEFAULT_MODAL_POSITION),
        expectCss: expectCenteredModal,
      },
      {
        name: "omitted on a fullscreen → DEFAULT_FULLSCREEN_POSITION",
        patch: { format: "fullscreen" },
        expectModel: m => expect(m.position).toBe(DEFAULT_FULLSCREEN_POSITION),
      },
      {
        name: "fullscreen keeps the position in the model but ignores it for layout",
        patch: { format: "fullscreen", position: "top" },
        expectModel: m => expect(m.position).toBe("top"),
        expectCss: expectFullscreen,
      },
    ],
  },

  minMLvl: {
    cssExpression: "none",
    cases: [
      {
        name: "explicit → kept as-is",
        patch: { minMLvl: 3 },
        expectModel: m => expect(m.minMLvl).toBe(3),
      },
      {
        name: "omitted → undefined",
        patch: {},
        expectModel: m => expect(m.minMLvl).toBeUndefined(),
      },
      {
        name: "non-number → kept as-is (no normalization)",
        patch: { minMLvl: "nope" },
        expectModel: m => expect(m.minMLvl as unknown).toBe("nope"),
      },
    ],
  },

  texts: {
    cssExpression: "none",
    cases: [
      {
        name: "explicit record → passed through untouched",
        patch: { texts: { title: "Hello", cta: "Open" } },
        expectModel: m => expect(m.texts).toEqual({ title: "Hello", cta: "Open" }),
      },
      {
        name: "omitted → empty record",
        patch: { texts: undefined },
        expectModel: m => expect(m.texts).toEqual({}),
      },
      {
        name: "unknown keys are kept (resolution happens per component)",
        patch: { texts: { notAComponentId: "orphan" } },
        expectModel: m => expect(m.texts).toEqual({ notAComponentId: "orphan" }),
      },
      {
        name: "dialogTitle feeds the host aria-label",
        patch: { texts: { dialogTitle: "Special offer" } },
        expectCss: host => expect(host.getAttribute("aria-label")).toBe("Special offer"),
      },
      {
        name: "missing dialogTitle → default host aria-label",
        patch: { texts: {} },
        expectCss: host => expect(host.getAttribute("aria-label")).toBe("Notification"),
      },
    ],
  },

  urls: {
    cssExpression: "none",
    cases: [
      {
        name: "https URL kept",
        patch: { urls: { hero: "https://example.com/a.png" } },
        expectModel: m => expect(m.urls).toEqual({ hero: "https://example.com/a.png" }),
      },
      {
        name: "http URL kept",
        patch: { urls: { hero: "http://example.com/a.png" } },
        expectModel: m => expect(m.urls).toEqual({ hero: "http://example.com/a.png" }),
      },
      {
        name: "javascript: URL removed",
        patch: { urls: { cta: "javascript:alert(1)" } },
        expectModel: m => expect(m.urls).toEqual({}),
      },
      {
        name: "relative URL removed (absolute only)",
        patch: { urls: { hero: "/local/a.png" } },
        expectModel: m => expect(m.urls).toEqual({}),
      },
      {
        name: "mixed record keeps only the safe entries",
        patch: { urls: { safe: "https://example.com", unsafe: "data:text/html,<b>x</b>" } },
        expectModel: m => expect(m.urls).toEqual({ safe: "https://example.com" }),
      },
      {
        name: "omitted → empty record",
        patch: { urls: undefined },
        expectModel: m => expect(m.urls).toEqual({}),
      },
    ],
  },

  actions: {
    cssExpression: "none",
    cases: [
      {
        name: "explicit record → copied into the model",
        patch: { actions: { cta: { action: "batch.dismiss" } } },
        expectModel: m => expect(m.actions).toEqual({ cta: { action: "batch.dismiss" } }),
      },
      {
        name: "params are carried unchanged",
        patch: { actions: { cta: { action: "batch.deeplink", params: { url: "https://example.com" } } } },
        expectModel: m => expect(m.actions.cta.params).toEqual({ url: "https://example.com" }),
      },
      {
        name: "unknown action name is kept (no allowlist at normalization time)",
        patch: { actions: { cta: { action: "not.a.registered.action" } } },
        expectModel: m => expect(m.actions.cta.action).toBe("not.a.registered.action"),
      },
      {
        name: "omitted → empty record",
        patch: { actions: undefined },
        expectModel: m => expect(m.actions).toEqual({}),
      },
    ],
  },

  eventData: {
    cssExpression: "none",
    cases: [
      {
        name: "explicit record → passed through untouched",
        patch: { eventData: { i: "campaign-1", ex: "experiment-2" } },
        expectModel: m => expect(m.eventData).toEqual({ i: "campaign-1", ex: "experiment-2" }),
      },
      {
        name: "omitted → empty record",
        patch: { eventData: undefined },
        expectModel: m => expect(m.eventData).toEqual({}),
      },
    ],
  },

  trackingId: {
    cssExpression: "none",
    cases: [
      {
        name: "explicit → kept as-is",
        patch: { trackingId: "tracking-42" },
        expectModel: m => expect(m.trackingId).toBe("tracking-42"),
      },
      {
        name: "omitted → undefined",
        patch: {},
        expectModel: m => expect(m.trackingId).toBeUndefined(),
      },
      {
        name: "empty string → kept as-is (no emptiness check)",
        patch: { trackingId: "" },
        expectModel: m => expect(m.trackingId).toBe(""),
      },
    ],
  },
};

const spec: ComponentMatrixSpec<MessageEnvelopePayload, MessageModel> = {
  label: "Message surface",
  buildPayload: (patch, message): MessagePayload => ({
    format: "modal",
    root: { children: [] },
    closeOptions: {},
    ...message,
    ...patch,
  }),
  select: message => message,
  render: (_model, message) => {
    const controller = new MessageSurfaceController({
      message,
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: jest.fn(),
    });
    controllers.push(controller);
    return controller.element;
  },
  props,
};

runComponentMatrix(spec);
