import { redirect } from "next/navigation";

export default async function MerchantMetricasRedirect({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/comercio/${businessId}`);
}
