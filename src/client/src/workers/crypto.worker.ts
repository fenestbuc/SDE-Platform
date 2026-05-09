import * as secp from "@noble/curves/secp256k1";
import { bufToHex, hexToBuf, bufToBase64, base64ToBuf, getPBKDF2Key, hkdfDerive } from "../utils/crypto-helpers";

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

    else if (type === "GENERATE_AND_ENCRYPT_KEY") {
      const { password } = payload;
      const privKey = secp.secp256k1.utils.randomPrivateKey();
      const pubKey = secp.secp256k1.getPublicKey(privKey);
      
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await getPBKDF2Key(password, salt);
      
      const encryptedBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, privKey as any);
      
      self.postMessage({ id, success: true, result: {
        pubKeyHex: bufToHex(pubKey),
        encryptedPrivKey: bufToBase64(encryptedBuf),
        salt: bufToBase64(salt),
        iv: bufToBase64(iv)
      }});
    }

    else if (type === "ENCRYPT_PAYLOAD") {
      const { plaintext, recipientPubKeyHex, infoStr, existingEPrivHex, existingEPubHex } = payload;
      
      let ePrivHex = existingEPrivHex;
      let ePubHex = existingEPubHex;
      
      if (!ePrivHex || !ePubHex) {
        const privKey = secp.secp256k1.utils.randomPrivateKey();
        ePrivHex = bufToHex(privKey);
        ePubHex = bufToHex(secp.secp256k1.getPublicKey(privKey));
      }
      
      const sharedSecret = secp.secp256k1.getSharedSecret(hexToBuf(ePrivHex), hexToBuf(recipientPubKeyHex));
      const ePubBuf = hexToBuf(ePubHex);
      const aesKey = await hkdfDerive(sharedSecret, ePubBuf, infoStr || "sde-message-v1");
      
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = typeof plaintext === "string" ? new TextEncoder().encode(plaintext) : new Uint8Array(plaintext);
      
      const ciphertextBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, encoded);
      const cipherBytes = new Uint8Array(ciphertextBuf);
      const tag = cipherBytes.slice(-16);
      const ciphertext = cipherBytes.slice(0, -16);
      
      const result = {
        ephemeralPubKey: ePubHex,
        ePrivHex,
        ciphertext: bufToBase64(ciphertext),
        iv: bufToBase64(iv),
        tag: bufToBase64(tag),
        rawEncryptedBuf: ciphertextBuf
      };
      
      self.postMessage({ id, success: true, result });
    }

    else if (type === "DECRYPT_PAYLOAD") {
      if (!decryptedPrivateKey) throw new Error("Private key not loaded in worker");
      
      const { ciphertextB64, ivB64, tagB64, ePubHex, isString, infoStr, rawCiphertextBuf } = payload;
      
      const ePubBuf = hexToBuf(ePubHex);
      const sharedSecret = secp.secp256k1.getSharedSecret(hexToBuf(decryptedPrivateKey), ePubBuf);
      const aesKey = await hkdfDerive(sharedSecret, ePubBuf, infoStr || "sde-message-v1");
      
      const iv = base64ToBuf(ivB64);
      const tag = base64ToBuf(tagB64);
      let cipherBuf;
      if (rawCiphertextBuf) {
        cipherBuf = new Uint8Array(rawCiphertextBuf);
      } else if (typeof ciphertextB64 === "string") {
        cipherBuf = base64ToBuf(ciphertextB64);
      } else {
        cipherBuf = new Uint8Array(ciphertextB64);
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
    
  } catch (err: any) {
    self.postMessage({ id, success: false, error: err.message });
  }
};
