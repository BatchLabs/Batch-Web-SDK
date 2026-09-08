import { MessagePayload } from "com.batch.dom/render/model/types";

export function makeModalPayload(overrides: Partial<MessagePayload> = {}): MessagePayload {
  return {
    format: "modal",
    root: {
      children: [
        {
          type: "button",
          id: "cta-main",
          backgroundColor: ["#0044FFFF"],
          textColor: ["#FFFFFFFF"],
          fontSize: 14,
        },
      ],
    },
    closeOptions: {
      button: {
        color: ["#FFFFFFFF"],
        backgroundColor: ["#00000080"],
      },
    },
    texts: {
      "cta-main": "Open",
    },
    actions: {
      "cta-main": {
        action: "batch.deeplink",
        params: {
          l: "https://cta.example.test",
        },
      },
    },
    eventData: {
      campaign: "spring_sale",
    },
    trackingId: "renderer-tracking-id",
    ...overrides,
  };
}

export const FULL_TREE_IMAGE_URL = "https://example.com/hero.png";

/** Payload wiring every tree component through one message: text, image, divider, spacer, field, column and button. */
export function makeFullTreePayload(): MessagePayload {
  return {
    format: "modal",
    root: {
      children: [
        { type: "text", id: "title", fontSize: 22, color: ["#112233FF"] },
        { type: "image", id: "hero", height: "200px" },
        { type: "divider", color: ["#FF0000FF"], thickness: 3, width: "fill", hideOn: "mobile" },
        { type: "spacer", height: "40px" },
        {
          type: "field",
          id: "email",
          mapsTo: "$email_address",
          fieldType: "email",
          placeholderId: "email_ph",
          labelTextId: "email",
          required: true,
        },
        { type: "columns", ratios: [1], children: [{ type: "text", id: "nested", fontSize: 14, color: ["#000000FF"] }] },
        { type: "button", id: "submit", backgroundColor: ["#0044FFFF"], textColor: ["#FFFFFFFF"], fontSize: 16 },
      ],
    },
    closeOptions: {},
    texts: {
      title: "Welcome",
      email: "Email address",
      email_ph: "you@example.com",
      nested: "Nested copy",
      submit: "Send",
    },
    urls: { hero: FULL_TREE_IMAGE_URL },
    actions: { submit: { action: "batch.form.submit" } },
  };
}

export function makeFocusTrapPayload(overrides: Partial<MessagePayload> = {}): MessagePayload {
  return {
    format: "modal",
    root: {
      children: [
        {
          type: "button",
          id: "cta-first",
          backgroundColor: ["#0044FFFF"],
          textColor: ["#FFFFFFFF"],
          fontSize: 14,
        },
        {
          type: "button",
          id: "cta-second",
          backgroundColor: ["#0044FFFF"],
          textColor: ["#FFFFFFFF"],
          fontSize: 14,
        },
      ],
    },
    closeOptions: {
      button: {
        color: ["#FFFFFFFF"],
        backgroundColor: ["#00000080"],
      },
    },
    texts: {
      "cta-first": "First",
      "cta-second": "Second",
    },
    actions: {
      "cta-first": {
        action: "dismiss",
      },
      "cta-second": {
        action: "dismiss",
      },
    },
    ...overrides,
  };
}
