// index.js — MUST be at root, replaces expo's default entrypoint
import { Buffer } from "buffer";
import { getRandomValues as expoCryptoGetRandomValues } from "expo-crypto";

global.Buffer = Buffer;

// Polyfill crypto for @solana/web3.js
class Crypto {
  getRandomValues = expoCryptoGetRandomValues;
}

const webCrypto = typeof crypto !== "undefined" ? crypto : new Crypto();

(() => {
  if (typeof crypto === "undefined") {
    Object.defineProperty(window, "crypto", {
      configurable: true,
      enumerable: true,
      get: () => webCrypto,
    });
  }
})();

import "expo-router/entry";
