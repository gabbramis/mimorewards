import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AppRole = "superadmin" | "merchant" | "staff";

export async function getCurrentAccess() {
  const sessionClient = await createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return { user: null, role: null as AppRole | null };

  const supabase: any = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return { user, role: (profile?.role || null) as AppRole | null };
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
