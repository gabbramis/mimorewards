import CommunicationsPage from '@/components/merchant/CommunicationsPage';

export default async function Page({ params }: { params: Promise<{ businessId: string; section?: string[] }> }) {
  const { businessId, section } = await params;
  return <CommunicationsPage businessId={businessId} segments={section} />;
}
