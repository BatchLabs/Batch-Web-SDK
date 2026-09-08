import type { MessageAnyComponentModel, MessageModel } from "com.batch.dom/render/model/model";
import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import type { MessageAnyComponentPayload, MessagePayload } from "com.batch.dom/render/model/types";
import { buildComponentTree } from "com.batch.dom/render/render/builder";

/** A single property case in a component matrix, shared by the normalizer (JSON → model) and renderer (model → CSS) matrices. */
export interface PropCase<TModel> {
  name: string;
  /** Partial component payload merged onto the spec's base component. */
  patch?: Record<string, unknown>;
  /** Extra top-level message fields (e.g. `texts`, `actions`) for this case. */
  message?: Partial<MessagePayload>;
  expectModel?: (model: TModel) => void;
  expectCss?: (el: HTMLElement) => void;
}

/** Every case of one payload property. `cssExpression: "none"` declares a property with no CSS assertion. */
export interface PropEntry<TModel> {
  cssExpression?: "none";
  cases: PropCase<TModel>[];
}

/** One entry per payload property; omitting one is a compile error. `type` and `id` are excluded. */
export type PropMatrix<TPayload, TModel> = {
  [K in keyof Required<Omit<TPayload, "type" | "id">>]: PropEntry<TModel>;
};

/** Everything a component needs to drive its normalizer and renderer matrices from one table. */
export interface ComponentMatrixSpec<TPayload, TModel> {
  /** Component label used in describe blocks. */
  label: string;
  buildPayload: (patch: Record<string, unknown>, message?: Partial<MessagePayload>) => MessagePayload;
  /** Narrows the normalized message down to the piece under test. */
  select: (message: MessageModel) => TModel;
  /** Renders the model piece to a detached element. Omit it for tree children, which go through `buildComponentTree`. */
  render?: (model: TModel, message: MessageModel) => HTMLElement;
  props: PropMatrix<TPayload, TModel>;
}

/** Builds a modal payload whose only root child is the given component. */
export function componentMessage(component: Record<string, unknown>, extra: Partial<MessagePayload> = {}): MessagePayload {
  return {
    format: "modal",
    root: { children: [component as unknown as MessageAnyComponentPayload] },
    closeOptions: {},
    texts: {},
    urls: {},
    actions: {},
    ...extra,
  };
}

/** Narrows the first root child to a component of the expected `type`. */
export function selectFirstChild<TModel extends MessageAnyComponentModel>(message: MessageModel, type: TModel["type"]): TModel {
  const child = message.root.children[0];
  if (!child || child.type !== type) {
    throw new Error(`expected first root child of type "${type}", got "${child ? child.type : "none"}"`);
  }
  return child as TModel;
}

/** Runs the JSON → model half of a case and returns the selected model piece. */
export function normalizeCase<TPayload, TModel>(spec: ComponentMatrixSpec<TPayload, TModel>, testCase: PropCase<TModel>): TModel {
  const payload = spec.buildPayload(testCase.patch ?? {}, testCase.message);
  return spec.select(normalizeMessage(payload));
}

/** Runs the JSON → model → CSS chain of a case and returns the rendered element. */
export function renderCase<TPayload, TModel>(spec: ComponentMatrixSpec<TPayload, TModel>, testCase: PropCase<TModel>): HTMLElement {
  const payload = spec.buildPayload(testCase.patch ?? {}, testCase.message);
  const message = normalizeMessage(payload);
  if (spec.render) {
    return spec.render(spec.select(message), message);
  }
  return renderFirstTreeChild(message);
}

function renderFirstTreeChild(message: MessageModel): HTMLElement {
  const tree = buildComponentTree(message, () => Promise.resolve({ kind: "none" as const }));
  const child = tree.firstElementChild;
  if (child) {
    return child as HTMLElement;
  }
  const dropped = document.createElement("div");
  dropped.dataset.dropped = "true";
  return dropped;
}

/** Asserts the light/dark custom property pair that `applyThemePair` emits; `dark` defaults to `light`. */
export function expectThemePair(el: HTMLElement, name: string, expected: { light: string; dark?: string }): void {
  expect(el.style.getPropertyValue(`--${name}`)).toBe(expected.light);
  expect(el.style.getPropertyValue(`--${name}-dark`)).toBe(expected.dark ?? expected.light);
}

/** Asserts the base/desktop custom property pair that `setResponsivePair` emits; `desktop` defaults to `base`. */
export function expectResponsivePair(el: HTMLElement, name: string, expected: { base: string; desktop?: string }): void {
  expect(el.style.getPropertyValue(`--${name}`)).toBe(expected.base);
  expect(el.style.getPropertyValue(`--${name}-desktop`)).toBe(expected.desktop ?? expected.base);
}

const UNCOMPARABLE_ATTRIBUTES = new Set(["class", "style", "id"]);

/** Returns every reflected attribute of an element as a plain object, so a case can pin the complete set with `toEqual`. */
export function attributesOf(el: Element): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const attribute of Array.from(el.attributes)) {
    if (!UNCOMPARABLE_ATTRIBUTES.has(attribute.name)) {
      attributes[attribute.name] = attribute.value;
    }
  }
  return attributes;
}

function allCases<TModel>(props: Record<string, PropEntry<TModel>>): (PropCase<TModel> & { prop: string })[] {
  return Object.entries(props).flatMap(([prop, entry]) => entry.cases.map(c => ({ ...c, prop })));
}

/** Returns why one property lacks end-to-end coverage, or `null` when it has it. */
export function propCoverageGap<TModel>(entry: PropEntry<TModel>): string | null {
  if (entry.cases.length === 0) {
    return "no case at all";
  }
  if (!entry.cases.some(c => c.expectModel)) {
    return "no case asserts the normalized model";
  }
  if (entry.cssExpression !== "none" && !entry.cases.some(c => c.expectCss)) {
    return 'no case asserts the CSS, and the property does not declare cssExpression: "none"';
  }
  return null;
}

/** Declares the completeness, normalizer and renderer describe blocks of a component matrix. */
export function runComponentMatrix<TPayload, TModel>(spec: ComponentMatrixSpec<TPayload, TModel>): void {
  const entries = Object.entries(spec.props as Record<string, PropEntry<TModel>>);
  const cases = allCases(spec.props as Record<string, PropEntry<TModel>>);

  describe(`${spec.label} · matrix completeness`, () => {
    test.each(entries.map(([prop, entry]) => ({ prop, entry })))("$prop is covered end to end", ({ entry }) => {
      expect(propCoverageGap(entry)).toBeNull();
    });
  });

  const modelCases = cases.filter(c => c.expectModel);
  if (modelCases.length > 0) {
    describe(`${spec.label} · normalizer (JSON → model)`, () => {
      test.each(modelCases)("$prop: $name", c => c.expectModel!(normalizeCase(spec, c)));
    });
  }

  const cssCases = cases.filter(c => c.expectCss);
  if (cssCases.length > 0) {
    describe(`${spec.label} · renderer (model → CSS)`, () => {
      test.each(cssCases)("$prop: $name", c => c.expectCss!(renderCase(spec, c)));
    });
  }
}
