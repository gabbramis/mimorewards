import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { parseLandingLead } from "@/lib/landing-leads";
import { notifyLandingLead } from "@/lib/lead-notifications";

// Best-effort duplicate protection without a database or storing phone numbers.
const recentSends = new Map<string, number>();

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Enviá la consulta desde el formulario de mimo." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "El formato de la consulta no es válido." }, { status: 415 });
  }
  let body: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Empty body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return NextResponse.json({ error: "La consulta es demasiado larga." }, { status: 413 });
      }
      chunks.push(value);
    }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return NextResponse.json({ error: "No pudimos leer la consulta. Intentá de nuevo." }, { status: 400 });
  }
  // Hidden trap for automated submissions. Never write these to the database.
  if (body && typeof body === "object" && "website" in body && body.website) {
    return NextResponse.json({ error: "No pudimos enviar la consulta. Recargá e intentá de nuevo." }, { status: 400 });
  }
  const parsed = parseLandingLead(body);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const key = createHash("sha256").update(parsed.lead!.phone).digest("hex");
  const now = Date.now();
  for (const [entry, time] of recentSends) if (now - time > 60000) recentSends.delete(entry);
  if (recentSends.has(key)) return NextResponse.json({ error: "Esperá un minuto antes de volver a enviar." }, { status: 429 });
  if (recentSends.size >= 1000) return NextResponse.json({ error: "Estamos recibiendo muchas consultas. Intentá en un minuto." }, { status: 429 });
  recentSends.set(key, now);
  try {
    if (!await notifyLandingLead(parsed.lead!)) throw new Error("Mail not accepted");
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    recentSends.delete(key);
    // No form data, provider diagnostics or credentials in public responses/logs.
    return NextResponse.json({ error: "No pudimos enviar tu consulta. Intentá de nuevo en unos minutos." }, { status: 503 });
  }
}
