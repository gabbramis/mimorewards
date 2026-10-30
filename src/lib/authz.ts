import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unstable_rethrow } from "next/navigation";

export type AppRole = "superadmin" | "merchant" | "staff";

export async function isEmailInAdminWhitelist(
  email?: string | null,
  supabaseClient?: any
): Promise<boolean> {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  const supabase: any = supabaseClient || createAdminClient();
  const { data } = await supabase
    .from("admin_whitelist")
    .select("id")
    .ilike("email", normalized)
    .limit(1)
    .maybeSingle();

  return Boolean(data);
}

export async function getCurrentAccess() {
  try {
    const sessionClient = await createClient();
    const {
      data: { user },
      error,
    } = await sessionClient.auth.getUser();
    if (error || !user) return { user: null, role: null as AppRole | null };

    const supabase: any = createAdminClient();

    const whitelisted = await isEmailInAdminWhitelist(user.email, supabase);
    if (whitelisted) {
      return { user, role: "superadmin" as AppRole };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    return { user, role: (profile?.role || null) as AppRole | null };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Error al obtener sesión en getCurrentAccess:", err);
    return { user: null, role: null as AppRole | null };
  }
}

export async function isSuperadmin() {
  const access = await getCurrentAccess();
  return access.role === "superadmin";
}

export async function canAccessBusiness(businessId: string) {
  const access = await getCurrentAccess();
  if (!access.user) return false;
  if (access.role === "superadmin") return true;

  const supabase: any = createAdminClient();
  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", access.user.id)
    .eq("business_id", businessId)
    .maybeSingle();

  return Boolean(membership);
}
