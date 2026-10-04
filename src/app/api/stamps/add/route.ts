import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessBusiness } from "@/lib/authz";

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
    const customerQuery = supabase
      .from("customers")
      .select("id, business_id")
      .limit(1);
    const { data: customer, error: customerError } = UUID_PATTERN.test(identifier)
      ? await customerQuery.eq("id", identifier).maybeSingle()
      : await customerQuery.eq("unique_code", identifier).maybeSingle();

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

    // Sync with Google Wallet in background
    try {
      const { updateLoyaltyPoints } = await import('@/lib/wallet/googleWallet');
      updateLoyaltyPoints(customer.id, result.current_stamps).catch(err => {
        console.error("Google Wallet Sync Error:", err);
      });
    } catch (importErr) {
      console.error("Google Wallet service missing:", importErr);
    }

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
