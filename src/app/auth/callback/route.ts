import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function resolveBaseUrl(request: NextRequest, origin: string): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";
  if (!isLocalEnv && forwardedHost) {
    return `https://${forwardedHost}`;
  }
  return origin;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const baseUrl = resolveBaseUrl(request, origin);

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Manejo silencioso para contextos de solo lectura
            }
          },
        },
      }
    );

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && sessionData?.user) {
      const user = sessionData.user;
      const adminSupabase: any = createAdminClient();
      const normalizedEmail = (user.email || "").trim().toLowerCase();

      // 1. Consultar la tabla admin_whitelist por el email del usuario logueado
      if (normalizedEmail) {
        const { data: whitelistEntry } = await adminSupabase
          .from("admin_whitelist")
          .select("id, email")
          .ilike("email", normalizedEmail)
          .limit(1)
          .maybeSingle();

        if (whitelistEntry) {
          return NextResponse.redirect(`${baseUrl}/admin`);
        }
      }

      // 2. Verificar si el usuario está vinculado a un comercio activo en business_members
      const { data: memberships } = await adminSupabase
        .from("business_members")
        .select("business_id, businesses(id, slug, active)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      const activeMembership = (memberships || []).find((m: any) => {
        const biz = Array.isArray(m.businesses) ? m.businesses[0] : m.businesses;
        return biz && biz.active !== false;
      });

      if (activeMembership) {
        const biz = Array.isArray(activeMembership.businesses)
          ? activeMembership.businesses[0]
          : activeMembership.businesses;
        const targetBusinessId = biz?.id || activeMembership.business_id;
        return NextResponse.redirect(`${baseUrl}/comercio/${targetBusinessId}`);
      }

      // 3. Usuario no registrado o sin comercio activo: cerrar sesión y redirigir con error amigable
      await supabase.auth.signOut();
      return NextResponse.redirect(`${baseUrl}/login?error=unregistered`);
    }
  }

  return NextResponse.redirect(`${baseUrl}/login?error=oauth_error`);
}
