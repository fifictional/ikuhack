import { db } from "@/lib/db/client";
import { getLaw, getNow } from "@/lib/db/settings";
import {
  type Actor,
  type CaseEvent,
  type CaseState,
  type EventBody,
  type LandlordType,
  type Revision,
  parseEventBody,
} from "@/lib/domain/types";
import { diff } from "@/lib/engine/diff";
import { project } from "@/lib/engine/project";
import { eventHash } from "@/lib/evidence/hash";

/**
 * The only write path for cases. Every change is: append event → extend hash
 * chain → re-project → store revisions. Both UIs, the voice agent and the
 * sensor pipeline all go through here.
 */

interface EventRow {
  id: string;
  case_id: string;
  occurred_at: Date;
  actor: Actor;
  type: string;
  payload: Record<string, unknown>;
}

const toEvent = (r: EventRow): CaseEvent =>
  ({ ...r.payload, type: r.type, id: r.id, caseId: r.case_id, at: r.occurred_at.toISOString(), actor: r.actor }) as CaseEvent;

export async function loadEvents(caseId: string): Promise<CaseEvent[]> {
  const rows = await db()<EventRow[]>`
    SELECT id, case_id, occurred_at, actor, type, payload FROM case_events
    WHERE case_id = ${caseId} ORDER BY seq`;
  return rows.map(toEvent);
}

export async function appendEvent(
  caseId: string,
  actor: Actor,
  input: unknown,
  at?: Date,
): Promise<{ event: CaseEvent; state: CaseState; revisions: Revision[] }> {
  const body: EventBody = parseEventBody(input);
  const occurredAt = at ?? (await getNow());
  const { type, ...payload } = body;

  const event = await db().begin(async (tx) => {
    // Serialise appends per case so the hash chain stays linear.
    await tx`SELECT id FROM cases WHERE id = ${caseId} FOR UPDATE`;
    const [head] = await tx`SELECT hash FROM case_events WHERE case_id = ${caseId} ORDER BY seq DESC LIMIT 1`;
    const prevHash: string | null = head?.hash ?? null;
    const id = crypto.randomUUID();
    const hash = eventHash(prevHash, { id, caseId, at: occurredAt.toISOString(), actor, type, payload });
    const [row] = await tx<EventRow[]>`
      INSERT INTO case_events (id, case_id, occurred_at, actor, type, payload, prev_hash, hash)
      VALUES (${id}, ${caseId}, ${occurredAt}, ${actor}, ${type}, ${tx.json(payload as never)}, ${prevHash}, ${hash})
      RETURNING id, case_id, occurred_at, actor, type, payload`;
    return toEvent(row);
  });

  const { state, revisions } = await recompute(caseId);
  return { event, state, revisions };
}

/** Re-project one case at the current (demo) time and record what changed. */
export async function recompute(caseId: string): Promise<{ state: CaseState; revisions: Revision[] }> {
  const [c] = await db()`
    SELECT c.state, p.landlord_type FROM cases c JOIN properties p ON p.id = c.property_id WHERE c.id = ${caseId}`;
  if (!c) throw new Error(`Case ${caseId} not found`);
  const [events, now, law] = await Promise.all([loadEvents(caseId), getNow(), getLaw()]);

  const state = project(caseId, events, { now, law, landlordType: c.landlord_type as LandlordType });
  const revisions = diff((c.state as CaseState | null) ?? null, state);

  await db().begin(async (tx) => {
    await tx`UPDATE cases SET state = ${tx.json(state as never)}, updated_at = now() WHERE id = ${caseId}`;
    for (const r of revisions) {
      await tx`INSERT INTO case_revisions (case_id, at, kind, summary, detail)
               VALUES (${caseId}, ${now}, ${r.kind}, ${r.summary}, ${tx.json((r.detail ?? {}) as never)})`;
    }
  });
  return { state, revisions };
}

/** Re-project every open case — run after the clock moves or a law commences. */
export async function recomputeAll(): Promise<number> {
  const rows = await db()`SELECT id FROM cases WHERE coalesce(state->>'phase', '') NOT IN ('closed', 'resolved')`;
  for (const r of rows) await recompute(r.id);
  return rows.length;
}

export async function createCase(input: {
  propertyId: string;
  title: string;
  report: { description: string; channel: "voice" | "text" | "photo" | "web"; language?: string };
  facts?: EventBody[];
  at?: Date;
}): Promise<{ caseId: string; state: CaseState }> {
  const at = input.at ?? (await getNow());
  const [c] = await db()`
    INSERT INTO cases (property_id, title, opened_at) VALUES (${input.propertyId}, ${input.title}, ${at}) RETURNING id`;
  let result = await appendEvent(c.id, "tenant", { type: "REPORTED", ...input.report }, at);
  for (const f of input.facts ?? []) result = await appendEvent(c.id, "system", f, at);
  return { caseId: c.id, state: result.state };
}

export interface CaseRow {
  id: string;
  title: string;
  opened_at: Date;
  state: CaseState;
  address: string;
  postcode: string;
  landlord_type: LandlordType;
  tenant_name: string | null;
  preferred_language: string | null;
  landlord_name: string;
}

export async function getCase(caseId: string) {
  const [c] = await db()<CaseRow[]>`
    SELECT c.id, c.title, c.opened_at, c.state, p.address, p.postcode, p.landlord_type,
           t.name AS tenant_name, t.preferred_language, l.name AS landlord_name
    FROM cases c JOIN properties p ON p.id = c.property_id
    JOIN parties l ON l.id = p.landlord_id
    LEFT JOIN parties t ON t.id = p.tenant_id
    WHERE c.id = ${caseId}`;
  if (!c) return null;
  const [events, revisions] = await Promise.all([
    loadEvents(caseId),
    db()<{ at: Date; kind: string; summary: string }[]>`
      SELECT at, kind, summary FROM case_revisions WHERE case_id = ${caseId} ORDER BY at DESC LIMIT 100`,
  ]);
  return { ...c, events, revisions };
}

export async function listCases(filter: { landlordId?: string; tenantId?: string }) {
  return db()<Pick<CaseRow, "id" | "title" | "opened_at" | "state" | "address" | "landlord_type">[]>`
    SELECT c.id, c.title, c.opened_at, c.state, p.address, p.landlord_type
    FROM cases c JOIN properties p ON p.id = c.property_id
    WHERE (${filter.landlordId ?? null}::uuid IS NULL OR p.landlord_id = ${filter.landlordId ?? null})
      AND (${filter.tenantId ?? null}::uuid IS NULL OR p.tenant_id = ${filter.tenantId ?? null})
    ORDER BY c.opened_at DESC`;
}
