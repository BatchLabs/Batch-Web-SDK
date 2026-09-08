/* eslint-env jest */

import type { MessageModel } from "com.batch.dom/render/model/model";
import { createAbortController } from "com.batch.dom/render/runtime/abort-controller";
import { trackDismiss } from "com.batch.dom/render/runtime/renderer-dismiss";
import { applyRootConfigurationStyles } from "com.batch.dom/render/runtime/surface/root-configuration";

describe("createAbortController", () => {
  const originalAbortController = globalThis.AbortController;

  afterEach(() => {
    Object.defineProperty(globalThis, "AbortController", {
      configurable: true,
      writable: true,
      value: originalAbortController,
    });
  });

  test("returns a native AbortController when available", () => {
    const controller = createAbortController();
    expect(controller.signal.aborted).toBe(false);
    controller.abort();
    expect(controller.signal.aborted).toBe(true);
  });

  test("provides a degraded fallback that tracks aborted when the native class is missing", () => {
    Reflect.deleteProperty(globalThis, "AbortController");

    const controller = createAbortController();
    expect(controller.signal.aborted).toBe(false);

    controller.abort();
    expect(controller.signal.aborted).toBe(true);
  });
});

describe("trackDismiss", () => {
  test("is a no-op when no analytics wrapper is provided", () => {
    expect(() => trackDismiss(null, { reason: "user_close" })).not.toThrow();
  });
});

describe("applyRootConfigurationStyles", () => {
  function makeModel(overrides: {
    backgroundColor?: string[];
    radius?: number[];
    borderWidth?: number;
    borderColor?: string[];
    margin?: number[];
    marginDesktop?: number[];
  }): MessageModel {
    return {
      root: {
        configuration: {
          style: {
            backgroundColor: overrides.backgroundColor ?? ["#FFFFFFFF"],
            radius: overrides.radius,
            borderWidth: overrides.borderWidth ?? 0,
            borderColor: overrides.borderColor ?? [],
          },
          placement: {
            margin: overrides.margin,
            marginDesktop: overrides.marginDesktop,
          },
        },
      },
    } as unknown as MessageModel;
  }

  test("skips box styling entirely for fullscreen surfaces (box: false)", () => {
    const container = document.createElement("div");
    applyRootConfigurationStyles(container, makeModel({ radius: [12, 12, 12, 12], margin: [8, 8, 8, 8] }), { box: false });

    expect(container.style.getPropertyValue("--iam-surface-bg")).toBe("rgba(255,255,255,1.000)");
    expect(container.style.borderRadius).toBe("");
    expect(container.style.getPropertyValue("--iam-root-margin")).toBe("");
  });

  test("does not set border-radius when the radius is absent (box: true)", () => {
    const container = document.createElement("div");
    applyRootConfigurationStyles(container, makeModel({ radius: undefined }), { box: true });

    expect(container.style.borderRadius).toBe("");
  });
});
