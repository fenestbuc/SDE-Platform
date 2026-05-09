import { db } from "../db";
import { FileService } from "./fileService";
import { notifyUser } from "../websocket/handler";

export class MessageService {
  static async sendMessage(senderId: string, data: any, file?: Express.Multer.File) {
    const recipient = await db.user.findUnique({ where: { id: data.recipientId } });
    if (!recipient) throw { status: 404, message: "Recipient not found" };

    const message = await db.message.create({
      data: {
        senderId,
        recipientId: data.recipientId,
        ephemeralPubKey: data.ephemeralPubKey,
        ciphertext: data.ciphertext,
        iv: data.iv,
        tag: data.tag,
        hasAttachment: !!file,
      }
    });

    if (file && data.fileIv && data.fileTag) {
      const storagePath = await FileService.saveFile(file.buffer);
      await db.attachment.create({
        data: {
          messageId: message.id,
          filename: file.originalname,
          storagePath,
          fileSize: file.size,
          contentType: file.mimetype,
          iv: data.fileIv,
          tag: data.fileTag
        }
      });
    }

    notifyUser(data.recipientId, {
      type: "new_message",
      messageId: message.id,
      senderId
    });

    return message;
  }

  static async getInbox(userId: string, page = 1, limit = 20) {
    return db.message.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        senderId: true,
        hasAttachment: true,
        readAt: true,
        createdAt: true,
        sender: { select: { username: true, displayName: true } }
      }
    });
  }

  static async getSent(userId: string, page = 1, limit = 20) {
    return db.message.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        recipientId: true,
        hasAttachment: true,
        readAt: true,
        createdAt: true,
        recipient: { select: { username: true, displayName: true } }
      }
    });
  }

  static async getMessageById(userId: string, messageId: string) {
    const message = await db.message.findUnique({
      where: { id: messageId },
      include: {
        attachment: { select: { filename: true, fileSize: true, contentType: true, iv: true, tag: true } },
        sender: { select: { username: true, displayName: true, publicKey: true } }
      }
    });
    
    if (!message) throw { status: 404, message: "Message not found" };
    if (message.senderId !== userId && message.recipientId !== userId) {
      throw { status: 403, message: "Forbidden" };
    }

    return message;
  }

  static async getAttachmentData(userId: string, messageId: string) {
    const message = await db.message.findUnique({
      where: { id: messageId },
      include: { attachment: true }
    });
    
    if (!message || !message.attachment) throw { status: 404, message: "Attachment not found" };
    if (message.senderId !== userId && message.recipientId !== userId) {
      throw { status: 403, message: "Forbidden" };
    }

    const buffer = await FileService.getFile(message.attachment.storagePath);
    return { buffer, attachment: message.attachment };
  }

  static async markAsRead(userId: string, messageId: string) {
    const message = await db.message.findUnique({ where: { id: messageId } });
    if (!message) return false;
    if (message.recipientId !== userId) return false;

    if (!message.readAt) {
      await db.message.update({
        where: { id: messageId },
        data: { readAt: new Date() }
      });
      notifyUser(message.senderId, {
        type: "read_receipt",
        messageId: message.id
      });
      return true;
    }
    return false;
  }

  static async deleteMessage(userId: string, messageId: string) {
    const message = await db.message.findUnique({
      where: { id: messageId },
      include: { attachment: true }
    });
    if (!message) return;
    if (message.senderId !== userId && message.recipientId !== userId) throw { status: 403, message: "Forbidden" };

    if (message.attachment) {
      await FileService.deleteFile(message.attachment.storagePath);
    }
    await db.message.delete({ where: { id: messageId } });
  }
}
