import { handle } from "@/lib/http";
import { verifyLeaf } from "@/lib/solana/anchor";

/** Public: anyone holding a file's SHA-256 can check it was anchored, and when. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ hash: string }> }) => {
  const { hash } = await params;
  if (!/^[0-9a-f]{64}$/.test(hash)) return Response.json({ error: "expected a sha256 hex string" }, { status: 400 });
  return Response.json(await verifyLeaf(hash));
});
