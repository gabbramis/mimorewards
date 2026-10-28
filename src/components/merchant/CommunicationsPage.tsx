import { notFound } from 'next/navigation';
import { getWalletLocationAccess } from '@/lib/wallet/location-store';
import CommunicationsClient from './CommunicationsClient';

export default async function CommunicationsPage({ businessId, segments, admin = false }: {
  businessId: string; segments?: string[]; admin?: boolean;
}) {
  const access = await getWalletLocationAccess(businessId);
  if (!access.allowed || (admin && !access.superadmin)) notFound();
  const section = segments?.[0] ?? 'resumen';
  if ((segments?.length ?? 0) > 1 || !['resumen', 'campanas', 'automatizaciones', 'geolocalizacion', 'historial', 'configuracion'].includes(section)) notFound();
  const basePath = admin ? `/admin/negocios/${businessId}/comunicaciones` : `/comercio/${businessId}/comunicaciones`;
  return <div className={admin ? 'mx-auto max-w-7xl p-4 sm:p-8' : ''}><CommunicationsClient key={businessId} businessId={businessId} section={section} basePath={basePath} /></div>;
}
