import { redirect } from "next/navigation";
import { getCurrentAccess } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminShell from "./admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getCurrentAccess();

  if (!access.user) {
    redirect("/login");
  }

  if (access.role !== "superadmin") {
    const supabase: any = createAdminClient();
    const { data: membership } = await supabase
      .from("business_members")
      .select("business_id")
      .eq("user_id", access.user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!membership?.business_id) {
      return (
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-semibold">Acceso Denegado</h1>
            <p className="mt-2 text-sm text-gray-500">
              Tu usuario no tiene ningún comercio asociado.
            </p>
          </div>
        </div>
      );
    }
  }

  return <AdminShell>{children}</AdminShell>;
}
