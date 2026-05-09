import { describe, it, expect } from "vitest";
import { generateKeypair, ecdhSharedSecret } from "../../src/crypto/ecies";

describe("Crypto", () => {
  it("should generate keypairs and compute shared secret correctly", () => {
    const alice = generateKeypair();
    const bob = generateKeypair();

    const aliceShared = ecdhSharedSecret(alice.privKey, bob.pubKey);
    const bobShared = ecdhSharedSecret(bob.privKey, alice.pubKey);

    expect(aliceShared).toEqual(bobShared);
  });
});
