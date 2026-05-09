import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "../../src/services/authService";
import { db } from "../../src/db";
import { hashPassword } from "../../src/crypto/hash";

// Mock the db
vi.mock("../../src/db", () => ({
  db: {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    session: {
      create: vi.fn()
    }
  }
}));

describe("AuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register a new user successfully", async () => {
    (db.user.findFirst as any).mockResolvedValue(null);
    (db.user.create as any).mockResolvedValue({ id: "1", username: "alice" });

    const result = await AuthService.register({
      email: "alice@example.com",
      username: "alice",
      password: "password123",
      publicKey: "pub",
      encryptedPrivKey: "priv",
      salt: "salt",
      iv: "iv"
    });

    expect(result).toEqual({ id: "1", username: "alice" });
    expect(db.user.create).toHaveBeenCalled();
  });

  it("should fail registration if user exists", async () => {
    (db.user.findFirst as any).mockResolvedValue({ id: "1" });
    await expect(AuthService.register({
      email: "alice@example.com",
      username: "alice",
      password: "password123",
    })).rejects.toMatchObject({ code: "USER_EXISTS" });
  });
});
