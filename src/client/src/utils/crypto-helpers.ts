export const hexToBuf = (hex: string) => new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
export const bufToHex = (buf: Uint8Array | ArrayBuffer) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
export const bufToBase64 = (buf: Uint8Array | ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
export const base64ToBuf = (b64: string) => new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)));

export async function getPBKDF2Key(password: string, saltBuf: Uint8Array) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBuf as any, iterations: 600000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, ["encrypt", "decrypt"]
  );
}

export async function hkdfDerive(sharedSecretBuf: Uint8Array, saltBuf: Uint8Array, infoStr: string) {
  const keyMaterial = await crypto.subtle.importKey("raw", sharedSecretBuf as any, { name: "HKDF" }, false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: saltBuf as any, info: new TextEncoder().encode(infoStr) },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, ["encrypt", "decrypt"]
  );
}
