import * as secp from "@noble/curves/secp256k1";
import { bufToHex, hexToBuf, base64ToBuf, getPBKDF2Key, hkdfDerive } from "../utils/crypto-helpers";

let decryptedPrivateKey: string | null = null;

self.onmessage = async (e) => {
  const { type, payload, id } = e.data;
  
  try {
    if (type === "STORE_KEY") {
      const { encryptedB64, saltB64, ivB64, password } = payload;
      const salt = base64ToBuf(saltB64);
      const iv = base64ToBuf(ivB64);
      const encryptedBuf = base64ToBuf(encryptedB64);
      
      const key = await getPBKDF2Key(password, salt);
      const privBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encryptedBuf);
      decryptedPrivateKey = bufToHex(privBuf);
      
      self.postMessage({ id, success: true });
    }
    
    else if (type === "CLEAR_KEY") {
      decryptedPrivateKey = null;
      self.postMessage({ id, success: true });
    }

    else if (type === "DECRYPT_PAYLOAD") {
      if (!decryptedPrivateKey) throw new Error("Private key not loaded in worker");
      
      const { ciphertextB64, ivB64, tagB64, ePubHex, isString, infoStr } = payload;
      
      const ePubBuf = hexToBuf(ePubHex);
      const sharedSecret = secp.secp256k1.getSharedSecret(hexToBuf(decryptedPrivateKey), ePubBuf);
      const aesKey = await hkdfDerive(sharedSecret, ePubBuf, infoStr || "sde-message-v1");
      
      const iv = base64ToBuf(ivB64);
      const tag = base64ToBuf(tagB64);
      let cipherBuf;
      if (typeof ciphertextB64 === "string") {
        cipherBuf = base64ToBuf(ciphertextB64);
      } else {
        cipherBuf = new Uint8Array(ciphertextB64); // ArrayBuffer directly
      }
      
      const combined = new Uint8Array(cipherBuf.length + tag.length);
      combined.set(cipherBuf);
      combined.set(tag, cipherBuf.length);
      
      const decryptedBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, combined);
      
      if (isString) {
        self.postMessage({ id, success: true, result: new TextDecoder().decode(decryptedBuf) });
      } else {
        self.postMessage({ id, success: true, result: decryptedBuf });
      }
    }
    
    // Chunked encryption/decryption could be added here for Stream API processing
    
  } catch (err: any) {
    self.postMessage({ id, success: false, error: err.message });
  }
};
