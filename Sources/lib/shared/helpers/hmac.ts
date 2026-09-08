/** Legacy Safari exposed `webkitSubtle`; the DOM lib does not declare it. */
interface LegacyWebkitCrypto {
  webkitSubtle?: SubtleCrypto;
}

const cryptoSign = (() => {
  if (typeof self.crypto !== "undefined") {
    const subtle = self.crypto.subtle ?? (self.crypto as unknown as LegacyWebkitCrypto).webkitSubtle;
    if (typeof subtle !== "undefined" && typeof subtle.sign !== "undefined") {
      // Bound to its receiver: `sign` is invoked detached below, which throws
      // ("Illegal invocation") on every implementation without its SubtleCrypto.
      return subtle.sign.bind(subtle);
    }
  }
  return undefined;
})();

// Returns the HMAC of an object with the given key. If unsupported, returns 'unsupported'.
export default function hmac(key: CryptoKey, text2sign: ArrayBuffer): Promise<ArrayBuffer> {
  if (cryptoSign) {
    return cryptoSign("HMAC", key, text2sign);
  }

  return Promise.reject(new Error("HMAC not supported in this environment"));
}
