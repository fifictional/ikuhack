import { extractIntake } from "@/lib/ai/intake";
import { fileToInline, handle } from "@/lib/http";

/** Tenant text + photos → structured draft for the tenant to confirm before a case is created. */
export const POST = handle(async (req: Request) => {
  const form = await req.formData();
  const text = String(form.get("text") ?? "");
  const photos = await Promise.all(form.getAll("photos").filter((f): f is File => f instanceof File).map(fileToInline));
  if (!text && photos.length === 0) return Response.json({ error: "Describe the problem or add a photo" }, { status: 400 });
  const draft = await extractIntake({ text: text || "(photo only)", photos });
  return Response.json({ draft });
});
