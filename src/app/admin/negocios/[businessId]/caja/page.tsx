import { redirect } from "next/navigation";

export default async function NegocioCajaRedirectPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/admin/caja?businessId=${encodeURIComponent(businessId)}`);
}
