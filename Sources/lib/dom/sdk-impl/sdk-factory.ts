import { ISDK } from "com.batch.dom/sdk-impl/sdk";
import SafariSDKFactory from "com.batch.dom/sdk-impl/sdk-safari";
import StandardSDKFactory from "com.batch.dom/sdk-impl/sdk-standard";
import UserAgent, { Browser } from "com.batch.shared/helpers/user-agent";
import { keysByProvider } from "com.batch.shared/parameters/keys";
import ParameterStore from "com.batch.shared/parameters/parameter-store";
/**
 * The factory used to create a uniq ISDK instance.
 * The instance is wrapped with a promise to always ensure that everything is correctly initialized.
 */
export interface ISDKFactory {
  /**
   * Setup a new ISDK instance (if not already done)
   * and returns the newly uniq created instance.
   */
  setup(config: object): Promise<ISDK>;

  /**
   * Return the uniq instance created by the factory.
   * Always call setup before or the promise will be rejected.
   */
  getInstance(): Promise<ISDK>;
}

/**
 * Create the right SDK factory according to the browser
 * @returns ISDKFactory
 */
export async function createSDKFactory(): Promise<ISDKFactory> {
  // Instantiate the right SDK factory according to the browser
  let sdkFactory: ISDKFactory = StandardSDKFactory;
  const userAgent = new UserAgent(window.navigator.userAgent);
  if (userAgent.browser === Browser.Safari) {
    if ("PushManager" in self) {
      const parameterStore: ParameterStore = await ParameterStore.getInstance();
      const subscription = await parameterStore.getParameterValue(keysByProvider.profile.Subscription);
      if (subscription && typeof subscription === "string") {
        // User already has an APNS subscription, we keep using APNS.
        sdkFactory = SafariSDKFactory;
      }
    } else {
      // Safari does NOT supports WPP.
      sdkFactory = SafariSDKFactory;
    }
  }
  return sdkFactory;
}
