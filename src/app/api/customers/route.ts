import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveNfcContext, toCustomerView } from "@/lib/mimo-nfc";
import { createCustomerSession, customerCookieName } from "@/lib/mimo-customer-session";
import { normalizeUruguayMobile } from "@/lib/customer-phone";
import { CUSTOMER_CONSENT_VERSION } from "@/lib/customer-consent";

type CustomerInput = {
  nfcId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  birthdate?: string;
  legalAccepted?: boolean;
  whatsappMarketingOptIn?: boolean;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function makeUniqueCode() {
  return `CLI-${Math.floor(100000 + Math.random() * 900000)}`;
}

async function creditStamp(supabase: any, customer: any, context: any, idempotencyKey: string) {
  const { data, error } = await supabase.rpc("record_loyalty_stamp", {
    p_customer_id: customer.id,
    p_business_id: context.businessId,
    p_method: "NFC",
    p_idempotency_key: idempotencyKey,
    p_cooldown_minutes: 180,
    p_enforce_cooldown: true,
  });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) throw new Error("No se pudo confirmar el sello.");
  return result;
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
    const input = (await request.json()) as CustomerInput;
    const nfcId = clean(input.nfcId);
    const firstName = clean(input.firstName);
    const lastName = clean(input.lastName);
    const rawPhone = clean(input.phone);
    const birthdate = clean(input.birthdate);

    if (!nfcId || !firstName || !lastName || !rawPhone || !birthdate) {
      return NextResponse.json({ error: "Completá todos los campos para continuar." }, { status: 400 });
    }
    if (input.legalAccepted !== true) {
      return NextResponse.json({ error: "Aceptá los términos y la política de privacidad para crear tu tarjeta." }, { status: 400 });
    }
    if (typeof input.whatsappMarketingOptIn !== "boolean") {
      return NextResponse.json({ error: "No pudimos registrar tu elección sobre promociones. Intentá de nuevo." }, { status: 400 });
    }

    const phone = normalizeUruguayMobile(rawPhone) || rawPhone;

    const context = await resolveNfcContext(supabase, nfcId);
    if (!context.active) return NextResponse.json({ error: "Este programa está pausado." }, { status: 410 });

    let existingQuery = supabase
      .from("customers")
      .select("id, unique_code, first_name, last_name, phone, birthdate, current_stamps, total_visits")
      .eq("business_id", context.businessId);

    if (phone !== rawPhone) {
      existingQuery = existingQuery.or(`phone.eq.${phone},phone.eq.${rawPhone}`);
    } else {
      existingQuery = existingQuery.eq("phone", phone);
    }

    const { data: existingCustomer, error: existingError } = await existingQuery.maybeSingle();

    if (existingError) throw existingError;

    if (existingCustomer) {
      const stamp = await creditStamp(supabase, existingCustomer, context, crypto.randomUUID());
      const customer = toCustomerView({ ...existingCustomer, current_stamps: stamp.current_stamps }, context);
      return responseWithCustomerCookie({
        customer,
        context,
        isNewCustomer: false,
        stampAdded: stamp.accepted,
        message: stamp.reason === "cooldown" ? "Ya registraste tu visita recientemente." : "Te reconocimos y sumamos tu sello.",
      }, customer.id, context.businessId);
    }

    const acceptedAt = new Date().toISOString();
    const { data: createdCustomer, error: customerError } = await supabase
      .from("customers")
      .insert({
        business_id: context.businessId,
        unique_code: makeUniqueCode(),
        first_name: firstName,
        last_name: lastName,
        phone,
        birthdate,
        current_stamps: 0,
        total_visits: 0,
        legal_accepted_at: acceptedAt,
        legal_version: CUSTOMER_CONSENT_VERSION,
        whatsapp_marketing_opt_in: input.whatsappMarketingOptIn,
        whatsapp_marketing_opt_in_at: input.whatsappMarketingOptIn ? acceptedAt : null,
      })
      .select("id, unique_code, first_name, last_name, phone, birthdate, current_stamps, total_visits")
      .single();

    if (customerError || !createdCustomer) {
      throw customerError || new Error("No se pudo crear el cliente.");
    }

    const { error: cardError } = await supabase.from("loyalty_cards").insert({
      customer_id: createdCustomer.id,
      business_id: context.businessId,
      current_stamps: 0,
    });
    if (cardError) throw cardError;

    const stamp = await creditStamp(supabase, createdCustomer, context, crypto.randomUUID());
    const customer = toCustomerView({ ...createdCustomer, current_stamps: stamp.current_stamps }, context);

    return responseWithCustomerCookie({
      customer,
      context,
      isNewCustomer: true,
      stampAdded: stamp.accepted,
      message: "¡Listo! Tu primer sello ya está adentro.",
    }, customer.id, context.businessId, 201);
  } catch (error: any) {
    console.error("Customer registration error:", error);
    return NextResponse.json({ error: error?.message || "No pudimos completar el registro." }, { status: 500 });
  }
}
