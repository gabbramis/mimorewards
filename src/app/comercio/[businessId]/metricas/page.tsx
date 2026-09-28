import MetricsDashboard from "@/app/admin/metricas/page";

export default async function MerchantMetricsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return <MetricsDashboard businessId={businessId} merchantMode />;
}
