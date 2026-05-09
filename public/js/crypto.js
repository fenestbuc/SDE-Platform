// Wrappers around Web Crypto API and Noble Curves
// Using the UMD build loaded via CDN in HTML: window.nobleCurves.secp256k1
const secp = window.nobleCurves ? window.nobleCurves.secp256k1 : null;

// Helpers
const hexToBuf = hex => new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
const bufToHex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
const bufToBase64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const base64ToBuf = b64 => new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)));

export async function generateKeypair() {
  const privKey = secp.utils.randomPrivateKey();
  const pubKey = secp.getPublicKey(privKey);
  return { 
    privKeyHex: bufToHex(privKey), 
    pubKeyHex: bufToHex(pubKey) 
  };
}

async function getPBKDF2Key(password, saltBuf) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBuf, iterations: 600000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, ["encrypt", "decrypt"]
  );
}

export async function encryptPrivateKey(privKeyHex, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getPBKDF2Key(password, salt);
  
  const privBuf = hexToBuf(privKeyHex);
  const encryptedBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, privBuf);
  
  return {
    encryptedPrivKey: bufToBase64(encryptedBuf),
    salt: bufToBase64(salt),
    iv: bufToBase64(iv)
  };
}

export async function decryptPrivateKey(encryptedB64, saltB64, ivB64, password) {
  const salt = base64ToBuf(saltB64);
  const iv = base64ToBuf(ivB64);
  const encryptedBuf = base64ToBuf(encryptedB64);
  
  const key = await getPBKDF2Key(password, salt);
  const privBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encryptedBuf);
  return bufToHex(privBuf);
}

async function hkdfDerive(sharedSecretBuf, saltBuf, infoStr) {
  const keyMaterial = await crypto.subtle.importKey("raw", sharedSecretBuf, { name: "HKDF" }, false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: saltBuf, info: new TextEncoder().encode(infoStr) },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, ["encrypt", "decrypt"]
  );
}

export async function encryptPayloadWithEphemeral(plaintext, recipientPubKeyHex, ePrivHex, ePubHex, infoStr = "sde-message-v1") {
  const sharedSecret = secp.getSharedSecret(hexToBuf(ePrivHex), hexToBuf(recipientPubKeyHex));
  
  const ePubBuf = hexToBuf(ePubHex);
  const aesKey = await hkdfDerive(sharedSecret, ePubBuf, infoStr);
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = typeof plaintext === "string" ? new TextEncoder().encode(plaintext) : plaintext;
  
  const ciphertextBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, encoded);
  const cipherBytes = new Uint8Array(ciphertextBuf);
  const tag = cipherBytes.slice(-16);
  const ciphertext = cipherBytes.slice(0, -16);
  
  return {
    ciphertext: bufToBase64(ciphertext),
    iv: bufToBase64(iv),
    tag: bufToBase64(tag),
    rawEncryptedBuf: ciphertextBuf
  };
}

export async function encryptPayload(plaintext, recipientPubKeyHex, infoStr = "sde-message-v1") {
  const { privKeyHex: ePrivHex, pubKeyHex: ePubHex } = await generateKeypair();
  const res = await encryptPayloadWithEphemeral(plaintext, recipientPubKeyHex, ePrivHex, ePubHex, infoStr);
  return {
    ephemeralPubKey: ePubHex,
    ePrivHex, // exposed for file reuse
    ...res
  };
}

export async function decryptPayload(ciphertextB64, ivB64, tagB64, ePubHex, myPrivKeyHex, isString = true, infoStr = "sde-message-v1") {
  const ePubBuf = hexToBuf(ePubHex);
  const sharedSecret = secp.getSharedSecret(hexToBuf(myPrivKeyHex), ePubBuf);
  const aesKey = await hkdfDerive(sharedSecret, ePubBuf, infoStr);
  
  const iv = base64ToBuf(ivB64);
  const tag = base64ToBuf(tagB64);
  let cipherBuf;
  if (typeof ciphertextB64 === "string") {
    cipherBuf = base64ToBuf(ciphertextB64);
  } else {
    cipherBuf = new Uint8Array(ciphertextB64); // ArrayBuffer directly
  }
  
  // re-append tag for Web Crypto
  const combined = new Uint8Array(cipherBuf.length + tag.length);
  combined.set(cipherBuf);
  combined.set(tag, cipherBuf.length);
  
  const decryptedBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, combined);
  if (isString) return new TextDecoder().decode(decryptedBuf);
  return decryptedBuf;
}
