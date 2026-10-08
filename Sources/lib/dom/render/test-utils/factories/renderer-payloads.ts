import { MessageComponentPayload, MessageComponentTypeValue, MessagePayload } from "com.batch.dom/render/model/types";
import { FORM_SUBMIT_ACTION_ID } from "com.batch.dom/render/render-constants";

const FORM_FIXTURE_SUBMIT_ID = "cta";

/** `message` overrides whole fields, `texts` seeds the base labels of the component. */
export function buildFormFieldMessage(
  component: Record<string, unknown>,
  message: Partial<MessagePayload> = {},
  texts: Record<string, string> = {}
): MessagePayload {
  const children = [component, { type: MessageComponentTypeValue.Button, id: FORM_FIXTURE_SUBMIT_ID }];
  return {
    format: "modal",
    root: { children: children as unknown as MessageComponentPayload[] },
    closeOptions: {},
    texts,
    urls: {},
    actions: { [FORM_FIXTURE_SUBMIT_ID]: { action: FORM_SUBMIT_ACTION_ID } },
    ...message,
  };
}

export function makeModalPayload(overrides: Partial<MessagePayload> = {}): MessagePayload {
  return {
    format: "modal",
    root: {
      children: [
        {
          type: MessageComponentTypeValue.Button,
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

/** Payload wiring every tree component through one message: text, image, divider, spacer, field, choice, column and button. */
export function makeFullTreePayload(): MessagePayload {
  return {
    format: "modal",
    root: {
      children: [
        { type: MessageComponentTypeValue.Text, id: "title", fontSize: 22, color: ["#112233FF"] },
        { type: MessageComponentTypeValue.Image, id: "hero", height: "200px" },
        { type: MessageComponentTypeValue.Divider, color: ["#FF0000FF"], thickness: 3, width: "fill", hideOn: "mobile" },
        { type: MessageComponentTypeValue.Spacer, height: "40px" },
        {
          type: MessageComponentTypeValue.Field,
          id: "email",
          mapsTo: "$email_address",
          fieldType: "email",
          placeholderId: "email_ph",
          labelTextId: "email",
          required: true,
        },
        {
          type: MessageComponentTypeValue.Choice,
          id: "sports",
          mapsTo: "sports",
          choiceType: "checkbox",
          attributeType: "array",
          labelTextId: "sports_label",
          values: [
            { id: "tennis_label", attributeValue: "tennis" },
            { id: "golf_label", attributeValue: "golf", selected: true },
          ],
        },
        {
          type: MessageComponentTypeValue.Columns,
          ratios: [1],
          children: [{ type: MessageComponentTypeValue.Text, id: "nested", fontSize: 14, color: ["#000000FF"] }],
        },
        { type: MessageComponentTypeValue.Button, id: "submit", backgroundColor: ["#0044FFFF"], textColor: ["#FFFFFFFF"], fontSize: 16 },
      ],
    },
    closeOptions: {},
    texts: {
      title: "Welcome",
      email: "Email address",
      email_ph: "you@example.com",
      nested: "Nested copy",
      submit: "Send",
      sports_label: "Favourite sports",
      tennis_label: "Tennis",
      golf_label: "Golf",
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
          type: MessageComponentTypeValue.Button,
          id: "cta-first",
          backgroundColor: ["#0044FFFF"],
          textColor: ["#FFFFFFFF"],
          fontSize: 14,
        },
        {
          type: MessageComponentTypeValue.Button,
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
