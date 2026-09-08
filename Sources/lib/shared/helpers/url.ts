const SAFE_URL_SCHEMES = new Set(["https:", "http:"]);

/** Returns true if the URL is an absolute `http` or `https` URL. Payload URLs and action deeplinks accept no other scheme. */
export function isSafeURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    return SAFE_URL_SCHEMES.has(parsed.protocol);
  } catch (_e) {
    return false;
  }
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Returns true if the URL may carry user-entered data: `https`, plus `http` on a loopback host. */
export function isSecureURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") {
      return true;
    }
    return parsed.protocol === "http:" && LOCAL_HOSTNAMES.has(parsed.hostname);
  } catch (_e) {
    return false;
  }
}
