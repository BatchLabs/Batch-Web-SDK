/* eslint-env jest */

jest.mock("com.batch.dom/render/render/render.raw.css", () => ".iam-root{}");

import type { ActionOutcome } from "com.batch.dom/render/contracts";
import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import { InlineLandingSurfaceController } from "com.batch.dom/render/runtime/surface/inline-landing-surface-controller";
import { InlineLandingSurfaceStrategy } from "com.batch.dom/render/runtime/surface/inline-landing-surface-strategy";
import { Log } from "com.batch.shared/logger";

const nativeAttachShadow = Element.prototype.attachShadow;

function makeMessage(overrides: Record<string, unknown> = {}) {
  return normalizeMessage({
    format: "modal",
    root: { children: [] },
    closeOptions: {},
    texts: {},
    urls: {},
    actions: {},
    ...overrides,
  });
}

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    message: makeMessage(),
    onUserClose: jest.fn(),
    onAutoClose: jest.fn(),
    onAction: jest.fn(),
    ...overrides,
  };
}

function makeFormParams(onAction: jest.Mock) {
  return makeParams({
    message: makeMessage({
      root: {
        children: [
          { type: "field", id: "email" },
          { type: "button", id: "submit", backgroundColor: ["#000000FF"], textColor: ["#FFFFFFFF"], fontSize: 16 },
        ],
      },
      texts: { submit: "Send" },
      actions: { submit: { action: "batch.form.submit" } },
    }),
    onAction,
  });
}

function makeDeferredAction(): { onAction: jest.Mock; resolve: (outcome: ActionOutcome) => void } {
  let settle!: (outcome: ActionOutcome) => void;
  const onAction = jest.fn(
    () =>
      new Promise<ActionOutcome>(resolve => {
        settle = resolve;
      })
  );
  return { onAction, resolve: outcome => settle(outcome) };
}

async function settleSubmit(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("InlineLandingSurfaceController", () => {
  beforeEach(() => {
    jest.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init: ShadowRootInit): ShadowRoot {
      return nativeAttachShadow.call(this, { ...init, mode: "open" });
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  test("builds a <main> landmark host that reserves the viewport height", () => {
    const controller = new InlineLandingSurfaceController(makeParams());

    const host = controller.element;
    expect(host.tagName).toBe("MAIN");
    expect(host.className).toBe("batch-lp-surface");
    expect(host.style.position).toBe("static");
    expect(host.style.display).toBe("flex");
    expect(host.style.flexDirection).toBe("column");
    expect(host.style.minHeight).toBe("100dvh");
    expect(host.style.width).toBe("100%");
    expect(host.style.justifyContent).toBe("");
  });

  test.each([
    ["top", "flex-start"],
    ["center", "center"],
    ["bottom", "flex-end"],
  ])("distributes the free space on the root from the payload position (%s)", (position, justify) => {
    const controller = new InlineLandingSurfaceController(makeParams({ message: makeMessage({ position }) }));

    const root = controller.element.shadowRoot?.querySelector(".iam-root--surface") as HTMLElement;
    expect(root.style.justifyContent).toBe(justify);
  });

  test("a fullscreen payload without a position anchors the root to the top by default", () => {
    const controller = new InlineLandingSurfaceController(
      makeParams({ message: makeMessage({ format: "fullscreen", position: undefined }) })
    );

    const root = controller.element.shadowRoot?.querySelector(".iam-root--surface") as HTMLElement;
    expect(root.style.justifyContent).toBe("flex-start");
  });

  test("mounts the shared stylesheet and the surface-flagged component root", () => {
    const controller = new InlineLandingSurfaceController(makeParams());

    const shadow = controller.element.shadowRoot;
    expect(shadow?.querySelector("style")?.textContent).toBe(".iam-root{}");
    expect(shadow?.querySelector(".iam-root--surface")).toBeInstanceOf(HTMLElement);
  });

  test("applies root configuration styles (background theme vars) on the component root", () => {
    const controller = new InlineLandingSurfaceController(
      makeParams({ message: makeMessage({ root: { backgroundColor: ["#FFFFFFFF", "#000000FF"], children: [] } }) })
    );

    const root = controller.element.shadowRoot?.querySelector(".iam-root--surface") as HTMLElement;
    expect(root.style.getPropertyValue("--iam-surface-bg")).toBe("rgba(255,255,255,1.000)");
    expect(root.style.getPropertyValue("--iam-surface-bg-dark")).toBe("rgba(0,0,0,1.000)");
  });

  test("stamps the same background pair on the host, which paints the root margin band", () => {
    const controller = new InlineLandingSurfaceController(
      makeParams({ message: makeMessage({ root: { backgroundColor: ["#FFFFFFFF", "#000000FF"], children: [] } }) })
    );

    const host = controller.element;
    expect(host.style.getPropertyValue("--iam-surface-bg")).toBe("rgba(255,255,255,1.000)");
    expect(host.style.getPropertyValue("--iam-surface-bg-dark")).toBe("rgba(0,0,0,1.000)");
  });

  test("stamps the normalized default background pair on the host when the payload declares no root color", () => {
    const controller = new InlineLandingSurfaceController(makeParams());

    const host = controller.element;
    const root = controller.element.shadowRoot?.querySelector(".iam-root--surface") as HTMLElement;
    expect(host.style.getPropertyValue("--iam-surface-bg")).toBe(root.style.getPropertyValue("--iam-surface-bg"));
    expect(host.style.getPropertyValue("--iam-surface-bg-dark")).toBe(root.style.getPropertyValue("--iam-surface-bg-dark"));
    expect(host.style.getPropertyValue("--iam-surface-bg")).toBe("rgba(255,255,255,1.000)");
  });

  test("caps the content column when the surface grants a content layout", () => {
    const controller = new InlineLandingSurfaceController(makeParams({ contentLayout: { maxWidth: 960 } }));

    const root = controller.element.shadowRoot?.querySelector(".iam-root--surface") as HTMLElement;
    expect(root.classList.contains("iam-root--capped")).toBe(true);
    expect(root.style.getPropertyValue("--iam-content-max-width")).toBe("960px");
  });

  test("leaves the content column unconstrained without a content layout", () => {
    const controller = new InlineLandingSurfaceController(makeParams());

    const root = controller.element.shadowRoot?.querySelector(".iam-root--surface") as HTMLElement;
    expect(root.classList.contains("iam-root--capped")).toBe(false);
    expect(root.style.getPropertyValue("--iam-content-max-width")).toBe("");
  });

  test("destroy() removes the host element from the DOM", () => {
    const controller = new InlineLandingSurfaceController(makeParams());
    document.body.appendChild(controller.element);
    expect(document.body.contains(controller.element)).toBe(true);

    controller.destroy();

    expect(document.body.contains(controller.element)).toBe(false);
  });

  test("a submit that resolves after destroy() writes nothing into the detached tree", async () => {
    const deferred = makeDeferredAction();
    const controller = new InlineLandingSurfaceController(makeFormParams(deferred.onAction));
    document.body.appendChild(controller.element);

    const shadow = controller.element.shadowRoot;
    const root = shadow?.querySelector(".iam-root") as HTMLElement;
    const feedback = shadow?.querySelector(".iam-form-message") as HTMLElement;
    const submit = shadow?.querySelector(".iam-button") as HTMLButtonElement;
    submit.click();

    expect(deferred.onAction).toHaveBeenCalledWith("submit", { formFields: {} });
    expect(root.classList.contains("iam-form--submitting")).toBe(true);

    controller.destroy();
    deferred.resolve({ kind: "form-feedback", status: "success", message: "Thanks!" });
    await settleSubmit();

    expect(document.body.contains(controller.element)).toBe(false);
    expect(root.classList.contains("iam-form--completed")).toBe(false);
    expect(feedback.textContent).toBe("");
    expect(feedback.classList.contains("iam-form-message--visible")).toBe(false);
    expect(root.getAttribute("aria-busy")).toBe("true");
  });
});

describe("InlineLandingSurfaceStrategy", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  test("never locks scroll", () => {
    const strategy = new InlineLandingSurfaceStrategy("#batch-lp-root");
    expect(strategy.lockScroll()).toBeNull();
  });

  test("exposes the content layout it was built with", () => {
    expect(new InlineLandingSurfaceStrategy("#batch-lp-root", { maxWidth: 960 }).contentLayout).toEqual({ maxWidth: 960 });
    expect(new InlineLandingSurfaceStrategy("#batch-lp-root").contentLayout).toBeUndefined();
  });

  test("attaches the host inside the configured mount container", () => {
    const mount = document.createElement("div");
    mount.id = "batch-lp-root";
    document.body.appendChild(mount);

    const strategy = new InlineLandingSurfaceStrategy("#batch-lp-root");
    const host = document.createElement("main");
    strategy.attach(host);

    expect(mount.contains(host)).toBe(true);
  });

  test("zeroes the user-agent body margin, so the host reaches the viewport edges", () => {
    const mount = document.createElement("div");
    mount.id = "batch-lp-root";
    document.body.appendChild(mount);
    document.body.style.margin = "8px";

    new InlineLandingSurfaceStrategy("#batch-lp-root").attach(document.createElement("main"));
    expect(document.body.style.margin).toBe("0px");

    document.body.style.margin = "8px";
    jest.spyOn(Log, "publicError").mockImplementation(() => undefined);
    new InlineLandingSurfaceStrategy("#missing-mount").attach(document.createElement("main"));
    expect(document.body.style.margin).toBe("0px");
  });

  test("falls back to <body> and logs when the mount container is missing", () => {
    const publicErrorSpy = jest.spyOn(Log, "publicError").mockImplementation(() => undefined);

    const strategy = new InlineLandingSurfaceStrategy("#missing-mount");
    const host = document.createElement("main");
    strategy.attach(host);

    expect(host.parentElement).toBe(document.body);
    expect(publicErrorSpy).toHaveBeenCalledWith(expect.stringContaining('mount container "#missing-mount" not found'));
  });
});
