/* eslint-env jest */

import type { MessageModel, MessageAnyComponentModel } from "com.batch.dom/render/model/model";
import { buildComponentTree } from "com.batch.dom/render/render/builder";

function makeMessage(children: MessageAnyComponentModel[] = []): MessageModel {
  return {
    format: "modal",
    position: "center",
    root: {
      configuration: {
        style: { backgroundColor: ["#FFFFFFFF"], radius: [0, 0, 0, 0], borderWidth: 0, borderColor: ["#00000000"] },
        placement: { margin: [0, 0, 0, 0] },
      },
      children,
    },
    closeOptions: {},
    texts: { title: "Hello", cta: "Click" },
    urls: { hero: "https://example.com/img.png" },
    actions: {},
    eventData: {},
  };
}

function makeSpacer(): MessageAnyComponentModel {
  return { type: "spacer", configuration: { placement: { height: "auto" } } };
}

function makeDivider(): MessageAnyComponentModel {
  return {
    type: "divider",
    configuration: {
      style: { color: ["#000000FF"], thickness: 1 },
      placement: { margin: [0, 0, 0, 0], width: { percent: 100 }, align: "center" },
    },
  };
}

function makeLabel(): MessageAnyComponentModel {
  return {
    type: "text",
    id: "title",
    configuration: {
      contentRef: "title",
      style: { align: "left", color: ["#000000FF"], maxLines: 0 },
      fontStyle: { fontSize: 16, fontDecoration: [] },
      placement: { margin: [0, 0, 0, 0] },
    },
  };
}

function makeButton(): MessageAnyComponentModel {
  return {
    type: "button",
    id: "cta",
    configuration: {
      contentRef: "cta",
      actionRef: "cta",
      style: {
        backgroundColor: ["#FFFFFFFF"],
        radius: [0, 0, 0, 0],
        borderWidth: 0,
        borderColor: ["#00000000"],
        align: "center",
        color: ["#000000FF"],
        maxLines: 0,
      },
      fontStyle: { fontSize: 14, fontDecoration: [] },
      placement: { margin: [0, 0, 0, 0], padding: [0, 0, 0, 0], width: { percent: 100 }, align: "center" },
    },
  };
}

function makeImage(): MessageAnyComponentModel {
  return {
    type: "image",
    id: "hero",
    configuration: {
      contentRef: "hero",
      style: { aspect: "fit", radius: [0, 0, 0, 0] },
      placement: { margin: [0, 0, 0, 0], height: "auto" },
      accessibility: {},
    },
  };
}

describe("buildComponentTree", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  test("returns a div with className iam-root", () => {
    const root = buildComponentTree(makeMessage(), jest.fn());
    expect(root.tagName).toBe("DIV");
    expect(root.className).toBe("iam-root");
  });

  test("empty children produces empty root", () => {
    const root = buildComponentTree(makeMessage([]), jest.fn());
    expect(root.children).toHaveLength(0);
  });

  test("renders spacer component", () => {
    const root = buildComponentTree(makeMessage([makeSpacer()]), jest.fn());
    expect(root.querySelector(".iam-spacer")).not.toBeNull();
  });

  test("renders divider component", () => {
    const root = buildComponentTree(makeMessage([makeDivider()]), jest.fn());
    expect(root.querySelector(".iam-divider")).not.toBeNull();
  });

  test("renders label (text) component", () => {
    const root = buildComponentTree(makeMessage([makeLabel()]), jest.fn());
    expect(root.querySelector(".iam-text")).not.toBeNull();
  });

  test("renders button component", () => {
    const root = buildComponentTree(makeMessage([makeButton()]), jest.fn());
    expect(root.querySelector(".iam-button")).not.toBeNull();
  });

  test("renders image component", () => {
    const root = buildComponentTree(makeMessage([makeImage()]), jest.fn());
    expect(root.querySelector(".iam-image")).not.toBeNull();
  });

  test("renders multiple children in order", () => {
    const root = buildComponentTree(makeMessage([makeSpacer(), makeDivider()]), jest.fn());
    expect(root.children).toHaveLength(2);
    expect(root.children[0].className).toBe("iam-spacer");
    expect(root.children[1].className).toBe("iam-divider");
  });

  test("onAction is called when a button is clicked", () => {
    const onAction = jest.fn();
    const root = buildComponentTree(makeMessage([makeButton()]), onAction);
    const btn = root.querySelector(".iam-button") as HTMLButtonElement;
    btn.click();
    expect(onAction).toHaveBeenCalledWith("cta");
  });

  test("columns renders recursively", () => {
    const columns: MessageAnyComponentModel = {
      type: "columns",
      configuration: {
        style: { spacing: 0, contentAlign: "top", backgroundColor: ["#00000000"], radius: [0, 0, 0, 0] },
        placement: { margin: [0, 0, 0, 0], padding: [0, 0, 0, 0] },
        ratios: [1, 1],
        children: [makeSpacer(), makeSpacer()],
      },
    };
    const root = buildComponentTree(makeMessage([columns]), jest.fn());
    const columnsEl = root.querySelector(".iam-columns");
    expect(columnsEl).not.toBeNull();
    expect(columnsEl?.querySelectorAll(".iam-spacer")).toHaveLength(2);
  });

  test("hideOn tags the rendered element with the matching hide class", () => {
    const hiddenLabel = { ...makeLabel(), hideOn: "desktop" as const };
    const hiddenSpacer = { ...makeSpacer(), hideOn: "mobile" as const };
    const root = buildComponentTree(makeMessage([hiddenLabel, hiddenSpacer, makeDivider()]), jest.fn());

    expect(root.querySelector(".iam-text")?.classList.contains("iam-hide-desktop")).toBe(true);
    expect(root.querySelector(".iam-spacer")?.classList.contains("iam-hide-mobile")).toBe(true);
    expect(root.querySelector(".iam-divider")?.className).toBe("iam-divider");
  });
});
