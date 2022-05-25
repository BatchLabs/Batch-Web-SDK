/* eslint-env jest */
/* eslint-disable max-len */
// @ts-nocheck

import { Browser, Platform, UserAgent } from "com.batch.shared/helpers/user-agent";

// todo write custom expect for logging

function testAllUserAgents(
  userAgents: string[],
  browser: Browser,
  isMobile: boolean,
  isDesktop: boolean,
  expectsVAPID: boolean,
  additionalChecks?: (ua: UserAgent) => void
): void {
  userAgents
    .map(ua => new UserAgent(ua))
    .forEach(ua => {
      // console.log(ua.rawUA, ua.browser, ua.platform);
      expect(ua.browser).toBe(browser);
      expect(ua.isMobile()).toBe(isMobile);
      expect(ua.isDesktop()).toBe(isDesktop);
      expect(ua.isVAPIDPotentiallySupported()).toBe(expectsVAPID);
      if (additionalChecks) {
        additionalChecks(ua);
      }
    });
}

const userAgentStrings = {
  Desktop: {
    Chrome: [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.98 Safari/537.36",
    ],
    Firefox: ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:52.0) Gecko/20100101 Firefox/52.0"],
    Safari: ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/602.4.8 (KHTML, like Gecko) Version/10.0.3 Safari/602.4.8"],
    Vivaldi: [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.88 Safari/537.36 Vivaldi/1.7.735.46",
    ],
    Opera: [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36 OPR/43.0.2442.1165",
    ],
    EdgeAndIE: [
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.10136",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edge/15.15048",
      "Mozilla/5.0 (Windows NT 6.3; Trident/7.0; rv:11.0) like Gecko",
      "Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.2; Trident/6.0)",
    ],
    EdgeChromium: [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3794.0 Safari/537.36 Edg/76.0.161.0",
    ],
  },
  Mobile: {
    Android: {
      Chrome: [
        "Mozilla/5.0 (Linux; Android 4.0.4; Galaxy Nexus Build/IMM76B) AppleWebKit/535.19 (KHTML, like Gecko) Chrome/18.0.1025.133 Mobile Safari/535.19",
      ],
      Firefox: ["Mozilla/5.0 (Android 7.1.2; Mobile; rv:52.0) Gecko/52.0 Firefox/52.0"],
      Opera: [
        "Mozilla/5.0 (Linux; Android 7.1.2; Nexus 5X Build/NPG05D) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.91 Mobile Safari/537.36 OPR/42.5.2246.114172",
      ],
      WebView: [
        "Mozilla/5.0 (Linux; U; Android 4.1.1; en-gb; Build/KLP) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Safari/534.30",
        "Mozilla/5.0 (Linux; Android 4.4; Nexus 5 Build/_BuildID_) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/30.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (Linux; Android 5.1.1; Nexus 5 Build/LMY48B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/43.0.2357.65 Mobile Safari/537.36",
      ],
    },
    IOS: [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 10_3 like Mac OS X) AppleWebKit/603.1.23 (KHTML, like Gecko) Version/10.0 Mobile/14E5239e Safari/602.1",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 10_3 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) CriOS/56.0.2924.75 Mobile/14E5239e Safari/602.1",
    ],
  },
  Other: [],
};

test("detects chrome desktop", () => {
  testAllUserAgents(userAgentStrings.Desktop.Chrome, Browser.Chrome, false, true, true);
});

test("detects vivaldi desktop as chrome", () => {
  testAllUserAgents(userAgentStrings.Desktop.Vivaldi, Browser.Chrome, false, true, true);
});

test("detects opera desktop as chrome", () => {
  testAllUserAgents(userAgentStrings.Desktop.Opera, Browser.Chrome, false, true, true);
});

test("detects edge desktop as chrome", () => {
  testAllUserAgents(userAgentStrings.Desktop.EdgeChromium, Browser.Chrome, false, true, true);
});

test("detects chrome android", () => {
  testAllUserAgents(userAgentStrings.Mobile.Android.Chrome, Browser.Chrome, true, false, true, ua => {
    expect(ua.platform).toBe(Platform.Android);
  });
});

test("detects firefox desktop", () => {
  testAllUserAgents(userAgentStrings.Desktop.Firefox, Browser.Firefox, false, true, true);
});

test("detects firefox android", () => {
  testAllUserAgents(userAgentStrings.Mobile.Android.Firefox, Browser.Firefox, true, false, true, ua => {
    expect(ua.platform).toBe(Platform.Android);
  });
});

test("does not detect android webview as chrome", () => {
  testAllUserAgents(userAgentStrings.Mobile.Android.WebView, Browser.Generic, true, false, false, ua => {
    expect(ua.platform).toBe(Platform.Android);
  });
});
