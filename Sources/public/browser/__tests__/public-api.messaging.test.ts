/* eslint-env jest */

jest.mock(
  "../../types/public-api",
  () => ({
    BatchSDK: {
      TypedEventAttributeType: {},
      UserAttributeType: {},
    },
  }),
  { virtual: true }
);

jest.mock("com.batch.dom/sdk-impl/sdk-standard", () => ({
  __esModule: true,
  StandardSDK: jest.fn().mockImplementation(() => ({
    setup: jest.fn().mockResolvedValue(undefined),
    start: jest.fn().mockResolvedValue(undefined),
    getInstallationID: jest.fn().mockResolvedValue("iid"),
    getSubscriptionState: jest.fn().mockResolvedValue({ permission: "default", subscribed: false }),
  })),
}));

import newPublicAPI from "../public-api";

describe("public API messaging (not publicly exposed)", () => {
  test("the public API exposes no messaging namespace", () => {
    const api = newPublicAPI();
    api.setup({ apiKey: "DEV12345", authKey: "1.test" });

    expect((api as unknown as Record<string, unknown>).messaging).toBeUndefined();
  });

  test("the public API exposes no getCustomUserID", () => {
    const api = newPublicAPI();

    expect((api as unknown as Record<string, unknown>).getCustomUserID).toBeUndefined();
  });
});
