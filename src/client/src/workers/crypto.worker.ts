import * as secp from "@noble/curves/secp256k1";
import { bufToHex, hexToBuf, base64ToBuf, getPBKDF2Key, hkdfDerive, bufToBase64 } from "../utils/crypto-helpers";

let decryptedPrivateKey: string | null = null;
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

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
      decryptedPrivateKey = bufToHex(privBuf as any);
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
      
      if (!decryptedPrivateKey) throw new Error("Private key not loaded in worker for signing");

      const result = {
        ephemeralPubKey: ePubHex,
        ePrivHex,
        ciphertext: bufToBase64(ciphertext),
        iv: bufToBase64(iv),
        tag: bufToBase64(tag),
        rawEncryptedBuf: ciphertextBuf,
        signature: ""
      };

      const dataToSign = new TextEncoder().encode(result.ephemeralPubKey + result.ciphertext);
      const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", dataToSign));
      const sig = secp.secp256k1.sign(hash, hexToBuf(decryptedPrivateKey));
      result.signature = sig.toCompactHex();
      
      self.postMessage({ id, success: true, result });
    }

    else if (type === "DECRYPT_PAYLOAD") {
      if (!decryptedPrivateKey) throw new Error("Private key not loaded in worker");
      
      const { ciphertextB64, ivB64, tagB64, ePubHex, isString, infoStr, rawCiphertextBuf, signatureHex, senderPubKeyHex } = payload;
      
      if (signatureHex && senderPubKeyHex) {
        const dataToVerify = new TextEncoder().encode(ePubHex + ciphertextB64);
        const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", dataToVerify));
        const isValid = secp.secp256k1.verify(signatureHex, hash, hexToBuf(senderPubKeyHex));
        if (!isValid) throw new Error("Digital signature verification failed! Message may be tampered with or sender is spoofed.");
      }
      
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
    
    // NEW CHUNKED ENCRYPTION
    else if (type === "ENCRYPT_FILE_CHUNKED") {
      const { fileBlob, recipientPubKeyHex, infoStr, existingEPrivHex, existingEPubHex } = payload;
      
      let ePrivHex = existingEPrivHex;
      let ePubHex = existingEPubHex;
      if (!ePrivHex || !ePubHex) throw new Error("ePriv/ePub required for file encryption");
      
      const sharedSecret = secp.secp256k1.getSharedSecret(hexToBuf(ePrivHex), hexToBuf(recipientPubKeyHex));
      const ePubBuf = hexToBuf(ePubHex);
      const aesKey = await hkdfDerive(sharedSecret, ePubBuf, infoStr || "sde-file-v1");
      
      const totalChunks = Math.ceil(fileBlob.size / CHUNK_SIZE);
      const encryptedChunks: Blob[] = [];
      
      // Shared file-level IV to store in the DB (for the first chunk or metadata)
      // Actually, we can generate a single random IV to pass back, but encrypt each chunk with a unique sub-IV.
      // Let's generate a 12-byte random base IV.
      const baseIv = crypto.getRandomValues(new Uint8Array(12));
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(fileBlob.size, start + CHUNK_SIZE);
        const chunkBlob = fileBlob.slice(start, end);
        const chunkBuf = await chunkBlob.arrayBuffer();
        
        // Chunk IV: 8 bytes random, 4 bytes counter
        const chunkIv = new Uint8Array(12);
        crypto.getRandomValues(chunkIv.subarray(0, 8)); // 8 bytes random nonce
        new DataView(chunkIv.buffer).setUint32(8, i, false); // 4 bytes counter
        
        const ciphertextBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv: chunkIv }, aesKey, chunkBuf);
        
        // We append the 12-byte chunkIv to the ciphertextBuf so we can decrypt it later
        // Structure: [chunkIv (12 bytes)] [ciphertext + tag]
        const chunkWithIv = new Uint8Array(chunkIv.length + ciphertextBuf.byteLength);
        chunkWithIv.set(chunkIv, 0);
        chunkWithIv.set(new Uint8Array(ciphertextBuf), chunkIv.length);
        
        encryptedChunks.push(new Blob([chunkWithIv]));
        
        self.postMessage({ type: "PROGRESS", id, payload: { progress: Math.round(((i + 1) / totalChunks) * 100) } });
      }
      
      const finalBlob = new Blob(encryptedChunks);
      
      self.postMessage({ id, success: true, result: {
        ephemeralPubKey: ePubHex,
        iv: bufToBase64(baseIv),
        tag: bufToBase64(new Uint8Array(16)), // Dummy tag for DB compatibility
        rawEncryptedBlob: finalBlob
      }});
    }
    
    // NEW CHUNKED DECRYPTION
    else if (type === "DECRYPT_FILE_CHUNKED") {
      if (!decryptedPrivateKey) throw new Error("Private key not loaded in worker");
      const { encryptedFileBlob, ePubHex, infoStr } = payload;
      
      const ePubBuf = hexToBuf(ePubHex);
      const sharedSecret = secp.secp256k1.getSharedSecret(hexToBuf(decryptedPrivateKey), ePubBuf);
      const aesKey = await hkdfDerive(sharedSecret, ePubBuf, infoStr || "sde-file-v1");
      
      const decryptedChunks: Blob[] = [];
      let offset = 0;
      let totalProcessed = 0;
      const totalSize = encryptedFileBlob.size;
      
      // We don't know exact chunk count easily without parsing, so we iterate
      // But wait! AES-GCM ciphertext size = plaintext size + 16 (tag).
      // Plus 12 bytes IV = + 28 bytes per chunk.
      // Maximum chunk ciphertext size = CHUNK_SIZE + 28.
      const ENCRYPTED_CHUNK_MAX = CHUNK_SIZE + 28;
      
      while (offset < totalSize) {
        const end = Math.min(totalSize, offset + ENCRYPTED_CHUNK_MAX);
        const chunkBlob = encryptedFileBlob.slice(offset, end);
        const chunkBuf = await chunkBlob.arrayBuffer();
        
        const chunkIv = new Uint8Array(chunkBuf.slice(0, 12));
        const ciphertextWithTag = chunkBuf.slice(12);
        
        const decryptedBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: chunkIv }, aesKey, ciphertextWithTag);
        decryptedChunks.push(new Blob([decryptedBuf]));
        
        offset += chunkBuf.byteLength;
        totalProcessed += chunkBuf.byteLength;
        
        self.postMessage({ type: "PROGRESS", id, payload: { progress: Math.round((totalProcessed / totalSize) * 100) } });
      }
      
      const finalBlob = new Blob(decryptedChunks);
      self.postMessage({ id, success: true, result: { decryptedBlob: finalBlob } });
    }
    
  } catch (err: any) {
    self.postMessage({ id, success: false, error: err.message });
  }
};
