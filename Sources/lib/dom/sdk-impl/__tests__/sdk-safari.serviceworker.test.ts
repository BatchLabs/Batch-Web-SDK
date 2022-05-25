import { SafariSDK } from "../sdk-safari";

it("always returns true when asked if the subscription key matches", () => {
  const sdk = new SafariSDK();
  expect(sdk.doesExistingSubscriptionKeyMatchCurrent()).resolves.toBe(true);
});
