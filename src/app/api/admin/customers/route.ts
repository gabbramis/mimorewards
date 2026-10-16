import { NextResponse } from "next/server";
import { getCurrentAccess } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { user, role } = await getCurrentAccess();
  if (!user) {
    return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  }

  try {
    const supabase: any = createAdminClient();
    const businessId = new URL(request.url).searchParams.get("businessId");
    let allowedBusinessIds: string[] | null = null;

    if (role !== "superadmin") {
      const { data: memberships, error: membershipError } = await supabase
        .from("business_members")
        .select("business_id")
        .eq("user_id", user.id);
      if (membershipError) throw membershipError;
      allowedBusinessIds = (memberships ?? []).map((member) => member.business_id);
    }

    if (businessId && allowedBusinessIds && !allowedBusinessIds.includes(businessId)) {
      return NextResponse.json({ error: "No tenés acceso a este comercio." }, { status: 403 });
    }
    if (allowedBusinessIds?.length === 0) {
      return NextResponse.json({ error: "No tenés comercios asociados." }, { status: 403 });
    }

    let query = supabase
      .from("customers")
      .select("id, unique_code, business_id, first_name, last_name, phone, birthdate, current_stamps, total_visits, last_visit_at, created_at, whatsapp_marketing_opt_in")
      .order("created_at", { ascending: false });
    if (businessId) query = query.eq("business_id", businessId);
    else if (allowedBusinessIds) query = query.in("business_id", allowedBusinessIds);

    const { data, error } = await query;
    if (error) throw error;

    // This database does not expose a customers → businesses foreign key to PostgREST.
    const businessIds = [...new Set((data ?? []).map((customer: { business_id: string | null }) => customer.business_id).filter(Boolean))];
    const rewardTargets = new Map<string, number | null>();
    if (businessIds.length > 0) {
      const { data: businesses, error: businessError } = await supabase
        .from("businesses")
        .select("id, reward_target")
        .in("id", businessIds);
      if (businessError) throw businessError;
      for (const business of businesses ?? []) rewardTargets.set(business.id, business.reward_target);
    }

    const customers = (data ?? []).map((customer: { business_id: string | null }) => ({
      ...customer,
      businesses: { reward_target: rewardTargets.get(customer.business_id ?? "") ?? 10 },
    }));

    return NextResponse.json({ customers }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la lista de clientes." },
      { status: 500 },
    );
  }
}
