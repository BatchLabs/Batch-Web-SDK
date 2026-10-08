/* eslint-env jest */

import { ProfileAttributeType } from "com.batch.shared/profile/profile-data-types";

import { ActionOutcome, FormFieldValue } from "../../contracts";
import { createLandingPageActionExecutor, LandingPageActionsConfig } from "../landing-page-actions";
import type { LandingSubmitVerdict, LandingTransport } from "../landing-transport";

jest.mock("../landing-page-probe", () => ({
  probeLandingPage: jest.fn().mockResolvedValue(false),
}));

type SubmitMock = jest.Mock<Promise<LandingSubmitVerdict>, [Record<string, unknown>]>;

function makeConfig(
  overrides: Partial<LandingPageActionsConfig> = {},
  submit: SubmitMock = jest.fn(async (_fields: Record<string, unknown>) => ({ status: "accepted" as const }))
): LandingPageActionsConfig & { showEmbeddedErrorPage: jest.Mock; navigate: jest.Mock; submit: SubmitMock } {
  const transport: LandingTransport = { submitFields: submit, emitEvent: jest.fn() };
  const config = {
    transport,
    showEmbeddedErrorPage: jest.fn(),
    navigate: jest.fn(),
    ...overrides,
  } as LandingPageActionsConfig & { showEmbeddedErrorPage: jest.Mock; navigate: jest.Mock };
  return { ...config, submit };
}

const FIELDS: Record<string, FormFieldValue> = { email: { type: ProfileAttributeType.STRING, value: "a@b.c" } };

async function submitWith(config: LandingPageActionsConfig, fields: Record<string, FormFieldValue> = FIELDS): Promise<ActionOutcome> {
  const executor = createLandingPageActionExecutor(config);
  return executor.execute({ action: "batch.form.submit", args: {} }, { formFields: fields });
}

describe("batch.form.submit (landing host)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("hands the collected fields to the transport and locks the form on acceptance", async () => {
    const config = makeConfig();

    const fields: Record<string, FormFieldValue> = {
      email: { type: ProfileAttributeType.STRING, value: "jean@example.com" },
      consent: { type: ProfileAttributeType.BOOLEAN, value: true },
      topics: { type: ProfileAttributeType.ARRAY, value: { $add: ["a", "b"] } },
    };

    const outcome = await submitWith(config, fields);

    expect(config.submit).toHaveBeenCalledTimes(1);
    expect(config.submit).toHaveBeenCalledWith(fields);
    expect(outcome).toEqual({ kind: "form-feedback", status: "success" });
  });

  test("no formFields resolves to a none outcome without touching the transport", async () => {
    const config = makeConfig();
    const executor = createLandingPageActionExecutor(config);

    const outcome = await executor.execute({ action: "batch.form.submit", args: {} }, {});

    expect(outcome).toEqual({ kind: "none" });
    expect(config.submit).not.toHaveBeenCalled();
  });

  test("a rejected verdict surfaces its field errors as-is", async () => {
    const fieldErrors = { email: "Veuillez saisir une adresse e-mail valide." };
    const config = makeConfig(
      {},
      jest.fn(async (_fields: Record<string, unknown>) => ({ status: "rejected" as const, fieldErrors }))
    );

    const outcome = await submitWith(config, { email: { type: ProfileAttributeType.STRING, value: "nope" } });

    expect(outcome).toEqual({ kind: "form-feedback", status: "error", fieldErrors });
    expect(config.showEmbeddedErrorPage).not.toHaveBeenCalled();
  });

  test("an accepted verdict stays on the page: the submit button carries the success state", async () => {
    const publicError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const config = makeConfig();

    await submitWith(config);
    await Promise.resolve();

    expect(config.navigate).not.toHaveBeenCalled();
    expect(config.showEmbeddedErrorPage).not.toHaveBeenCalled();
    expect(publicError).not.toHaveBeenCalled();
  });

  test("a transport failure keeps the form so the user can retry in place", async () => {
    const config = makeConfig(
      {},
      jest.fn(async (_fields: Record<string, unknown>) => Promise.reject(new Error("No verdict")))
    );

    await expect(submitWith(config)).rejects.toThrow("No verdict");
    expect(config.showEmbeddedErrorPage).not.toHaveBeenCalled();
  });

  test("a second failure gives up and takes the service-unavailable path", async () => {
    const config = makeConfig(
      {},
      jest.fn(async (_fields: Record<string, unknown>) => Promise.reject(new Error("No verdict")))
    );
    const executor = createLandingPageActionExecutor(config);
    const submit = (): Promise<ActionOutcome> => executor.execute({ action: "batch.form.submit", args: {} }, { formFields: FIELDS });

    await expect(submit()).rejects.toThrow("No verdict");
    const outcome = await submit();

    expect(outcome).toEqual({ kind: "form-feedback", status: "error" });
    expect(config.showEmbeddedErrorPage).toHaveBeenCalledTimes(1);
  });

  test("a verdict clears the retry credit: a later outage gets its own in-place retry", async () => {
    const submitMock: SubmitMock = jest.fn(async (_fields: Record<string, unknown>) => Promise.reject(new Error("No verdict")));
    const config = makeConfig({}, submitMock);
    const executor = createLandingPageActionExecutor(config);
    const submit = (): Promise<ActionOutcome> => executor.execute({ action: "batch.form.submit", args: {} }, { formFields: FIELDS });

    await expect(submit()).rejects.toThrow("No verdict");
    submitMock.mockResolvedValueOnce({ status: "rejected", fieldErrors: { email: "Invalide" } });
    await submit();

    await expect(submit()).rejects.toThrow("No verdict");
    expect(config.showEmbeddedErrorPage).not.toHaveBeenCalled();
  });

  test("no transport at all goes straight to the service-unavailable path", async () => {
    const config = { showEmbeddedErrorPage: jest.fn() } as unknown as LandingPageActionsConfig & { showEmbeddedErrorPage: jest.Mock };

    const outcome = await submitWith(config);

    expect(outcome).toEqual({ kind: "form-feedback", status: "error" });
    expect(config.showEmbeddedErrorPage).toHaveBeenCalledTimes(1);
  });

  describe("submit with a redirect URL (batch.group of submit then deeplink)", () => {
    const REDIRECT = {
      action: "batch.group",
      args: {
        actions: [
          ["batch.form.submit", {}],
          ["batch.deeplink", { l: "https://batch.com/thanks", li: true }],
        ],
      },
    };

    test("an accepted verdict carries the redirect on the success feedback", async () => {
      const config = makeConfig();
      const executor = createLandingPageActionExecutor(config);

      const outcome = await executor.execute(REDIRECT, { formFields: { email: { type: ProfileAttributeType.STRING, value: "a@b.c" } } });

      expect(config.submit).toHaveBeenCalledWith({ email: { type: ProfileAttributeType.STRING, value: "a@b.c" } });
      expect(outcome).toEqual({
        kind: "form-feedback",
        status: "success",
        openWindow: { url: "https://batch.com/thanks", target: "_self", features: "noopener" },
      });
    });

    test("a rejected verdict keeps the field errors and drops the redirect", async () => {
      const fieldErrors = { email: "Invalid" };
      const config = makeConfig(
        {},
        jest.fn(async (_fields: Record<string, unknown>) => ({ status: "rejected" as const, fieldErrors }))
      );
      const executor = createLandingPageActionExecutor(config);

      const outcome = await executor.execute(REDIRECT, { formFields: { email: { type: ProfileAttributeType.STRING, value: "nope" } } });

      expect(outcome).toEqual({ kind: "form-feedback", status: "error", fieldErrors });
    });

    test("an unavailable service opens the error outcome and drops the redirect", async () => {
      jest.spyOn(console, "error").mockImplementation(() => undefined);
      const config = makeConfig(
        {},
        jest.fn(async (_fields: Record<string, unknown>) => Promise.reject(new Error("offline")))
      );
      const executor = createLandingPageActionExecutor(config);
      const submit = (): Promise<ActionOutcome> =>
        executor.execute(REDIRECT, { formFields: { email: { type: ProfileAttributeType.STRING, value: "a@b.c" } } });

      await expect(submit()).rejects.toThrow("offline");
      const outcome = await submit();

      expect(outcome).toEqual({ kind: "form-feedback", status: "error" });
      expect(config.showEmbeddedErrorPage).toHaveBeenCalledTimes(1);
    });
  });
});
