/* eslint-env jest */

import { MessagePayload } from "com.batch.dom/render/model/types";

import { makeModalPayload } from "../../test-utils/factories/renderer-payloads";
import { modalRenderer, captureAnalyticsEvents, flushPromises, getHostShadowRoot } from "../../test-utils/helpers/renderer";

function makeFormSubmitPayload(): MessagePayload {
  return makeModalPayload({
    root: {
      children: [
        { type: "field", id: "email", mapsTo: "email_map", fieldType: "email" },
        { type: "button", id: "submit", backgroundColor: ["#0044FFFF"], textColor: ["#FFFFFFFF"], fontSize: 14 },
      ],
    },
    texts: { submit: "Send" },
    actions: { submit: { action: "batch.form.submit", params: { e: "form_event" } } },
  });
}

function clickSubmit(): void {
  const button = getHostShadowRoot().querySelector(".iam-button");
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error("submit button not found");
  }
  button.click();
}

function fillEmail(value: string): void {
  const input = getHostShadowRoot().querySelector(".iam-input");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("email input not found");
  }
  input.value = value;
}

describe("modalRenderer analytics", () => {
  const nativeAttachShadow = Element.prototype.attachShadow;

  beforeEach(() => {
    jest.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init: ShadowRootInit): ShadowRoot {
      return nativeAttachShadow.call(this, { ...init, mode: "open" });
    });
  });

  afterEach(() => {
    modalRenderer.hide();
    modalRenderer.setFontFamily(null);
    modalRenderer.setTheme("auto");
    document.body.innerHTML = "";
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("tracks show on display", async () => {
    const { events, unsubscribe } = captureAnalyticsEvents();

    await modalRenderer.show(makeModalPayload());

    expect(events.map(event => event.type)).toEqual(["displayed"]);

    unsubscribe();
  });

  test("api hide tracks dismiss only", async () => {
    const { events, unsubscribe } = captureAnalyticsEvents();

    await modalRenderer.show(makeModalPayload());
    modalRenderer.hide();

    expect(events.map(event => event.type)).toEqual(["displayed", "dismiss"]);

    unsubscribe();
  });

  test("a form submit CTA tracks a clicked event before the action executes", async () => {
    const { events, unsubscribe } = captureAnalyticsEvents();

    await modalRenderer.show(makeFormSubmitPayload());
    clickSubmit();
    await flushPromises();

    expect(events.map(event => event.type)).toEqual(["displayed", "clicked"]);
    expect(events[1]).toMatchObject({ type: "clicked", ctaId: "submit", ctaType: "button", action: "batch.form.submit" });

    unsubscribe();
  });

  test("a form submit CTA reports the fields it had at the tap, keyed by their mapsTo", async () => {
    const { events, unsubscribe } = captureAnalyticsEvents();

    await modalRenderer.show(makeFormSubmitPayload());
    fillEmail("user@batch.com");
    clickSubmit();
    await flushPromises();

    expect(events[1]).toMatchObject({ type: "clicked", action: "batch.form.submit", value: { email_map: "user@batch.com" } });

    unsubscribe();
  });

  test("a form submit CTA tapped on an untouched form reports an empty field map", async () => {
    const { events, unsubscribe } = captureAnalyticsEvents();

    await modalRenderer.show(makeFormSubmitPayload());
    clickSubmit();
    await flushPromises();

    expect(events[1]).toMatchObject({ type: "clicked", action: "batch.form.submit", value: {} });

    unsubscribe();
  });

  test("a second submit of the same CTA does not re-emit the clicked event", async () => {
    const { events, unsubscribe } = captureAnalyticsEvents();

    await modalRenderer.show(makeFormSubmitPayload());
    clickSubmit();
    await flushPromises();
    clickSubmit();
    await flushPromises();

    expect(events.filter(event => event.type === "clicked")).toHaveLength(1);

    unsubscribe();
  });

  test("auto-close tracks auto_close then dismiss", async () => {
    jest.useFakeTimers();
    const { events, unsubscribe } = captureAnalyticsEvents();

    await modalRenderer.show(
      makeModalPayload({
        closeOptions: {
          auto: { delay: 1, color: ["#00FF00FF"] },
          button: {
            color: ["#FFFFFFFF"],
            backgroundColor: ["#00000080"],
          },
        },
      })
    );

    jest.advanceTimersByTime(1000);

    expect(events.map(event => event.type)).toEqual(["displayed", "auto_close", "dismiss"]);

    unsubscribe();
  });
});
