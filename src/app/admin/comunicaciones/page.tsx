import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentAccess } from '@/lib/authz';
import { walletLocationClient } from '@/lib/wallet/location-database';

export default async function CommunicationsIndex() {
  const access = await getCurrentAccess();
  if (access.role !== 'superadmin') redirect('/admin');
  const { data: businesses, error } = await walletLocationClient().from('businesses')
    .select('id, name, slug, active').order('name');
  return <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
    <div><p className="text-xs font-bold uppercase tracking-widest text-[#FF1F2D]">mimo / comunicaciones</p><h1 className="mt-2 text-3xl font-bold">Comunicaciones</h1><p className="mt-2 text-sm text-[#737373]">Seleccioná un negocio para supervisar y configurar su piloto de cercanía.</p></div>
    {error ? <p role="alert">No se pudieron cargar los negocios.</p> : <div className="grid gap-4 sm:grid-cols-2">{(businesses ?? []).map((business) => <Link key={business.id} href={`/admin/negocios/${business.id}/comunicaciones/geolocalizacion`} className="rounded-2xl border border-[#D5CFC4] bg-white p-6 hover:border-[#FF1F2D]">
      <h2 className="font-bold">{business.name}</h2><p className="mt-2 text-sm text-[#737373]">{business.active ? 'Negocio activo' : 'Negocio inactivo'}{business.slug === 'coffe-dreams' ? ' · Piloto propuesto' : ''}</p><p className="mt-4 text-sm font-semibold text-[#FF1F2D]">Configurar ubicaciones →</p>
    </Link>)}</div>}
  </div>;
}
