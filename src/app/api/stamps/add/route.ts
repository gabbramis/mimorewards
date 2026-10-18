import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessBusiness } from "@/lib/authz";
import { notifyCustomerWalletUpdate } from "@/lib/wallet-notifications";

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
      .select("id, business_id")
      .limit(1);

    if (businessId) {
      customerQuery = customerQuery.eq("business_id", businessId);
    }

    let customerResult;
    if (UUID_PATTERN.test(identifier)) {
      customerResult = await customerQuery.eq("id", identifier).maybeSingle();
    } else if (businessId) {
      customerResult = await customerQuery.or(`unique_code.eq.${identifier},phone.eq.${identifier}`).maybeSingle();
    } else {
      customerResult = await customerQuery.eq("unique_code", identifier).maybeSingle();
    }
    const { data: customer, error: customerError } = customerResult;

    if (customerError || !customer) return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    if (!await canAccessBusiness(customer.business_id)) {
      return NextResponse.json({ error: "No tenés permisos para operar sobre este comercio." }, { status: 403 });
    }

    const { data, error } = await supabase.rpc("record_loyalty_stamp", {
      p_customer_id: customer.id,
      p_business_id: customer.business_id,
      p_method: method,
      p_idempotency_key: request.headers.get("x-idempotency-key") || crypto.randomUUID(),
      p_cooldown_minutes: 180,
      p_enforce_cooldown: false,
    });
    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.accepted) {
      const messages: Record<string, string> = {
        business_inactive: "El negocio está inactivo.",
        reward_pending: "La recompensa ya está disponible para canjear.",
      };
      return NextResponse.json({ error: messages[result?.reason] || "No se pudo sumar el sello.", reason: result?.reason }, { status: 409 });
    }

    // Notificar a los dispositivos Apple Wallet y Google Wallet registrados
    notifyCustomerWalletUpdate({
      customerId: customer.id,
      businessId: customer.business_id,
      currentStamps: result.current_stamps,
      targetStamps: result.target_stamps,
      notificationMessage: `¡Sumaste sellos! Llevás ${result.current_stamps} de ${result.target_stamps}.`,
    }).catch((pushErr) => {
      console.error("[Wallet Notifications] Error triggering wallet push:", pushErr);
    });

    return NextResponse.json({
      success: true,
      newTotal: result.current_stamps,
      message: "Sello sumado correctamente.",
    });
  } catch (error) {
    console.error("Error adding stamp:", error);
    return NextResponse.json({ error: "No se pudo sumar el sello." }, { status: 500 });
  }
}
