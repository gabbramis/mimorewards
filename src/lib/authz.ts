import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unstable_rethrow } from "next/navigation";

export type AppRole = "superadmin" | "merchant" | "staff";

const MIMO_ADMIN_EMAILS = new Set([
  "creator@mimorewards.com",
  "contactomimorewards@gmail.com",
]);

export function isMimoAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (MIMO_ADMIN_EMAILS.has(normalized) || normalized.endsWith("@mimorewards.com")) {
    return true;
  }
  const extraEmails = (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return extraEmails.includes(normalized);
}

export async function getCurrentAccess() {
  try {
    const sessionClient = await createClient();
    const { data: { user }, error } = await sessionClient.auth.getUser();
    if (error || !user) return { user: null, role: null as AppRole | null };

    if (isMimoAdminEmail(user.email)) {
      return { user, role: "superadmin" as AppRole };
    }

    const supabase: any = createAdminClient();
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
  return access.role === "superadmin" || isMimoAdminEmail(access.user?.email);
}

export async function canAccessBusiness(businessId: string) {
  const access = await getCurrentAccess();
  if (!access.user) return false;
  if (access.role === "superadmin" || isMimoAdminEmail(access.user.email)) return true;

  const supabase: any = createAdminClient();
  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", access.user.id)
    .eq("business_id", businessId)
    .maybeSingle();

  return Boolean(membership);
}
