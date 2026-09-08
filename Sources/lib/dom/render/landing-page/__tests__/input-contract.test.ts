/* eslint-env jest */

import {
  RENDER_TEXT_KEY_FORM_INVALID_EMAIL_ERROR,
  RENDER_TEXT_KEY_FORM_INVALID_ERROR,
  RENDER_TEXT_KEY_FORM_REQUIRED_ERROR,
} from "com.batch.dom/render/render-constants";
import { Consts } from "com.batch.shared/constants/user";
import { Log } from "com.batch.shared/logger";

import { WS_URL } from "../../../../../config";
import {
  buildFormSubmittedEvent,
  buildMessagingEventParams,
  isInputResponseBody,
  localizeFieldErrors,
  resolveInputEndpoint,
} from "../input-contract";
import { landingDefaultTexts } from "../landing-page-l10n";

const EVENT_DATA = { trid: "orch_7788_step2", is_test: "false" };

describe("buildMessagingEventParams", () => {
  it("maps displayed to the native show params", () => {
    const params = buildMessagingEventParams({ type: "displayed" }, EVENT_DATA);
    expect(JSON.parse(JSON.stringify(params))).toEqual({
      ed: { trid: "orch_7788_step2", is_test: "false" },
      type: "show",
    });
  });

  it("maps clicked to the native cta_action params", () => {
    const params = buildMessagingEventParams({ type: "clicked", ctaId: "cta-1", ctaType: "button", action: "batch.deeplink" }, EVENT_DATA);
    expect(JSON.parse(JSON.stringify(params))).toEqual({
      ed: { trid: "orch_7788_step2", is_test: "false" },
      type: "cta_action",
      ctaId: "cta-1",
      ctaType: "button",
      action: "batch.deeplink",
    });
  });

  it("never emits a source in the request payload: the dedicated endpoint carries the provenance", () => {
    const params = buildMessagingEventParams({ type: "displayed" }, {});
    expect(params).not.toHaveProperty("s");
  });

  it("keeps canonical actions verbatim", () => {
    const params = buildMessagingEventParams({ type: "clicked", ctaId: "c", ctaType: "button", action: "batch.clipboard" }, {});
    expect(params?.action).toBe("batch.clipboard");
  });

  it("carries the CTA value verbatim, the deeplink URL here", () => {
    const params = buildMessagingEventParams(
      { type: "clicked", ctaId: "cta-1", ctaType: "button", action: "batch.deeplink", value: "https://batch.com/offer" },
      EVENT_DATA
    );
    expect(params?.value).toBe("https://batch.com/offer");
  });

  it("omits value when the CTA has none to report", () => {
    const params = buildMessagingEventParams({ type: "clicked", ctaId: "c", ctaType: "button", action: "batch.group" }, EVENT_DATA);
    expect(params).not.toHaveProperty("value");
  });

  it("carries a whitespace-only CTA value, which is what the clipboard copied", () => {
    const params = buildMessagingEventParams(
      { type: "clicked", ctaId: "c", ctaType: "button", action: "batch.clipboard", value: "  " },
      EVENT_DATA
    );
    expect(params?.value).toBe("  ");
  });

  it("omits value when the CTA declared an empty payload", () => {
    const params = buildMessagingEventParams(
      { type: "clicked", ctaId: "c", ctaType: "button", action: "batch.deeplink", value: "" },
      EVENT_DATA
    );
    expect(params).not.toHaveProperty("value");
  });

  it("serializes a submit CTA field map, natives under their canonical $ name", () => {
    const params = buildMessagingEventParams(
      {
        type: "clicked",
        ctaId: "submit",
        ctaType: "button",
        action: "batch.form.submit",
        value: { $email_address: "jean.dupont@example.com", $phone_number: "+33612345678", firstname: "Jean" },
      },
      EVENT_DATA
    );
    expect(params?.value).toBe('{"$email":"jean.dupont@example.com","$phone_number":"+33612345678","firstname":"Jean"}');
  });

  it("drops an unrecognized native alias from value, as the submit drops it", () => {
    const params = buildMessagingEventParams(
      {
        type: "clicked",
        ctaId: "submit",
        ctaType: "button",
        action: "batch.form.submit",
        value: { $email_adress: "typo@batch.com", city: "Paris" },
      },
      EVENT_DATA
    );
    expect(params?.value).toBe('{"city":"Paris"}');
  });

  it("omits value when the submit CTA was tapped on an untouched form", () => {
    const params = buildMessagingEventParams(
      { type: "clicked", ctaId: "submit", ctaType: "button", action: "batch.form.submit", value: {} },
      EVENT_DATA
    );
    expect(params).not.toHaveProperty("value");
  });

  it("uses the injected serving eventData, not the wrapper ed copy", () => {
    const params = buildMessagingEventParams({ type: "displayed", ed: { wrapper: "copy" } }, EVENT_DATA);
    expect(params?.ed).toEqual(EVENT_DATA);
  });

  it.each(["dismiss", "close", "auto_close", "close_error"] as const)("returns null for the engine lifecycle type %s", type => {
    expect(buildMessagingEventParams({ type }, EVENT_DATA)).toBeNull();
  });
});

describe("resolveInputEndpoint", () => {
  it("returns an endpoint on the Batch backend untouched, query string included", () => {
    expect(resolveInputEndpoint(`${WS_URL}/lp/input/lp-42`)).toBe(`${WS_URL}/lp/input/lp-42`);
    expect(resolveInputEndpoint(`${WS_URL}/lp/input/lp-42?debug=1`)).toBe(`${WS_URL}/lp/input/lp-42?debug=1`);
  });

  it("resolves a relative endpoint against the page, pinning the target", () => {
    expect(resolveInputEndpoint("/lp/input/lp-42")).toBe(`${location.origin}/lp/input/lp-42`);
    expect(resolveInputEndpoint("/lp/input/lp-42?debug=1")).toBe(`${location.origin}/lp/input/lp-42?debug=1`);
  });

  it.each([
    ["a third-party collector", "https://evil.tld/collect"],
    ["a look-alike host", "https://ws.secure.evil.tld/lp/input/lp-42"],
    ["a userinfo-disguised host", "https://ws.secure@evil.tld/lp/input"],
  ])("refuses %s: the marker lives in a DOM anyone may write to", (_label, endpoint) => {
    expect(resolveInputEndpoint(endpoint)).toBeNull();
  });

  it("refuses plain http on a remote host: a submit carries the e-mail and the phone number", () => {
    expect(resolveInputEndpoint("http://example.com/lp/input/p1")).toBeNull();
  });

  it.each(["javascript:fetch('//evil.tld')", "data:text/plain,x", "ftp://ws.secure/lp/input", "blob:https://evil.tld/x"])(
    "refuses the non-http(s) scheme %s",
    endpoint => {
      expect(resolveInputEndpoint(endpoint)).toBeNull();
    }
  );
});

describe("buildFormSubmittedEvent", () => {
  const DATE = new Date("2026-07-24T14:32:41.880Z");

  it("splits natives into their own slot and type-suffixes the custom attributes", () => {
    const event = buildFormSubmittedEvent(
      "5f1c8e2a-0001-4a1b-9c3d-000000000003",
      DATE,
      {
        $email_address: "jean.dupont@example.com",
        firstname: "Jean",
        consent_newsletter: true,
        topics: ["news", "offers"],
      },
      EVENT_DATA
    );
    expect(JSON.parse(JSON.stringify(event))).toEqual({
      id: "5f1c8e2a-0001-4a1b-9c3d-000000000003",
      name: "_FORM_SUBMITTED",
      date: "2026-07-24T14:32:41.880Z",
      params: {
        ed: { trid: "orch_7788_step2", is_test: "false" },
        email: "jean.dupont@example.com",
        custom_attributes: {
          "firstname.s": "Jean",
          "consent_newsletter.b": true,
          "topics.a": ["news", "offers"],
        },
      },
    });
  });

  it("types and converts every value the profile vocabulary covers", () => {
    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      {
        firstname: "Jean",
        consent_newsletter: true,
        topics: ["news", "offers"],
        birthday: new Date("1988-04-12T00:00:00.000Z"),
        website: new URL("https://batch.com/pricing"),
        children_count: 2,
        basket_total: 19.99,
      },
      EVENT_DATA
    );

    expect(event.params.custom_attributes).toEqual({
      "firstname.s": "Jean",
      "consent_newsletter.b": true,
      "topics.a": ["news", "offers"],
      "birthday.t": 576806400000,
      "website.u": "https://batch.com/pricing",
      "children_count.i": 2,
      "basket_total.f": 19.99,
    });
  });

  it("keeps a date and a URL serializable in the request body", () => {
    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      { birthday: new Date("1988-04-12T00:00:00.000Z"), website: new URL("https://batch.com/pricing") },
      EVENT_DATA
    );

    expect(JSON.parse(JSON.stringify(event)).params.custom_attributes).toEqual({
      "birthday.t": 576806400000,
      "website.u": "https://batch.com/pricing",
    });
  });

  it("maps $phone_number to the phone_number slot", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { $phone_number: "+33612345678" }, EVENT_DATA);
    expect(event.params.phone_number).toBe("+33612345678");
    expect(event.params.custom_attributes).toBeUndefined();
  });

  it("normalizes the email alias to the fixed `email` param key", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { $email_address: "jean.dupont@example.com" }, EVENT_DATA);
    expect(event.params.email).toBe("jean.dupont@example.com");
    expect(event.params.email_address).toBeUndefined();
    expect(event.params.custom_attributes).toBeUndefined();
  });

  it("drops an unrecognized native alias instead of forwarding it raw", () => {
    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      { $email_adress: "jean.dupont@example.com", $region: "FR", firstname: "Jean" },
      EVENT_DATA
    );
    expect(event.params.email_adress).toBeUndefined();
    expect(event.params.region).toBeUndefined();
    expect(Object.keys(event.params)).toEqual(["ed", "custom_attributes"]);
    expect(event.params.custom_attributes).toEqual({ "firstname.s": "Jean" });
  });

  it("maps $honeypot to the root honeypot param, next to the natives", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { $honeypot: "i am a bot", $email_address: "jean.dupont@example.com" }, EVENT_DATA);

    expect(event.params.honeypot).toBe("i am a bot");
    expect(event.params.email).toBe("jean.dupont@example.com");
    expect(event.params.$honeypot).toBeUndefined();
    expect(event.params.custom_attributes).toBeUndefined();
  });

  it("caps the honeypot value instead of dropping it on the profile contract", () => {
    const oversized = "x".repeat(Consts.AttributeStringMaxLengthCEP + 100);

    const event = buildFormSubmittedEvent("id-1", DATE, { $honeypot: oversized }, EVENT_DATA);

    expect(event.params.honeypot).toBe("x".repeat(255));
  });

  it("drops a native whose value violates the profile contract of its slot", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);

    const event = buildFormSubmittedEvent("id-1", DATE, { $email_address: true, firstname: "Jean" }, EVENT_DATA);

    expect(event.params.email).toBeUndefined();
    expect(event.params.custom_attributes).toEqual({ "firstname.s": "Jean" });
    expect(warn).toHaveBeenCalledWith(
      expect.anything(),
      `[landing] dropping form field with mapsTo "$email_address": the value violates profile attribute constraints`
    );
  });

  it.each([
    ["a malformed address", "not-an-email"],
    ["an empty value", ""],
    ["an address over the email maximum", `${"a".repeat(Consts.EmailAddressMaxLength)}@example.com`],
    ["a non-string value", 42],
  ])("drops $email_address carrying %s", (_label, value) => {
    const event = buildFormSubmittedEvent("id-1", DATE, { $email_address: value, firstname: "Jean" }, EVENT_DATA);

    expect(event.params.email).toBeUndefined();
    expect(event.params.custom_attributes).toEqual({ "firstname.s": "Jean" });
  });

  it("keeps an $email_address the profile editor would accept", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { $email_address: "jean.dupont@example.com" }, EVENT_DATA);
    expect(event.params.email).toBe("jean.dupont@example.com");
  });

  it("leaves the phone format and the non-string verdict to the server", () => {
    const kept = buildFormSubmittedEvent("id-1", DATE, { $phone_number: "0612345678" }, EVENT_DATA);
    expect(kept.params.phone_number).toBe("0612345678");

    for (const value of ["", "a".repeat(Consts.AttributeStringMaxLengthCEP + 1)]) {
      const dropped = buildFormSubmittedEvent("id-1", DATE, { $phone_number: value }, EVENT_DATA);
      expect(dropped.params.phone_number).toBeUndefined();
    }

    const tolerated = buildFormSubmittedEvent("id-1", DATE, { $phone_number: 42 }, EVENT_DATA);
    expect(tolerated.params.phone_number).toBe(42);
  });

  it("converts a native slot value like a profile attribute, so a Date or a URL never ships raw", () => {
    const url = buildFormSubmittedEvent("id-1", DATE, { $phone_number: new URL("https://batch.com/pricing") }, EVENT_DATA);
    expect(url.params.phone_number).toBe("https://batch.com/pricing");

    const date = buildFormSubmittedEvent("id-1", DATE, { $phone_number: new Date("1988-04-12T00:00:00.000Z") }, EVENT_DATA);
    expect(date.params.phone_number).toBe(576806400000);
  });

  it.each([
    ["an empty string", ""],
    ["a string over the maximum", "a".repeat(Consts.AttributeStringMaxLengthCEP + 1)],
    ["an empty array", []],
    ["an array over the maximum size", Array.from({ length: Consts.MaxEventArrayItems + 1 }, (_, i) => `v${i}`)],
    ["an array holding an invalid entry", ["ok", ""]],
    ["a URL over the maximum length", new URL(`https://batch.com/${"a".repeat(Consts.AttributeURLMaxLength)}`)],
  ])("drops a custom attribute carrying %s and keeps its valid siblings", (_label, value) => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);

    const event = buildFormSubmittedEvent("id-1", DATE, { rejected: value, firstname: "Jean" }, EVENT_DATA);

    expect(event.params.custom_attributes).toEqual({ "firstname.s": "Jean" });
    expect(event.params.ed).toEqual(EVENT_DATA);
    expect(warn).toHaveBeenCalledWith(
      expect.anything(),
      `[landing] dropping form field with mapsTo "rejected": the value violates profile attribute constraints`
    );
  });

  it("serializes the boundary-valid custom values the profile accepts", () => {
    const maxString = "a".repeat(Consts.AttributeStringMaxLengthCEP);
    const maxArray = Array.from({ length: Consts.MaxEventArrayItems }, (_, i) => `v${i}`);
    const event = buildFormSubmittedEvent("id-1", DATE, { firstname: maxString, topics: maxArray }, EVENT_DATA);

    expect(event.params.custom_attributes).toEqual({ "firstname.s": maxString, "topics.a": maxArray });
  });

  it("tolerates in a custom attribute exactly what the profile tolerates", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { topics: ["ok", 42] as never, firstname: "Jean" }, EVENT_DATA);

    expect(event.params.custom_attributes).toEqual({ "topics.a": ["ok", 42], "firstname.s": "Jean" });
  });

  it("normalizes an array like the profile does, before applying the size limit", () => {
    const withDuplicate = [...Array.from({ length: Consts.MaxEventArrayItems }, (_, i) => `v${i}`), "V0"];
    const event = buildFormSubmittedEvent("id-1", DATE, { topics: withDuplicate }, EVENT_DATA);

    const serialized = event.params.custom_attributes?.["topics.a"];
    expect(serialized).toHaveLength(Consts.MaxEventArrayItems);
    expect(serialized).toEqual([...Array.from({ length: Consts.MaxEventArrayItems - 1 }, (_, i) => `v${i + 1}`), "v0"]);
  });

  it("lowercases and deduplicates array values exactly like the profile", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { topics: ["A", "a", "B"] }, EVENT_DATA);
    expect(event.params.custom_attributes).toEqual({ "topics.a": ["a", "B".toLocaleLowerCase()] });
  });

  it("still emits the lead when every field is rejected", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { firstname: "", topics: [] }, EVENT_DATA);

    expect(event.params.custom_attributes).toBeUndefined();
    expect(Object.keys(event.params)).toEqual(["ed"]);
    expect(event.name).toBe("_FORM_SUBMITTED");
  });

  it("omits custom_attributes entirely when every field is native", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { $email_address: "a@b.co" }, EVENT_DATA);
    expect(Object.keys(event.params)).toEqual(["ed", "email"]);
  });

  it("keeps a custom key verbatim, including an email-looking prefix", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { email_a1b2c3d4e5: "typed by hand" }, EVENT_DATA);
    expect(event.params.email).toBeUndefined();
    expect(event.params.custom_attributes).toEqual({ "email_a1b2c3d4e5.s": "typed by hand" });
  });

  it("drops a bare $, which names no native at all", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { $: "nowhere", firstname: "Jean" }, EVENT_DATA);
    expect(event.params.custom_attributes).toEqual({ "firstname.s": "Jean" });
    expect(Object.keys(event.params)).toEqual(["ed", "custom_attributes"]);
  });

  it("drops a field whose mapsTo collides with a reserved envelope key", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { ed: "malicious", custom_attributes: "malicious", firstname: "Jean" }, EVENT_DATA);
    expect(event.params.ed).toEqual(EVENT_DATA);
    expect(event.params.custom_attributes).toEqual({ "firstname.s": "Jean" });
  });

  it("keeps a mapsTo that collides with an inherited object member: only `ed` and `custom_attributes` are reserved", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { toString: "Jean", constructor: "Dupont" }, EVENT_DATA);
    expect(event.params.custom_attributes).toEqual({ "toString.s": "Jean", "constructor.s": "Dupont" });
  });

  it("drops a native whose stripped name would shadow a reserved envelope key", () => {
    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      { $ed: "malicious", $custom_attributes: "malicious", firstname: "Jean" },
      EVENT_DATA
    );
    expect(event.params.ed).toEqual(EVENT_DATA);
    expect(event.params.custom_attributes).toEqual({ "firstname.s": "Jean" });
  });

  it.each([
    ["a dot, indistinguishable from the type suffix", "email.address"],
    ["a dash, which the Profile API refuses", "first-name"],
    ["over 30 characters", "a".repeat(31)],
    ["a space", "first name"],
  ])("drops a custom mapsTo carrying %s", (_label, mapsTo) => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);

    const event = buildFormSubmittedEvent("id-1", DATE, { [mapsTo]: "value", firstname: "Jean" }, EVENT_DATA);

    expect(event.params.custom_attributes).toEqual({ "firstname.s": "Jean" });
    expect(warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining(mapsTo));
  });

  it("keeps the longest key the attribute grammar allows", () => {
    const mapsTo = "a".repeat(30);
    const event = buildFormSubmittedEvent("id-1", DATE, { [mapsTo]: "value" }, EVENT_DATA);
    expect(event.params.custom_attributes).toEqual({ [`${mapsTo}.s`]: "value" });
  });
});

describe("isInputResponseBody", () => {
  it("accepts a nominal response", () => {
    expect(
      isInputResponseBody({
        results: [
          { id: "a", status: "accepted" },
          { id: "b", status: "rejected", errors: { $email_address: "invalid_email" } },
        ],
      })
    ).toBe(true);
  });

  it("accepts unknown error codes for forward compatibility", () => {
    expect(isInputResponseBody({ results: [{ id: "a", status: "rejected", errors: { f: "brand_new_code" } }] })).toBe(true);
  });

  it.each([
    ["null", null],
    ["missing results", {}],
    ["results not an array", { results: {} }],
    ["missing id", { results: [{ status: "accepted" }] }],
    ["unknown status", { results: [{ id: "a", status: "maybe" }] }],
    ["non-string error values", { results: [{ id: "a", status: "rejected", errors: { f: 42 } }] }],
  ])("rejects %s", (_label, value) => {
    expect(isInputResponseBody(value)).toBe(false);
  });
});

describe("localizeFieldErrors", () => {
  const TEXTS = landingDefaultTexts("fr");

  it("maps the specific codes to their localized messages", () => {
    expect(localizeFieldErrors({ a: "required", b: "invalid_email", c: "invalid_phone" }, TEXTS)).toEqual({
      a: "Ce champ est obligatoire.",
      b: "Veuillez saisir une adresse e-mail valide.",
      c: "Veuillez saisir un numéro de téléphone valide.",
    });
  });

  it.each(["too_short", "too_long", "invalid_format", "unknown_field", "unknown_future_code"])(
    "degrades %s to the generic invalid message",
    code => {
      expect(localizeFieldErrors({ field: code }, TEXTS)).toEqual({ field: "Cette valeur est invalide." });
    }
  );

  it("reports unknown_field as a public error, since no value the visitor types can clear it", () => {
    const publicError = jest.spyOn(Log, "publicError").mockImplementation(() => undefined);
    try {
      localizeFieldErrors({ email: "unknown_field", phone: "invalid_phone" }, TEXTS);
      expect(publicError).toHaveBeenCalledTimes(1);
      expect(publicError.mock.calls[0][0]).toContain('field "email"');
    } finally {
      publicError.mockRestore();
    }
  });

  it("prefers serving overrides over the embedded l10n", () => {
    const texts = { ...TEXTS, [RENDER_TEXT_KEY_FORM_REQUIRED_ERROR]: "Champ requis !" };
    expect(localizeFieldErrors({ field: "required" }, texts)).toEqual({ field: "Champ requis !" });
  });

  it("falls back to the embedded english text when the key is missing from texts", () => {
    expect(localizeFieldErrors({ field: "invalid_email" }, {})).toEqual({
      field: landingDefaultTexts("en")[RENDER_TEXT_KEY_FORM_INVALID_EMAIL_ERROR],
    });
  });

  it("never leaks the raw code even with empty texts", () => {
    const localized = localizeFieldErrors({ field: "invalid_format" }, {});
    expect(localized.field).toBe(landingDefaultTexts("en")[RENDER_TEXT_KEY_FORM_INVALID_ERROR]);
    expect(localized.field).not.toBe("invalid_format");
  });
});
