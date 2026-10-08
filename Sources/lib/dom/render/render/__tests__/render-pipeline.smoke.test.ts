/* eslint-env jest */

import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import { buildComponentTree } from "com.batch.dom/render/render/builder";

import { makeFullTreePayload } from "../../test-utils/factories/renderer-payloads";

describe("render pipeline · JSON → normalize → build tree → CSS (smoke)", () => {
  const build = (): HTMLElement =>
    buildComponentTree(normalizeMessage(makeFullTreePayload()), () => Promise.resolve({ kind: "none" as const }));

  test("renders every tree component to its expected class", () => {
    const root = build();

    expect(root.className).toBe("iam-root");
    expect(root.querySelector(".iam-text")).not.toBeNull();
    expect(root.querySelector(".iam-image")).not.toBeNull();
    expect(root.querySelector(".iam-divider")).not.toBeNull();
    expect(root.querySelector(".iam-spacer")).not.toBeNull();
    expect(root.querySelector(".iam-columns")).not.toBeNull();
    expect(root.querySelector(".iam-input")).not.toBeNull();
    expect(root.querySelector(".iam-field-choice")).not.toBeNull();
    expect(root.querySelector(".iam-button")).not.toBeNull();
  });

  test("field renders label, input placeholder and font-size from JSON", () => {
    const root = build();
    const wrapper = root.querySelector<HTMLElement>(".iam-field");
    expect(wrapper).not.toBeNull();
    const control = wrapper!.querySelector<HTMLInputElement>(".iam-input");
    expect(control).not.toBeNull();
    expect(control!.type).toBe("email");
    expect(control!.placeholder).toBe("you@example.com");
    expect(control!.name).toBe("email");
    const labelEl = wrapper!.querySelector<HTMLLabelElement>(".iam-field-label")!;
    expect(labelEl.textContent).toBe("Email address*");
    expect(labelEl.getAttribute("aria-label")).toBe("Email address");
    expect(control!.getAttribute("aria-label")).toBe("Email address");
  });
});
