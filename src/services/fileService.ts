import fs from "fs/promises";
import path from "path";
import { config } from "../config";
import crypto from "crypto";

export class FileService {
  static async saveFile(buffer: Buffer): Promise<string> {
    const id = crypto.randomUUID();
    const filePath = path.join(config.UPLOAD_DIR, id);
    await fs.mkdir(config.UPLOAD_DIR, { recursive: true });
    await fs.writeFile(filePath, buffer);
    return id;
  }

  static async getFile(fileId: string): Promise<Buffer> {
    const filePath = path.join(config.UPLOAD_DIR, fileId);
    return fs.readFile(filePath);
  }

  static async deleteFile(fileId: string): Promise<void> {
    try {
      const filePath = path.join(config.UPLOAD_DIR, fileId);
      await fs.unlink(filePath);
    } catch (e) {
      console.warn("Failed to delete file", fileId);
    }
  }
}
