import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminShell from "./admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getCurrentAccess();
  if (!access.user) redirect("/login");
  if (access.role !== "superadmin") {
    const supabase: any = createAdminClient();
    const { data: membership } = await supabase
      .from("business_members")
      .select("business_id")
      .eq("user_id", access.user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membership?.business_id) {
      redirect(`/comercio/${membership.business_id}/metricas`);
    }

    redirect("/login");
  }

  return <AdminShell>{children}</AdminShell>;
}
