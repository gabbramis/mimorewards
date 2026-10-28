import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveNfcContext, toCustomerView } from "@/lib/mimo-nfc";
import { createCustomerSession, customerCookieName } from "@/lib/mimo-customer-session";
import { cleanUruguayPhone, findCustomersByMobile, getUruguayMobileVariants, normalizeCustomerPhone, normalizeUruguayMobile } from "@/lib/customer-phone";
import { CUSTOMER_CONSENT_VERSION } from "@/lib/customer-consent";
import { scheduleCustomerWalletUpdate } from "@/lib/wallet-notifications";

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

  if (result.accepted) {
    scheduleCustomerWalletUpdate({
      customerId: customer.id,
      businessId: context.businessId,
      currentStamps: result.current_stamps,
      targetStamps: result.target_stamps,
      notificationMessage: `¡Sumaste sellos! Llevás ${result.current_stamps} de ${result.target_stamps}.`,
    });
  }

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

    // Normalizar formato de celular para trabajar con número completo con '+'
    const phone = normalizeCustomerPhone(rawPhone) || normalizeUruguayMobile(rawPhone) || cleanUruguayPhone(rawPhone);
    if (!phone) {
      return NextResponse.json({ error: "Ingresá un número de celular válido." }, { status: 400 });
    }

    const context = await resolveNfcContext(supabase, nfcId);
    if (!context.active) return NextResponse.json({ error: "Este programa está pausado." }, { status: 410 });

    // 1. Verificación previa anti-duplicados buscando todas las variantes de formato
    const variants = getUruguayMobileVariants(phone);
    let existingCustomer: any = null;

    // Buscar coincidencia directa priorizando la tarjeta con más sellos acumulados y última actividad
    const { data: directMatch } = await supabase
      .from("customers")
      .select("id, unique_code, first_name, last_name, phone, birthdate, current_stamps, total_visits, created_at, updated_at")
      .eq("business_id", context.businessId)
      .in("phone", variants)
      .order("current_stamps", { ascending: false })
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (directMatch) {
      existingCustomer = directMatch;
    } else if (phone) {
      // Fallback escaneando variantes con caracteres especiales (guiones, espacios)
      const matches = await findCustomersByMobile(supabase, context.businessId, phone);
      if (matches.length > 0) {
        existingCustomer = matches[0];
      }
    }

    // 2. Si ya existe, NO creamos un registro duplicado: retornamos la tarjeta existente directamente
    if (existingCustomer) {
      // Normalizamos el formato del teléfono si estaba sin +598
      if (phone && existingCustomer.phone !== phone) {
        await supabase
          .from("customers")
          .update({ phone, updated_at: new Date().toISOString() })
          .eq("id", existingCustomer.id);
        existingCustomer.phone = phone;
      }

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

    // 3. Flujo de registro nuevo (con inserción segura y manejo de concurrencia)
    const acceptedAt = new Date().toISOString();
    let createdCustomer: any = null;

    const { data: newCustomer, error: customerError } = await supabase
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
        updated_at: acceptedAt,
      })
      .select("id, unique_code, first_name, last_name, phone, birthdate, current_stamps, total_visits")
      .single();

    if (customerError) {
      // Si ocurrió una colisión concurrente con la misma (business_id, phone)
      if (customerError.code === "23505" || customerError.message?.includes("customers_business_id_phone_key")) {
        const { data: raceCustomer } = await supabase
          .from("customers")
          .select("id, unique_code, first_name, last_name, phone, birthdate, current_stamps, total_visits")
          .eq("business_id", context.businessId)
          .eq("phone", phone)
          .order("current_stamps", { ascending: false })
          .order("updated_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (raceCustomer) {
          const stamp = await creditStamp(supabase, raceCustomer, context, crypto.randomUUID());
          const customer = toCustomerView({ ...raceCustomer, current_stamps: stamp.current_stamps }, context);
          return responseWithCustomerCookie({
            customer,
            context,
            isNewCustomer: false,
            stampAdded: stamp.accepted,
            message: "Te reconocimos y sumamos tu sello.",
          }, customer.id, context.businessId);
        }
      }
      throw customerError;
    }

    createdCustomer = newCustomer;

    const { error: cardError } = await supabase.from("loyalty_cards").upsert(
      {
        customer_id: createdCustomer.id,
        business_id: context.businessId,
        current_stamps: 0,
      },
      { onConflict: "customer_id, business_id", ignoreDuplicates: true }
    );
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
