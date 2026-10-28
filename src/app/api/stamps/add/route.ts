import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessBusiness } from "@/lib/authz";
import { scheduleCustomerWalletUpdate } from "@/lib/wallet-notifications";
import { normalizeUruguayMobile, cleanUruguayPhone, getUruguayMobileVariants } from "@/lib/customer-phone";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Necesitás iniciar sesión para sumar un sello desde el panel." }, { status: 401 });

    const body = await request.json();
    const identifier = String(body.identifier || "").trim();
    const method = String(body.method || "MANUAL").toUpperCase();
    if (!identifier) return NextResponse.json({ error: "Falta el identificador del cliente." }, { status: 400 });
    if (!['QR', 'MANUAL'].includes(method)) return NextResponse.json({ error: "Método de sello inválido." }, { status: 400 });

    const supabase: any = createAdminClient();
    const businessId = typeof body.businessId === "string" ? body.businessId.trim() : null;

    let customerQuery = supabase
      .from("customers")
      .select("*")
      .limit(1);

    if (businessId) {
      customerQuery = customerQuery.eq("business_id", businessId);
    }

    let customerResult;
    if (UUID_PATTERN.test(identifier)) {
      customerResult = await customerQuery.eq("id", identifier).maybeSingle();
    } else {
      const variants = getUruguayMobileVariants(identifier);
      if (businessId) {
        let orFilter = `unique_code.eq.${identifier},phone.eq.${identifier}`;
        for (const v of variants) {
          if (v !== identifier) {
            orFilter += `,phone.eq.${v}`;
          }
        }
        customerResult = await customerQuery.or(orFilter).maybeSingle();
      } else {
        customerResult = await customerQuery.eq("unique_code", identifier).maybeSingle();
      }
    }
    const { data: customer, error: customerError } = customerResult;

    if (customerError || !customer) return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    if (!await canAccessBusiness(customer.business_id)) {
      return NextResponse.json({ error: "No tenés permisos para operar sobre este comercio." }, { status: 403 });
    }

    // 1. Buscá el comercio y la tarjeta activa del cliente
    const { data: business } = await supabase
      .from("businesses")
      .select("id, active, reward_target, reward_description")
      .eq("id", customer.business_id)
      .maybeSingle();

    if (!business || business.active === false) {
      return NextResponse.json({ error: "El negocio está inactivo." }, { status: 400 });
    }

    const maxStamps = Number(business.reward_target) || 10;
    const currentStamps = Number(customer.current_stamps) || 0;

    // 2. Si stamps < max_stamps: sumá stamps + 1.
    // 3. Si stamps === max_stamps (la tarjeta estaba llena):
    //    - Reseteá stamps a 1 (comenzando el nuevo ciclo con el sello recién escaneado).
    //    - (Opcional/Recomendado) Sumá +1 a un contador de rewards_available si existe esa columna.
    const isFull = currentStamps >= maxStamps;
    const newStamps = isFull ? 1 : currentStamps + 1;

    const now = new Date().toISOString();
    const updateCustomerPayload: Record<string, any> = {
      current_stamps: newStamps,
      total_visits: (Number(customer.total_visits) || 0) + 1,
      last_visit_at: now,
      updated_at: now,
    };

    if (isFull && customer.rewards_available !== undefined && typeof customer.rewards_available === "number") {
      updateCustomerPayload.rewards_available = (customer.rewards_available || 0) + 1;
    }

    // Actualización segura de customers mediante UPDATE (sin crear registros duplicados)
    const { error: updateCustomerError } = await supabase
      .from("customers")
      .update(updateCustomerPayload)
      .eq("id", customer.id);

    if (updateCustomerError) {
      console.error("Error al actualizar cliente en customers:", updateCustomerError);
      throw updateCustomerError;
    }

    // Actualizar la tarjeta activa en loyalty_cards
    const { data: loyaltyCard } = await supabase
      .from("loyalty_cards")
      .select("*")
      .eq("customer_id", customer.id)
      .eq("business_id", customer.business_id)
      .maybeSingle();

    if (loyaltyCard) {
      const updateCardPayload: Record<string, any> = {
        current_stamps: newStamps,
        updated_at: now,
      };
      if (isFull && loyaltyCard.rewards_available !== undefined && typeof loyaltyCard.rewards_available === "number") {
        updateCardPayload.rewards_available = (loyaltyCard.rewards_available || 0) + 1;
      }
      await supabase
        .from("loyalty_cards")
        .update(updateCardPayload)
        .eq("id", loyaltyCard.id);
    } else {
      await supabase
        .from("loyalty_cards")
        .upsert({
          customer_id: customer.id,
          business_id: customer.business_id,
          current_stamps: newStamps,
          wallet_status: "ACTIVE",
          updated_at: now,
        }, { onConflict: "customer_id,business_id" });
    }

    // Registrar en stamp_logs
    await supabase.from("stamp_logs").insert({
      customer_id: customer.id,
      business_id: customer.business_id,
      method: method,
      stamps_added: 1,
      idempotency_key: request.headers.get("x-idempotency-key") || crypto.randomUUID(),
    });

    // Notificar a los dispositivos Apple Wallet y Google Wallet registrados
    scheduleCustomerWalletUpdate({
      customerId: customer.id,
      businessId: customer.business_id,
      currentStamps: newStamps,
      targetStamps: maxStamps,
      notificationMessage: isFull
        ? `¡Tarjeta completada! Comenzaste un nuevo ciclo con 1 de ${maxStamps} sellos.`
        : `¡Sumaste sellos! Llevás ${newStamps} de ${maxStamps}.`,
    });

    return NextResponse.json({
      success: true,
      newTotal: newStamps,
      cycleCompleted: isFull,
      message: isFull
        ? "¡Tarjeta completada! Comenzó un nuevo ciclo con 1 sello."
        : "Sello sumado correctamente.",
    });
  } catch (error) {
    console.error("Error adding stamp:", error);
    return NextResponse.json({ error: "No se pudo sumar el sello." }, { status: 500 });
  }
}
