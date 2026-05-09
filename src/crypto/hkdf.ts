import crypto from "crypto";

export function hkdfDeriveKey(sharedSecret: Uint8Array, salt: Uint8Array, info: string): Uint8Array {
  // Using crypto.hkdfSync
  const key = crypto.hkdfSync(
    "sha256",
    sharedSecret,
    salt,
    info,
    32
  );
  return new Uint8Array(key as ArrayBuffer);
}
