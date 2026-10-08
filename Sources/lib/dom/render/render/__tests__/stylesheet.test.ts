/* eslint-env jest */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import type { MessagePayload } from "com.batch.dom/render/model/types";
import { buildComponentTree } from "com.batch.dom/render/render/builder";
import { CHOICE_BOX_BORDER_WIDTH } from "com.batch.dom/render/render/components/choice";
import { buildChoiceMessage } from "com.batch.dom/render/test-utils/factories/choice-payloads";
import { buildFieldMessage } from "com.batch.dom/render/test-utils/factories/field-payloads";

/** The Jest mapper for `*.raw.css` only intercepts `import`, so `fs` is what hands over the real stylesheet. */
const CSS = readFileSync(resolve(__dirname, "../render.raw.css"), "utf8");

/** jsdom's CSSOM parses the sheet: rules, at-rule nesting and selector lists come from the browser model, not from brace counting. */
function parseStylesheet(css: string): CSSStyleSheet {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  return style.sheet as CSSStyleSheet;
}

const SHEET = parseStylesheet(CSS);

const normalizeSpace = (text: string): string => text.replace(/\s+/g, " ").trim();

const isStyleRule = (rule: CSSRule): rule is CSSStyleRule => "selectorText" in rule;
const isMediaRule = (rule: CSSRule): rule is CSSMediaRule => "media" in rule;

const selectorsOf = (rule: CSSStyleRule): string[] => rule.selectorText.split(",").map(normalizeSpace);

function declarationsOf(rule: CSSStyleRule): string[] {
  return Array.from(rule.style, name => {
    const priority = rule.style.getPropertyPriority(name);
    return normalizeSpace(`${name}: ${rule.style.getPropertyValue(name)}${priority ? ` !${priority}` : ""}`);
  });
}

/** Every style rule of a rule list, at any at-rule depth; `@keyframes` frames carry no selector and drop out. */
function allStyleRules(rules: CSSRuleList): CSSStyleRule[] {
  return Array.from(rules).flatMap(rule => {
    if (isStyleRule(rule)) return [rule];
    return "cssRules" in rule ? allStyleRules((rule as CSSGroupingRule).cssRules) : [];
  });
}

const TOP_LEVEL_RULES = Array.from(SHEET.cssRules).filter(isStyleRule);

/** Host prefixes that differ between the two dark blocks, mapped to their theme-agnostic form. */
const HOST_PREFIXES: [string, string][] = [
  [":host(.batch-lp-surface:not([data-batch-messaging-theme]))", ":host(.batch-lp-surface)"],
  [':host(.batch-lp-surface[data-batch-messaging-theme="auto"])', ":host(.batch-lp-surface)"],
  [':host(.batch-lp-surface[data-batch-messaging-theme="dark"])', ":host(.batch-lp-surface)"],
  [":host(:not([data-batch-messaging-theme]))", ""],
  [':host([data-batch-messaging-theme="auto"])', ""],
  [':host([data-batch-messaging-theme="dark"])', ""],
];

function stripHostPrefix(selector: string): string {
  for (const [prefix, replacement] of HOST_PREFIXES) {
    if (selector === prefix) return replacement;
    if (selector.startsWith(`${prefix} `)) return normalizeSpace(`${replacement} ${selector.slice(prefix.length + 1)}`);
  }
  return selector;
}

/** Theme-agnostic view of some rules: one entry per stripped selector, so the `:not` and `auto` twins collapse onto one. */
function rulesOf(styleRules: CSSStyleRule[]): Map<string, Set<string>> {
  const rules = new Map<string, Set<string>>();
  for (const rule of styleRules) {
    for (const selector of selectorsOf(rule)) {
      const key = stripHostPrefix(selector);
      const declarations = rules.get(key) ?? new Set<string>();
      for (const declaration of declarationsOf(rule)) declarations.add(declaration);
      rules.set(key, declarations);
    }
  }
  return rules;
}

const ALL_SELECTORS = new Set(allStyleRules(SHEET.cssRules).flatMap(selectorsOf));

/** Declarations of the one top-level rule carrying `selector`; an at-rule override never answers here. */
function baseDeclarations(selector: string): string[] {
  const matches = TOP_LEVEL_RULES.filter(rule => selectorsOf(rule).includes(selector));
  if (matches.length !== 1) {
    throw new Error(`expected exactly one top-level "${selector}" rule, found ${matches.length}`);
  }
  return declarationsOf(matches[0]);
}

/** Custom property names inline-set anywhere in the tree a payload renders to. */
function customPropertiesOf(payload: MessagePayload): string[] {
  const tree = buildComponentTree(normalizeMessage(payload), () => Promise.resolve({ kind: "none" as const }));
  const names: string[] = [];
  for (const el of [tree, ...Array.from(tree.querySelectorAll<HTMLElement>("*"))]) {
    for (let i = 0; i < el.style.length; i++) {
      const name = el.style[i];
      if (name.startsWith("--")) names.push(name);
    }
  }
  return names;
}

/** Choice with every style property of the `choice.matrix.style` matrix set; the opaque border arms the focus veil. */
const CHOICE_PAYLOAD = buildChoiceMessage({
  margin: [1, 2, 3, 4],
  marginDesktop: [5, 6, 7, 8],
  spacing: 12,
  layout: "horizontal",
  align: "center",
  fontSize: 14,
  fontSizeDesktop: 20,
  labelFontSize: 12,
  labelFontSizeDesktop: 16,
  labelColor: ["#102030FF", "#405060FF"],
  textColor: ["#112233FF", "#445566FF"],
  borderColor: ["#123456FF", "#654321FF"],
  checkedColor: ["#008000FF", "#00FF00FF"],
});

/** Text field with every style property of the `input.matrix.style` matrix set. */
const FIELD_PAYLOAD = buildFieldMessage({
  fieldType: "text",
  margin: [1, 2, 3, 4],
  marginDesktop: [5, 6, 7, 8],
  padding: [9, 10, 11, 12],
  paddingDesktop: [13, 14, 15, 16],
  width: 50,
  align: "center",
  fontSize: 16,
  fontSizeDesktop: 22,
  labelFontSize: 12,
  labelFontSizeDesktop: 16,
  labelColor: ["#102030FF", "#405060FF"],
  placeholderColor: ["#999999FF", "#777777FF"],
  textColor: ["#112233FF", "#445566FF"],
  backgroundColor: ["#FFFFFFFF", "#000000FF"],
  borderColor: ["#123456FF", "#654321FF"],
  borderWidth: 2,
  radius: [4, 4, 4, 4],
});

const WRITTEN = new Set([...customPropertiesOf(CHOICE_PAYLOAD), ...customPropertiesOf(FIELD_PAYLOAD)]);

/** Prefixes of the form variables: the stylesheet may only read what a form component writes. */
const FORM_VARIABLE_PREFIXES = [
  "--iam-choice-",
  "--iam-input-",
  "--iam-placeholder-",
  "--iam-label-",
  "--iam-focus-veil",
  "--iam-margin",
  "--iam-padding",
];

const HANDOFF_SELECTORS = [
  ".iam-choice-input:focus + .iam-choice-box",
  ".iam-choice-input:checked + .iam-choice-box",
  '.iam-choice-input[type="radio"] + .iam-choice-box',
  ".iam-choice-input:disabled + .iam-choice-box",
  ".iam-choice--error .iam-choice-input + .iam-choice-box",
  ".iam-choice-input.iam-choice--error + .iam-choice-box",
  ".iam-input--focus-ring:focus",
  ".iam-input--error",
];

describe("render.raw.css", () => {
  test("the two dark blocks declare the same overrides, so KEEP IN SYNC is enforced", () => {
    const media = Array.from(SHEET.cssRules)
      .filter(isMediaRule)
      .filter(rule => rule.media.mediaText === "(prefers-color-scheme: dark)");
    expect(media).toHaveLength(1);
    // The forced-dark override is a run of top-level rules, each scoped by the dark theme attribute.
    const forced = TOP_LEVEL_RULES.filter(rule => rule.selectorText.includes('[data-batch-messaging-theme="dark"]'));
    expect(forced.length).toBeGreaterThan(0);

    expect(rulesOf(forced)).toEqual(rulesOf(allStyleRules(media[0].cssRules)));
  });

  test("every custom property the form components write is read by a rule", () => {
    const orphans = [...WRITTEN].filter(name => !new RegExp(`var\\(${name}[,)]`).test(CSS));

    expect(orphans).toEqual([]);
  });

  test("the stylesheet reads no form variable the components never write", () => {
    const read = new Set<string>();
    for (const [, name] of CSS.matchAll(/var\((--[a-z0-9-]+)/g)) {
      if (!name.endsWith("-resolved") && FORM_VARIABLE_PREFIXES.some(prefix => name.startsWith(prefix))) {
        read.add(name);
      }
    }
    expect(read.size).toBeGreaterThan(FORM_VARIABLE_PREFIXES.length);

    const unwritten = [...read].filter(name => !WRITTEN.has(name));

    expect(unwritten).toEqual([]);
  });

  test("the choice control stays focusable while invisible", () => {
    const declarations = baseDeclarations(".iam-choice-input");

    expect(declarations).toContain("opacity: 0");
    expect(declarations).toContain("pointer-events: none");
    expect(declarations).not.toContain("display: none");
    expect(declarations).not.toContain("visibility: hidden");
  });

  test("the hidden control hands its focus ring and its states to the box", () => {
    expect(HANDOFF_SELECTORS.filter(selector => !ALL_SELECTORS.has(selector))).toEqual([]);
  });

  test("the choice box border width is the one the focus veil assumes", () => {
    expect(baseDeclarations(".iam-choice-box")).toContain(`border: ${CHOICE_BOX_BORDER_WIDTH}px solid var(--iam-border-color-resolved)`);
  });
});
