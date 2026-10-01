import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { customerCookieName, readCustomerSession, readTapTestToken } from "@/lib/mimo-customer-session";
import { findNfcTag } from "@/lib/mimo-nfc";

type TapResult = {
  accepted: boolean;
  reason: string;
  current_stamps: number;
  target_stamps: number;
  log_id: string | null;
};

function firstResult(data: unknown): TapResult | null {
  if (Array.isArray(data)) return (data[0] as TapResult | undefined) || null;
  return (data as TapResult | null) || null;
}

async function processTap(request: NextRequest, nfcId: string, testToken?: string) {
  const supabase: any = createAdminClient();
  const tag = await findNfcTag(supabase, nfcId);

  if (!tag) {
    return { kind: "redirect" as const, destination: `/t/${encodeURIComponent(nfcId)}?error=nfc_not_found` };
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, active")
    .eq("id", tag.business_id)
    .maybeSingle();

  if (businessError || !business || tag.active === false || business.active === false) {
    return { kind: "redirect" as const, destination: `/t/${encodeURIComponent(nfcId)}?error=program_inactive` };
  }

  const cookieStore = await cookies();
  const customerId = readTapTestToken(testToken, nfcId) || readCustomerSession(cookieStore.get(customerCookieName(tag.business_id))?.value);
  if (!customerId) {
    return { kind: "redirect" as const, destination: `/t/${encodeURIComponent(nfcId)}` };
  }

  const requestKey = request.headers.get("x-idempotency-key") || crypto.randomUUID();
  const { data, error } = await supabase.rpc("record_loyalty_stamp", {
    p_customer_id: customerId,
    p_business_id: tag.business_id,
    p_method: "NFC",
    p_idempotency_key: requestKey,
    p_cooldown_minutes: 180,
    p_enforce_cooldown: true,
  });

  if (error) {
    console.error("NFC stamp error:", error);
    return { kind: "redirect" as const, destination: `/tarjeta/${encodeURIComponent(customerId)}?stamp=error` };
  }

  const result = firstResult(data);

  let status = result?.accepted ? "success" : result?.reason || "error";
  if (status.includes("cooldown")) {
    status = "cooldown";
  }

  return { kind: "redirect" as const, destination: `/tarjeta/${encodeURIComponent(customerId)}?stamp=${encodeURIComponent(status)}` };
}

export async function GET(request: NextRequest) {
  const nfcId = (request.nextUrl.searchParams.get("nfcId") || request.nextUrl.searchParams.get("tag") || "").trim();
  if (!nfcId) return NextResponse.json({ error: "Falta el identificador del NFC." }, { status: 400 });

  const result = await processTap(request, nfcId, request.nextUrl.searchParams.get("test") || undefined);
  if (result.kind === "redirect") return NextResponse.redirect(new URL(result.destination, request.url), 302);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const nfcId = String(body.nfcId || body.tag || "").trim();
  if (!nfcId) return NextResponse.json({ error: "Falta el identificador del NFC." }, { status: 400 });

  const result = await processTap(request, nfcId, typeof body.test === "string" ? body.test : undefined);
  if (result.kind === "redirect") return NextResponse.json({ redirectTo: result.destination });
  return NextResponse.json(result);
}
