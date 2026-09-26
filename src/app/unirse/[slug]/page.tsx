import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ClientForm from './ClientForm';

export default async function UnirseSlugPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const supabase = await createClient();

    const { data: business } = await supabase
        .from('businesses')
        .select('id, name, logo_url, reward_target, reward_description')
        .eq('slug', slug)
        .single();

    if (!business) {
        notFound();
    }

    return <ClientForm business={business} />;
}
