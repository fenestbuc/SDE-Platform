import bcrypt from "bcrypt";
import crypto from "crypto";
import { promisify } from "util";

const pbkdf2 = promisify(crypto.pbkdf2);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function pbkdf2Derive(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const derivedKey = await pbkdf2(password, salt, 600000, 32, "sha256");
  return new Uint8Array(derivedKey);
}
