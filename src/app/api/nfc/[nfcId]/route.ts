import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveNfcContext, toCustomerView } from "@/lib/mimo-nfc";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ nfcId: string }> },
) {
  const supabase = await createClient();
  const { nfcId } = await params;
  const context = await resolveNfcContext(supabase, nfcId);
  if (!context.active) return NextResponse.json({ error: "Este programa está pausado." }, { status: 410 });
  const customerId = new URL(request.url).searchParams.get("customerId");

  if (!customerId) {
    return NextResponse.json({ context });
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id, unique_code, first_name, last_name, phone, birthdate, current_stamps, total_visits")
    .eq("id", customerId)
    .eq("business_id", context.businessId)
    .maybeSingle();

  return NextResponse.json({ context, customer: toCustomerView(customer, context) });
}
