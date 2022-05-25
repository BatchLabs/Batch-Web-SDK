const cryptoSign = (() => {
  if (typeof self.crypto !== "undefined") {
    const subtle = self.crypto.subtle || (self.crypto as unknown).webkitSubtle;
    if (typeof subtle !== "undefined" && typeof subtle.sign !== "undefined") {
      return subtle.sign;
    }
  }
  return undefined;
})();

// Returns the HMAC of an object with the given key. If unsupported, returns 'unsupported'.
export default function hmac(key: unknown, text2sign: ArrayBuffer): Promise<ArrayBuffer> {
  if (cryptoSign) {
    // TS comes with cryptoSign as a PromiseLike, but we use it in envs that suppport real promises
    return cryptoSign("HMAC", key, text2sign) as Promise<ArrayBuffer>;
  }

  return Promise.reject(new Error("HMAC not supported in this environment"));
}
