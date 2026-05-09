import { db } from "../db";
import { hashPassword, verifyPassword } from "../crypto/hash";
import jwt from "jsonwebtoken";
import { config } from "../config";

export class AuthService {
  static async register(data: any) {
    const existingUser = await db.user.findFirst({
      where: { OR: [{ email: data.email }, { username: data.username }] }
    });
    if (existingUser) throw { status: 400, message: "Username or email already exists", code: "USER_EXISTS" };

    const pwdHash = await hashPassword(data.password);

    const user = await db.user.create({
      data: {
        email: data.email,
        username: data.username,
        passwordHash: pwdHash,
        publicKey: data.publicKey,
        encryptedPrivKey: data.encryptedPrivKey,
        salt: data.salt,
        iv: data.iv,
      }
    });
    return { id: user.id, username: user.username };
  }

  static async login(data: any) {
    const user = await db.user.findUnique({ where: { username: data.username } });
    if (!user) throw { status: 401, message: "Invalid credentials" };

    const valid = await verifyPassword(data.password, user.passwordHash);
    if (!valid) throw { status: 401, message: "Invalid credentials" };

    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const accessToken = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      config.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshTokenString = jwt.sign(
      { id: user.id },
      config.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    await db.session.create({
      data: {
        userId: user.id,
        token: refreshTokenString,
        type: "refresh",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    return { accessToken, refreshToken: refreshTokenString };
  }

  static async refresh(token: string) {
    try {
      const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET) as any;
      const session = await db.session.findUnique({ where: { token } });
      if (!session || session.expiresAt < new Date()) {
        if (session) await db.session.delete({ where: { id: session.id } });
        throw new Error();
      }

      const user = await db.user.findUnique({ where: { id: decoded.id } });
      if (!user) throw new Error();

      const accessToken = jwt.sign(
        { id: user.id, username: user.username, email: user.email, role: user.role },
        config.JWT_SECRET,
        { expiresIn: "15m" }
      );
      
      return { accessToken };
    } catch {
      throw { status: 401, message: "Invalid refresh token" };
    }
  }

  static async logout(token: string) {
    await db.session.deleteMany({ where: { token } });
  }
}
