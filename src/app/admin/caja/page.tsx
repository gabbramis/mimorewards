import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminCajaQrClient from "./AdminCajaQrClient";

export const dynamic = "force-dynamic";

export default async function AdminCajaQrPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    redirect("/login");
  }

  return <AdminCajaQrClient />;
}
