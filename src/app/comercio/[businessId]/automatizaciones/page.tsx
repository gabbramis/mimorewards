import Link from 'next/link';

export default async function Page({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return <section className="rounded-2xl border border-[#D5CFC4] bg-white p-6 space-y-4">
    <h1 className="text-2xl font-bold">Comunicaciones en preparación</h1>
    <p className="text-sm text-[#737373]">Estamos validando las tarjetas y la cercanía con un negocio piloto. Los envíos promocionales y las automatizaciones estarán disponibles en una próxima etapa.</p>
    <Link href={`/comercio/${businessId}`} className="inline-block text-sm font-semibold text-[#FF1F2D]">Volver al panel</Link>
  </section>;
}
