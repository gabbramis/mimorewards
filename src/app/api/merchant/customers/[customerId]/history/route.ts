import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessBusiness } from "@/lib/authz";
import { isPlanFree } from "@/contexts/BusinessContext";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId")?.trim() || "";

    if (!customerId || !businessId) {
      return NextResponse.json(
        { error: "Faltan parámetros requeridos (customerId, businessId)." },
        { status: 400 }
      );
    }

    if (!(await canAccessBusiness(businessId))) {
      return NextResponse.json(
        { error: "No tenés permisos para consultar este comercio." },
        { status: 403 }
      );
    }

    const supabase: any = createAdminClient();

    const { data: business } = await supabase
      .from("businesses")
      .select("id, plan_type, plan, reward_description")
      .eq("id", businessId)
      .maybeSingle();

    if (!business) {
      return NextResponse.json({ error: "Comercio no encontrado." }, { status: 404 });
    }

    const effectivePlan =
      business.plan_type && !isPlanFree(business.plan_type)
        ? business.plan_type
        : business.plan || business.plan_type;

    if (isPlanFree(effectivePlan)) {
      return NextResponse.json(
        {
          error:
            "El historial detallado de clientes es una función exclusiva de los planes Pro y Premium",
          locked: true,
        },
        { status: 403 }
      );
    }

    const { data: logs, error: logsError } = await supabase
      .from("stamp_logs")
      .select("id, customer_id, business_id, method, stamps_added, metadata, created_at")
      .eq("customer_id", customerId)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (logsError) {
      console.error("[Customer History API] Error fetching stamp_logs:", logsError);
      return NextResponse.json(
        { error: "No se pudo obtener el historial del cliente." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      logs: logs || [],
      rewardDescription: business.reward_description || "Premio",
    });
  } catch (error: any) {
    console.error("[Customer History API] Unexpected error:", error);
    return NextResponse.json(
      { error: error?.message || "Error interno del servidor." },
      { status: 500 }
    );
  }
}

