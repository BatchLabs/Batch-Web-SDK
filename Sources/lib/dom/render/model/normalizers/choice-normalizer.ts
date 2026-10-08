import { RENDER_LOG_MODULE, RENDER_MAPS_TO_TOPIC_PREFERENCES } from "com.batch.dom/render/render-constants";
import { Consts } from "com.batch.shared/constants/user";
import { Log } from "com.batch.shared/logger";
import { validateAndNormalizeTopic } from "com.batch.shared/profile/profile-data-helper";
import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

import { ATTRIBUTE_KINDS, type MessageProfileAttributeType, PROFILE_ATTRIBUTE_TYPES } from "../attribute-kinds";
import { MessageChoiceModel, MessageChoiceValueModel } from "../model";
import {
  dropComponent,
  normalizeBoundsPair,
  normalizeColor,
  normalizeEnum,
  normalizeFieldLabel,
  normalizeHorizontalAlignment,
  normalizeMarginPlacement,
  normalizeNumber,
  normalizeOptionalEnum,
  normalizeOptionalPositiveNumber,
} from "../normalize-helpers";
import {
  DEFAULT_BOX_FALLBACK,
  DEFAULT_CHOICE_ALIGN,
  DEFAULT_CHOICE_CHECKED_COLOR,
  DEFAULT_CHOICE_LAYOUT,
  DEFAULT_CHOICE_SPACING,
  DEFAULT_FALLBACK_COLOR,
  DEFAULT_FIELD_FONT_SIZE,
  DEFAULT_INPUT_BORDER_COLOR,
} from "../normalizer-defaults";
import {
  MessageAttributeType,
  MessageAttributeTypeValue,
  MessageChoiceLayoutValue,
  MessageChoicePayload,
  MessageChoiceType,
  MessageChoiceTypeValue,
  MessageChoiceValuePayload,
  MessageComponentTypeValue,
} from "../types";

interface ChoiceOption {
  id: string;
  attributeValue: string;
  selected: boolean;
  /** Diagnostic label carrying the payload index, which the kept list no longer reflects. */
  field: string;
}

/** How a control writes one attribute type: the option count it holds (`reason` drops it otherwise), and whether option values parse. */
interface ChoicePolicy {
  min: number;
  max: number;
  reason: string;
  /** `false` for a boolean checkbox: it submits its checked state, its option value carries nothing to parse. */
  parsesValues: boolean;
}

const RADIO_POLICY: ChoicePolicy = { min: 2, max: Infinity, reason: "a radio needs at least 2 values", parsesValues: true };

/** The attribute types each control can write; an absent type is incompatible with the control. */
const CHOICE_POLICIES: Readonly<Record<MessageChoiceType, Partial<Record<MessageProfileAttributeType, ChoicePolicy>>>> = {
  [MessageChoiceTypeValue.Radio]: {
    [ProfileAttributeType.STRING]: RADIO_POLICY,
    [ProfileAttributeType.BOOLEAN]: RADIO_POLICY,
    [ProfileAttributeType.INTEGER]: RADIO_POLICY,
    [ProfileAttributeType.FLOAT]: RADIO_POLICY,
    [ProfileAttributeType.DATE]: RADIO_POLICY,
    [ProfileAttributeType.URL]: RADIO_POLICY,
  },
  [MessageChoiceTypeValue.Checkbox]: {
    [ProfileAttributeType.BOOLEAN]: { min: 1, max: 1, reason: "a boolean checkbox holds exactly 1 value", parsesValues: false },
    [ProfileAttributeType.ARRAY]: { min: 1, max: Infinity, reason: "an array checkbox needs at least 1 value", parsesValues: true },
  },
};

/** Options carrying both identities, trimmed, in payload order. The kind check comes after: it needs the resolved type. */
function readOptions(values: (MessageChoiceValuePayload | null)[] | undefined): ChoiceOption[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const options: ChoiceOption[] = [];
  values.forEach((value, index) => {
    const field = `choice.values[${index}]`;
    const id = typeof value?.id === "string" ? value.id.trim() : "";
    const attributeValue = typeof value?.attributeValue === "string" ? value.attributeValue.trim() : "";
    if (id.length === 0 || attributeValue.length === 0) {
      Log.debug(RENDER_LOG_MODULE, `[normalizer] ignored "${field}": an option needs an "id" and an "attributeValue"`);
      return;
    }
    options.push({ id, attributeValue, selected: value?.selected === true, field });
  });
  return options;
}

function defaultAttributeType(choiceType: MessageChoiceType, offered: number): MessageAttributeType {
  if (choiceType === MessageChoiceTypeValue.Radio) {
    return MessageAttributeTypeValue.String;
  }
  return offered > 1 ? MessageAttributeTypeValue.Array : MessageAttributeTypeValue.Boolean;
}

/**
 * Options `accept` takes (all when absent), each holding the value `accept` returns, keeping the first of each id and
 * each value. Only an array is capped, at what one partial update branch carries: a radio submits one value. `word`
 * names the type in diagnostics.
 */
function keepOptions(
  options: ChoiceOption[],
  attributeType: MessageProfileAttributeType,
  accept: ((text: string) => string | null) | undefined,
  word: MessageAttributeType
): ChoiceOption[] {
  const kept: ChoiceOption[] = [];
  const seenIds = new Set<string>();
  const seenValues = new Set<string>();
  for (const option of options) {
    const accepted = accept !== undefined ? accept(option.attributeValue) : option.attributeValue;
    if (accepted === null) {
      Log.debug(RENDER_LOG_MODULE, `[normalizer] ignored "${option.field}": "${option.attributeValue}" is not a valid ${word}`);
      continue;
    }
    option.attributeValue = accepted;
    if (seenIds.has(option.id) || seenValues.has(option.attributeValue)) {
      Log.debug(RENDER_LOG_MODULE, `[normalizer] ignored "${option.field}": duplicate option "${option.id}"`);
      continue;
    }
    if (attributeType === ProfileAttributeType.ARRAY && kept.length >= Consts.MaxEventArrayItems) {
      Log.debug(
        RENDER_LOG_MODULE,
        `[normalizer] ignored "${option.field}": a checkbox group holds at most ${Consts.MaxEventArrayItems} options`
      );
      continue;
    }
    seenIds.add(option.id);
    seenValues.add(option.attributeValue);
    kept.push(option);
  }
  return kept;
}

function limitRadioSelection(options: ChoiceOption[]): void {
  let selectionSeen = false;
  for (const option of options) {
    if (!option.selected) {
      continue;
    }
    if (selectionSeen) {
      Log.debug(RENDER_LOG_MODULE, `[normalizer] ignored "${option.field}.selected": a radio pre-selects one option`);
      option.selected = false;
      continue;
    }
    selectionSeen = true;
  }
}

/** The value an option holds once accepted, or `null` when it must be dropped. A topic is the one value rewritten. */
function optionAcceptor(attributeType: MessageProfileAttributeType, topics: boolean): (text: string) => string | null {
  if (topics) {
    return text => {
      try {
        return validateAndNormalizeTopic(text);
      } catch {
        return null;
      }
    };
  }
  // An array member is one string.
  const kind = ATTRIBUTE_KINDS[attributeType === ProfileAttributeType.ARRAY ? ProfileAttributeType.STRING : attributeType];
  return text => (kind.parse(text) !== null ? text : null);
}

export function normalizeChoice(component: MessageChoicePayload): MessageChoiceModel | null {
  // No `mapsTo` is legitimate: the choice then gates the submit locally without writing to the profile.
  const mapsTo = typeof component.mapsTo === "string" ? component.mapsTo.trim() : "";
  const topics = mapsTo === RENDER_MAPS_TO_TOPIC_PREFERENCES;
  if (mapsTo.charAt(0) === "$" && !topics) {
    return dropComponent(
      MessageComponentTypeValue.Choice,
      component.id,
      `"${RENDER_MAPS_TO_TOPIC_PREFERENCES}" is the only native target of a choice`
    );
  }

  // No default control: it would pick an attribute type on the marketer's behalf.
  const choiceType = normalizeOptionalEnum(component.choiceType, MessageChoiceTypeValue, "choiceType", "choice.choiceType");
  if (choiceType === undefined) {
    return dropComponent(MessageComponentTypeValue.Choice, component.id, 'missing or unknown "choiceType"');
  }

  const declared = normalizeOptionalEnum(component.attributeType, MessageAttributeTypeValue, "attributeType", "choice.attributeType");
  const offered = readOptions(component.values);
  const word = declared ?? defaultAttributeType(choiceType, offered.length);
  const attributeType = PROFILE_ATTRIBUTE_TYPES[word];
  const policy = CHOICE_POLICIES[choiceType][attributeType];
  if (policy === undefined) {
    return dropComponent(MessageComponentTypeValue.Choice, component.id, `a ${choiceType} cannot write a ${word}`);
  }
  if (topics && attributeType !== ProfileAttributeType.ARRAY) {
    return dropComponent(MessageComponentTypeValue.Choice, component.id, "topic preferences hold an array");
  }

  const kept = keepOptions(offered, attributeType, policy.parsesValues ? optionAcceptor(attributeType, topics) : undefined, word);
  if (choiceType === MessageChoiceTypeValue.Radio) {
    limitRadioSelection(kept);
  }
  if (kept.length < policy.min || kept.length > policy.max) {
    return dropComponent(MessageComponentTypeValue.Choice, component.id, policy.reason);
  }
  const values: MessageChoiceValueModel[] = kept.map(({ id, attributeValue, selected }) => ({ id, attributeValue, selected }));

  let minSelected: number | undefined;
  let maxSelected: number | undefined;
  if (attributeType === ProfileAttributeType.ARRAY) {
    const bounds = normalizeBoundsPair(component.minMax, "choice.minMax");
    // Both bounds stop at the options offered: a minimum no selection can reach would lock the submit.
    minSelected = bounds.min !== undefined ? Math.min(bounds.min, values.length) : undefined;
    maxSelected = bounds.max !== undefined ? Math.min(bounds.max, values.length) : undefined;
  } else if (component.minMax !== undefined) {
    Log.debug(RENDER_LOG_MODULE, `[normalizer] ignored "choice.minMax": not applicable to a ${word} choice`);
  }

  if (component.validation !== undefined) {
    Log.debug(RENDER_LOG_MODULE, `[normalizer] ignored "choice.validation": not supported on choices`);
  }
  // A hidden form component would still submit its value, so `hideOn` cannot apply here.
  if (component.hideOn !== undefined) {
    Log.debug(RENDER_LOG_MODULE, `[normalizer] ignored "choice.hideOn": not supported on choices`);
  }

  return {
    type: MessageComponentTypeValue.Choice,
    id: component.id,
    mapsTo: mapsTo.length > 0 ? mapsTo : undefined,
    required: component.required === true,
    configuration: {
      choiceType,
      attributeType,
      values,
      minSelected,
      maxSelected,
      ...normalizeFieldLabel(component, MessageComponentTypeValue.Choice, component.textColor),
      layout: normalizeEnum(component.layout, MessageChoiceLayoutValue, DEFAULT_CHOICE_LAYOUT, "layout", "choice.layout"),
      align: normalizeHorizontalAlignment(component.align, DEFAULT_CHOICE_ALIGN, "choice.align"),
      spacing: normalizeNumber(component.spacing, DEFAULT_CHOICE_SPACING, false, "choice.spacing"),
      checkedColor: normalizeColor(component.checkedColor, DEFAULT_CHOICE_CHECKED_COLOR, "choice.checkedColor"),
      borderColor: normalizeColor(component.borderColor, DEFAULT_INPUT_BORDER_COLOR, "choice.borderColor"),
      textColor: normalizeColor(component.textColor, DEFAULT_FALLBACK_COLOR, "choice.textColor"),
      fontStyle: {
        fontSize: normalizeNumber(component.fontSize, DEFAULT_FIELD_FONT_SIZE, false, "choice.fontSize"),
        fontSizeDesktop: normalizeOptionalPositiveNumber(component.fontSizeDesktop, "choice.fontSizeDesktop"),
        fontDecoration: [],
      },
      placement: normalizeMarginPlacement(
        component.margin,
        DEFAULT_BOX_FALLBACK,
        "choice.margin",
        component.marginDesktop,
        "choice.marginDesktop"
      ),
    },
  };
}
