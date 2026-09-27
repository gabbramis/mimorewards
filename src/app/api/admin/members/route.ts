import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperadmin } from "@/lib/authz";

async function requireSuperadmin() {
  const sessionClient = await createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 }) };
  if (!await isSuperadmin()) return { error: NextResponse.json({ error: "No tenés permisos para administrar accesos." }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const guard = await requireSuperadmin();
  if (guard.error) return guard.error;

  try {
    const supabase: any = createAdminClient();
    const [{ data: usersData, error: usersError }, { data: businesses, error: businessesError }, { data: profiles, error: profilesError }, { data: members, error: membersError }] = await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabase.from("businesses").select("id, name, active").order("name"),
      supabase.from("profiles").select("id, role, display_name"),
      supabase.from("business_members").select("user_id, business_id, role"),
    ]);

    const error = usersError || businessesError || profilesError || membersError;
    if (error) throw error;

    const profileMap = new Map<string, any>((profiles || []).map((profile: any) => [profile.id, profile]));
    const businessMap = new Map<string, any>((businesses || []).map((business: any) => [business.id, business]));
    const memberMap = new Map<string, any[]>();

    for (const member of members || []) {
      const current = memberMap.get(member.user_id) || [];
      const business = businessMap.get(member.business_id);
      if (business) current.push({ ...member, businessName: business.name, businessActive: business.active });
      memberMap.set(member.user_id, current);
    }

    const users = (usersData?.users || []).map((user: any) => ({
      id: user.id,
      email: user.email || "Sin email",
      createdAt: user.created_at,
      profile: profileMap.get(user.id) || null,
      memberships: memberMap.get(user.id) || [],
    }));

    return NextResponse.json({ users, businesses: businesses || [] });
  } catch (error: any) {
    console.error("Admin members GET error:", error);
    return NextResponse.json({ error: error?.message || "No se pudieron cargar los accesos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const guard = await requireSuperadmin();
  if (guard.error) return guard.error;

  try {
    const body = await request.json();
    const userId = String(body.userId || "").trim();
    const businessId = String(body.businessId || "").trim();
    const role = body.role === "staff" ? "staff" : "merchant";
    const displayName = String(body.displayName || "").trim() || null;

    if (!userId || !businessId) {
      return NextResponse.json({ error: "Seleccioná un usuario y un negocio." }, { status: 400 });
    }

    const supabase: any = createAdminClient();
    const [{ data: authUser, error: authError }, { data: business, error: businessError }] = await Promise.all([
      supabase.auth.admin.getUserById(userId),
      supabase.from("businesses").select("id").eq("id", businessId).maybeSingle(),
    ]);

    if (authError || !authUser?.user) return NextResponse.json({ error: "El usuario no existe en Authentication." }, { status: 404 });
    if (businessError || !business) return NextResponse.json({ error: "El negocio no existe." }, { status: 404 });

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      role,
      display_name: displayName,
    }, { onConflict: "id" });
    if (profileError) throw profileError;

    const { error: memberError } = await supabase.from("business_members").upsert({
      user_id: userId,
      business_id: businessId,
      role,
    }, { onConflict: "user_id,business_id" });
    if (memberError) throw memberError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Admin members POST error:", error);
    return NextResponse.json({ error: error?.message || "No se pudo asignar el acceso." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const guard = await requireSuperadmin();
  if (guard.error) return guard.error;

  try {
    const body = await request.json();
    const userId = String(body.userId || "").trim();
    const businessId = String(body.businessId || "").trim();
    if (!userId || !businessId) return NextResponse.json({ error: "Falta el usuario o el negocio." }, { status: 400 });

    const supabase: any = createAdminClient();
    const { error } = await supabase.from("business_members").delete().eq("user_id", userId).eq("business_id", businessId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Admin members DELETE error:", error);
    return NextResponse.json({ error: error?.message || "No se pudo quitar el acceso." }, { status: 500 });
  }
}
