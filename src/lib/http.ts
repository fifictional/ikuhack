import { ZodError } from "zod";

/** Wraps a route handler so validation errors become 400s and everything else a logged 500. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ZodError) return Response.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
      console.error(err);
      return Response.json({ error: err instanceof Error ? err.message : "internal_error" }, { status: 500 });
    }
  };
}

export type IdParams = { params: Promise<{ id: string }> };

export async function fileToInline(f: File) {
  return { mimeType: f.type || "application/octet-stream", data: Buffer.from(await f.arrayBuffer()).toString("base64") };
}
