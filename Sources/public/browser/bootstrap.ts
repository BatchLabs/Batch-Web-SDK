// tslint:disable no-console
import { Browser, Platform, UserAgent } from "com.batch.shared/helpers/user-agent";

import { IS_WEBPACK_DEV_SERVER, SDK_VERSION, SSL_SCRIPT_URL } from "../../config";
interface IBootstrapOptions {
  unsafe_allowNonNativePromises?: boolean | null;
}

interface MobileSafariNavigator extends Navigator {
  standalone?: boolean;
}

const VERSION_MAJOR = SDK_VERSION === "rolling" ? SDK_VERSION : SDK_VERSION.split(".")[0];

const appendScript = (url: string): void => {
  const tag = document.createElement("script");
  tag.async = true;
  tag.src = url;
  const firstTagElem = document.getElementsByTagName("script")[0];
  if (firstTagElem.parentNode) {
    firstTagElem.parentNode.insertBefore(tag, firstTagElem);
  }
};

const setupBatchSDK = (): void => {
  const dummyConsole = {
    error: (_msg: string) => {},
    debug: (_msg: string) => {},
    log: (_msg: string) => {},
  };
  const safeConsole = typeof console === "object" && console !== null ? Object.assign(dummyConsole, console) : dummyConsole;

  // Yes, we're using any to avoid adding a lot of boilerplate in bootstrap, which should be small
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bootstrapOptions: IBootstrapOptions = (window as any)["batchSDKBootstrapOptions"];
  if (typeof bootstrapOptions !== "object" || bootstrapOptions === null) {
    bootstrapOptions = {};
  }

  if (!self.fetch) {
    safeConsole.error("[Batch] 'fetch' is missing on self, refusing to load.");
    return;
  }

  if (typeof Promise === "undefined") {
    safeConsole.error("[Batch] Promises aren't available, refusing to load.");
    return;
  }

  if (!URL || URL.prototype.toString.call(new URL("https://batch.com")) !== "https://batch.com/") {
    safeConsole.error("[Batch] URL is unreliable, refusing to load.");
    return;
  }

  const userAgent = new UserAgent(window.navigator.userAgent);
  if (userAgent.platform === Platform.IOS && userAgent.browser === Browser.Safari) {
    if (!("standalone" in navigator) || (navigator as MobileSafariNavigator).standalone === false) {
      safeConsole.debug(
        "[Batch] Website is running in an iOS browser but isn't installed as a standalone app. Push messages will not work."
      );
    }
  }

  if (!("Notification" in window)) {
    safeConsole.log("[Batch] Enabling SDK without Notification support.");
  }

  if (Promise.toString().indexOf("[native code]") === -1) {
    const baseWarning = "[Batch] Using non-standard Promises";

    if (bootstrapOptions["unsafe_allowNonNativePromises"] === true) {
      console.debug(baseWarning + ".");
    } else {
      console.error(baseWarning + ", refusing to load.");
      return;
    }
  }

  if (IS_WEBPACK_DEV_SERVER) {
    appendScript("/sdk.min.js");
  } else {
    fetch(`https://${SSL_SCRIPT_URL}/manifest.json`)
      .then(response => {
        void response.json().then(manifest => {
          if (Object.prototype.hasOwnProperty.call(manifest, "latest")) {
            if (Object.prototype.hasOwnProperty.call(manifest.latest, VERSION_MAJOR)) {
              appendScript(`https://${SSL_SCRIPT_URL}/${manifest.latest[VERSION_MAJOR]}/sdk.min.js`);
            }
          }
        });
      })
      .catch(err => {
        console.log("Batch SDK was unable to start", err);
      });
  }
};

setupBatchSDK();
