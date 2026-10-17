import { after } from "next/server";
import { z } from "zod";
import { ACTORS, EVIDENCE_KINDS } from "@/lib/domain/types";
import { checkAuthenticity } from "@/lib/evidence/authenticity";
import { addEvidence } from "@/lib/evidence/store";
import { handle, type IdParams } from "@/lib/http";

const MAX_BYTES = 8 * 1024 * 1024;

export const POST = handle(async (req: Request, { params }: IdParams) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "file required" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "file too large (8MB max)" }, { status: 413 });
  const result = await addEvidence({
    caseId: (await params).id,
    uploadedBy: z.enum(ACTORS).parse(form.get("actor") ?? "tenant"),
    kind: z.enum(EVIDENCE_KINDS).parse(form.get("kind") ?? "photo"),
    mime: file.type || "application/octet-stream",
    bytes: new Uint8Array(await file.arrayBuffer()),
    filename: file.name,
    caption: form.get("caption")?.toString(),
    captureMethod: form.get("capture") === "live" ? "live" : "upload",
  });
  // Every photo gets the AI/edit check straight away, so the landlord sees a verdict without asking.
  if ((form.get("kind") ?? "photo") === "photo") {
    after(() => checkAuthenticity(result.evidenceId).catch((e) => console.warn("Upload photo check failed:", e instanceof Error ? e.message : e)));
  }
  return Response.json(result, { status: 201 });
});
