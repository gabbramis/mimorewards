import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveNfcContext, toCustomerView } from "@/lib/mimo-nfc";

type CustomerInput = {
  nfcId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  birthdate?: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function makeUniqueCode() {
  return `CLI-${Math.floor(10000 + Math.random() * 90000)}`;
}

async function creditStamp(supabase: any, customer: any, context: any) {
  const currentStamps = Number(customer.current_stamps || 0);
  const totalVisits = Number(customer.total_visits || 0);
  const newTotal = Math.min(currentStamps + 1, context.rewardTarget);
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("customers")
    .update({ current_stamps: newTotal, total_visits: totalVisits + 1, last_visit_at: now })
    .eq("id", customer.id);

  if (updateError) throw updateError;

  await supabase.from("stamp_logs").insert({
    customer_id: customer.id,
    business_id: context.businessId,
    method: "NFC",
  });
  await supabase
    .from("loyalty_cards")
    .update({ current_stamps: newTotal })
    .eq("customer_id", customer.id)
    .eq("business_id", context.businessId);

  return newTotal;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const input = (await request.json()) as CustomerInput;
    const nfcId = clean(input.nfcId);
    const firstName = clean(input.firstName);
    const lastName = clean(input.lastName);
    const phone = clean(input.phone);
    const birthdate = clean(input.birthdate);

    if (!nfcId || !firstName || !lastName || !phone || !birthdate) {
      return NextResponse.json({ error: "Completá todos los campos para continuar." }, { status: 400 });
    }

    const context = await resolveNfcContext(supabase, nfcId);
    if (!context.active) return NextResponse.json({ error: "Este programa está pausado." }, { status: 410 });
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id, unique_code, first_name, last_name, phone, birthdate, current_stamps, total_visits")
      .eq("business_id", context.businessId)
      .eq("phone", phone)
      .maybeSingle();

    if (existingCustomer) {
      const newTotal = await creditStamp(supabase, existingCustomer, context);
      const customer = toCustomerView({ ...existingCustomer, current_stamps: newTotal }, context);
      return NextResponse.json({
        customer,
        context,
        isNewCustomer: false,
        stampAdded: true,
        message: "Te reconocimos y sumamos tu sello.",
      });
    }

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
      })
      .select("id, unique_code, first_name, last_name, phone, birthdate, current_stamps, total_visits")
      .single();

    if (customerError || !createdCustomer) {
      throw customerError || new Error("No se pudo crear el cliente.");
    }

    // The table can be added when wallet provisioning is enabled. Registration
    // remains usable while that integration is still being prepared.
    await supabase.from("loyalty_cards").insert({
      customer_id: createdCustomer.id,
      business_id: context.businessId,
      current_stamps: 0,
    });

    const newTotal = await creditStamp(supabase, createdCustomer, context);
    const customer = toCustomerView({ ...createdCustomer, current_stamps: newTotal }, context);

    return NextResponse.json({
      customer,
      context,
      isNewCustomer: true,
      stampAdded: true,
      message: "¡Listo! Tu primer sello ya está adentro.",
    }, { status: 201 });
  } catch (error: any) {
    console.error("Customer registration error:", error);
    return NextResponse.json({ error: error?.message || "No pudimos completar el registro." }, { status: 500 });
  }
}
