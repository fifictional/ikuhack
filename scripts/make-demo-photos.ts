import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdir, writeFile } from "node:fs/promises";
import { gemini } from "@/lib/ai/gemini";

/**
 * Generates the demo's before/after photos with Gemini's image model (no real tenant photos needed).
 * The "after" shots are edits of the "before" shot, so they show the same ceiling.
 *   npm run demo:photos   → public/demo/{before-mould,after-painted-over,after-fixed}.png
 * Needs a Gemini key with billing enabled: image models have no free-tier quota.
 */
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

async function generate(parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[]) {
  const res = await gemini().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: { responseModalities: ["IMAGE"] },
  });
  const img = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!img?.data) throw new Error(`No image returned: ${res.text ?? "empty response"}`);
  return { mimeType: img.mimeType ?? "image/png", data: img.data };
}

async function main() {
  await mkdir("public/demo", { recursive: true });
  const save = (name: string, data: string) => writeFile(`public/demo/${name}.png`, Buffer.from(data, "base64"));

  console.log("before…");
  const before = await generate([
    {
      text:
        "Realistic smartphone photo taken by a tenant, looking up at the corner of a small UK rental bathroom ceiling above a shower. " +
        "Patches of black mould spreading across the white ceiling and down the wall corner, some peeling paint, slightly dim lighting. No people, no text.",
    },
  ]);
  await save("before-mould", before.data);

  console.log("after (painted over)…");
  const bad = await generate([
    { inlineData: before },
    {
      text:
        "Edit this photo: the same ceiling corner after a quick cosmetic repair. Fresh white paint has been rolled over most of it, " +
        "but grey-black mould spots are clearly showing back through the paint in the corner above the shower, with a damp stain. Same angle and framing.",
    },
  ]);
  await save("after-painted-over", bad.data);

  console.log("after (properly fixed)…");
  const good = await generate([
    { inlineData: before },
    {
      text:
        "Edit this photo: the same ceiling corner after a proper repair. The mould is completely gone, the plaster is smooth and freshly painted clean white, " +
        "and a new extractor fan vent is fitted on the ceiling. Same angle and framing.",
    },
  ]);
  await save("after-fixed", good.data);
  console.log("✓ saved public/demo/*.png");
}

main()
  .catch((e) => {
    console.error(e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(), 100));
