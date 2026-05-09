import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageService } from "../../src/services/messageService";
import { db } from "../../src/db";
import { notifyUser } from "../../src/websocket/handler";
import { FileService } from "../../src/services/fileService";

vi.mock("../../src/db", () => ({
  db: {
    user: {
      findUnique: vi.fn()
    },
    message: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    attachment: {
      create: vi.fn()
    }
  }
}));

vi.mock("../../src/websocket/handler", () => ({
  notifyUser: vi.fn()
}));

vi.mock("../../src/services/fileService", () => ({
  FileService: {
    saveFile: vi.fn()
  }
}));

describe("MessageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send a message successfully without attachment", async () => {
    (db.user.findUnique as any).mockResolvedValue({ id: "user2" });
    (db.message.create as any).mockResolvedValue({ id: "msg1" });

    await MessageService.sendMessage("user1", {
      recipientId: "user2",
      ephemeralPubKey: "epub",
      ciphertext: "ctx",
      iv: "iv1",
      tag: "tag1"
    });

    expect(db.message.create).toHaveBeenCalled();
    expect(notifyUser).toHaveBeenCalledWith("user2", expect.objectContaining({ type: "new_message", messageId: "msg1" }));
  });

  it("should send a message with attachment", async () => {
    (db.user.findUnique as any).mockResolvedValue({ id: "user2" });
    (db.message.create as any).mockResolvedValue({ id: "msg2" });
    (FileService.saveFile as any).mockResolvedValue("upload-path");

    await MessageService.sendMessage("user1", {
      recipientId: "user2",
      ephemeralPubKey: "epub",
      ciphertext: "ctx",
      iv: "iv1",
      tag: "tag1",
      fileIv: "fiv",
      fileTag: "ftag"
    }, { originalname: "test.txt", size: 100, mimetype: "text/plain", buffer: Buffer.from("test") } as any);

    expect(FileService.saveFile).toHaveBeenCalled();
    expect(db.attachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        messageId: "msg2",
        filename: "test.txt"
      })
    });
  });
});
