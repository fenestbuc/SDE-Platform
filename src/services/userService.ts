import { db } from "../db";

export class UserService {
  static async getProfile(userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true, username: true, email: true, displayName: true,
        publicKey: true, encryptedPrivKey: true, salt: true, iv: true, createdAt: true
      }
    });
    if (!user) throw { status: 404, message: "User not found" };
    return user;
  }

  static async getPublicProfile(username: string) {
    const user = await db.user.findUnique({
      where: { username },
      select: { id: true, username: true, displayName: true, publicKey: true }
    });
    if (!user) throw { status: 404, message: "User not found" };
    return user;
  }

  static async searchUsers(query: string, limit = 20) {
    if (!query || query.length < 2) return [];
    return db.user.findMany({
      where: {
        OR: [
          { username: { contains: query } },
          { displayName: { contains: query } }
        ]
      },
      select: { id: true, username: true, displayName: true, publicKey: true },
      take: limit
    });
  }
}
