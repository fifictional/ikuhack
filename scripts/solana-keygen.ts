import { config } from "dotenv";
config({ path: ".env.local" });

import { appendFile, readFile } from "node:fs/promises";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Creates a throwaway DEVNET keypair for anchoring, writes it to .env.local,
 * and requests a devnet airdrop. Devnet SOL has no value. Never reuse this key on mainnet.
 */
async function main() {
  const existing = await readFile(".env.local", "utf8").catch(() => "");
  if (/^SOLANA_SECRET_KEY=.+/m.test(existing)) {
    console.log("SOLANA_SECRET_KEY already set in .env.local — skipping keygen.");
  } else {
    const kp = Keypair.generate();
    await appendFile(".env.local", `\nSOLANA_SECRET_KEY=${bs58.encode(kp.secretKey)}\n`);
    process.env.SOLANA_SECRET_KEY = bs58.encode(kp.secretKey);
    console.log(`Wrote SOLANA_SECRET_KEY to .env.local (public key ${kp.publicKey.toBase58()})`);
  }
  const kp = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_SECRET_KEY!));
  const connection = new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
  try {
    const sig = await connection.requestAirdrop(kp.publicKey, LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
    console.log("Airdropped 1 devnet SOL.");
  } catch {
    console.log(`Airdrop rate-limited. Fund ${kp.publicKey.toBase58()} at https://faucet.solana.com (devnet).`);
  }
  console.log(`Balance: ${(await connection.getBalance(kp.publicKey)) / LAMPORTS_PER_SOL} SOL`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
