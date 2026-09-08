/* eslint-env jest */

import { MessageDividerModel } from "com.batch.dom/render/model/model";
import { renderDivider } from "com.batch.dom/render/render/components/divider";

describe("renderDivider", () => {
  test("resolves typed width values before applying styles", () => {
    const percentDivider: MessageDividerModel = {
      type: "divider",
      configuration: {
        style: {
          color: ["#000000FF"],
          thickness: 2,
        },
        placement: {
          margin: [0, 0, 0, 0],
          width: { percent: 50 },
          align: "center",
        },
      },
    };

    const pixelDivider: MessageDividerModel = {
      type: "divider",
      configuration: {
        style: {
          color: ["#000000FF"],
          thickness: 2,
        },
        placement: {
          margin: [0, 0, 0, 0],
          width: { px: 12 },
          align: "center",
        },
      },
    };

    expect(renderDivider(percentDivider).style.width).toBe("50%");
    expect(renderDivider(pixelDivider).style.width).toBe("12px");
  });

  test("writes theme source custom properties on the divider element", () => {
    const divider = renderDivider({
      type: "divider",
      configuration: {
        style: {
          color: ["#000000FF"],
          thickness: 1,
        },
        placement: {
          margin: [0, 0, 0, 0],
          width: { percent: 100 },
          align: "center",
        },
      },
    });

    expect(divider.style.getPropertyValue("--iam-border-color")).toBe("rgba(0,0,0,1.000)");
    expect(divider.style.getPropertyValue("--iam-border-color-dark")).toBe("rgba(0,0,0,1.000)");
  });

  test("applies thickness to borderTopWidth", () => {
    const divider = renderDivider({
      type: "divider",
      configuration: {
        style: { color: ["#000000FF"], thickness: 3 },
        placement: { margin: [0, 0, 0, 0], width: { percent: 100 }, align: "center" },
      },
    });

    expect(divider.style.borderTopWidth).toBe("3px");
  });

  test("keeps zero thickness explicit on borderTopWidth", () => {
    const divider = renderDivider({
      type: "divider",
      configuration: {
        style: { color: ["#000000FF"], thickness: 0 },
        placement: { margin: [0, 0, 0, 0], width: { percent: 100 }, align: "center" },
      },
    });

    expect(divider.style.borderTopWidth).toBe("0px");
  });

  test("resets non-top borders to zero", () => {
    const divider = renderDivider({
      type: "divider",
      configuration: {
        style: { color: ["#000000FF"], thickness: 1 },
        placement: { margin: [0, 0, 0, 0], width: { percent: 100 }, align: "center" },
      },
    });

    expect(divider.style.borderRightWidth).toBe("0px");
    expect(divider.style.borderBottomWidth).toBe("0px");
    expect(divider.style.borderLeftWidth).toBe("0px");
  });

  test("always uses a solid border style", () => {
    const divider = renderDivider({
      type: "divider",
      configuration: {
        style: { color: ["#000000FF"], thickness: 1 },
        placement: { margin: [0, 0, 0, 0], width: { percent: 100 }, align: "center" },
      },
    });

    expect(divider.style.borderStyle).toBe("solid");
  });

  test("maps alignment to align-self so lateral margins stay untouched", () => {
    const make = (align: "left" | "center" | "right"): MessageDividerModel => ({
      type: "divider",
      configuration: {
        style: { color: ["#000000FF"], thickness: 1 },
        placement: { margin: [0, 0, 0, 0], width: { percent: 50 }, align },
      },
    });

    expect(renderDivider(make("left")).style.alignSelf).toBe("flex-start");
    expect(renderDivider(make("center")).style.alignSelf).toBe("center");
    expect(renderDivider(make("right")).style.alignSelf).toBe("flex-end");
    expect(renderDivider(make("center")).style.marginLeft).toBe("");
    expect(renderDivider(make("center")).style.marginRight).toBe("");
  });

  test("drives the full margin box through the responsive CSS var pair", () => {
    const divider = renderDivider({
      type: "divider",
      configuration: {
        style: { color: ["#000000FF"], thickness: 1 },
        placement: { margin: [8, 4, 8, 4], marginDesktop: [16, 8, 16, 8], width: { percent: 100 }, align: "center" },
      },
    });

    expect(divider.style.margin).toBe("");
    expect(divider.style.getPropertyValue("--iam-margin")).toBe("8px 4px 8px 4px");
    expect(divider.style.getPropertyValue("--iam-margin-desktop")).toBe("16px 8px 16px 8px");
  });
});
