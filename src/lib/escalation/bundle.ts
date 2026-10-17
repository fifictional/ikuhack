import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "@/lib/db/client";
import { getCase } from "@/lib/cases/service";
import { verifyLeaf } from "@/lib/solana/anchor";

/**
 * Evidence bundle PDF: cover, obligations, chronology, evidence index with
 * SHA-256 + Solana proof link, then the photos. Hand this to a solicitor,
 * the council or the Ombudsman.
 */
// Brand colours (see .claude/skills/docket-brand/SKILL.md).
const TEAL = rgb(0x12 / 255, 0x59 / 255, 0x51 / 255);
const INK = rgb(0x2b / 255, 0x26 / 255, 0x20 / 255);

export async function buildBundle(caseId: string): Promise<Uint8Array> {
  const c = await getCase(caseId);
  if (!c) throw new Error("Case not found");
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage();
  let y = page.getHeight() - 50;
  const line = (text: string, opts: { size?: number; bold?: boolean } = {}) => {
    const size = opts.size ?? 10;
    // pdf-lib's standard fonts are WinAnsi only; strip anything else.
    for (const chunk of wrap(text.replace(/[^\x20-\x7E£]/g, " "), 95)) {
      if (y < 50) {
        page = pdf.addPage();
        y = page.getHeight() - 50;
      }
      page.drawText(chunk, { x: 50, y, size, font: opts.bold ? bold : font, color: opts.bold ? TEAL : INK });
      y -= size + 4;
    }
  };

  line("Docket evidence bundle", { size: 18, bold: true });
  line(`${c.title} — ${c.address}`, { size: 12 });
  line(`Tenant: ${c.tenant_name ?? "-"}   Landlord: ${c.landlord_name}`);
  line(`Generated ${new Date().toISOString()}`);
  y -= 10;

  line("Duties", { size: 13, bold: true });
  for (const o of c.state.obligations) {
    line(`[${o.status.toUpperCase()}] ${o.party}: ${o.title} — due ${o.dueAt}`);
    const kind = !o.legalBasis.statutory ? "Docket target" : o.legalBasis.deadline === "law" ? "legal deadline" : "legal duty; deadline is Docket's target for a reasonable time";
    line(`    ${o.legalBasis.citation} (${kind})${o.legalBasis.url ? ` ${o.legalBasis.url}` : ""}`);
  }
  y -= 10;

  line("Chronology", { size: 13, bold: true });
  for (const e of c.events) line(`${e.at}  ${e.actor}  ${e.type}`);
  y -= 10;

  line("Evidence index", { size: 13, bold: true });
  const evidence = await db()`SELECT id, kind, mime, caption, sha256, bytes, created_at FROM evidence WHERE case_id = ${caseId} ORDER BY created_at`;
  for (const e of evidence) {
    const proof = await verifyLeaf(e.sha256);
    line(`${e.kind} ${e.caption ?? ""} — sha256 ${e.sha256}`);
    line(`    ${proof.anchored ? `Anchored on Solana: ${proof.url}` : "Not yet anchored"}`);
  }

  for (const e of evidence.filter((e) => e.mime === "image/jpeg" || e.mime === "image/png")) {
    const img = e.mime === "image/png" ? await pdf.embedPng(e.bytes) : await pdf.embedJpg(e.bytes);
    const p = pdf.addPage();
    const scale = Math.min(500 / img.width, 650 / img.height, 1);
    p.drawImage(img, { x: 50, y: p.getHeight() - 80 - img.height * scale, width: img.width * scale, height: img.height * scale });
    p.drawText(`${e.caption ?? e.kind} — sha256 ${e.sha256}`.slice(0, 110), { x: 50, y: p.getHeight() - 50, size: 9, font });
  }
  return pdf.save();
}

function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let cur = "";
    for (const word of para.split(" ")) {
      if ((cur + " " + word).trim().length > width) {
        out.push(cur);
        cur = word;
      } else cur = (cur + " " + word).trim();
    }
    out.push(cur);
  }
  return out;
}
