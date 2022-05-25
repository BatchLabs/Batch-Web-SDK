/* tslint:disable triple-equals */
// Based on https://www.chromium.org/Home/chromium-security/prefer-secure-origins-for-powerful-new-features

export default function isOriginSecure(protocol: string, hostname: string): boolean {
  if (window.isSecureContext) {
    return true;
  }

  if (protocol == "https:" || protocol == "wss:" || protocol == "file:") {
    return true;
  }

  if (hostname == "localhost" || hostname == "127/8" || hostname == "::1/128") {
    return true;
  }

  return false;
}
