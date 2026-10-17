import { lawGraph } from "@/lib/law/graph";
import { handle } from "@/lib/http";

/**
 * Returns the legal knowledge graph (nodes + edges). The UI uses this to show
 * "where a duty comes from". Swap the data source here for a Neo4j query later
 * without touching the client.
 */
export const GET = handle(async () => Response.json(lawGraph));
