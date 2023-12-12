Object.defineProperty(globalThis, "crypto", {
  value: {
    subtle: require("crypto").subtle,
  },
});

Object.defineProperty(globalThis, "CryptoKey", {
  value: require("crypto").webcrypto.CryptoKey,
});
