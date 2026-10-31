import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AppRole = "superadmin" | "merchant" | "staff";

export function getPanelRedirect(value?: string | null): string | null {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\s]/.test(value)) return null;
  try {
    const url = new URL(value, "https://mimo.invalid");
    if (url.origin !== "https://mimo.invalid") return null;
    if (/%(?:2f|5c|25)/i.test(url.pathname)) return null;
    const pathname = decodeURIComponent(url.pathname);
    if (!/^\/(admin|comercio|caja)(\/|$)/.test(pathname) || /[\\\s]/.test(pathname)) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export async function getUserRole(supabase: SupabaseClient, user: Pick<User, "id" | "email">): Promise<AppRole | null> {
  if (user.email?.trim()) {
    const { data, error } = await supabase.from("admin_whitelist").select("id")
      .ilike("email", user.email.trim().toLowerCase().replace(/[\\%_]/g, "\\$&")).limit(1).maybeSingle();
    if (!error && data) return "superadmin";
    // Older installations may not have admin_whitelist yet. Preserve profile permissions.
    if (error && error.code !== "PGRST205" && error.code !== "42P01") throw error;
  }
  const { data, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (error) throw error;
  return ["superadmin", "merchant", "staff"].includes(data?.role) ? data.role as AppRole : null;
}

export async function getLoginDestination(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "email">,
  next?: string | null,
): Promise<string | null> {
  const role = await getUserRole(supabase, user);
  const requested = getPanelRedirect(next);
  if (role === "superadmin") return requested || "/admin";
  const { data, error } = await supabase.from("business_members")
    .select("business_id, businesses(id, active)").eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const memberships = (data || []).filter((membership) => {
    const business = Array.isArray(membership.businesses) ? membership.businesses[0] : membership.businesses;
    return business && business.active !== false;
  });
  if (!memberships.length) return "/#acceso";
  if (requested && memberships.some(({ business_id }) => {
    const path = new URL(requested, "https://mimo.invalid").pathname;
    return path === `/comercio/${business_id}` || path.startsWith(`/comercio/${business_id}/`);
  })) return requested;
  return `/comercio/${memberships[0].business_id}`;
}
