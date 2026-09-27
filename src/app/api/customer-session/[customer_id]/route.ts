import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCustomerSession, customerCookieName } from "@/lib/mimo-customer-session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ customer_id: string }> },
) {
  const { customer_id: customerId } = await params;
  const supabase = createAdminClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, business_id")
    .eq("id", customerId)
    .maybeSingle();

  if (!customer) return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: customerCookieName(customer.business_id),
    value: createCustomerSession(customer.id),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
