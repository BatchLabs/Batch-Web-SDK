import BaseSdk from "../lib/dom/sdk-impl/sdk-base";

export class TestSDK extends BaseSdk {
  protected isPushMessagingAvailable(): boolean {
    return true;
  }
}
