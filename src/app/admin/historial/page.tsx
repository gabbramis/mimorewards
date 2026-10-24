import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

interface PageProps {
  searchParams: Promise<{ businessId?: string }>;
}

export default async function AdminHistorialPage({ searchParams }: PageProps) {
  const { businessId } = await searchParams;
  if (businessId) {
    redirect(`/comercio/${businessId}/historial`);
  }

  const supabase: any = createAdminClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (business?.id) {
    redirect(`/comercio/${business.id}/historial`);
  }

  redirect("/admin/negocios");
}
