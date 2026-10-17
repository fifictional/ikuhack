import { config } from "dotenv";
config({ path: ".env.local" });

import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { db } from "@/lib/db/client";
import { anchorPending } from "@/lib/solana/anchor";

/** Sanity check for demo day: wallet funded? RPC reachable? Then anchors anything pending and prints the link. */
async function main() {
  const rpc = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpc, "confirmed");
  const payer = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_SECRET_KEY!));
  const sol = (await connection.getBalance(payer.publicKey)) / 1e9;
  console.log(`cluster ${process.env.SOLANA_CLUSTER ?? "devnet"} · wallet ${payer.publicKey.toBase58()} · ${sol} SOL`);
  if (sol < 0.01) console.warn("Low balance: run npm run solana:keygen to airdrop devnet SOL.");
  const result = await anchorPending();
  console.log(result ?? "nothing new to anchor");
  await db().end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
