import { createBrowserClient } from '@supabase/ssr';

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      console.error('Supabase client: NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY no están definidos.');
      return null as any;
    }

    try {
      client = createBrowserClient(url, key);
    } catch (err) {
      console.error('Error instanciando createBrowserClient:', err);
      return null as any;
    }
  }
  return client;
}
