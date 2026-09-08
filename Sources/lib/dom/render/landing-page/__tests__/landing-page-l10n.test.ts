/* eslint-env jest */

import {
  RENDER_TEXT_KEY_FORM_COMPLETED_STATUS,
  RENDER_TEXT_KEY_FORM_INVALID_EMAIL_ERROR,
  RENDER_TEXT_KEY_FORM_INVALID_ERROR,
  RENDER_TEXT_KEY_FORM_INVALID_PHONE_ERROR,
  RENDER_TEXT_KEY_FORM_NETWORK_ERROR,
  RENDER_TEXT_KEY_FORM_REQUIRED_ERROR,
  RENDER_TEXT_KEY_FORM_SUBMIT_ERROR,
  RENDER_TEXT_KEY_IMAGE_INTERACTIVE,
} from "com.batch.dom/render/render-constants";

import { landingDefaultTexts, resolveLandingPageLang } from "../landing-page-l10n";

const RESERVED_KEYS = [
  RENDER_TEXT_KEY_FORM_REQUIRED_ERROR,
  RENDER_TEXT_KEY_FORM_INVALID_ERROR,
  RENDER_TEXT_KEY_FORM_INVALID_EMAIL_ERROR,
  RENDER_TEXT_KEY_FORM_INVALID_PHONE_ERROR,
  RENDER_TEXT_KEY_FORM_SUBMIT_ERROR,
  RENDER_TEXT_KEY_FORM_NETWORK_ERROR,
  RENDER_TEXT_KEY_FORM_COMPLETED_STATUS,
  RENDER_TEXT_KEY_IMAGE_INTERACTIVE,
];

describe("resolveLandingPageLang", () => {
  test.each(["fr", "de", "es"] as const)("honors the %s value the marker carries in data-lang", lang => {
    expect(resolveLandingPageLang(lang)).toBe(lang);
  });

  test("falls back to en when the marker carries no data-lang", () => {
    expect(resolveLandingPageLang(undefined)).toBe("en");
  });

  test("falls back to en for a language the bundle does not embed", () => {
    expect(resolveLandingPageLang("it")).toBe("en");
  });

  test("falls back to en on an empty attribute", () => {
    expect(resolveLandingPageLang("")).toBe("en");
  });

  test("ignores case-sensitive variants (only the exact fr value is honored)", () => {
    expect(resolveLandingPageLang("FR")).toBe("en");
  });

  test("ignores a regioned tag, since the bundle keys on the bare language", () => {
    expect(resolveLandingPageLang("fr-FR")).toBe("en");
  });

  test("keeps a prototype key away from the text dictionaries", () => {
    expect(resolveLandingPageLang("constructor")).toBe("en");
  });
});

describe("landingDefaultTexts", () => {
  test.each(["en", "fr", "de", "es"] as const)("provides every reserved form key in %s", lang => {
    const texts = landingDefaultTexts(lang);
    for (const key of RESERVED_KEYS) {
      expect(typeof texts[key]).toBe("string");
      expect(texts[key].length).toBeGreaterThan(0);
    }
  });

  test("localizes the required error in every embedded language", () => {
    expect(landingDefaultTexts("en")[RENDER_TEXT_KEY_FORM_REQUIRED_ERROR]).toBe("This field is required.");
    expect(landingDefaultTexts("fr")[RENDER_TEXT_KEY_FORM_REQUIRED_ERROR]).toBe("Ce champ est obligatoire.");
    expect(landingDefaultTexts("de")[RENDER_TEXT_KEY_FORM_REQUIRED_ERROR]).toBe("Dieses Feld ist erforderlich.");
    expect(landingDefaultTexts("es")[RENDER_TEXT_KEY_FORM_REQUIRED_ERROR]).toBe("Este campo es obligatorio.");
  });
});
