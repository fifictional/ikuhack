import { config } from "dotenv";
config({ path: ".env.local" });

import { readFile, writeFile } from "node:fs/promises";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Creates a throwaway DEVNET keypair for anchoring, writes it to .env.local,
 * and requests a devnet airdrop. No prompts. Devnet SOL has no value; never reuse this key on mainnet.
 */
const AIRDROP_TIMEOUT_MS = 30_000;

const withTimeout = <T>(p: Promise<T>, ms: number, what: string) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${what} timed out`)), ms))]);

async function main() {
  const envFile = await readFile(".env.local", "utf8").catch(() => "");
  let secret = envFile.match(/^SOLANA_SECRET_KEY=(.+)$/m)?.[1]?.trim();

  if (secret) {
    console.log("✓ SOLANA_SECRET_KEY already set in .env.local — reusing it.");
  } else {
    const kp = Keypair.generate();
    secret = bs58.encode(kp.secretKey);
    // Fill the empty placeholder from .env.example if present, otherwise append.
    const next = /^SOLANA_SECRET_KEY=\s*$/m.test(envFile)
      ? envFile.replace(/^SOLANA_SECRET_KEY=\s*$/m, `SOLANA_SECRET_KEY=${secret}`)
      : `${envFile.trimEnd()}\nSOLANA_SECRET_KEY=${secret}\n`;
    await writeFile(".env.local", next);
    console.log("✓ Wrote a new devnet key to .env.local");
  }

  const kp = Keypair.fromSecretKey(bs58.decode(secret));
  const address = kp.publicKey.toBase58();
  console.log(`  Wallet address: ${address}`);

  const connection = new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
  console.log(`… Requesting 1 devnet SOL (up to ${AIRDROP_TIMEOUT_MS / 1000}s)`);
  try {
    const sig = await withTimeout(connection.requestAirdrop(kp.publicKey, LAMPORTS_PER_SOL), AIRDROP_TIMEOUT_MS, "Airdrop");
    await withTimeout(connection.confirmTransaction(sig, "confirmed"), AIRDROP_TIMEOUT_MS, "Airdrop confirmation");
    console.log("✓ Airdropped 1 devnet SOL");
  } catch (e) {
    console.log(`! Airdrop failed (${e instanceof Error ? e.message : e}). The devnet faucet is often rate-limited.`);
    console.log(`  Fund it manually: https://faucet.solana.com → paste ${address} → Devnet.`);
  }
  const balance = await withTimeout(connection.getBalance(kp.publicKey), 15_000, "Balance check").catch(() => null);
  console.log(balance === null ? "  Balance: unknown (RPC unreachable)" : `  Balance: ${balance / LAMPORTS_PER_SOL} SOL (each anchor costs ~0.000005)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
