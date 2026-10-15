import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveNfcContext, toCustomerView } from "@/lib/mimo-nfc";
import { customerCookieName, readCustomerSession } from "@/lib/mimo-customer-session";
import { appleWalletConfigured } from "@/lib/wallet/appleWallet";
import { cookies } from "next/headers";
import { existsSync } from "node:fs";
import { join } from "node:path";

function googleWalletReady() {
  return Boolean(process.env.GOOGLE_WALLET_ISSUER_ID && existsSync(join(process.cwd(), "google-service-account.json")));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ nfcId: string }> },
) {
  const supabase = createAdminClient();
  const { nfcId } = await params;
  const context = await resolveNfcContext(supabase, nfcId);
  if (!context.active) return NextResponse.json({ error: "Este programa está pausado." }, { status: 410 });
  const cookieStore = await cookies();
  const customerId = readCustomerSession(cookieStore.get(customerCookieName(context.businessId))?.value);

  if (!customerId) {
    return NextResponse.json({ context, appleWalletReady: appleWalletConfigured(), googleWalletReady: googleWalletReady() }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id, unique_code, first_name, last_name, phone, birthdate, current_stamps, total_visits")
    .eq("id", customerId)
    .eq("business_id", context.businessId)
    .maybeSingle();

  return NextResponse.json({ context, customer: toCustomerView(customer, context), appleWalletReady: appleWalletConfigured(), googleWalletReady: googleWalletReady() }, { headers: { "Cache-Control": "private, no-store" } });
}
