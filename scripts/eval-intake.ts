import { config } from "dotenv";
config({ path: ".env.local" });

import { extractIntake } from "@/lib/ai/intake";
import { INTAKE_FIXTURES } from "@/lib/ai/intake.fixtures";

/**
 * Scores Gemini intake against realistic reports.
 *   npm run eval:intake                         → uses GEMINI_MODEL
 *   npm run eval:intake -- gemini-3.8-flash     → try another model
 * Severity matters most: under-rating an emergency is the costly mistake.
 */
async function main() {
  const model = process.argv[2];
  if (model) process.env.GEMINI_MODEL = model;
  // Measure one model fairly: no fallback, and pace calls under the free tier's 5 requests/min.
  process.env.GEMINI_FALLBACK_MODELS = "";
  const paceMs = Number(process.env.EVAL_PACE_MS ?? 13_000);
  console.log(`model: ${process.env.GEMINI_MODEL ?? "(default)"}\n`);

  let score = { category: 0, severity: 0, vulnerable: 0, language: 0, underRated: 0 };
  const started = Date.now();
  const results = [];
  for (const [i, f] of INTAKE_FIXTURES.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, paceMs));
    const t0 = Date.now();
    try {
      results.push({ f, d: await extractIntake({ text: f.text }), ms: Date.now() - t0 });
    } catch (e) {
      results.push({ f, error: (e instanceof Error ? e.message : String(e)).slice(0, 160), ms: Date.now() - t0 });
    }
  }

  const rank = ["routine", "significant", "emergency"];
  for (const r of results) {
    if ("error" in r) {
      console.log(`✗ ERROR ${r.f.text.slice(0, 50)}… — ${r.error}`);
      continue;
    }
    const { f, d } = r;
    const severity = d.assessedSeverity;
    const ok = {
      category: f.category.includes(d.category),
      severity: f.severity.includes(severity),
      vulnerable: d.vulnerableOccupantMentioned === f.vulnerable,
      language: d.detectedLanguage.toLowerCase().startsWith(f.language),
    };
    const under = rank.indexOf(severity) < Math.min(...f.severity.map((s) => rank.indexOf(s)));
    score = {
      category: score.category + Number(ok.category),
      severity: score.severity + Number(ok.severity),
      vulnerable: score.vulnerable + Number(ok.vulnerable),
      language: score.language + Number(ok.language),
      underRated: score.underRated + Number(under),
    };
    const mark = (b: boolean) => (b ? "✓" : "✗");
    console.log(
      `${mark(Object.values(ok).every(Boolean))} ${f.text.slice(0, 48).padEnd(48)} ` +
        `cat ${mark(ok.category)} ${d.category.padEnd(17)} sev ${mark(ok.severity)} ${severity.padEnd(11)} ` +
        `vuln ${mark(ok.vulnerable)} lang ${mark(ok.language)} ${d.detectedLanguage} ${r.ms}ms` +
        (under ? "  ⚠ UNDER-RATED" : ""),
    );
  }
  const n = INTAKE_FIXTURES.length;
  console.log(
    `\ncategory ${score.category}/${n} · severity ${score.severity}/${n} · vulnerable ${score.vulnerable}/${n} · ` +
      `language ${score.language}/${n} · under-rated ${score.underRated} · ${Date.now() - started}ms total`,
  );
  process.exitCode = score.underRated > 0 || score.category < n - 1 ? 1 : 0;
}

main().finally(() => setTimeout(() => process.exit(), 100));
