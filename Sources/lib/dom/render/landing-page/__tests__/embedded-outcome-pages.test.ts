/* eslint-env jest */

import { normalizeMessage } from "com.batch.dom/render/model/normalizer";

import { makeEmbeddedErrorPayload } from "../embedded-outcome-pages";

describe("makeEmbeddedErrorPayload", () => {
  test.each([
    ["en", "Something went wrong", "We couldn't process your request. Please try again later."],
    ["fr", "Une erreur est survenue", "Nous n'avons pas pu traiter votre demande. Veuillez réessayer plus tard."],
    ["de", "Ein Fehler ist aufgetreten", "Ihre Anfrage konnte nicht verarbeitet werden. Bitte versuchen Sie es später erneut."],
    ["es", "Se ha producido un error", "No hemos podido procesar su solicitud. Inténtelo de nuevo más tarde."],
  ] as const)("the error page in %s carries the RFC copy and normalizes cleanly", (lang, title, message) => {
    const payload = makeEmbeddedErrorPayload(lang);

    expect(payload.texts).toEqual({ title, message });

    const normalized = normalizeMessage(payload);
    expect(normalized.format).toBe("fullscreen");
    expect(normalized.root.children).toHaveLength(5);
    expect(normalized.texts.title).toBe(title);
    expect(normalized.texts.message).toBe(message);
  });

  test("the embedded page is inert: no actions, no urls, no fields", () => {
    const payload = makeEmbeddedErrorPayload("en");
    expect(payload.actions).toEqual({});
    expect(payload.urls).toEqual({});
    expect(payload.root.children.every(child => child.type === "text" || child.type === "divider" || child.type === "spacer")).toBe(true);
  });

  test("the accent divider carries the error color", () => {
    const payload = makeEmbeddedErrorPayload("en");
    const accent = payload.root.children.find(child => child.type === "divider")?.color;
    expect(accent).toEqual(["#d93025ff", "#f87171ff"]);
  });
});
