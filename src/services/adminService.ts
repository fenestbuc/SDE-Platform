import { db } from "../db";

export class AdminService {
  static async getStats() {
    const usersCount = await db.user.count();
    const messagesCount = await db.message.count();
    
    // Total file storage
    const attachments = await db.attachment.aggregate({
      _sum: { fileSize: true }
    });
    
    return {
      users: usersCount,
      messages: messagesCount,
      storageBytes: attachments._sum.fileSize || 0
    };
  }

  static async listUsers(page = 1, limit = 20) {
    return db.user.findMany({
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, username: true, email: true, role: true, createdAt: true, lastLoginAt: true,
        _count: { select: { sentMessages: true, receivedMessages: true } }
      }
    });
  }

  static async deleteUser(adminId: string, targetUserId: string) {
    if (adminId === targetUserId) throw { status: 400, message: "Cannot delete yourself" };
    // The DB has Cascade deletes for messages, but attachments file payloads need manual cleanup
    // We'll let the user record delete, and the cron/garbage collector handle orphaned files 
    // or just leave it for v2.
    await db.user.delete({ where: { id: targetUserId } });
  }
}
