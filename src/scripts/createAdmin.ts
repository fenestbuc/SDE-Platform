import { db } from "../db";
import { hashPassword } from "../crypto/hash";
import { generateKeypair } from "../crypto/ecies";
import * as secp256k1 from "@noble/curves/secp256k1";
import crypto from "crypto";
import { parseArgs } from "util";

async function run() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      username: { type: "string" },
      password: { type: "string" }
    }
  });

  if (!values.email || !values.username || !values.password) {
    console.error("Usage: npm run create-admin -- --email x --username y --password z");
    process.exit(1);
  }

  const { privKey, pubKey } = generateKeypair();
  const pwdHash = await hashPassword(values.password);

  // Derive encryption key
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.pbkdf2Sync(values.password, salt, 600000, 32, "sha256");

  // Encrypt privKey
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", derivedKey, iv);
  
  let encrypted = cipher.update(privKey);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();

  // combine ciphertext + tag for simple storage, or store tag separately.
  // Wait, in our schema we don't have encryptedPrivKeyTag! 
  // Let's just append the tag to the ciphertext: Buffer.concat([ciphertext, tag]).
  // Or in Web Crypto it's automatically appended.
  const encryptedPrivKey = Buffer.concat([encrypted, tag]).toString("base64");

  await db.user.create({
    data: {
      email: values.email,
      username: values.username,
      passwordHash: pwdHash,
      role: "admin",
      publicKey: Buffer.from(pubKey).toString("hex"),
      encryptedPrivKey: encryptedPrivKey,
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
    }
  });

  console.log("Admin created successfully!");
  process.exit(0);
}

run().catch(console.error);
