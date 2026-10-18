import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MerchantPromotionsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/comercio/${businessId}/automatizaciones`);
}
