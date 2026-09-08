/* eslint-env jest */

import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import type { MessagePayload } from "com.batch.dom/render/model/types";
import { InlineLandingSurfaceStrategy } from "com.batch.dom/render/runtime/surface/inline-landing-surface-strategy";
import EventTracker from "com.batch.shared/event/event-tracker";
import type * as LoggerModule from "com.batch.shared/logger";
import { Log } from "com.batch.shared/logger";

import { WS_URL } from "../../../../config";
import { bootstrapLandingPage } from "../landing-page";

const INPUT_ENDPOINT = `${WS_URL}/lp/input/lp-42`;
const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

function mockFetch(response: unknown, ok = true): jest.Mock {
  const fetchMock = jest.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => response });
  (global as unknown as { fetch: typeof fetch }).fetch = fetchMock;
  return fetchMock;
}

function mockAcceptedVerdicts(): jest.Mock {
  const fetchMock = jest.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(((init as RequestInit).body as string) ?? "{}") as { events?: { id: string }[] };
    return {
      ok: true,
      status: 200,
      json: async () => ({ results: (body.events ?? []).map(event => ({ id: event.id, status: "accepted" })) }),
    };
  });
  (global as unknown as { fetch: typeof fetch }).fetch = fetchMock;
  return fetchMock;
}

function postedEventNames(fetchMock: jest.Mock): string[] {
  return fetchMock.mock.calls.flatMap(call => {
    const init: unknown = call[1];
    if (!(typeof init === "object" && init !== null && "body" in init && typeof init.body === "string")) {
      return [];
    }
    const body: unknown = JSON.parse(init.body);
    if (!(typeof body === "object" && body !== null && "events" in body && Array.isArray(body.events))) {
      return [];
    }
    return body.events.map((event: unknown) =>
      typeof event === "object" && event !== null && "name" in event && typeof event.name === "string" ? event.name : ""
    );
  });
}

function makeFormPayload(): MessagePayload {
  return {
    format: "modal",
    root: {
      children: [
        { type: "field", id: "email", mapsTo: "email_map", fieldType: "email" },
        { type: "button", id: "submit", backgroundColor: ["#0044FFFF"], textColor: ["#FFFFFFFF"], fontSize: 14 },
      ],
    },
    closeOptions: {},
    texts: { submit: "Send" },
    urls: {},
    actions: { submit: { action: "batch.form.submit" } },
    eventData: {},
  };
}

function makeRequiredFormPayload(): MessagePayload {
  const payload = makeFormPayload();
  const field = payload.root.children[0];
  if (field.type === "field") {
    field.required = true;
  }
  return payload;
}

describe("InlineLandingSurfaceStrategy", () => {
  const nativeAttachShadow = Element.prototype.attachShadow;

  beforeEach(() => {
    jest.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init: ShadowRootInit): ShadowRoot {
      return nativeAttachShadow.call(this, { ...init, mode: "open" });
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  function present(strategy: InlineLandingSurfaceStrategy) {
    return strategy.present({
      message: normalizeMessage(makeFormPayload()),
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: jest.fn(() => Promise.resolve({ kind: "none" as const })),
    });
  }

  test("mounts the surface inside the configured container and renders the form", () => {
    const mount = document.createElement("div");
    mount.id = "batch-lp-root";
    document.body.appendChild(mount);

    const strategy = new InlineLandingSurfaceStrategy("#batch-lp-root");
    const presentation = present(strategy);
    strategy.attach(presentation.element);

    expect(mount.contains(presentation.element)).toBe(true);
    expect(presentation.element.tagName).toBe("MAIN");
    expect(presentation.element.style.position).toBe("static");
    expect(presentation.element.shadowRoot?.querySelector(".iam-input")).not.toBeNull();
    expect(presentation.element.shadowRoot?.querySelector(".iam-backdrop")).toBeNull();
  });

  test("falls back to <body> when the mount container is missing", () => {
    const strategy = new InlineLandingSurfaceStrategy("#missing");
    const presentation = present(strategy);
    strategy.attach(presentation.element);

    expect(document.body.contains(presentation.element)).toBe(true);
    expect(strategy.lockScroll()).toBeNull();
  });

  test("applies the payload root configuration on the inline surface root", () => {
    const strategy = new InlineLandingSurfaceStrategy("#missing");
    const payload = makeFormPayload();
    payload.root.backgroundColor = ["#112233FF", "#332211FF"];
    payload.root.margin = [8, 8, 8, 8];
    payload.root.marginDesktop = [24, 16, 24, 16];
    const presentation = strategy.present({
      message: normalizeMessage(payload),
      onUserClose: jest.fn(),
      onAutoClose: jest.fn(),
      onAction: jest.fn(() => Promise.resolve({ kind: "none" as const })),
    });

    const root = presentation.element.shadowRoot?.querySelector(".iam-root") as HTMLElement;
    expect(root.classList.contains("iam-root--surface")).toBe(true);
    expect(root.style.getPropertyValue("--iam-surface-bg")).toBe("rgba(17,34,51,1.000)");
    expect(root.style.getPropertyValue("--iam-surface-bg-dark")).toBe("rgba(51,34,17,1.000)");
    expect(root.style.getPropertyValue("--iam-root-margin")).toBe("8px 8px 8px 8px");
    expect(root.style.getPropertyValue("--iam-root-margin-desktop")).toBe("24px 16px 24px 16px");
  });
});

describe("bootstrapLandingPage", () => {
  const nativeAttachShadow = Element.prototype.attachShadow;

  beforeEach(() => {
    jest.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init: ShadowRootInit): ShadowRoot {
      return nativeAttachShadow.call(this, { ...init, mode: "open" });
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    window.history.replaceState(null, "", "/");
    jest.restoreAllMocks();
  });

  function setupDom(payload: MessagePayload = makeFormPayload(), inputEndpoint: string = INPUT_ENDPOINT, lang?: string): HTMLScriptElement {
    const mount = document.createElement("div");
    mount.id = "batch-lp-root";
    document.body.appendChild(mount);

    const marker = document.createElement("script");
    marker.type = "application/json";
    marker.id = "batch-lp-definition";
    marker.dataset.batchLp = "";
    marker.dataset.mount = "#batch-lp-root";
    marker.dataset.inputEndpoint = inputEndpoint;
    if (lang !== undefined) {
      marker.dataset.lang = lang;
    }
    marker.textContent = JSON.stringify({ payload: { ...payload, eventData: { page_id: "lp-42", ...payload.eventData } } });
    document.body.appendChild(marker);
    return marker;
  }

  function querySurface(): HTMLElement | null {
    return document.querySelector("#batch-lp-root .batch-lp-surface");
  }

  /**
   * The shadow root of the mounted surface. Every caller runs after a
   * successful bootstrap, so a missing root is a test failure.
   */
  function surfaceShadow(): ShadowRoot {
    const shadow = querySurface()?.shadowRoot;
    if (!shadow) {
      throw new Error("the landing surface must be mounted before querying its shadow root");
    }
    return shadow;
  }

  /** The rendered submit button. The form template always renders `.iam-button` as a <button>. */
  function submitButton(): HTMLButtonElement {
    const button = surfaceShadow().querySelector(".iam-button");
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("the rendered form must carry a submit button");
    }
    return button;
  }

  test("renders the envelope payload inline and wires the submit to the input endpoint", async () => {
    const fetchMock = mockAcceptedVerdicts();
    const script = setupDom();

    await bootstrapLandingPage(script);
    await flush();

    const host = document.querySelector("#batch-lp-root .batch-lp-surface") as HTMLElement | null;
    expect(host).not.toBeNull();
    expect(host?.shadowRoot?.querySelector(".iam-input")).not.toBeNull();

    submitButton().click();
    await flush();

    expect(fetchMock).toHaveBeenCalledWith(INPUT_ENDPOINT, expect.objectContaining({ method: "POST" }));
  });

  test("a successful submit stays on the page: the form locks and the submit button shows the check mark", async () => {
    mockAcceptedVerdicts();
    const script = setupDom();

    await bootstrapLandingPage(script);
    await flush();

    submitButton().click();
    await flush();
    await flush();
    await flush();

    const shadow = querySurface()?.shadowRoot;
    expect(shadow?.querySelector(".iam-input")).not.toBeNull();
    expect(shadow?.querySelector(".iam-form--completed")).not.toBeNull();
    const button = shadow?.querySelector(".iam-button") as HTMLButtonElement;
    expect(button.classList.contains("iam-button--submit")).toBe(true);
    expect(button.disabled).toBe(true);
    expect(button.querySelector(".iam-button-check")).not.toBeNull();
    expect(button.querySelector(".iam-button-label")?.textContent).toBe("Send");
  });

  test("the embedded error view emits no analytics of its own", async () => {
    const track = jest.spyOn(EventTracker.prototype, "track");
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockFetch({ unexpected: true });
    const script = setupDom();

    await bootstrapLandingPage(script);
    await flush();
    expect(track).toHaveBeenCalledTimes(1);

    const click = (): void => submitButton().click();
    click();
    await flush();
    await flush();
    await flush();
    click();
    await flush();
    await flush();
    await flush();

    expect(querySurface()?.shadowRoot?.textContent).toContain("Something went wrong");
    const shows = track.mock.calls.filter(([event]) => {
      const serializedEvent = event.toJSON() as { params?: { type?: string } };
      return serializedEvent.params?.type === "show";
    });
    expect(shows).toHaveLength(1);
  });

  test("data-lang=fr localizes the client validation errors and the embedded error page", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = mockFetch({ unexpected: true });
    const script = setupDom(makeRequiredFormPayload(), INPUT_ENDPOINT, "fr");

    await bootstrapLandingPage(script);
    await flush();

    submitButton().click();
    await flush();
    expect(postedEventNames(fetchMock)).not.toContain("_FORM_SUBMITTED");
    expect(postedEventNames(fetchMock)).toContain("_MESSAGING");
    expect(querySurface()?.shadowRoot?.querySelector(".iam-field-error")?.textContent).toBe("Ce champ est obligatoire.");

    const input = querySurface()?.shadowRoot?.querySelector(".iam-input") as HTMLInputElement;
    input.value = "user@example.com";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const click = (): void => submitButton().click();
    click();
    await flush();
    await flush();
    await flush();
    click();
    await flush();
    await flush();
    await flush();

    expect(querySurface()?.shadowRoot?.textContent).toContain("Une erreur est survenue");
  });

  test("ignores a lang query parameter on the page URL: the marker is the only language source", async () => {
    mockFetch({ unexpected: true });
    window.history.replaceState(null, "", "/?lang=fr");
    const script = setupDom(makeRequiredFormPayload());

    await bootstrapLandingPage(script);
    await flush();

    submitButton().click();
    await flush();

    expect(querySurface()?.shadowRoot?.querySelector(".iam-field-error")?.textContent).toBe("This field is required.");
  });

  test("never takes the language from payload.eventData: that metadata stays opaque", async () => {
    mockFetch({ unexpected: true });
    const payload = makeRequiredFormPayload();
    payload.eventData = { language: "fr" };
    const script = setupDom(payload);

    await bootstrapLandingPage(script);
    await flush();

    submitButton().click();
    await flush();

    expect(querySurface()?.shadowRoot?.querySelector(".iam-field-error")?.textContent).toBe("This field is required.");
  });

  test("aborts when the page definition is missing a payload", async () => {
    const fetchMock = mockFetch({ outcome: "success" });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const mount = document.createElement("div");
    mount.id = "batch-lp-root";
    document.body.appendChild(mount);

    const marker = document.createElement("script");
    marker.type = "application/json";
    marker.dataset.batchLp = "";
    marker.dataset.mount = "#batch-lp-root";
    marker.dataset.inputEndpoint = INPUT_ENDPOINT;
    marker.textContent = JSON.stringify({ definition: {} });
    document.body.appendChild(marker);

    await bootstrapLandingPage(marker);
    await flush();

    expect(document.querySelector("#batch-lp-root .batch-lp-surface")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a third-party input endpoint builds no transport: the page renders, stays silent and submits to the embedded error page", async () => {
    const fetchMock = mockAcceptedVerdicts();
    const track = jest.spyOn(EventTracker.prototype, "track");
    const publicError = jest.spyOn(Log, "publicError").mockImplementation(() => undefined);
    const script = setupDom(makeFormPayload(), "https://third-party.example/lp/input");

    await bootstrapLandingPage(script);
    await flush();

    expect(publicError).toHaveBeenCalledWith(
      `[LandingPage] refusing to post form data to "https://third-party.example/lp/input": an input endpoint must be an http(s) URL on this page's origin or on the Batch backend`
    );
    const input = querySurface()?.shadowRoot?.querySelector(".iam-input") as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(querySurface()?.shadowRoot?.querySelector(".iam-button")).not.toBeNull();
    expect(track).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    (input as HTMLInputElement).value = "user@example.com";
    (input as HTMLInputElement).dispatchEvent(new Event("input", { bubbles: true }));
    submitButton().click();
    await flush();
    await flush();
    await flush();

    expect(querySurface()?.shadowRoot?.querySelector(".iam-input")).toBeNull();
    expect(querySurface()?.shadowRoot?.textContent).toContain("Something went wrong");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});

describe("landing-page entry — baseline capability gate", () => {
  const globalWithFetch = global as unknown as { fetch?: typeof fetch };
  const promiseSource = Promise as unknown as { toString?: () => string };

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete globalWithFetch.fetch;
    delete promiseSource.toString;
  });

  test("a browser without fetch loads nothing", () => {
    delete globalWithFetch.fetch;
    const autoInit = jest.fn();
    let publicError: jest.SpyInstance | undefined;

    jest.isolateModules(() => {
      jest.doMock("com.batch.shared/logger", () => {
        const actual = jest.requireActual<typeof LoggerModule>("com.batch.shared/logger");
        publicError = jest.spyOn(actual.Log, "publicError").mockImplementation(() => undefined);
        return actual;
      });
      jest.doMock("../landing-page", () => ({ __esModule: true, autoInitLandingPage: autoInit }));

      require("../landing-page-bootstrap");
    });

    expect(autoInit).not.toHaveBeenCalled();
    expect(publicError).toHaveBeenCalledWith("[Batch] 'fetch' is missing on self, refusing to load.");
  });

  test("a non-native Promise loads nothing", () => {
    globalWithFetch.fetch = jest.fn();
    promiseSource.toString = () => "function Promise() { /* polyfill */ }";
    const autoInit = jest.fn();
    let publicError: jest.SpyInstance | undefined;

    jest.isolateModules(() => {
      jest.doMock("com.batch.shared/logger", () => {
        const actual = jest.requireActual<typeof LoggerModule>("com.batch.shared/logger");
        publicError = jest.spyOn(actual.Log, "publicError").mockImplementation(() => undefined);
        return actual;
      });
      jest.doMock("../landing-page", () => ({ __esModule: true, autoInitLandingPage: autoInit }));

      require("../landing-page-bootstrap");
    });

    expect(autoInit).not.toHaveBeenCalled();
    expect(publicError).toHaveBeenCalledWith("[Batch] Using non-standard Promises, refusing to load.");
  });
});
