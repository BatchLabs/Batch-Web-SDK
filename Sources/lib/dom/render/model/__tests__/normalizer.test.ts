/* eslint-env jest */

import { MessageHeightValue, MessageWidthValue } from "com.batch.dom/render/model/model";
import { normalizeMessage } from "com.batch.dom/render/model/normalizer";
import type { MessageAction } from "com.batch.dom/render/model/types";
import {
  MessageAspectRatioValue,
  MessageFormat,
  MessageFormatValue,
  MessageHorizontalAlignmentValue,
  MessagePayload,
  MessageVerticalAlignmentValue,
} from "com.batch.dom/render/model/types";
import { Log } from "com.batch.shared/logger";

afterEach(() => {
  jest.restoreAllMocks();
});

function base(): MessagePayload {
  return {
    format: MessageFormatValue.Modal,
    root: { children: [] },
    closeOptions: {},
    texts: {},
    urls: {},
    actions: {},
  };
}

describe("URL validation", () => {
  test("https and http URLs are preserved in the urls dict", () => {
    const msg = normalizeMessage({
      ...base(),
      urls: {
        img: "https://cdn.example.com/img.png",
        insecure: "http://cdn.example.com/img.png",
      },
    });
    expect(msg.urls["img"]).toBe("https://cdn.example.com/img.png");
    expect(msg.urls["insecure"]).toBe("http://cdn.example.com/img.png");
  });

  test("javascript: URLs are stripped from the urls dict", () => {
    const msg = normalizeMessage({
      ...base(),
      urls: { xss: "javascript:alert(1)" },
    });
    expect(msg.urls["xss"]).toBeUndefined();
  });

  test("data: URLs are stripped from the urls dict", () => {
    const msg = normalizeMessage({
      ...base(),
      urls: { data: "data:text/html,<script>alert(1)</script>" },
    });
    expect(msg.urls["data"]).toBeUndefined();
  });

  test("safe entries are kept verbatim and unsafe entries are dropped from the exact map", () => {
    const msg = normalizeMessage({
      ...base(),
      urls: {
        secure: "https://cdn.example.com/a.png",
        insecure: "http://cdn.example.com/b.png",
        xss: "javascript:alert(1)",
        data: "data:text/html,x",
      },
    });

    expect(msg.urls).toEqual({
      secure: "https://cdn.example.com/a.png",
      insecure: "http://cdn.example.com/b.png",
    });
    expect(Object.keys(msg.urls)).not.toContain("xss");
    expect(Object.keys(msg.urls)).not.toContain("data");
  });
});

describe("format normalization", () => {
  test("unknown format falls back to 'fullscreen'", () => {
    const msg = normalizeMessage({
      ...base(),
      format: "unknown" as unknown as MessageFormat,
    });
    expect(msg.format).toBe(MessageFormatValue.Fullscreen);
  });

  test("an invalid format warns with the offending value and the fallback", () => {
    const warnSpy = jest.spyOn(Log, "warn").mockImplementation(() => undefined);

    normalizeMessage({
      ...base(),
      format: "bogus-format" as unknown as MessageFormat,
    });

    expect(warnSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("bogus-format"));
    expect(warnSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining(MessageFormatValue.Fullscreen));
  });
});

describe("format defaults", () => {
  test("modal without an explicit position defaults to center", () => {
    const msg = normalizeMessage({
      ...base(),
      format: MessageFormatValue.Modal,
      position: undefined,
    });

    expect(msg.position).toBe(MessageVerticalAlignmentValue.Center);
  });

  test("fullscreen without an explicit position defaults to top", () => {
    const msg = normalizeMessage({
      ...base(),
      format: MessageFormatValue.Fullscreen,
      position: undefined,
    });

    expect(msg.position).toBe(MessageVerticalAlignmentValue.Top);
  });

  test("modal without a close button falls back to the modal close-button colors", () => {
    const msg = normalizeMessage({
      ...base(),
      format: MessageFormatValue.Modal,
      closeOptions: {},
    });

    expect(msg.closeOptions.button?.color).toEqual(["#000000FF", "#F3F3F3FF"]);
    expect(msg.closeOptions.button?.backgroundColor).toEqual(["#0000001A", "#FFFFFF1F"]);
  });
});

describe("missing payload sections", () => {
  test("an undefined root resolves to safe defaults without throwing", () => {
    const msg = normalizeMessage({
      ...base(),
      root: undefined as unknown as MessagePayload["root"],
    });

    expect(msg.root.children).toEqual([]);
    expect(msg.root.configuration.style.backgroundColor).toEqual(["#FFFFFFFF", "#000000FF"]);
    expect(msg.root.configuration.placement.margin).toEqual([0, 0, 0, 0]);
  });

  test("non-array root children resolve to an empty children list", () => {
    const msg = normalizeMessage({
      ...base(),
      root: { children: "not-an-array" as unknown as MessagePayload["root"]["children"] },
    });

    expect(msg.root.children).toEqual([]);
  });

  test("undefined closeOptions resolves to the modal default close button without throwing", () => {
    const msg = normalizeMessage({
      ...base(),
      closeOptions: undefined,
    });

    expect(msg.closeOptions.auto).toBeUndefined();
    expect(msg.closeOptions.button?.color).toEqual(["#000000FF", "#F3F3F3FF"]);
  });

  test("an invalid root color logs a fallback keyed by its field name", () => {
    const debugSpy = jest.spyOn(Log, "debug").mockImplementation(() => undefined);

    normalizeMessage({
      ...base(),
      root: { children: [], backgroundColor: ["definitely-not-a-color"] },
    });

    expect(debugSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("root.backgroundColor"));
  });
});

describe("passthrough dictionaries", () => {
  test("texts, actions and eventData are preserved intact", () => {
    const msg = normalizeMessage({
      ...base(),
      texts: { title: "Hello" },
      actions: { "cta.click": { action: "batch.deeplink", params: ["https://example.com"] } as unknown as MessageAction },
      eventData: { campaign: "summer", variant: "b" },
    });

    expect(msg.texts).toEqual({ title: "Hello" });
    expect(msg.actions["cta.click"]).toEqual({ action: "batch.deeplink", params: ["https://example.com"] });
    expect(msg.eventData).toEqual({ campaign: "summer", variant: "b" });
  });
});

describe("close options normalization", () => {
  test("preserves fractional auto-close delays", () => {
    const msg = normalizeMessage({
      ...base(),
      closeOptions: {
        auto: {
          delay: 0.25,
        },
      },
    });

    expect(msg.closeOptions.auto?.delay).toBeCloseTo(0.25);
  });

  test("keeps delay 0 as an explicit auto-close disable signal", () => {
    const msg = normalizeMessage({
      ...base(),
      closeOptions: {
        auto: {
          delay: 0,
        },
      },
    });

    expect(msg.closeOptions.auto).toBeUndefined();
  });

  test("normalizes close button color when provided", () => {
    const msg = normalizeMessage({
      ...base(),
      closeOptions: {
        button: {
          color: ["rgba(255,0,0,0.5)"],
        },
      },
    });

    expect(msg.closeOptions.button?.color[0]).toBe("rgba(255,0,0,0.5)");
  });

  test("normalizes auto close color when provided", () => {
    const msg = normalizeMessage({
      ...base(),
      closeOptions: {
        auto: {
          delay: 5,
          color: ["rgba(0,0,255,0.5)"],
        },
      },
    });

    expect(msg.closeOptions.auto?.color?.[0]).toBe("rgba(0,0,255,0.5)");
  });
});

describe("number normalization", () => {
  test("floors floating point font sizes", () => {
    const msg = normalizeMessage({
      ...base(),
      root: {
        children: [
          {
            type: "button",
            id: "cta",
            backgroundColor: ["#FFFFFFFF"],
            textColor: ["#000000FF"],
            fontSize: 14.9,
          },
        ],
      },
    });

    const button = msg.root.children[0];
    if (button.type !== "button") throw new Error("expected button");
    expect(button.configuration.fontStyle.fontSize).toBe(14);
  });

  test("falls back for negative border widths", () => {
    const msg = normalizeMessage({
      ...base(),
      root: {
        children: [
          {
            type: "button",
            id: "cta",
            backgroundColor: ["#FFFFFFFF"],
            textColor: ["#000000FF"],
            fontSize: 14,
            borderWidth: -1,
          },
        ],
      },
    });

    const button = msg.root.children[0];
    if (button.type !== "button") throw new Error("expected button");
    expect(button.configuration.style.borderWidth).toBe(0);
  });

  test("falls back to default for non-positive time intervals", () => {
    const msg = normalizeMessage({
      ...base(),
      closeOptions: {
        auto: {
          delay: -5,
        },
      },
    });

    expect(msg.closeOptions.auto).toBeUndefined();
  });
});

describe("component fallback normalization", () => {
  test("unknown component type is dropped from the tree", () => {
    const msg = normalizeMessage({
      ...base(),
      root: {
        children: [
          { type: "unknown" } as unknown as MessagePayload["root"]["children"][number],
          { type: "spacer", height: "24px" } as unknown as MessagePayload["root"]["children"][number],
        ],
      },
    });

    expect(msg.root.children).toHaveLength(1);
    expect(msg.root.children[0].type).toBe("spacer");
  });

  test("unknown component warns with the offending type before being ignored", () => {
    const warnSpy = jest.spyOn(Log, "warn").mockImplementation(() => undefined);

    normalizeMessage({
      ...base(),
      root: {
        children: [{ type: "carousel" } as unknown as MessagePayload["root"]["children"][number]],
      },
    });

    expect(warnSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("carousel"));
    expect(warnSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("ignoring"));
  });
});

describe("normalizer diagnostics keyed by field name", () => {
  test("an invalid button text color logs a fallback keyed by button.textColor", () => {
    const debugSpy = jest.spyOn(Log, "debug").mockImplementation(() => undefined);

    normalizeMessage({
      ...base(),
      root: {
        children: [
          { type: "button", id: "cta", textColor: ["definitely-not-a-color"] } as unknown as MessagePayload["root"]["children"][number],
        ],
      },
    });

    expect(debugSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("button.textColor"));
  });

  test("an invalid button background color logs a fallback keyed by button.backgroundColor", () => {
    const debugSpy = jest.spyOn(Log, "debug").mockImplementation(() => undefined);

    normalizeMessage({
      ...base(),
      root: {
        children: [
          {
            type: "button",
            id: "cta",
            backgroundColor: ["definitely-not-a-color"],
          } as unknown as MessagePayload["root"]["children"][number],
        ],
      },
    });

    expect(debugSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("button.backgroundColor"));
  });

  test("an invalid text color logs a fallback keyed by text.color", () => {
    const debugSpy = jest.spyOn(Log, "debug").mockImplementation(() => undefined);

    normalizeMessage({
      ...base(),
      root: {
        children: [
          { type: "text", id: "title", color: ["definitely-not-a-color"] } as unknown as MessagePayload["root"]["children"][number],
        ],
      },
    });

    expect(debugSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("text.color"));
  });
});

describe("diagnostic labels keyed by component.property", () => {
  const comp = (obj: Record<string, unknown>): MessagePayload["root"]["children"][number] =>
    obj as unknown as MessagePayload["root"]["children"][number];

  const withChild = (child: Record<string, unknown>): MessagePayload => ({ ...base(), root: { children: [comp(child)] } });

  const choiceCase = (extra: Record<string, unknown>): MessagePayload =>
    withChild({
      type: "choice",
      id: "c",
      mapsTo: "sports",
      choiceType: "checkbox",
      attributeType: "array",
      values: [
        { id: "one", attributeValue: "one" },
        { id: "two", attributeValue: "two" },
      ],
      ...extra,
    });

  const cases: { label: string; payload: MessagePayload }[] = [
    { label: `"message.position"`, payload: { ...base(), position: "diagonal" as never } },
    { label: `"root.backgroundColor"`, payload: { ...base(), root: { children: [], backgroundColor: ["nope"] as never } } },
    { label: `"root.radius[0]"`, payload: { ...base(), root: { children: [], radius: [NaN] } } },
    { label: `"root.borderWidth"`, payload: { ...base(), root: { children: [], borderWidth: -1 } } },
    { label: `"root.borderColor"`, payload: { ...base(), root: { children: [], borderColor: ["nope"] as never } } },
    { label: `"root.margin[0]"`, payload: { ...base(), root: { children: [], margin: [NaN] as never } } },
    { label: `"root.marginDesktop"`, payload: { ...base(), root: { children: [], marginDesktop: [NaN] } } },
    { label: `"button.textAlign"`, payload: withChild({ type: "button", id: "b", textAlign: "diagonal" }) },
    { label: `"button.textColor"`, payload: withChild({ type: "button", id: "b", textColor: ["nope"] }) },
    { label: `"button.maxLines"`, payload: withChild({ type: "button", id: "b", maxLines: NaN }) },
    { label: `"button.fontSize"`, payload: withChild({ type: "button", id: "b", fontSize: NaN }) },
    { label: `"button.fontSizeDesktop"`, payload: withChild({ type: "button", id: "b", fontSizeDesktop: -1 }) },
    { label: `"button.backgroundColor"`, payload: withChild({ type: "button", id: "b", backgroundColor: ["nope"] }) },
    { label: `"button.radius[0]"`, payload: withChild({ type: "button", id: "b", radius: [NaN] }) },
    { label: `"button.borderWidth"`, payload: withChild({ type: "button", id: "b", borderWidth: -1 }) },
    { label: `"button.borderColor"`, payload: withChild({ type: "button", id: "b", borderColor: ["nope"] }) },
    { label: `"button.hideOn"`, payload: withChild({ type: "button", id: "b", hideOn: "tablet" }) },
    { label: `"button.margin[0]"`, payload: withChild({ type: "button", id: "b", margin: [NaN] }) },
    { label: `"button.marginDesktop"`, payload: withChild({ type: "button", id: "b", marginDesktop: [NaN] }) },
    { label: `"button.padding[0]"`, payload: withChild({ type: "button", id: "b", padding: [NaN] }) },
    { label: `"button.paddingDesktop"`, payload: withChild({ type: "button", id: "b", paddingDesktop: [NaN] }) },
    { label: `"button.width"`, payload: withChild({ type: "button", id: "b", width: "10em" }) },
    { label: `"button.align"`, payload: withChild({ type: "button", id: "b", align: "diagonal" }) },
    { label: `"text.textAlign"`, payload: withChild({ type: "text", id: "t", textAlign: "diagonal" }) },
    { label: `"text.color"`, payload: withChild({ type: "text", id: "t", color: ["nope"] }) },
    { label: `"text.maxLines"`, payload: withChild({ type: "text", id: "t", maxLines: NaN }) },
    { label: `"text.fontSize"`, payload: withChild({ type: "text", id: "t", fontSize: NaN }) },
    { label: `"text.fontSizeDesktop"`, payload: withChild({ type: "text", id: "t", fontSizeDesktop: -1 }) },
    { label: `"text.hideOn"`, payload: withChild({ type: "text", id: "t", hideOn: "tablet" }) },
    { label: `"text.margin[0]"`, payload: withChild({ type: "text", id: "t", margin: [NaN] }) },
    { label: `"text.marginDesktop"`, payload: withChild({ type: "text", id: "t", marginDesktop: [NaN] }) },
    { label: `"image.hideOn"`, payload: withChild({ type: "image", id: "i", height: "auto", hideOn: "tablet" }) },
    { label: `"image.aspect"`, payload: withChild({ type: "image", id: "i", height: "auto", aspect: "stretch" }) },
    { label: `"image.radius[0]"`, payload: withChild({ type: "image", id: "i", height: "auto", radius: [NaN] }) },
    { label: `"image.margin[0]"`, payload: withChild({ type: "image", id: "i", height: "auto", margin: [NaN] }) },
    { label: `"image.marginDesktop"`, payload: withChild({ type: "image", id: "i", height: "auto", marginDesktop: [NaN] }) },
    { label: `"image.height"`, payload: withChild({ type: "image", id: "i", height: "10em" }) },
    { label: `"divider.hideOn"`, payload: withChild({ type: "divider", color: ["#000000FF"], width: "100%", hideOn: "tablet" }) },
    { label: `"divider.color"`, payload: withChild({ type: "divider", color: ["nope"], width: "100%" }) },
    { label: `"divider.thickness"`, payload: withChild({ type: "divider", color: ["#000000FF"], width: "100%", thickness: -1 }) },
    { label: `"divider.margin[0]"`, payload: withChild({ type: "divider", color: ["#000000FF"], width: "100%", margin: [NaN] }) },
    {
      label: `"divider.marginDesktop"`,
      payload: withChild({ type: "divider", color: ["#000000FF"], width: "100%", marginDesktop: [NaN] }),
    },
    { label: `"divider.width"`, payload: withChild({ type: "divider", color: ["#000000FF"], width: "10em" }) },
    { label: `"divider.align"`, payload: withChild({ type: "divider", color: ["#000000FF"], width: "100%", align: "diagonal" }) },
    { label: `"spacer.hideOn"`, payload: withChild({ type: "spacer", height: "0px", hideOn: "tablet" }) },
    { label: `"spacer.height"`, payload: withChild({ type: "spacer", height: "10em" }) },
    { label: `"columns.hideOn"`, payload: withChild({ type: "columns", children: [], hideOn: "tablet" }) },
    { label: `"columns.spacing"`, payload: withChild({ type: "columns", children: [], spacing: -1 }) },
    { label: `"columns.contentAlign"`, payload: withChild({ type: "columns", children: [], contentAlign: "diagonal" }) },
    { label: `"columns.margin[0]"`, payload: withChild({ type: "columns", children: [], margin: [NaN] }) },
    { label: `"columns.marginDesktop"`, payload: withChild({ type: "columns", children: [], marginDesktop: [NaN] }) },
    { label: `"columns.padding[0]"`, payload: withChild({ type: "columns", children: [], padding: [NaN] }) },
    { label: `"columns.paddingDesktop"`, payload: withChild({ type: "columns", children: [], paddingDesktop: [NaN] }) },
    { label: `"columns.backgroundColor"`, payload: withChild({ type: "columns", children: [], backgroundColor: ["nope"] }) },
    { label: `"columns.radius[0]"`, payload: withChild({ type: "columns", children: [], radius: [NaN] }) },
    { label: `field.validation:`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", validation: { regex: "(" } }) },
    { label: `"field.fieldType"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", fieldType: "date" }) },
    { label: `"field.attributeType"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", attributeType: "money" }) },
    { label: `"field.width"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", width: 200 }) },
    { label: `"field.align"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", align: "diagonal" }) },
    { label: `"field.textColor"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", textColor: ["nope"] }) },
    { label: `"field.minMax"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", minMax: [50, 25] }) },
    { label: `"field.fontSize"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", fontSize: NaN }) },
    { label: `"field.fontSizeDesktop"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", fontSizeDesktop: -1 }) },
    { label: `"field.labelFontSize"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", labelFontSize: -1 }) },
    { label: `"field.labelFontSizeDesktop"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", labelFontSizeDesktop: -1 }) },
    { label: `"field.labelColor"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", labelColor: ["nope"] }) },
    { label: `"field.backgroundColor"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", backgroundColor: ["nope"] }) },
    { label: `"field.radius[0]"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", radius: [NaN] }) },
    { label: `"field.borderWidth"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", borderWidth: -1 }) },
    { label: `"field.borderColor"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", borderColor: ["nope"] }) },
    { label: `"field.margin[0]"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", margin: [NaN] }) },
    { label: `"field.marginDesktop"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", marginDesktop: [NaN] }) },
    { label: `"field.padding[0]"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", padding: [NaN] }) },
    { label: `"field.paddingDesktop"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", paddingDesktop: [NaN] }) },
    { label: `"field.hideOn"`, payload: withChild({ type: "field", id: "f", mapsTo: "f_map", hideOn: "tablet" }) },
    { label: `"choice.layout"`, payload: choiceCase({ layout: "diagonal" }) },
    { label: `"choice.align"`, payload: choiceCase({ align: "diagonal" }) },
    { label: `"choice.spacing"`, payload: choiceCase({ spacing: NaN }) },
    { label: `"choice.attributeType"`, payload: choiceCase({ attributeType: "money" }) },
    { label: `"choice.minMax"`, payload: choiceCase({ minMax: [3, 2] }) },
    { label: `"choice.checkedColor"`, payload: choiceCase({ checkedColor: ["nope"] }) },
    { label: `"choice.borderColor"`, payload: choiceCase({ borderColor: ["nope"] }) },
    { label: `"choice.textColor"`, payload: choiceCase({ textColor: ["nope"] }) },
    { label: `"choice.fontSize"`, payload: choiceCase({ fontSize: NaN }) },
    { label: `"choice.fontSizeDesktop"`, payload: choiceCase({ fontSizeDesktop: -1 }) },
    { label: `"choice.labelFontSize"`, payload: choiceCase({ labelFontSize: -1 }) },
    { label: `"choice.labelColor"`, payload: choiceCase({ labelColor: ["nope"] }) },
    { label: `"choice.margin[0]"`, payload: choiceCase({ margin: [NaN] }) },
    { label: `"choice.marginDesktop"`, payload: choiceCase({ marginDesktop: [NaN] }) },
    { label: `"choice.validation"`, payload: choiceCase({ validation: { regex: "^a" } }) },
    { label: `"choice.hideOn"`, payload: choiceCase({ hideOn: "tablet" }) },
    { label: `"choice.values[1]"`, payload: choiceCase({ values: [{ id: "one", attributeValue: "one" }, { id: "two" }] }) },
    { label: `"choice.choiceType"`, payload: choiceCase({ choiceType: "dropdown" }) },
    { label: `"choice.labelFontSizeDesktop"`, payload: choiceCase({ labelFontSizeDesktop: -1 }) },
  ];

  test.each(cases)("logs $label", ({ label, payload }) => {
    const debugSpy = jest.spyOn(Log, "debug").mockImplementation(() => undefined);
    const warnSpy = jest.spyOn(Log, "warn").mockImplementation(() => undefined);

    normalizeMessage(payload);

    const messages = [...debugSpy.mock.calls, ...warnSpy.mock.calls].map(call => String(call[1]));
    expect(messages.some(message => message.includes(label))).toBe(true);
  });
});

describe("specific component normalization", () => {
  test("trims blank image accessibility labels to undefined", () => {
    const msg = normalizeMessage({
      ...base(),
      root: {
        children: [
          {
            type: "image",
            id: "hero",
            height: "100px",
            accessibilityLabel: "  ",
          },
        ],
      },
    });

    const image = msg.root.children[0];
    if (image.type !== "image") throw new Error("expected image");
    expect(image.configuration.accessibility.label).toBeUndefined();
  });

  test("normalizes button radius shorthand to a four-value box", () => {
    const msg = normalizeMessage({
      ...base(),
      root: {
        children: [
          {
            type: "button",
            id: "cta",
            backgroundColor: ["#FFFFFFFF"],
            textColor: ["#000000FF"],
            fontSize: 14,
            radius: [8, 4],
          },
        ],
      },
    });

    const button = msg.root.children[0];
    if (button.type !== "button") throw new Error("expected button");
    expect(button.configuration.style.radius).toEqual([8, 4, 8, 4]);
  });
});

describe("alignment normalization", () => {
  test("invalid alignments fall back to the expected defaults", () => {
    const msg = normalizeMessage({
      ...base(),
      position: "diagonal" as never,
      root: {
        children: [
          {
            type: "button",
            id: "cta",
            backgroundColor: ["#FFFFFFFF"],
            textColor: ["#000000FF"],
            fontSize: 14,
            align: "diagonal" as never,
            textAlign: "diagonal" as never,
          },
          {
            type: "divider",
            color: ["#000000FF"],
            align: "diagonal" as never,
            width: "100%",
          },
          {
            type: "columns",
            children: [],
            contentAlign: "diagonal" as never,
          },
        ],
      },
    });

    const button = msg.root.children[0];
    const divider = msg.root.children[1];
    const columns = msg.root.children[2];

    if (button.type !== "button") throw new Error("expected button");
    if (divider.type !== "divider") throw new Error("expected divider");
    if (columns.type !== "columns") throw new Error("expected columns");

    expect(msg.position).toBe(MessageVerticalAlignmentValue.Center);
    expect(button.configuration.style.align).toBe(MessageHorizontalAlignmentValue.Center);
    expect(button.configuration.placement.align).toBe(MessageHorizontalAlignmentValue.Center);
    expect(divider.configuration.placement.align).toBe(MessageHorizontalAlignmentValue.Center);
    expect(columns.configuration.style.contentAlign).toBe(MessageVerticalAlignmentValue.Center);
  });
});

describe("expandBox", () => {
  test("4-value array passes through unchanged", () => {
    const msg = normalizeMessage({
      ...base(),
      root: { children: [], margin: [1, 2, 3, 4] },
    });
    expect(msg.root.configuration.placement.margin).toEqual([1, 2, 3, 4]);
  });

  test("2-value array expands to [top/bottom, left/right] pairs", () => {
    const msg = normalizeMessage({
      ...base(),
      root: { children: [], margin: [10, 20] as unknown as [number, number, number, number] },
    });
    expect(msg.root.configuration.placement.margin).toEqual([10, 20, 10, 20]);
  });

  test("3-value CSS shorthand [top, horizontal, bottom] → [top, h, bottom, h]", () => {
    const msg = normalizeMessage({
      ...base(),
      root: { children: [], margin: [10, 20, 30] as unknown as [number, number, number, number] },
    });
    expect(msg.root.configuration.placement.margin).toEqual([10, 20, 30, 20]);
  });

  test("1-value array expands to uniform [v, v, v, v]", () => {
    const msg = normalizeMessage({
      ...base(),
      root: { children: [], margin: [8] as unknown as [number, number, number, number] },
    });
    expect(msg.root.configuration.placement.margin).toEqual([8, 8, 8, 8]);
  });

  test("empty array falls back to default", () => {
    const msg = normalizeMessage({
      ...base(),
      root: { children: [], margin: [] as unknown as [number, number, number, number] },
    });
    expect(msg.root.configuration.placement.margin).toEqual([0, 0, 0, 0]);
  });
});

describe("normalizeRatios", () => {
  test("accepts absolute percentages [50, 50]", () => {
    const msg = normalizeMessage({
      ...base(),
      root: { children: [{ type: "columns", children: [null, null], ratios: [50, 50] }] },
    });
    const cols = msg.root.children[0];
    if (cols.type !== "columns") throw new Error("expected columns");
    expect(cols.configuration.ratios).toEqual([50, 50]);
  });

  test("accepts relative ratios [1, 2] without fallback to equal distribution", () => {
    const msg = normalizeMessage({
      ...base(),
      root: { children: [{ type: "columns", children: [null, null], ratios: [1, 2] }] },
    });
    const cols = msg.root.children[0];
    if (cols.type !== "columns") throw new Error("expected columns");
    expect(cols.configuration.ratios).toEqual([1, 2]);
  });

  test("falls back to equal distribution when any ratio is zero", () => {
    const msg = normalizeMessage({
      ...base(),
      root: { children: [{ type: "columns", children: [null, null], ratios: [0, 1] }] },
    });
    const cols = msg.root.children[0];
    if (cols.type !== "columns") throw new Error("expected columns");
    expect(cols.configuration.ratios).toEqual([50, 50]);
  });

  test("falls back when ratios count mismatches children count", () => {
    const msg = normalizeMessage({
      ...base(),
      root: { children: [{ type: "columns", children: [null, null, null], ratios: [50, 50] }] },
    });
    const cols = msg.root.children[0];
    if (cols.type !== "columns") throw new Error("expected columns");
    expect(cols.configuration.ratios).toHaveLength(3);
  });
});

describe("malformed children", () => {
  test("a columns payload whose children is not an array yields no slot and keeps the message renderable", () => {
    const msg = normalizeMessage({
      ...base(),
      root: { children: [{ type: "columns", children: "x" as unknown as never[] }, { type: "divider" }] },
    });

    const cols = msg.root.children[0];
    if (cols.type !== "columns") throw new Error("expected columns");
    expect(cols.configuration.children).toEqual([]);
    expect(cols.configuration.ratios).toEqual([]);
    expect(msg.root.children).toHaveLength(2);
    expect(msg.root.children[1].type).toBe("divider");
  });
});

describe("color normalization", () => {
  test("accepts 8-digit hex #RRGGBBAA", () => {
    const msg = normalizeMessage({
      ...base(),
      root: { children: [], backgroundColor: ["#FF0000FF"] },
    });
    expect(msg.root.configuration.style.backgroundColor[0]).toBe("#FF0000FF");
  });

  test("accepts 6-digit hex #RRGGBB", () => {
    const msg = normalizeMessage({
      ...base(),
      root: { children: [], backgroundColor: ["#FF0000"] },
    });
    expect(msg.root.configuration.style.backgroundColor[0]).toBe("#FF0000");
  });

  test("rejects CSS named color 'red' (not in functional notation) and applies fallback", () => {
    const msg = normalizeMessage({
      ...base(),
      root: { children: [], backgroundColor: ["red"] },
    });
    expect(msg.root.configuration.style.backgroundColor[0]).toBe("#FFFFFFFF");
  });

  test("accepts rgba() functional notation", () => {
    const msg = normalizeMessage({
      ...base(),
      root: { children: [], backgroundColor: ["rgba(255,0,0,0.5)"] },
    });
    expect(msg.root.configuration.style.backgroundColor[0]).toBe("rgba(255,0,0,0.5)");
  });

  test("rejects non-CSS strings and applies fallback", () => {
    const msg = normalizeMessage({
      ...base(),
      root: { children: [], backgroundColor: ["javascript:alert(1)"] },
    });
    expect(msg.root.configuration.style.backgroundColor[0]).toBe("#FFFFFFFF");
  });

  test("rejects CSS keywords like 'inherit' and applies fallback", () => {
    const msg = normalizeMessage({
      ...base(),
      root: { children: [], backgroundColor: ["inherit"] },
    });
    expect(msg.root.configuration.style.backgroundColor[0]).toBe("#FFFFFFFF");
  });

  test("accepts transparent as a valid named color", () => {
    const msg = normalizeMessage({
      ...base(),
      root: { children: [], backgroundColor: ["transparent"] },
    });
    expect(msg.root.configuration.style.backgroundColor[0]).toBe("transparent");
  });

  test("rejects malformed hex and applies fallback", () => {
    const msg = normalizeMessage({
      ...base(),
      root: { children: [], backgroundColor: ["#ZZZZZZ"] },
    });
    expect(msg.root.configuration.style.backgroundColor[0]).toBe("#FFFFFFFF");
  });
});

describe("dimension normalization", () => {
  test("normalizes button widths", () => {
    const buttonPayload = {
      type: "button" as const,
      id: "cta",
      backgroundColor: ["#FFFFFFFF"] as [string],
      textColor: ["#000000FF"] as [string],
      fontSize: 14,
    };

    const fillMsg = normalizeMessage({
      ...base(),
      root: { children: [{ ...buttonPayload, width: "fill" }] },
    });
    const pxMsg = normalizeMessage({
      ...base(),
      root: { children: [{ ...buttonPayload, width: "300px" }] },
    });
    const percentMsg = normalizeMessage({
      ...base(),
      root: { children: [{ ...buttonPayload, width: "50%" }] },
    });
    const invalidMsg = normalizeMessage({
      ...base(),
      root: { children: [{ ...buttonPayload, width: "calc(100% - 12px)" }] },
    });
    const missingMsg = normalizeMessage({
      ...base(),
      root: { children: [buttonPayload] },
    });

    const fillButton = fillMsg.root.children[0];
    const pxButton = pxMsg.root.children[0];
    const percentButton = percentMsg.root.children[0];
    const invalidButton = invalidMsg.root.children[0];
    const missingButton = missingMsg.root.children[0];

    if (fillButton.type !== "button") throw new Error("expected button");
    if (pxButton.type !== "button") throw new Error("expected button");
    if (percentButton.type !== "button") throw new Error("expected button");
    if (invalidButton.type !== "button") throw new Error("expected button");
    if (missingButton.type !== "button") throw new Error("expected button");

    expect(fillButton.configuration.placement.width).toBe(MessageWidthValue.Fill);
    expect(pxButton.configuration.placement.width).toEqual({ px: 300 });
    expect(percentButton.configuration.placement.width).toEqual({ percent: 50 });
    expect(invalidButton.configuration.placement.width).toEqual({ percent: 100 });
    expect(missingButton.configuration.placement.width).toEqual({ percent: 100 });
  });

  test("normalizes divider widths", () => {
    const dividerPayload = {
      type: "divider" as const,
      color: ["#000000FF"] as [string],
    };

    const percentMsg = normalizeMessage({
      ...base(),
      root: { children: [{ ...dividerPayload, width: "100%" }] },
    });
    const pxMsg = normalizeMessage({
      ...base(),
      root: { children: [{ ...dividerPayload, width: "12px" }] },
    });
    const invalidMsg = normalizeMessage({
      ...base(),
      root: { children: [{ ...dividerPayload, width: "auto" }] },
    });

    const percentDivider = percentMsg.root.children[0];
    const pxDivider = pxMsg.root.children[0];
    const invalidDivider = invalidMsg.root.children[0];

    if (percentDivider.type !== "divider") throw new Error("expected divider");
    if (pxDivider.type !== "divider") throw new Error("expected divider");
    if (invalidDivider.type !== "divider") throw new Error("expected divider");

    expect(percentDivider.configuration.placement.width).toEqual({ percent: 100 });
    expect(pxDivider.configuration.placement.width).toEqual({ px: 12 });
    expect(invalidDivider.configuration.placement.width).toEqual({ percent: 100 });
  });

  test("normalizes image heights and aspect ratio", () => {
    const imagePayload = {
      type: "image" as const,
      id: "hero",
    };

    const autoMsg = normalizeMessage({
      ...base(),
      root: { children: [{ ...imagePayload, height: "auto" }] },
    });
    const pxMsg = normalizeMessage({
      ...base(),
      root: { children: [{ ...imagePayload, height: "200px" }] },
    });
    const fillMsg = normalizeMessage({
      ...base(),
      root: { children: [{ ...imagePayload, height: "fill", aspect: MessageAspectRatioValue.Fit }] },
    });
    const invalidMsg = normalizeMessage({
      ...base(),
      root: { children: [{ ...imagePayload, height: "100%", aspect: "stretch" as never }] },
    });

    const autoImage = autoMsg.root.children[0];
    const pxImage = pxMsg.root.children[0];
    const fillImage = fillMsg.root.children[0];
    const invalidImage = invalidMsg.root.children[0];

    if (autoImage.type !== "image") throw new Error("expected image");
    if (pxImage.type !== "image") throw new Error("expected image");
    if (fillImage.type !== "image") throw new Error("expected image");
    if (invalidImage.type !== "image") throw new Error("expected image");

    expect(autoImage.configuration.placement.height).toBe(MessageHeightValue.Auto);
    expect(autoImage.configuration.style.aspect).toBe(MessageAspectRatioValue.Fill);
    expect(pxImage.configuration.placement.height).toEqual({ px: 200 });
    expect(pxImage.configuration.style.aspect).toBe(MessageAspectRatioValue.Fill);
    expect(fillImage.configuration.placement.height).toBe(MessageHeightValue.Fill);
    expect(fillImage.configuration.style.aspect).toBe(MessageAspectRatioValue.Fit);
    expect(invalidImage.configuration.placement.height).toBe(MessageHeightValue.Auto);
    expect(invalidImage.configuration.style.aspect).toBe(MessageAspectRatioValue.Fill);
  });

  test("normalizes spacer heights", () => {
    const zeroMsg = normalizeMessage({
      ...base(),
      root: { children: [{ type: "spacer", height: "0px" }] },
    });
    const pxMsg = normalizeMessage({
      ...base(),
      root: { children: [{ type: "spacer", height: "24px" }] },
    });
    const invalidMsg = normalizeMessage({
      ...base(),
      root: { children: [{ type: "spacer", height: "stretch" }] },
    });

    const zeroSpacer = zeroMsg.root.children[0];
    const pxSpacer = pxMsg.root.children[0];
    const invalidSpacer = invalidMsg.root.children[0];

    if (zeroSpacer.type !== "spacer") throw new Error("expected spacer");
    if (pxSpacer.type !== "spacer") throw new Error("expected spacer");
    if (invalidSpacer.type !== "spacer") throw new Error("expected spacer");

    expect(zeroSpacer.configuration.placement.height).toEqual({ px: 0 });
    expect(pxSpacer.configuration.placement.height).toEqual({ px: 24 });
    expect(invalidSpacer.configuration.placement.height).toEqual({ px: 0 });
  });
});
