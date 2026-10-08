/* eslint-env jest */

import {
  RENDER_HONEYPOT_MAX_LENGTH,
  RENDER_TEXT_KEY_FORM_INVALID_EMAIL_ERROR,
  RENDER_TEXT_KEY_FORM_INVALID_ERROR,
  RENDER_TEXT_KEY_FORM_REQUIRED_ERROR,
} from "com.batch.dom/render/render-constants";
import { ATTRIBUTE_TYPE_CASES, ATTRIBUTE_TYPES, collectedSample } from "com.batch.dom/render/test-utils/factories/attribute-type-cases";
import { Consts } from "com.batch.shared/constants/user";
import { Log } from "com.batch.shared/logger";
import { PartialUpdateObject, ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

import { WS_URL } from "../../../../../config";
import type { FormFieldValue } from "../../contracts";
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
        value: {
          $email_address: { type: ProfileAttributeType.STRING, value: "jean.dupont@example.com" },
          $phone_number: { type: ProfileAttributeType.STRING, value: "+33612345678" },
          firstname: { type: ProfileAttributeType.STRING, value: "Jean" },
        },
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
        value: {
          $email_adress: { type: ProfileAttributeType.STRING, value: "typo@batch.com" },
          city: { type: ProfileAttributeType.STRING, value: "Paris" },
        },
      },
      EVENT_DATA
    );
    expect(params?.value).toBe('{"city":"Paris"}');
  });

  it("reports the checked values of a choice group in the CTA value, not the profile operation", () => {
    const params = buildMessagingEventParams(
      {
        type: "clicked",
        ctaId: "submit",
        ctaType: "button",
        action: "batch.form.submit",
        value: {
          sports: { type: ProfileAttributeType.ARRAY, value: { $add: ["tennis"], $remove: ["golf"] } },
          newsletter: { type: ProfileAttributeType.BOOLEAN, value: true },
        },
      },
      EVENT_DATA
    );
    expect(params?.value).toBe('{"sports":["tennis"],"newsletter":true}');
  });

  it("reports the picked number of a typed field in the CTA value, not its carrier", () => {
    const params = buildMessagingEventParams(
      {
        type: "clicked",
        ctaId: "submit",
        ctaType: "button",
        action: "batch.form.submit",
        value: { budget: { type: ProfileAttributeType.FLOAT, value: 2.5 } },
      },
      EVENT_DATA
    );
    expect(params?.value).toBe('{"budget":2.5}');
  });

  it("a submit CTA reports a date as ISO and a URL as its href", () => {
    const params = buildMessagingEventParams(
      {
        type: "clicked",
        ctaId: "submit",
        ctaType: "button",
        action: "batch.form.submit",
        value: { when: ATTRIBUTE_TYPE_CASES.date.accepted[0].value, site: ATTRIBUTE_TYPE_CASES.url.accepted[0].value },
      },
      EVENT_DATA
    );
    expect(JSON.parse(String(params?.value))).toEqual({ when: "2026-09-09T00:00:00.000Z", site: "https://batch.com/pricing" });
  });

  it("a group that only removes reports an empty pick", () => {
    const params = buildMessagingEventParams(
      {
        type: "clicked",
        ctaId: "submit",
        ctaType: "button",
        action: "batch.form.submit",
        value: { sports: { type: ProfileAttributeType.ARRAY, value: { $remove: ["golf"] } } },
      },
      EVENT_DATA
    );
    expect(params?.value).toBe('{"sports":[]}');
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
  const str = (value: string): FormFieldValue => ({ type: ProfileAttributeType.STRING, value });

  it("splits natives into their own slot and type-suffixes the custom attributes", () => {
    const event = buildFormSubmittedEvent(
      "5f1c8e2a-0001-4a1b-9c3d-000000000003",
      DATE,
      {
        $email_address: str("jean.dupont@example.com"),
        firstname: str("Jean"),
        consent_newsletter: { type: ProfileAttributeType.BOOLEAN, value: true },
        topics: { type: ProfileAttributeType.ARRAY, value: { $add: ["news", "offers"] } },
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
          "topics.a": { $add: ["news", "offers"] },
        },
      },
    });
  });

  it.each(ATTRIBUTE_TYPES)("a %s value lands under its suffix with its JSON shape", type => {
    const event = buildFormSubmittedEvent("id-1", DATE, { k: collectedSample(type) }, EVENT_DATA);
    const { wire } = ATTRIBUTE_TYPE_CASES[type];

    expect(JSON.parse(JSON.stringify(event.params.custom_attributes))).toEqual({ [`k.${wire.suffix}`]: wire.json });
  });

  it("keeps a date and a URL serializable in the request body", () => {
    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      {
        birthday: { type: ProfileAttributeType.DATE, value: new Date("1988-04-12T00:00:00.000Z") },
        website: { type: ProfileAttributeType.URL, value: new URL("https://batch.com/pricing") },
      },
      EVENT_DATA
    );

    expect(JSON.parse(JSON.stringify(event)).params.custom_attributes).toEqual({
      "birthday.t": 576806400000,
      "website.u": "https://batch.com/pricing",
    });
  });

  it("a URL travels as the profile would store it: credentials and fragment kept", () => {
    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      { k: { type: ProfileAttributeType.URL, value: new URL("https://user:pw@batch.com/p#frag") } },
      EVENT_DATA
    );

    expect(event.params.custom_attributes).toEqual({ "k.u": "https://user:pw@batch.com/p#frag" });
  });

  it("keeps an integral float a float, which a shape-typed value could not do", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { budget: { type: ProfileAttributeType.FLOAT, value: 2 } }, EVENT_DATA);

    expect(event.params.custom_attributes).toEqual({ "budget.f": 2 });
  });

  it.each<[string, FormFieldValue]>([
    ["an empty string", str("")],
    ["a string over the maximum", str("a".repeat(Consts.AttributeStringMaxLengthCEP + 1))],
    [
      "a URL over the maximum length",
      { type: ProfileAttributeType.URL, value: new URL(`https://batch.com/${"a".repeat(Consts.AttributeURLMaxLength)}`) },
    ],
    ["a NaN integer", { type: ProfileAttributeType.INTEGER, value: Number.NaN }],
    ["a NaN float", { type: ProfileAttributeType.FLOAT, value: Number.NaN }],
  ])("drops a custom attribute carrying %s and keeps its valid siblings", (_label, value) => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);

    const event = buildFormSubmittedEvent("id-1", DATE, { rejected: value, firstname: str("Jean") }, EVENT_DATA);

    expect(event.params.custom_attributes).toEqual({ "firstname.s": "Jean" });
    expect(event.params.ed).toEqual(EVENT_DATA);
    expect(warn).toHaveBeenCalledWith(
      expect.anything(),
      `[landing] dropping form field with mapsTo "rejected": the value violates profile attribute constraints`
    );
    warn.mockRestore();
  });

  it("serializes the boundary-valid custom values the profile accepts", () => {
    const maxString = "a".repeat(Consts.AttributeStringMaxLengthCEP);
    const maxArray = Array.from({ length: Consts.MaxEventArrayItems }, (_, i) => `v${i}`);
    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      { firstname: str(maxString), topics: { type: ProfileAttributeType.ARRAY, value: { $add: maxArray } } },
      EVENT_DATA
    );

    expect(event.params.custom_attributes).toEqual({ "firstname.s": maxString, "topics.a": { $add: maxArray } });

    const maxURL = new URL(`https://batch.com/${"a".repeat(Consts.AttributeURLMaxLength - "https://batch.com/".length)}`);
    expect(maxURL.href).toHaveLength(Consts.AttributeURLMaxLength);
    const url = buildFormSubmittedEvent("id-1", DATE, { k: { type: ProfileAttributeType.URL, value: maxURL } }, EVENT_DATA);
    expect(url.params.custom_attributes).toEqual({ "k.u": maxURL.href });

    const negativeZero = buildFormSubmittedEvent("id-1", DATE, { k: { type: ProfileAttributeType.FLOAT, value: -0 } }, EVENT_DATA);
    expect(Object.is(JSON.parse(JSON.stringify(negativeZero.params.custom_attributes))["k.f"], 0)).toBe(true);
    expect(JSON.stringify(negativeZero.params)).toContain('"k.f":0');

    // The wire tolerates the exponential notation `JSON.stringify` picks for an integer this large.
    const huge = buildFormSubmittedEvent("id-1", DATE, { k: { type: ProfileAttributeType.INTEGER, value: 1e21 } }, EVENT_DATA);
    expect(JSON.stringify(huge.params)).toContain('"k.i":1e+21');
  });

  it("ships a checkbox group as a partial array update, its members as written", () => {
    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      {
        sports: { type: ProfileAttributeType.ARRAY, value: { $add: ["Foot", "Basketball_dev"], $remove: ["foot"] } },
        newsletter: { type: ProfileAttributeType.BOOLEAN, value: false },
        fav_sport: str("tennis_dev"),
      },
      EVENT_DATA
    );

    expect(event.params.custom_attributes).toEqual({
      "sports.a": { $add: ["Foot", "Basketball_dev"], $remove: ["foot"] },
      "newsletter.b": false,
      "fav_sport.s": "tennis_dev",
    });
  });

  it("maps $topic_preferences to the topic_preferences slot as a partial update", () => {
    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      { $topic_preferences: { type: ProfileAttributeType.ARRAY, value: { $add: ["News"], $remove: ["promo"] } } },
      EVENT_DATA
    );

    expect(event.params.topic_preferences).toEqual({ $add: ["news"], $remove: ["promo"] });
    expect(event.params.custom_attributes).toBeUndefined();
  });

  it("drops a $topic_preferences value that is not a partial array update", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);

    const event = buildFormSubmittedEvent("id-1", DATE, { $topic_preferences: str("news") }, EVENT_DATA);

    expect(event.params).not.toHaveProperty("topic_preferences");
    expect(warn).toHaveBeenCalledWith(
      expect.anything(),
      `[landing] dropping form field with mapsTo "$topic_preferences": the value violates profile attribute constraints`
    );
    warn.mockRestore();
  });

  it("drops $topic_preferences carrying a member that is not a topic", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);

    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      { $topic_preferences: { type: ProfileAttributeType.ARRAY, value: { $add: ["news"], $remove: ["Sports & more"] } } },
      EVENT_DATA
    );

    expect(event.params).not.toHaveProperty("topic_preferences");
    expect(warn).toHaveBeenCalledWith(
      expect.anything(),
      `[landing] dropping form field with mapsTo "$topic_preferences": the value violates profile attribute constraints`
    );
    warn.mockRestore();
  });

  it("drops $topic_preferences with more members than the topic cap in one branch", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    const topics = Array.from({ length: Consts.MaxTopicPreferenceItems + 1 }, (_, i) => `t${i}`);

    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      { $topic_preferences: { type: ProfileAttributeType.ARRAY, value: { $add: topics } } },
      EVENT_DATA
    );

    expect(event.params).not.toHaveProperty("topic_preferences");
    warn.mockRestore();
  });

  it("bounds each branch on its own, not their sum", () => {
    const add = Array.from({ length: 20 }, (_, i) => `a${i}`);
    const remove = Array.from({ length: 20 }, (_, i) => `r${i}`);
    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      { sports: { type: ProfileAttributeType.ARRAY, value: { $add: add, $remove: remove } } },
      EVENT_DATA
    );

    expect(event.params.custom_attributes).toEqual({ "sports.a": { $add: add, $remove: remove } });
  });
  it("omits the empty branch of a partial array update", () => {
    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      { sports: { type: ProfileAttributeType.ARRAY, value: { $add: ["tennis"], $remove: [] } } },
      EVENT_DATA
    );

    expect(event.params.custom_attributes).toEqual({ "sports.a": { $add: ["tennis"] } });
  });

  it("deduplicates inside a branch, keeping the last occurrence", () => {
    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      { sports: { type: ProfileAttributeType.ARRAY, value: { $remove: ["golf", "tennis", "golf"] } } },
      EVENT_DATA
    );

    expect(event.params.custom_attributes).toEqual({ "sports.a": { $remove: ["tennis", "golf"] } });

    const added = buildFormSubmittedEvent(
      "id-1",
      DATE,
      { sports: { type: ProfileAttributeType.ARRAY, value: { $add: ["a", "b", "a"] } } },
      EVENT_DATA
    );

    expect(added.params.custom_attributes).toEqual({ "sports.a": { $add: ["b", "a"] } });
  });

  it.each<[string, PartialUpdateObject]>([
    ["both branches empty", { $add: [], $remove: [] }],
    [
      "more values than the array cap in the removed branch",
      { $remove: Array.from({ length: Consts.MaxEventArrayItems + 1 }, (_, i) => `r${i}`) },
    ],
    ["an invalid value in a branch", { $add: ["ok"], $remove: [""] }],
    ["26 values in a single branch", { $add: Array.from({ length: Consts.MaxEventArrayItems + 1 }, (_, i) => `a${i}`) }],
  ])("drops a partial array update with %s", (_label, value) => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);

    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      { sports: { type: ProfileAttributeType.ARRAY, value }, firstname: str("Jean") },
      EVENT_DATA
    );

    expect(event.params.custom_attributes).toEqual({ "firstname.s": "Jean" });
    warn.mockRestore();
  });

  it("maps $phone_number to the phone_number slot", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { $phone_number: str("+33612345678") }, EVENT_DATA);
    expect(event.params.phone_number).toBe("+33612345678");
    expect(event.params.custom_attributes).toBeUndefined();
  });

  it("normalizes the email alias to the fixed `email` param key", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { $email_address: str("jean.dupont@example.com") }, EVENT_DATA);
    expect(event.params.email).toBe("jean.dupont@example.com");
    expect(event.params).not.toHaveProperty("email_address");
    expect(event.params.custom_attributes).toBeUndefined();
  });

  it("drops an unrecognized native alias instead of forwarding it raw", () => {
    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      { $email_adress: str("jean.dupont@example.com"), $region: str("FR"), firstname: str("Jean") },
      EVENT_DATA
    );
    expect(event.params).not.toHaveProperty("email_adress");
    expect(event.params).not.toHaveProperty("region");
    expect(Object.keys(event.params)).toEqual(["ed", "custom_attributes"]);
    expect(event.params.custom_attributes).toEqual({ "firstname.s": "Jean" });
  });

  it("maps $honeypot to the root honeypot param, next to the natives", () => {
    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      { $honeypot: str("i am a bot"), $email_address: str("jean.dupont@example.com") },
      EVENT_DATA
    );

    expect(event.params.honeypot).toBe("i am a bot");
    expect(event.params.email).toBe("jean.dupont@example.com");
    expect(event.params).not.toHaveProperty("$honeypot");
    expect(event.params.custom_attributes).toBeUndefined();
  });

  it("caps the honeypot value instead of dropping it on the profile contract", () => {
    const oversized = "x".repeat(Consts.AttributeStringMaxLengthCEP + 100);

    const event = buildFormSubmittedEvent("id-1", DATE, { $honeypot: str(oversized) }, EVENT_DATA);

    expect(event.params.honeypot).toBe("x".repeat(RENDER_HONEYPOT_MAX_LENGTH));
  });

  it("$honeypot carrying anything but a string is dropped without a word", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);

    const event = buildFormSubmittedEvent("id-1", DATE, { $honeypot: { type: ProfileAttributeType.BOOLEAN, value: true } }, EVENT_DATA);

    expect(event.params.honeypot).toBeUndefined();
    expect(event.params.custom_attributes).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it.each([
    ["a malformed address", "not-an-email"],
    ["an empty value", ""],
    ["an address over the email maximum", `${"a".repeat(Consts.EmailAddressMaxLength)}@example.com`],
  ])("drops $email_address carrying %s", (_label, value) => {
    const event = buildFormSubmittedEvent("id-1", DATE, { $email_address: str(value), firstname: str("Jean") }, EVENT_DATA);

    expect(event.params.email).toBeUndefined();
    expect(event.params.custom_attributes).toEqual({ "firstname.s": "Jean" });
  });

  it("keeps an $email_address the profile editor would accept", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { $email_address: str("jean.dupont@example.com") }, EVENT_DATA);
    expect(event.params.email).toBe("jean.dupont@example.com");
  });

  it("a native email at the length bound travels, one character past it does not", () => {
    const atBound = `${"a".repeat(Consts.EmailAddressMaxLength - "@example.com".length)}@example.com`;
    expect(atBound).toHaveLength(Consts.EmailAddressMaxLength);
    const kept = buildFormSubmittedEvent("id-1", DATE, { $email_address: str(atBound) }, EVENT_DATA);
    expect(kept.params.email).toBe(atBound);

    const overBound = `a${atBound}`;
    expect(overBound).toHaveLength(Consts.EmailAddressMaxLength + 1);
    const dropped = buildFormSubmittedEvent("id-1", DATE, { $email_address: str(overBound), firstname: str("Jean") }, EVENT_DATA);
    expect(dropped.params.email).toBeUndefined();
    expect(dropped.params.custom_attributes).toEqual({ "firstname.s": "Jean" });
  });

  it("holds $phone_number to the profile phone format", () => {
    const kept = buildFormSubmittedEvent("id-1", DATE, { $phone_number: str("+33612345678") }, EVENT_DATA);
    expect(kept.params.phone_number).toBe("+33612345678");

    for (const value of ["0612345678", "", "+", "+3361234567890123", "+33 6 12 34 56 78"]) {
      const dropped = buildFormSubmittedEvent("id-1", DATE, { $phone_number: str(value) }, EVENT_DATA);
      expect(dropped.params.phone_number).toBeUndefined();
      expect(dropped.params.custom_attributes).toBeUndefined();
    }
  });

  it.each<[string, FormFieldValue]>([
    ["a partial array update", { type: ProfileAttributeType.ARRAY, value: { $add: ["a@b.c"] } }],
    ["a typed number", { type: ProfileAttributeType.INTEGER, value: 3 }],
    ["a boolean", { type: ProfileAttributeType.BOOLEAN, value: true }],
    ["a date", { type: ProfileAttributeType.DATE, value: new Date("1988-04-12T00:00:00.000Z") }],
    ["a url", { type: ProfileAttributeType.URL, value: new URL("https://batch.com/pricing") }],
  ])("drops %s aimed at a native slot, which holds one string", (_label, value) => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);

    for (const [mapsTo, slot] of [
      ["$email_address", "email"],
      ["$phone_number", "phone_number"],
    ]) {
      const event = buildFormSubmittedEvent("id-1", DATE, { [mapsTo]: value }, EVENT_DATA);

      expect(event.params).not.toHaveProperty(slot);
      expect(event.params.custom_attributes).toBeUndefined();
    }
    warn.mockRestore();
  });

  it("still emits the lead when every field is rejected", () => {
    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      { firstname: str(""), topics: { type: ProfileAttributeType.ARRAY, value: {} } },
      EVENT_DATA
    );

    expect(event.params.custom_attributes).toBeUndefined();
    expect(Object.keys(event.params)).toEqual(["ed"]);
    expect(event.name).toBe("_FORM_SUBMITTED");
  });

  it("omits custom_attributes entirely when every field is native", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { $email_address: str("a@b.co") }, EVENT_DATA);
    expect(Object.keys(event.params)).toEqual(["ed", "email"]);
  });

  it("keeps a custom key verbatim, including an email-looking prefix", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { email_a1b2c3d4e5: str("typed by hand") }, EVENT_DATA);
    expect(event.params.email).toBeUndefined();
    expect(event.params.custom_attributes).toEqual({ "email_a1b2c3d4e5.s": "typed by hand" });
  });

  it("an uppercase key is another key", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { Firstname: str("Jean"), firstname: str("Jeanne") }, EVENT_DATA);
    expect(event.params.custom_attributes).toEqual({ "Firstname.s": "Jean", "firstname.s": "Jeanne" });
  });

  it("a custom key named email lives next to the native email slot", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { email: str("typed"), $email_address: str("a@b.co") }, EVENT_DATA);
    expect(event.params.email).toBe("a@b.co");
    expect(event.params.custom_attributes).toEqual({ "email.s": "typed" });
  });

  it("drops a bare $, which names no native at all", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { $: str("nowhere"), firstname: str("Jean") }, EVENT_DATA);
    expect(event.params.custom_attributes).toEqual({ "firstname.s": "Jean" });
    expect(Object.keys(event.params)).toEqual(["ed", "custom_attributes"]);
  });

  it("drops a field whose mapsTo collides with a reserved envelope key", () => {
    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      { ed: str("malicious"), custom_attributes: str("malicious"), firstname: str("Jean") },
      EVENT_DATA
    );
    expect(event.params.ed).toEqual(EVENT_DATA);
    expect(event.params.custom_attributes).toEqual({ "firstname.s": "Jean" });
  });

  it("keeps a mapsTo that collides with an inherited object member: only `ed` and `custom_attributes` are reserved", () => {
    const event = buildFormSubmittedEvent("id-1", DATE, { toString: str("Jean"), constructor: str("Dupont") }, EVENT_DATA);
    expect(event.params.custom_attributes).toEqual({ "toString.s": "Jean", "constructor.s": "Dupont" });
  });

  it("drops a native whose stripped name would shadow a reserved envelope key", () => {
    const event = buildFormSubmittedEvent(
      "id-1",
      DATE,
      { $ed: str("malicious"), $custom_attributes: str("malicious"), firstname: str("Jean") },
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

    const event = buildFormSubmittedEvent("id-1", DATE, { [mapsTo]: str("value"), firstname: str("Jean") }, EVENT_DATA);

    expect(event.params.custom_attributes).toEqual({ "firstname.s": "Jean" });
    expect(warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining(mapsTo));
    warn.mockRestore();
  });

  it("keeps the longest key the attribute grammar allows", () => {
    const mapsTo = "a".repeat(30);
    const event = buildFormSubmittedEvent("id-1", DATE, { [mapsTo]: str("value") }, EVENT_DATA);
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

  it("refuses a results list as soon as one entry is malformed", () => {
    const wellFormed = { id: "a", status: "accepted" };
    expect(isInputResponseBody({ results: [wellFormed, { id: "b", status: "maybe" }] })).toBe(false);
    expect(isInputResponseBody({ results: [wellFormed, { id: "b", status: "rejected" }] })).toBe(true);
  });

  it("refuses an error map as soon as one code is not a string", () => {
    const results = (errors: Record<string, unknown>): unknown => ({ results: [{ id: "a", status: "rejected", errors }] });
    expect(isInputResponseBody(results({ email: "invalid_email", phone: 42 }))).toBe(false);
    expect(isInputResponseBody(results({ email: "invalid_email", phone: "invalid_phone" }))).toBe(true);
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

  it("treats a declared empty text as no override: the visitor reads the embedded copy, not a blank error", () => {
    const texts = { ...TEXTS, [RENDER_TEXT_KEY_FORM_REQUIRED_ERROR]: "" };
    expect(localizeFieldErrors({ field: "required" }, texts)).toEqual({
      field: landingDefaultTexts("en")[RENDER_TEXT_KEY_FORM_REQUIRED_ERROR],
    });
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
