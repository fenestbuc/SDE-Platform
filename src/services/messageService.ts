import { db } from "../db";
import { FileService } from "./fileService";
import { notifyUser, isUserOnline } from "../websocket/handler";
import { NotificationService } from "./notificationService";

export class MessageService {
  static async sendMessage(senderId: string, data: any) {
    let recipientId = data.recipientId;
    
    // Group Message Support
    if (data.groupId) {
      const group = await db.group.findUnique({
        where: { id: data.groupId },
        include: { members: true }
      });
      if (!group) throw { status: 404, message: "Group not found" };
      if (!group.members.some(m => m.userId === senderId)) throw { status: 403, message: "Not a group member" };
    } else {
      const recipient = await db.user.findUnique({ where: { id: recipientId } });
      if (!recipient) throw { status: 404, message: "Recipient not found" };
    }

    const message = await db.message.create({
      data: {
        senderId,
        recipientId: recipientId || null,
        groupId: data.groupId || null,
        ephemeralPubKey: data.ephemeralPubKey,
        ciphertext: data.ciphertext,
        iv: data.iv,
        tag: data.tag,
        signature: data.signature,
        hasAttachment: !!data.storagePath,
        preKeyId: data.preKeyId || null // NEW in v6
      }
    });

    if (data.storagePath && data.fileIv && data.fileTag) {
      await db.attachment.create({
        data: {
          messageId: message.id,
          filename: data.filename || "attachment",
          storagePath: data.storagePath,
          fileSize: parseInt(data.fileSize) || 0,
          contentType: data.contentType || "application/octet-stream",
          iv: data.fileIv,
          tag: data.fileTag
        }
      });
    }

    if (recipientId) {
      notifyUser(recipientId, {
        type: "new_message",
        messageId: message.id,
        senderId
      });

      if (!isUserOnline(recipientId)) {
        const sender = await db.user.findUnique({ where: { id: senderId } });
        await NotificationService.sendPushToUser(recipientId, {
          title: "New Encrypted Message",
          body: `You received a new secure message from ${sender?.displayName || sender?.username}`
        });
      }
    } else if (data.groupId) {
      // Notify all group members except sender
      const group = await db.group.findUnique({ where: { id: data.groupId }, include: { members: true } });
      const sender = await db.user.findUnique({ where: { id: senderId } });
      for (const m of group!.members) {
        if (m.userId !== senderId) {
          notifyUser(m.userId, {
            type: "new_message",
            messageId: message.id,
            senderId,
            groupId: data.groupId
          });
          if (!isUserOnline(m.userId)) {
            await NotificationService.sendPushToUser(m.userId, {
              title: "New Group Message",
              body: `New message in ${group!.name} from ${sender?.displayName || sender?.username}`
            });
          }
        }
      }
    }

    return message;
  }

  static async getInbox(userId: string, page = 1, limit = 20) {
    return db.message.findMany({
      where: {
        OR: [
          { recipientId: userId },
          { group: { members: { some: { userId } } } }
        ]
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        senderId: true,
        groupId: true,
        hasAttachment: true,
        readAt: true,
        createdAt: true,
        sender: { select: { username: true, displayName: true } },
        group: { select: { name: true } }
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
        groupId: true,
        hasAttachment: true,
        readAt: true,
        createdAt: true,
        recipient: { select: { username: true, displayName: true } },
        group: { select: { name: true } }
      }
    });
  }

  static async getMessageById(userId: string, messageId: string) {
    const message = await db.message.findUnique({
      where: { id: messageId },
      include: {
        attachment: { select: { filename: true, fileSize: true, contentType: true, iv: true, tag: true } },
        sender: { select: { username: true, displayName: true, publicKey: true } },
        group: { include: { members: true } }
      }
    });
    
    if (!message) throw { status: 404, message: "Message not found" };
    
    if (message.groupId) {
      if (!message.group!.members.some(m => m.userId === userId)) {
        throw { status: 403, message: "Forbidden" };
      }
    } else {
      if (message.senderId !== userId && message.recipientId !== userId) {
        throw { status: 403, message: "Forbidden" };
      }
    }

    return message;
  }

  static async getAttachmentUrl(userId: string, messageId: string) {
    const message = await db.message.findUnique({
      where: { id: messageId },
      include: { attachment: true, group: { include: { members: true } } }
    });
    
    if (!message || !message.attachment) throw { status: 404, message: "Attachment not found" };
    
    if (message.groupId) {
      if (!message.group!.members.some(m => m.userId === userId)) {
        throw { status: 403, message: "Forbidden" };
      }
    } else {
      if (message.senderId !== userId && message.recipientId !== userId) {
        throw { status: 403, message: "Forbidden" };
      }
    }

    const url = await FileService.getFileUrl(message.attachment.storagePath);
    return url;
  }

  static async markAsRead(userId: string, messageId: string) {
    const message = await db.message.findUnique({ where: { id: messageId } });
    if (!message) return false;
    
    // For groups, read receipts are more complex. 
    // We'll skip setting readAt on the main message record for groups to avoid marking it read for everyone.
    if (message.groupId) return false;

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

