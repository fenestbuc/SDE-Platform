import * as secp256k1 from "@noble/curves/secp256k1";
import crypto from "crypto";
import { hkdfDeriveKey } from "./hkdf";

export function generateKeypair() {
  const privKey = secp256k1.secp256k1.utils.randomPrivateKey();
  const pubKey = secp256k1.secp256k1.getPublicKey(privKey);
  return { privKey, pubKey };
}

export function ecdhSharedSecret(privKey: Uint8Array, pubKey: Uint8Array): Uint8Array {
  return secp256k1.secp256k1.getSharedSecret(privKey, pubKey);
}

export function encryptMessage(plaintext: string, recipientPubKey: Uint8Array) {
  const { privKey: ePriv, pubKey: ePub } = generateKeypair();
  const sharedSecret = ecdhSharedSecret(ePriv, recipientPubKey);
  const aesKey = hkdfDeriveKey(sharedSecret, ePub, "sde-message-v1");
  
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  
  let ciphertext = cipher.update(plaintext, "utf8");
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return {
    ephemeralPubKey: Buffer.from(ePub).toString("hex"),
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptMessage(ciphertextBase64: string, ivBase64: string, tagBase64: string, ephemeralPubKeyHex: string, privKey: Uint8Array) {
  const ePub = Buffer.from(ephemeralPubKeyHex, "hex");
  const sharedSecret = ecdhSharedSecret(privKey, new Uint8Array(ePub));
  const aesKey = hkdfDeriveKey(sharedSecret, new Uint8Array(ePub), "sde-message-v1");
  
  const iv = Buffer.from(ivBase64, "base64");
  const tag = Buffer.from(tagBase64, "base64");
  const ciphertext = Buffer.from(ciphertextBase64, "base64");
  
  const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey, iv);
  decipher.setAuthTag(tag);
  
  let plaintext = decipher.update(ciphertext, undefined, "utf8");
  plaintext += decipher.final("utf8");
  
  return plaintext;
}
