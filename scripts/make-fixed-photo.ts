import { config } from "dotenv";
config({ path: ".env.local" });

import { readFile, writeFile } from "node:fs/promises";
import { gemini } from "@/lib/ai/gemini";

/**
 * Makes the demo's "properly fixed" after-shot by editing the REAL before photo (public/demo/before-mould-wall.jpg),
 * so the framing matches. Needs Gemini billing (image models have no free quota).
 *   npx tsx scripts/make-fixed-photo.ts
 */
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

async function main() {
  const data = (await readFile("public/demo/before-mould-wall.jpg")).toString("base64");
  const res = await gemini().models.generateContent({
    model: MODEL,
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType: "image/jpeg", data } },
        { text: "Edit this photo: the same wall corner after a proper repair. All the mould spots are completely gone and the walls are clean, smooth, freshly painted. Keep the same angle, framing, wooden trim at the bottom and the blue panel on the right. Keep it looking like an ordinary phone photo." },
      ],
    }],
    config: { responseModalities: ["IMAGE"] },
  });
  const img = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!img?.data) throw new Error(`No image returned: ${res.text ?? "empty response"}`);
  await writeFile("public/demo/after-fixed.png", Buffer.from(img.data, "base64"));
  console.log("saved public/demo/after-fixed.png");
}

main().catch((e) => { console.error(e?.message ?? e); process.exitCode = 1; }).finally(() => setTimeout(() => process.exit(), 100));
