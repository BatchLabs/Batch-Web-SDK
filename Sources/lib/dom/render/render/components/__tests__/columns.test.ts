/* eslint-env jest */

import type { MessageColumnsModel, MessageAnyComponentModel } from "com.batch.dom/render/model/model";
import { renderColumns } from "com.batch.dom/render/render/components/columns";

function makeColumns(overrides?: {
  spacing?: number;
  contentAlign?: "top" | "center" | "bottom";
  ratios?: number[];
  children?: (MessageAnyComponentModel | null)[];
  margin?: [number, number, number, number];
}): MessageColumnsModel {
  const children = overrides?.children ?? [makeSpacer(), makeSpacer()];
  return {
    type: "columns",
    configuration: {
      style: {
        spacing: overrides?.spacing ?? 0,
        contentAlign: overrides?.contentAlign ?? "top",
        backgroundColor: ["#00000000"],
        radius: [0, 0, 0, 0],
      },
      placement: {
        margin: overrides?.margin ?? [0, 0, 0, 0],
        padding: [0, 0, 0, 0],
      },
      ratios: overrides?.ratios ?? Array(children.length).fill(1),
      children,
    },
  };
}

function makeSpacer(): MessageAnyComponentModel {
  return { type: "spacer", configuration: { placement: { height: "auto" } } };
}

describe("renderColumns", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  test("has className iam-columns", () => {
    const el = renderColumns(makeColumns(), jest.fn().mockReturnValue(null));
    expect(el.className).toBe("iam-columns");
  });

  test("creates a flex row container", () => {
    const el = renderColumns(makeColumns(), jest.fn().mockReturnValue(null));
    expect(el.style.display).toBe("flex");
    expect(el.style.flexDirection).toBe("row");
  });

  test("applies gap when spacing is greater than zero", () => {
    const el = renderColumns(makeColumns({ spacing: 12 }), jest.fn().mockReturnValue(null));
    expect(el.style.gap).toBe("12px");
  });

  test("does not set gap when spacing is zero", () => {
    const el = renderColumns(makeColumns({ spacing: 0 }), jest.fn().mockReturnValue(null));
    expect(el.style.gap).toBe("");
  });

  test("alignItems top maps to flex-start", () => {
    const el = renderColumns(makeColumns({ contentAlign: "top" }), jest.fn().mockReturnValue(null));
    expect(el.style.alignItems).toBe("flex-start");
  });

  test("alignItems center maps to center", () => {
    const el = renderColumns(makeColumns({ contentAlign: "center" }), jest.fn().mockReturnValue(null));
    expect(el.style.alignItems).toBe("center");
  });

  test("alignItems bottom maps to flex-end", () => {
    const el = renderColumns(makeColumns({ contentAlign: "bottom" }), jest.fn().mockReturnValue(null));
    expect(el.style.alignItems).toBe("flex-end");
  });

  test("each column div has minWidth 0", () => {
    const children = [makeSpacer(), makeSpacer()];
    const el = renderColumns(makeColumns({ children }), jest.fn().mockReturnValue(null));
    for (const col of Array.from(el.children) as HTMLElement[]) {
      expect(["0", "0px"]).toContain(col.style.minWidth);
    }
  });

  test("each column div is a flex column so full-width children can stretch", () => {
    const children = [makeSpacer(), makeSpacer()];
    const el = renderColumns(makeColumns({ children }), jest.fn().mockReturnValue(null));
    for (const col of Array.from(el.children) as HTMLElement[]) {
      expect(col.style.display).toBe("flex");
      expect(col.style.flexDirection).toBe("column");
    }
  });

  test("flex weight is distributed by ratio — 3:1 gives 0.75 and 0.25", () => {
    const children = [makeSpacer(), makeSpacer()];
    const el = renderColumns(makeColumns({ children, ratios: [3, 1] }), jest.fn().mockReturnValue(null));
    const col1 = el.children[0] as HTMLElement;
    const col2 = el.children[1] as HTMLElement;
    expect(col1.style.flex).toMatch(/^0\.75/);
    expect(col2.style.flex).toMatch(/^0\.25/);
  });

  test("equal weight fallback when all ratios are zero", () => {
    const children = [makeSpacer(), makeSpacer()];
    const el = renderColumns(makeColumns({ children, ratios: [0, 0] }), jest.fn().mockReturnValue(null));
    const col1 = el.children[0] as HTMLElement;
    const col2 = el.children[1] as HTMLElement;
    expect(col1.style.flex).toMatch(/^0\.5/);
    expect(col2.style.flex).toMatch(/^0\.5/);
  });

  test("renderChild is called for each non-null child", () => {
    const children = [makeSpacer(), makeSpacer()];
    const renderChild = jest.fn().mockReturnValue(document.createElement("div"));
    renderColumns(makeColumns({ children }), renderChild);
    expect(renderChild).toHaveBeenCalledTimes(2);
    expect(renderChild).toHaveBeenCalledWith(children[0]);
    expect(renderChild).toHaveBeenCalledWith(children[1]);
  });

  test("renderChild is not called for null children", () => {
    const children: (MessageAnyComponentModel | null)[] = [makeSpacer(), null, makeSpacer()];
    const renderChild = jest.fn().mockReturnValue(document.createElement("div"));
    const el = renderColumns(makeColumns({ children, ratios: [1, 1, 1] }), renderChild);
    expect(renderChild).toHaveBeenCalledTimes(2);
    expect(el.children).toHaveLength(3);
  });

  test("appends child element returned by renderChild inside column div", () => {
    const childEl = document.createElement("span");
    childEl.className = "rendered-child";
    const renderChild = jest.fn().mockReturnValue(childEl);
    const el = renderColumns(makeColumns({ children: [makeSpacer()] }), renderChild);
    expect(el.children[0].querySelector(".rendered-child")).not.toBeNull();
  });

  test("drives margin through the responsive CSS var pair", () => {
    const el = renderColumns(makeColumns({ margin: [8, 0, 8, 0] }), jest.fn().mockReturnValue(null));
    expect(el.style.margin).toBe("");
    expect(el.style.getPropertyValue("--iam-margin")).toBe("8px 0px 8px 0px");
    expect(el.style.getPropertyValue("--iam-margin-desktop")).toBe("8px 0px 8px 0px");
  });
});
