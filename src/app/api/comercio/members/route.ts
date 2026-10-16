import { NextResponse } from "next/server";
import { getCurrentAccess, canAccessBusiness } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const { user } = await getCurrentAccess();
    if (!user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    if (!businessId || !(await canAccessBusiness(businessId))) {
      return NextResponse.json(
        { error: "No tenés acceso a este comercio." },
        { status: 403 }
      );
    }

    const supabase: any = createAdminClient();

    const [
      { data: members, error: membersError },
      { data: profiles, error: profilesError },
      { data: usersData, error: usersError },
    ] = await Promise.all([
      supabase
        .from("business_members")
        .select("user_id, business_id, role, created_at")
        .eq("business_id", businessId),
      supabase.from("profiles").select("id, role, display_name"),
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    if (membersError) throw membersError;

    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.id, p])
    );
    const userMap = new Map<string, any>(
      (usersData?.users || []).map((u: any) => [u.id, u])
    );

    const team = (members || []).map((m: any) => {
      const u: any = userMap.get(m.user_id);
      const p: any = profileMap.get(m.user_id);

      return {
        userId: m.user_id,
        email: u?.email || "Sin email",
        displayName: p?.display_name || u?.user_metadata?.full_name || null,
        role: m.role || "staff",
        createdAt: m.created_at,
        isCurrentUser: m.user_id === user.id,
      };
    });

    return NextResponse.json({ members: team });
  } catch (err: any) {
    console.error("Error fetching members:", err);
    return NextResponse.json(
      { error: err.message || "Error al listar miembros." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await getCurrentAccess();
    if (!user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const { businessId, email, role, password, displayName } = body;

    if (!businessId || !(await canAccessBusiness(businessId))) {
      return NextResponse.json(
        { error: "No tenés acceso a este comercio." },
        { status: 403 }
      );
    }

    const targetEmail = String(email || "").trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes("@")) {
      return NextResponse.json(
        { error: "Ingresá un correo electrónico válido." },
        { status: 400 }
      );
    }

    const memberRole = role === "merchant" ? "merchant" : "staff";
    const supabase: any = createAdminClient();

    // Buscar si el usuario ya existe en Supabase Auth
    const { data: usersData } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    let targetUser = (usersData?.users || []).find(
      (u: any) => u.email?.toLowerCase() === targetEmail
    );

    // Si no existe y se provee password, crearlo
    if (!targetUser) {
      const targetPassword = password || `Mimo${Math.random().toString(36).slice(-8)}!`;
      const { data: newUser, error: createError } =
        await supabase.auth.admin.createUser({
          email: targetEmail,
          password: targetPassword,
          email_confirm: true,
          user_metadata: { full_name: displayName || targetEmail.split("@")[0] },
        });

      if (createError) {
        return NextResponse.json(
          { error: `No se pudo crear el usuario: ${createError.message}` },
          { status: 400 }
        );
      }
      targetUser = newUser.user;

      // Crear perfil si no existe
      if (targetUser) {
        await supabase.from("profiles").upsert({
          id: targetUser.id,
          role: memberRole,
          display_name: displayName || targetEmail.split("@")[0],
        });
      }
    }

    if (!targetUser) {
      return NextResponse.json(
        { error: "No se pudo identificar al usuario." },
        { status: 400 }
      );
    }

    // Vincular a business_members
    const { error: insertError } = await supabase
      .from("business_members")
      .upsert({
        user_id: targetUser.id,
        business_id: businessId,
        role: memberRole,
      });

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      message: `Usuario ${targetEmail} vinculado como ${memberRole === "merchant" ? "Administrador" : "Personal de mostrador"}.`,
    });
  } catch (err: any) {
    console.error("Error assigning member:", err);
    return NextResponse.json(
      { error: err.message || "Error al vincular miembro." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await getCurrentAccess();
    if (!user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const targetUserId = searchParams.get("userId");

    if (!businessId || !(await canAccessBusiness(businessId))) {
      return NextResponse.json(
        { error: "No tenés acceso a este comercio." },
        { status: 403 }
      );
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Falta el ID del usuario a desvincular." },
        { status: 400 }
      );
    }

    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: "No podés removerte a vos mismo de tu comercio." },
        { status: 400 }
      );
    }

    const supabase: any = createAdminClient();
    const { error } = await supabase
      .from("business_members")
      .delete()
      .eq("business_id", businessId)
      .eq("user_id", targetUserId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Acceso revocado correctamente.",
    });
  } catch (err: any) {
    console.error("Error removing member:", err);
    return NextResponse.json(
      { error: err.message || "Error al desvincular miembro." },
      { status: 500 }
    );
  }
}
