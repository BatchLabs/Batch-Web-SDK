/* eslint-env jest */

import type { ActionOutcome } from "com.batch.dom/render/contracts";
import type { MessageAnyComponentModel, MessageButtonModel, MessageInputModel, MessageModel } from "com.batch.dom/render/model/model";
import { buildComponentTree } from "com.batch.dom/render/render/builder";
import { Log } from "com.batch.shared/logger";

const SUBMIT_REF = "submit";

function makeMessage(children: MessageAnyComponentModel[], actions: MessageModel["actions"] = {}): MessageModel {
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
    texts: { submit: "Send", later: "Later" },
    urls: {},
    actions: { [SUBMIT_REF]: { action: "batch.form.submit" }, ...actions },
    eventData: {},
  };
}

function makeInput(id: string, required = false, mapsTo = `${id}_map`): MessageInputModel {
  return {
    type: "field",
    id,
    mapsTo,
    required,
    configuration: {
      inputType: "text",
      labelVisible: true,
      labelFontSize: 14,
      labelColor: ["#000000FF"],
      width: 100,
      align: "center",
      style: {
        backgroundColor: ["#FFFFFFFF"],
        radius: [0, 0, 0, 0],
        borderWidth: 1,
        borderColor: ["#C7C7CCFF"],
        align: "left",
        color: ["#000000FF"],
        maxLines: 0,
      },
      fontStyle: { fontSize: 16, fontDecoration: [] },
      placement: { margin: [0, 0, 0, 0], padding: [8, 8, 8, 8] },
    },
  };
}

function makeButton(id: string): MessageButtonModel {
  return {
    type: "button",
    id,
    configuration: {
      contentRef: id,
      actionRef: id,
      style: {
        backgroundColor: ["#007AFFFF"],
        radius: [0, 0, 0, 0],
        borderWidth: 0,
        borderColor: ["#00000000"],
        align: "center",
        color: ["#FFFFFFFF"],
        maxLines: 0,
      },
      fontStyle: { fontSize: 16, fontDecoration: [] },
      placement: { margin: [0, 0, 0, 0], padding: [12, 12, 12, 12], width: { percent: 100 }, align: "center" },
    },
  };
}

function makeColumn(children: (MessageAnyComponentModel | null)[]): MessageAnyComponentModel {
  return {
    type: "columns",
    configuration: {
      style: { spacing: 0, contentAlign: "top", backgroundColor: ["#00000000"], radius: [0, 0, 0, 0] },
      placement: { margin: [0, 0, 0, 0], padding: [0, 0, 0, 0] },
      ratios: Array(children.length).fill(1),
      children,
    },
  };
}

const SUCCESS_OUTCOME: ActionOutcome = { kind: "form-feedback", status: "success" };

function makeAction(outcome: ActionOutcome | Error = SUCCESS_OUTCOME): jest.Mock {
  return jest.fn(() => (outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome)));
}

function hasKey(value: unknown, key: string): boolean {
  return typeof value === "object" && value !== null && key in value;
}

function submitCalls(onAction: jest.Mock): unknown[][] {
  return onAction.mock.calls.filter(call => hasKey(call[1], "formFields"));
}

function clickCalls(onAction: jest.Mock): unknown[][] {
  return onAction.mock.calls.filter(call => hasKey(call[1], "formClick"));
}

const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

function deferredAction(): { onAction: jest.Mock; settle: (index: number, outcome?: ActionOutcome) => void } {
  const pending: Array<(outcome: ActionOutcome) => void> = [];
  const onAction = jest.fn((_id: string, context?: unknown) => {
    if (!hasKey(context, "formFields")) {
      return Promise.resolve<ActionOutcome>({ kind: "none" });
    }
    return new Promise<ActionOutcome>(resolve => pending.push(resolve));
  });
  return {
    onAction,
    settle: (index: number, outcome: ActionOutcome = { kind: "form-feedback", status: "error", message: "Network error." }): void =>
      pending[index](outcome),
  };
}

describe("form assembly via buildComponentTree (no form container)", () => {
  test("renders the fields and the feedback node without a <form> wrapper", () => {
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), makeAction());
    expect(root.querySelector("form")).toBeNull();
    expect(root.querySelector(".iam-input")).not.toBeNull();
    expect(root.querySelector(".iam-button")).not.toBeNull();
    expect(root.querySelector(".iam-form-message")).not.toBeNull();
  });

  test("the feedback node is inserted right before the submit button", () => {
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit"), makeInput("phone")]), makeAction());
    const submitButton = root.querySelector(".iam-button") as HTMLElement;
    expect(submitButton.previousElementSibling?.classList.contains("iam-form-message")).toBe(true);
  });

  test("a batch.group that chains batch.form.submit is the submit button", async () => {
    const onAction = makeAction();
    const grouped = {
      action: "batch.group",
      params: {
        actions: [
          ["batch.form.submit", {}],
          ["batch.deeplink", { l: "https://batch.com/thanks", li: true }],
        ],
      },
    };
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("grouped")], { grouped }), onAction);
    const button = root.querySelector(".iam-button") as HTMLButtonElement;

    expect(button.classList.contains("iam-button--submit")).toBe(true);
    button.click();
    await flush();
    expect(onAction).toHaveBeenCalledWith("grouped", { formFields: {} });
  });

  test("the submit button carries the status nodes, the other buttons do not", () => {
    const message = makeMessage([makeInput("email"), makeButton("submit"), makeButton("other")]);
    const root = buildComponentTree(message, makeAction());
    const [submit, other] = Array.from(root.querySelectorAll<HTMLButtonElement>(".iam-button"));

    expect(submit.classList.contains("iam-button--submit")).toBe(true);
    const label = submit.querySelector(".iam-button-label");
    expect(label?.textContent).toBe("Send");
    expect(label?.getAttribute("aria-hidden")).toBeNull();
    expect(submit.querySelector(".iam-button-spinner")?.getAttribute("aria-hidden")).toBe("true");
    const check = submit.querySelector(".iam-button-check");
    expect(check?.getAttribute("aria-hidden")).toBe("true");
    expect(check?.querySelector("path")?.getAttribute("fill")).toBe("currentColor");

    expect(other.classList.contains("iam-button--submit")).toBe(false);
    expect(other.querySelector(".iam-button-spinner")).toBeNull();
    expect(other.querySelector(".iam-button-check")).toBeNull();
  });

  test("clicking the batch.form.submit button reports the tap, then routes the collected fields through onAction", async () => {
    const onAction = makeAction();
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), onAction);
    (root.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();

    expect(onAction.mock.calls).toEqual([
      ["submit", { formClick: { values: {} } }],
      ["submit", { formFields: {} }],
    ]);
  });

  test("a successful submit shows the confirmation message, locks the form and clears the submitting state", async () => {
    const onAction = makeAction({ kind: "form-feedback", status: "success", message: "Thanks!" });
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), onAction);
    (root.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();

    expect(root.classList.contains("iam-form--completed")).toBe(true);
    expect(root.classList.contains("iam-form--submitting")).toBe(false);
    const message = root.querySelector(".iam-form-message") as HTMLElement;
    expect(message.textContent).toBe("Thanks!");
    expect(message.classList.contains("iam-form-message--visible")).toBe(true);
    expect((root.querySelector(".iam-button") as HTMLButtonElement).disabled).toBe(true);
  });

  test("a success without copy announces the completion in the spoken status region", async () => {
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), makeAction());
    const status = root.querySelector(".iam-form-status") as HTMLElement;
    expect(status.getAttribute("role")).toBe("status");
    expect(status.textContent).toBe("");

    (root.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();

    expect(status.textContent).toBe("Form submitted.");
    expect((root.querySelector(".iam-form-message") as HTMLElement).textContent).toBe("");
    expect(root.querySelector(".iam-form-message")?.classList.contains("iam-form-message--visible")).toBe(false);
  });

  test("the payload overrides the spoken completion status", async () => {
    const message = makeMessage([makeInput("email"), makeButton("submit")]);
    message.texts["batch.form.status.completed"] = "Formulaire envoyé.";
    const root = buildComponentTree(message, makeAction());
    (root.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();

    expect((root.querySelector(".iam-form-status") as HTMLElement).textContent).toBe("Formulaire envoyé.");
  });

  test("a success with copy leaves the status region silent: the visible message is the announcement", async () => {
    const onAction = makeAction({ kind: "form-feedback", status: "success", message: "Thanks!" });
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), onAction);
    (root.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();

    expect((root.querySelector(".iam-form-status") as HTMLElement).textContent).toBe("");
    expect((root.querySelector(".iam-form-message") as HTMLElement).textContent).toBe("Thanks!");
  });

  test("an error outcome shows the form message and per-field errors without locking the form", async () => {
    const onAction = makeAction({ kind: "form-feedback", status: "error", message: "Please review.", fieldErrors: { email: "Rejected" } });
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), onAction);
    (root.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();

    expect(root.classList.contains("iam-form--completed")).toBe(false);
    const message = root.querySelector(".iam-form-message") as HTMLElement;
    expect(message.textContent).toBe("Please review.");
    expect(message.classList.contains("iam-form-message--error")).toBe(true);
    expect(root.querySelector(".iam-field-error")?.textContent).toBe("Rejected");
    expect((root.querySelector(".iam-button") as HTMLButtonElement).disabled).toBe(false);
  });

  test("a field error without a form-level message leaves the form message collapsed", async () => {
    const onAction = makeAction({ kind: "form-feedback", status: "error", fieldErrors: { email: "Rejected" } });
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), onAction);
    document.body.appendChild(root);

    (root.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();

    expect(root.querySelector(".iam-field-error")?.textContent).toBe("Rejected");
    expect(root.querySelector(".iam-form-message")?.classList.contains("iam-form-message--visible")).toBe(false);
    expect(document.activeElement).toBe(root.querySelector("input.iam-input"));
    expect(root.querySelector(".iam-field-input.iam-field-shake")).not.toBeNull();
    expect((root.querySelector(".iam-button") as HTMLButtonElement).disabled).toBe(false);
    root.remove();
  });

  test("a rejected submit keeps the rendered tree and surfaces the network error feedback", async () => {
    const onAction = makeAction(new Error("offline"));
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), onAction);
    (root.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();

    expect(root.querySelector(".iam-input")).not.toBeNull();
    const message = root.querySelector(".iam-form-message") as HTMLElement;
    expect(message.classList.contains("iam-form-message--error")).toBe(true);
    expect(message.classList.contains("iam-form-message--visible")).toBe(true);
    expect(root.classList.contains("iam-form--submitting")).toBe(false);
  });

  test("a non form-feedback outcome surfaces a generic error instead of silence", async () => {
    const onAction = makeAction({ kind: "none" });
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), onAction);
    (root.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();

    const message = root.querySelector(".iam-form-message") as HTMLElement;
    expect(message.classList.contains("iam-form-message--error")).toBe(true);
    expect(message.textContent?.length).toBeGreaterThan(0);
  });

  test("the feedback node carries no author aria-live, so its role drives the urgency", () => {
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), makeAction());
    const message = root.querySelector(".iam-form-message") as HTMLElement;

    expect(message.hasAttribute("aria-live")).toBe(false);
    expect(message.getAttribute("role")).toBe("status");
  });

  test("the feedback node becomes an alert on an error and a status on a success", async () => {
    const errorRoot = buildComponentTree(
      makeMessage([makeInput("email"), makeButton("submit")]),
      makeAction({ kind: "form-feedback", status: "error", message: "Please review." })
    );
    (errorRoot.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();
    expect((errorRoot.querySelector(".iam-form-message") as HTMLElement).getAttribute("role")).toBe("alert");

    const successRoot = buildComponentTree(
      makeMessage([makeInput("email"), makeButton("submit")]),
      makeAction({ kind: "form-feedback", status: "success", message: "Thanks!" })
    );
    (successRoot.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();
    expect((successRoot.querySelector(".iam-form-message") as HTMLElement).getAttribute("role")).toBe("status");
  });

  test("a repeated identical error empties the live region first, so it is announced again", async () => {
    const onAction = makeAction({ kind: "form-feedback", status: "error", message: "Network error." });
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), onAction);
    const button = root.querySelector(".iam-button") as HTMLButtonElement;
    const message = root.querySelector(".iam-form-message") as HTMLElement;

    button.click();
    await flush();
    expect(message.textContent).toBe("Network error.");

    const records: MutationRecord[] = [];
    const observer = new MutationObserver(batch => records.push(...batch));
    observer.observe(message, { childList: true, characterData: true, subtree: true });

    button.click();
    await flush();
    records.push(...observer.takeRecords());
    observer.disconnect();

    expect(records.some(record => record.removedNodes.length > 0 && record.addedNodes.length === 0)).toBe(true);
    expect(records.some(record => record.addedNodes.length > 0)).toBe(true);
    expect(message.textContent).toBe("Network error.");
    expect(submitCalls(onAction)).toHaveLength(2);
  });

  test("submit does not fire when a required field is empty", async () => {
    const onAction = makeAction();
    const root = buildComponentTree(makeMessage([makeInput("email", true), makeButton("submit")]), onAction);
    (root.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();
    expect(submitCalls(onAction)).toHaveLength(0);
    expect(clickCalls(onAction)).toHaveLength(1);
    expect(root.querySelector(".iam-input")?.classList.contains("iam-input--error")).toBe(true);
    expect(root.querySelector(".iam-field-error")?.classList.contains("iam-field-error--visible")).toBe(true);
  });

  test("an invalid email resolves the type-specific error key before the generic one", async () => {
    const onAction = makeAction();
    const message = makeMessage([makeInput("email"), makeButton("submit")]);
    (message.root.children[0] as MessageInputModel).configuration.inputType = "email";
    message.texts["batch.form.error.invalid.email"] = "Adresse e-mail invalide";
    message.texts["batch.form.error.invalid"] = "Valeur invalide";
    const root = buildComponentTree(message, onAction);

    (root.querySelector(".iam-input") as HTMLInputElement).value = "not-an-email";
    (root.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();

    expect(submitCalls(onAction)).toHaveLength(0);
    expect(clickCalls(onAction)).toHaveLength(1);
    expect(root.querySelector(".iam-field-error")?.textContent).toBe("Adresse e-mail invalide");
  });

  test("the default email format is the SDK profile validator, not a looser form-only rule", async () => {
    const onAction = makeAction();
    const message = makeMessage([makeInput("email"), makeButton("submit")]);
    (message.root.children[0] as MessageInputModel).configuration.inputType = "email";
    const root = buildComponentTree(message, onAction);
    const input = root.querySelector(".iam-input") as HTMLInputElement;
    const submit = root.querySelector(".iam-button") as HTMLButtonElement;

    input.value = "user@batch.c-om";
    submit.click();
    await flush();
    expect(submitCalls(onAction)).toHaveLength(0);

    input.value = "user@batch.com";
    submit.click();
    await flush();
    expect(onAction).toHaveBeenCalled();
  });

  test("an invalid email falls back to the generic invalid key when no type-specific key exists", async () => {
    const onAction = makeAction();
    const message = makeMessage([makeInput("email"), makeButton("submit")]);
    (message.root.children[0] as MessageInputModel).configuration.inputType = "email";
    message.texts["batch.form.error.invalid"] = "Valeur invalide";
    const root = buildComponentTree(message, onAction);

    (root.querySelector(".iam-input") as HTMLInputElement).value = "not-an-email";
    (root.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();

    expect(root.querySelector(".iam-field-error")?.textContent).toBe("Valeur invalide");
  });

  test("a payload errorId always wins over the built-in invalid keys", async () => {
    const onAction = makeAction();
    const message = makeMessage([makeInput("email"), makeButton("submit")]);
    const field = message.root.children[0] as MessageInputModel;
    field.configuration.inputType = "email";
    field.validation = { errorId: "customError" };
    message.texts["customError"] = "Custom copy wins";
    message.texts["batch.form.error.invalid.email"] = "Adresse e-mail invalide";
    const root = buildComponentTree(message, onAction);

    (root.querySelector(".iam-input") as HTMLInputElement).value = "not-an-email";
    (root.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();

    expect(root.querySelector(".iam-field-error")?.textContent).toBe("Custom copy wins");
  });

  test("pressing Enter inside a field produces the same ordered tap and submit pair as the button", async () => {
    const onAction = makeAction();
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), onAction);
    const input = root.querySelector(".iam-input") as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true, bubbles: true }));
    await flush();

    expect(onAction.mock.calls).toEqual([
      ["submit", { formClick: { values: {} } }],
      ["submit", { formFields: {} }],
    ]);
  });

  test("pressing Enter dispatches nothing when the payload carries no submit button", async () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    const onAction = makeAction();
    const message = makeMessage([makeInput("email"), makeButton("later")], { later: { action: "batch.dismiss" } });
    const root = buildComponentTree(message, onAction);

    (root.querySelector(".iam-input") as HTMLInputElement).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", cancelable: true, bubbles: true })
    );
    await flush();

    expect(onAction).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test("fields and the submit button are collected recursively across columns", async () => {
    const onAction = makeAction();
    const message = makeMessage([
      makeColumn([makeInput("firstname", true), makeInput("lastname", true)]),
      makeInput("email", true),
      makeColumn([makeButton("submit")]),
    ]);
    const root = buildComponentTree(message, onAction);
    (root.querySelector(".iam-button") as HTMLButtonElement).click();

    expect(root.querySelectorAll(".iam-input--error")).toHaveLength(3);
    expect(root.querySelectorAll('[aria-invalid="true"]')).toHaveLength(3);

    const inputs = Array.from(root.querySelectorAll<HTMLInputElement>(".iam-input"));
    for (const input of inputs) {
      input.value = "filled";
    }
    (root.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();
    expect(onAction).toHaveBeenCalledWith("submit", {
      formFields: { firstname_map: "filled", lastname_map: "filled", email_map: "filled" },
    });
  });

  test("a rejected submit plays the shake animation on the first invalid field", () => {
    const root = buildComponentTree(makeMessage([makeInput("email", true), makeButton("submit")]), makeAction());
    (root.querySelector(".iam-button") as HTMLButtonElement).click();
    expect(root.querySelector(".iam-field-input.iam-field-shake")).not.toBeNull();
  });

  test("submit routes the iOS-shaped attributes (empty strings dropped)", async () => {
    const onAction = makeAction();
    const message = makeMessage([makeInput("email"), makeButton("submit")]);
    const root = buildComponentTree(message, onAction);
    const input = root.querySelector(".iam-input") as HTMLInputElement;
    input.value = "  ";
    (root.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();

    expect(onAction).toHaveBeenCalledWith("submit", { formFields: {} });
  });

  test("while a submit is in flight the whole form is locked, then the state is released", async () => {
    let resolveOutcome: (outcome: ActionOutcome) => void = () => undefined;
    const onAction = jest.fn(() => new Promise<ActionOutcome>(resolve => (resolveOutcome = resolve)));
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), onAction);
    const button = root.querySelector(".iam-button") as HTMLButtonElement;
    const input = root.querySelector(".iam-input") as HTMLInputElement;

    button.click();
    await flush();

    expect(root.classList.contains("iam-form--submitting")).toBe(true);
    expect(root.getAttribute("aria-busy")).toBe("true");
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(input.disabled).toBe(true);

    resolveOutcome({ kind: "form-feedback", status: "success" });
    await flush();

    expect(root.classList.contains("iam-form--submitting")).toBe(false);
    expect(root.getAttribute("aria-busy")).toBe("false");
    expect(button.getAttribute("aria-busy")).toBe("false");
  });

  test("a failed submit releases the lock so the user can fix the fields and retry", async () => {
    let resolveOutcome: (outcome: ActionOutcome) => void = () => undefined;
    const onAction = jest.fn(() => new Promise<ActionOutcome>(resolve => (resolveOutcome = resolve)));
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), onAction);
    const button = root.querySelector(".iam-button") as HTMLButtonElement;
    const input = root.querySelector(".iam-input") as HTMLInputElement;

    input.value = "user@batch.com";
    button.click();
    await flush();
    expect(input.disabled).toBe(true);

    resolveOutcome({ kind: "form-feedback", status: "error", fieldErrors: { email: "Rejected" } });
    await flush();

    expect(input.disabled).toBe(false);
    expect(button.disabled).toBe(false);
    expect(input.value).toBe("user@batch.com");
    expect(root.classList.contains("iam-form--completed")).toBe(false);
  });

  test("two enabled button activations report one tap each, each one before its own submit", async () => {
    const { onAction, settle } = deferredAction();
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), onAction);
    const button = root.querySelector(".iam-button") as HTMLButtonElement;
    (root.querySelector(".iam-input") as HTMLInputElement).value = "user@batch.com";

    button.click();
    await flush();
    settle(0);
    await flush();
    expect(button.disabled).toBe(false);

    button.click();
    await flush();
    settle(1);
    await flush();

    expect(onAction.mock.calls).toEqual([
      ["submit", { formClick: { values: { email_map: "user@batch.com" } } }],
      ["submit", { formFields: { email_map: "user@batch.com" } }],
      ["submit", { formClick: { values: { email_map: "user@batch.com" } } }],
      ["submit", { formFields: { email_map: "user@batch.com" } }],
    ]);
  });

  test("two Enter activations report the same ordered pairs as two button taps", async () => {
    const { onAction, settle } = deferredAction();
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), onAction);
    const input = root.querySelector(".iam-input") as HTMLInputElement;
    input.value = "user@batch.com";
    const pressEnter = (): void => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true, bubbles: true }));
    };

    pressEnter();
    await flush();
    settle(0);
    await flush();
    expect(input.disabled).toBe(false);

    pressEnter();
    await flush();
    settle(1);
    await flush();

    expect(onAction.mock.calls).toEqual([
      ["submit", { formClick: { values: { email_map: "user@batch.com" } } }],
      ["submit", { formFields: { email_map: "user@batch.com" } }],
      ["submit", { formClick: { values: { email_map: "user@batch.com" } } }],
      ["submit", { formFields: { email_map: "user@batch.com" } }],
    ]);
  });

  test("a tap while the submit is in flight reports no click", async () => {
    const { onAction } = deferredAction();
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), onAction);
    const button = root.querySelector(".iam-button") as HTMLButtonElement;
    (root.querySelector(".iam-input") as HTMLInputElement).value = "user@batch.com";

    button.click();
    await flush();
    expect(button.disabled).toBe(true);

    button.disabled = false;
    button.click();
    await flush();

    expect(clickCalls(onAction)).toHaveLength(1);
    expect(submitCalls(onAction)).toHaveLength(1);
  });

  test("a tap after a successful submit reports no click", async () => {
    const { onAction, settle } = deferredAction();
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), onAction);
    const button = root.querySelector(".iam-button") as HTMLButtonElement;
    (root.querySelector(".iam-input") as HTMLInputElement).value = "user@batch.com";

    button.click();
    await flush();
    settle(0, { kind: "form-feedback", status: "success" });
    await flush();

    button.disabled = false;
    button.click();
    await flush();

    expect(clickCalls(onAction)).toHaveLength(1);
    expect(submitCalls(onAction)).toHaveLength(1);
  });

  test("Enter after a successful submit reports no click either", async () => {
    const { onAction, settle } = deferredAction();
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), onAction);
    const input = root.querySelector(".iam-input") as HTMLInputElement;
    input.value = "user@batch.com";
    const pressEnter = (): void => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true, bubbles: true }));
    };

    pressEnter();
    await flush();
    settle(0, { kind: "form-feedback", status: "success" });
    await flush();

    input.disabled = false;
    (root.querySelector(".iam-button") as HTMLButtonElement).disabled = false;
    pressEnter();
    await flush();

    expect(clickCalls(onAction)).toHaveLength(1);
    expect(submitCalls(onAction)).toHaveLength(1);
  });

  test("fields present with no batch.form.submit button warns and appends the feedback node at the tree end", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    const message = makeMessage([makeInput("email"), makeButton("later")], { later: { action: "batch.dismiss" } });
    const root = buildComponentTree(message, makeAction());

    expect(warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("no submit button found"));
    expect(root.lastElementChild?.classList.contains("iam-form-message")).toBe(true);
    warn.mockRestore();
  });

  test("multiple batch.form.submit buttons warn and the first one drives the submit", async () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    const onAction = makeAction();
    const message = makeMessage([makeInput("email"), makeButton("submit"), makeButton("submit2")], {
      submit2: { action: "batch.form.submit" },
    });
    const root = buildComponentTree(message, onAction);

    expect(warn).toHaveBeenCalledWith(expect.anything(), expect.stringContaining("multiple"));

    const buttons = root.querySelectorAll<HTMLButtonElement>(".iam-button");
    expect(buttons).toHaveLength(2);

    buttons[1].click();
    await flush();
    expect(onAction).toHaveBeenCalledWith("submit2");

    buttons[0].click();
    await flush();
    expect(onAction).toHaveBeenCalledWith("submit", { formFields: {} });
    warn.mockRestore();
  });

  test("a button with an explicit action keeps the standard CTA flow", () => {
    const onAction = makeAction();
    const message = makeMessage([makeInput("email"), makeButton("later"), makeButton("submit")], {
      later: { action: "batch.dismiss" },
    });
    const root = buildComponentTree(message, onAction);
    const buttons = root.querySelectorAll(".iam-button");
    (buttons[0] as HTMLButtonElement).click();
    expect(onAction).toHaveBeenCalledWith("later");
  });
});

describe("anti-bot decoy field", () => {
  const DECOY = "input.iam-decoy";

  test("the opted-in tree renders one decoy as the first child, hidden and unreachable", () => {
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), makeAction(), undefined, {
      decoyField: true,
    });

    const decoys = root.querySelectorAll<HTMLInputElement>(DECOY);
    expect(decoys).toHaveLength(1);
    const decoy = decoys[0];
    expect(root.firstElementChild).toBe(decoy);
    expect(decoy.type).toBe("text");
    expect(decoy.name).toBe("subject");
    expect(decoy.maxLength).toBe(255);
    expect(decoy.getAttribute("tabindex")).toBe("-1");
    expect(decoy.getAttribute("aria-hidden")).toBe("true");
    expect(decoy.getAttribute("autocomplete")).toBe("off");
    expect(decoy.id).toBe("");
    expect(decoy.classList.contains("iam-input")).toBe(false);
    expect(root.querySelectorAll("input.iam-input")).toHaveLength(1);
  });

  test("the modal path renders no decoy", () => {
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), makeAction());

    expect(root.querySelector(DECOY)).toBeNull();
  });

  test("a tree with fields but no submit button renders no decoy", () => {
    const warn = jest.spyOn(Log, "warn").mockImplementation(() => undefined);
    const root = buildComponentTree(makeMessage([makeInput("email")]), makeAction(), undefined, { decoyField: true });

    expect(root.querySelector(DECOY)).toBeNull();
    warn.mockRestore();
  });

  test("a submit button with no field still gets its decoy", () => {
    const root = buildComponentTree(makeMessage([makeButton("submit")]), makeAction(), undefined, { decoyField: true });

    expect(root.querySelector(DECOY)).not.toBeNull();
  });

  test("a filled decoy reaches the submit under the $honeypot key", async () => {
    const onAction = makeAction();
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), onAction, undefined, {
      decoyField: true,
    });

    (root.querySelector(DECOY) as HTMLInputElement).value = "bot";
    (root.querySelector("input.iam-input") as HTMLInputElement).value = "someone@batch.com";
    (root.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();

    expect(submitCalls(onAction)[0][1]).toEqual({ formFields: { $honeypot: "bot", email_map: "someone@batch.com" } });
  });

  test("an untouched decoy contributes no key", async () => {
    const onAction = makeAction();
    const root = buildComponentTree(makeMessage([makeInput("email"), makeButton("submit")]), onAction, undefined, {
      decoyField: true,
    });

    (root.querySelector("input.iam-input") as HTMLInputElement).value = "someone@batch.com";
    (root.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();

    expect(submitCalls(onAction)[0][1]).toEqual({ formFields: { email_map: "someone@batch.com" } });
  });

  test("the decoy never blocks a submit nor steals the focus of an invalid one", async () => {
    const onAction = makeAction();
    const root = buildComponentTree(makeMessage([makeInput("email", true), makeButton("submit")]), onAction, undefined, {
      decoyField: true,
    });
    document.body.appendChild(root);

    (root.querySelector(DECOY) as HTMLInputElement).value = "bot";
    (root.querySelector(".iam-button") as HTMLButtonElement).click();
    await flush();

    expect(submitCalls(onAction)).toHaveLength(0);
    expect(document.activeElement).toBe(root.querySelector("input.iam-input"));
    root.remove();
  });
});
