export enum Browser {
  Unknown = 0,
  Generic, // Generic is a browser we detected but don't care about (Android WebView, Edge, etc...)
  Chrome, // Includes all chrome-likes
  Firefox,
  Safari,
}

export enum Platform {
  Unknown = 0,
  GenericDesktop,
  GenericMobile,
  IOS,
  Android,
  MacOS,
  Windows,
  Linux,
}

export class UserAgent {
  public rawUA: string;
  public rawPlatform: string;
  public browser: Browser;
  public platform: Platform;

  public constructor(userAgentString: string, platform: string = window.navigator.platform) {
    this.rawUA = userAgentString;
    this.rawPlatform = platform;
    this.parse();
  }

  public uaContains(wanted: string): boolean {
    return this.rawUA.indexOf(wanted) !== -1;
  }

  public platformContains(wanted: string): boolean {
    return this.rawPlatform.indexOf(wanted) !== -1;
  }

  public isDesktop(): boolean {
    switch (this.platform) {
      case Platform.GenericDesktop:
      case Platform.MacOS:
      case Platform.Windows:
      case Platform.Linux:
        return true;

      default:
        return false;
    }
  }

  public isMobile(): boolean {
    switch (this.platform) {
      case Platform.GenericMobile:
      case Platform.IOS:
      case Platform.Android:
        return true;

      default:
        return false;
    }
  }

  // Be careful, as this doesn't take into account the browser's version!
  // Resorting to real feature checks is the best way here
  public isVAPIDPotentiallySupported(): boolean {
    return (
      (this.isDesktop() || this.platform === Platform.Android) && (this.browser === Browser.Chrome || this.browser === Browser.Firefox)
    );
  }

  private parse(): void {
    this.browser = Browser.Unknown;

    // Parsing the useragent is evil, but we have to do it here
    // Helpful resource: https://developer.mozilla.org/en-US/docs/Web/HTTP/Browser_detection_using_the_user_agent

    // Get some edge cases out of the way

    // Start with Edge, as OF COURSE Edge tells it's chrome
    // We don't care about Edge, since it has no push support as of writing
    // Also rule out IE because we don't care about it
    if (this.uaContains("Edge/") || this.uaContains("Trident/")) {
      this.browser = Browser.Generic;
      this.platform = Platform.Windows;
      return;
    }

    if (this.uaContains("iPhone") || this.uaContains("iPad") || this.uaContains("CriOS")) {
      // We're on an iPhone
      // We could be a WebView, Chrome iOS, Firefox, MobileSafari ...
      // But we don't care since none of them will have push support
      this.browser = Browser.Generic;
      this.platform = Platform.IOS;
      if (this.uaContains("Safari/")) {
        this.browser = Browser.Safari;
      }
      return;
    }

    if (this.uaContains("Android")) {
      this.platform = Platform.Android;
    } else if (this.uaContains("Mobi") || this.uaContains("Tablet")) {
      this.platform = Platform.GenericMobile;
    }

    // We got most of the noise out, try to detect the desktop browser
    if (this.platform !== Platform.Android) {
      this.platform = Platform.GenericDesktop;
    }

    if (this.platform === Platform.GenericDesktop) {
      // Try to figure out the platform
      if (this.platformContains("Mac")) {
        this.platform = Platform.MacOS;
      } else if (this.platformContains("Win")) {
        this.platform = Platform.Windows;
      } else if (this.platformContains("Linux") || this.platformContains("X11")) {
        this.platform = Platform.Linux;
      }
    }

    // https:// developer.chrome.com/multidevice/user-agent
    if (this.uaContains("Chrome/") || this.uaContains("Chromium/")) {
      // Probably Chrome
      this.browser = Browser.Chrome;

      if (this.platform === Platform.Android) {
        // Exclude the KitKat WebView, which really doesn't try to stand out
        // Lollipop WebViews are kinder and add "wv"
        if (
          this.uaContains("; wv") ||
          this.uaContains("(wv;") ||
          this.uaContains("Chrome/30.0.0.0") ||
          this.uaContains("Chrome/33.0.0.0")
        ) {
          this.browser = Browser.Generic;
        }
      }
      return;
    }

    if (this.uaContains("Firefox/")) {
      this.browser = Browser.Firefox;
      return;
    }

    if (this.uaContains("Version/") && this.platform === Platform.Android) {
      // If the UA has Version/ it may be Android's WebView, or MobileSafari.
      // iOS WebViews don't have Version/, but we don't care about them
      this.browser = Browser.Generic;
      return;
    }

    if (this.uaContains("Safari/")) {
      this.browser = Browser.Safari;
      if (this.platform === Platform.GenericDesktop) {
        // Only do that if we didn't determine the platform yet
        this.platform = Platform.MacOS; // Yes, Safari for Windows was a thing, but we don't care.
      }

      return;
    }

    this.browser = Browser.Unknown;
    if (this.platform === Platform.GenericDesktop) {
      // We were not really sure to begin with
      this.platform = Platform.Unknown;
    }
  }
}

export default UserAgent;
