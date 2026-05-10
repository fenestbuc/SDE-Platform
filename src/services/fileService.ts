import * as fs from "fs/promises";
import * as path from "path";
import { config } from "../config";
import * as crypto from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let s3Client: S3Client | null = null;
if (config.S3_BUCKET && config.S3_REGION) {
  s3Client = new S3Client({
    region: config.S3_REGION,
    endpoint: config.S3_ENDPOINT,
    credentials: (config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY) ? {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    } : undefined,
    forcePathStyle: !!config.S3_ENDPOINT, // useful for minio/tigris
  });
}

export class FileService {
  static async getPresignedUploadUrl(filename: string, contentType: string): Promise<{ url: string; fileId: string }> {
    const id = crypto.randomUUID();
    
    // Auto mock for local E2E where AWS creds might be missing or minio is slow
    if (process.env.NODE_ENV === 'test' || (!config.AWS_ACCESS_KEY_ID && process.env.NODE_ENV !== 'production')) {
       return { url: '/api/messages/mock-upload/' + id, fileId: id };
    }

    if (s3Client && config.S3_BUCKET) {
      const command = new PutObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: id,
        ContentType: contentType
      });
      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return { url, fileId: id };
    }
    
    throw new Error("S3 is not configured for direct uploads");
  }

  static async saveFile(buffer: Buffer): Promise<string> {
    const id = crypto.randomUUID();
    
    if (s3Client && config.S3_BUCKET) {
      await s3Client.send(new PutObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: id,
        Body: buffer
      }));
      return id;
    }

    const filePath = path.join(config.UPLOAD_DIR, id);
    await fs.mkdir(config.UPLOAD_DIR, { recursive: true });
    await fs.writeFile(filePath, buffer);
    return id;
  }

  static async getFileUrl(fileId: string): Promise<string> {
    if (process.env.NODE_ENV === 'test' || (!config.AWS_ACCESS_KEY_ID && process.env.NODE_ENV !== 'production')) {
       return 'http://localhost:3000/api/messages/mock-download/' + fileId;
    }

    if (s3Client && config.S3_BUCKET) {
      const command = new GetObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: fileId
      });
      return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    }
    throw new Error("S3 is not configured for direct downloads");
  }

  static async getFile(fileId: string): Promise<Buffer> {
    if (s3Client && config.S3_BUCKET) {
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: fileId
      }));
      if (!response.Body) throw new Error("Empty body from S3");
      const bytes = await response.Body.transformToByteArray();
      return Buffer.from(bytes);
    }

    const filePath = path.join(config.UPLOAD_DIR, fileId);
    return fs.readFile(filePath);
  }

  static async deleteFile(fileId: string): Promise<void> {
    if (s3Client && config.S3_BUCKET) {
      try {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: config.S3_BUCKET,
          Key: fileId
        }));
      } catch (e) {
        console.warn("Failed to delete file from S3", fileId);
      }
      return;
    }

    try {
      const filePath = path.join(config.UPLOAD_DIR, fileId);
      await fs.unlink(filePath);
    } catch (e) {
      console.warn("Failed to delete file", fileId);
    }
  }
}
