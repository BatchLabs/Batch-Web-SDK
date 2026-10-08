import type { MessagePayload } from "com.batch.dom/render/model/types";
import { MessageComponentTypeValue } from "com.batch.dom/render/model/types";
import { buildFormFieldMessage } from "com.batch.dom/render/test-utils/factories/renderer-payloads";

export const CHOICE_ID = "sports_group";
export const CHOICE_MAPS_TO = "sports";

export const CHOICE_VALUES = [
  { id: "tennis_label", attributeValue: "tennis" },
  { id: "golf_label", attributeValue: "golf" },
];

export const CHOICE_TEXTS = {
  sports_label: "Favourite sports",
  tennis_label: "Tennis",
  golf_label: "Golf",
};

export function buildChoiceMessage(patch: Record<string, unknown>, message?: Partial<MessagePayload>): MessagePayload {
  return buildFormFieldMessage(
    {
      type: MessageComponentTypeValue.Choice,
      id: CHOICE_ID,
      mapsTo: CHOICE_MAPS_TO,
      choiceType: "checkbox",
      attributeType: "array",
      labelTextId: "sports_label",
      values: CHOICE_VALUES,
      ...patch,
    },
    message,
    CHOICE_TEXTS
  );
}

export const list = (el: HTMLElement): HTMLElement => el.querySelector(".iam-choice-list") as HTMLElement;
export const choiceLabel = (el: HTMLElement): HTMLElement => el.querySelector(".iam-field-label") as HTMLElement;
export const inputs = (el: HTMLElement): HTMLInputElement[] => Array.from(el.querySelectorAll<HTMLInputElement>(".iam-choice-input"));
export const optionTexts = (el: HTMLElement): (string | null)[] =>
  Array.from(el.querySelectorAll(".iam-choice-text")).map(node => node.textContent);
