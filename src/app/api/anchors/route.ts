import { connection } from "next/server";
import { handle } from "@/lib/http";
import { explorerUrl, listAnchors } from "@/lib/solana/anchor";

/** Recent anchored batches, for the /verify page. */
export const GET = handle(async () => {
  await connection();
  const rows = await listAnchors(5);
  return Response.json({
    anchors: rows.map((a) => ({
      id: a.id,
      root: a.merkle_root,
      leaves: a.leaf_count,
      cluster: a.cluster,
      signature: a.tx_signature,
      url: a.tx_signature ? explorerUrl(a.tx_signature) : null,
      createdAt: a.created_at,
    })),
  });
});
