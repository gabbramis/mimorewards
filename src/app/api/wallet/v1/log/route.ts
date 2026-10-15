import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (body?.logs && Array.isArray(body.logs)) {
      console.warn("[Apple Wallet Client Log]:", body.logs.join("\n"));
    } else {
      console.warn("[Apple Wallet Client Log]:", body);
    }
    return new Response(null, { status: 200 });
  } catch (err) {
    console.error("[Apple Wallet Client Log Error]:", err);
    return new Response(null, { status: 200 });
  }
}
