import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveNfcContext, toCustomerView } from "@/lib/mimo-nfc";
import { createCustomerSession, customerCookieName } from "@/lib/mimo-customer-session";
import { findCustomersByMobile, normalizeUruguayMobile } from "@/lib/customer-phone";

type RecoverInput = {
  nfcId?: string;
  phone?: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function responseWithCustomerCookie(payload: unknown, customerId: string, businessId: string, status = 200) {
  const response = NextResponse.json(payload, { status });
  response.cookies.set({
    name: customerCookieName(businessId),
    value: createCustomerSession(customerId),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export async function POST(request: Request) {
  const supabase: any = createAdminClient();

  try {
    const input = (await request.json()) as RecoverInput;
    const nfcId = clean(input.nfcId);
    const phoneInput = clean(input.phone);
    const phone = normalizeUruguayMobile(phoneInput);

    if (!nfcId || !phoneInput) {
      return NextResponse.json({ error: "Completá tu número de celular para continuar." }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: "Ingresá un celular uruguayo válido, con o sin +598." }, { status: 400 });
    }

    const context = await resolveNfcContext(supabase, nfcId);
    if (!context.active) return NextResponse.json({ error: "Este programa está pausado." }, { status: 410 });

    const matches = await findCustomersByMobile(supabase, context.businessId, phone);
    if (matches.length > 1) {
      return NextResponse.json({ error: "Encontramos más de una tarjeta con ese número y no pudimos identificar cuál es la tuya." }, { status: 409 });
    }
    const customer = matches[0] || null;

    if (!customer) {
      return NextResponse.json({ error: "No encontramos una tarjeta registrada con este número en este local. Regístrate para comenzar a sumar." }, { status: 404 });
    }

    const customerView = toCustomerView(customer, context);

    return responseWithCustomerCookie({
      customer: customerView,
      context,
      message: "¡Qué bueno verte de nuevo! Ya recuperamos tu tarjeta.",
    }, customer.id, context.businessId);
  } catch (error: any) {
    console.error("Customer recovery error:", error);
    return NextResponse.json({ error: error?.message || "No pudimos recuperar tu tarjeta." }, { status: 500 });
  }
}
