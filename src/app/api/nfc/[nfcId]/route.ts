import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveNfcContext, toCustomerView } from "@/lib/mimo-nfc";
import { customerCookieName, readCustomerSession } from "@/lib/mimo-customer-session";
import { appleWalletConfigured } from "@/lib/wallet/appleWallet";
import { googleWalletConfigured } from "@/lib/wallet/googleWallet";
import { cookies } from "next/headers";

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
    return NextResponse.json({ context, appleWalletReady: appleWalletConfigured(), googleWalletReady: googleWalletConfigured() }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id, unique_code, first_name, last_name, phone, birthdate, current_stamps, total_visits")
    .eq("id", customerId)
    .eq("business_id", context.businessId)
    .maybeSingle();

  return NextResponse.json({ context, customer: toCustomerView(customer, context), appleWalletReady: appleWalletConfigured(), googleWalletReady: googleWalletConfigured() }, { headers: { "Cache-Control": "private, no-store" } });
}
