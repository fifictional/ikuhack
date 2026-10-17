import { createHash } from "node:crypto";

export const sha256Hex = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");

/** Stable JSON (sorted keys) so the same event always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

/** Hash-chain link for a case event: H(prevHash || canonical(event)). */
export function eventHash(prevHash: string | null, event: Record<string, unknown>): string {
  return sha256Hex(`${prevHash ?? ""}|${canonicalJson(event)}`);
}
